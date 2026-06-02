/**
 * Bulk-upload supervisor primitives.
 *
 * The old model was *choreographed*: each worker, on finishing, enqueued the
 * next job in the batch. A single dropped message (e.g. a job orphaned between
 * Phase 1 returning and Phase 2 starting) stalled the whole batch forever,
 * because nothing reconciled desired vs. actual state.
 *
 * The new model is *reconciled*: the database is the single source of truth and
 * a 1-minute cron (plus the bulk-upload entrypoint, opportunistically) calls:
 *
 *   reapStale()     — resume or fail jobs that stopped making progress
 *   dispatchReady() — start queued jobs up to a global concurrency cap
 *
 * Liveness no longer depends on the happy path: a lost message is recovered on
 * the next tick by re-deriving what should be running from the DB. Workers
 * receive a thin { jobId } and hydrate their inputs from `phase_payload`, so a
 * resume is a RESUME of the current phase, not a restart from scrape.
 */
import { and, asc, count, eq, inArray, isNotNull, lt, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { generationJobs } from '@/lib/db/schema';
import { enqueueTask, type TaskName } from '@/lib/queue';
import { env } from '@/lib/env';

// Arbitrary app-wide constant identifying the advisory lock that serializes
// batch dispatch. pg_advisory_xact_lock is transaction-scoped (released on
// COMMIT), so it is safe under PgBouncer transaction pooling — unlike
// session-level advisory locks, which leak across pooled connections.
const DISPATCH_LOCK_KEY = 4_727_001;

// A running job that hasn't bumped updated_at within this window is presumed
// dead. Must exceed the Vercel function timeout (60s Hobby cap) plus QStash's
// single-retry window so we never reap a worker that is legitimately still
// executing a slow substage or about to be retried by QStash. Each worker
// invocation bumps updated_at at its first step, so this is measured from the
// last sign of progress, not from job creation.
const LEASE_MS = 180_000; // 3 minutes

// Total dispatch attempts (initial + reaper resumes) before a stuck job is
// failed. attempts starts at 1, so this permits exactly one reaper resume:
// transient orphans recover on the first resume; genuinely poisoned jobs fail
// fast instead of being re-run forever (each enqueue already carries one
// QStash retry of its own).
const REAP_MAX_ATTEMPTS = 2;

function taskForPhase(phase: string): TaskName {
  return phase === 'author' ? 'author-design-md' : 'scrape-and-extract';
}

/**
 * Start queued batch jobs up to the global concurrency cap.
 *
 * Atomicity model:
 *   1. Inside a transaction, take a transaction-scoped advisory lock so
 *      overlapping dispatchers (cron tick, entrypoint, worker completions)
 *      can't each read the same `running` count and collectively over-claim.
 *   2. Claim the oldest queued jobs with FOR UPDATE SKIP LOCKED (row-level
 *      safety against any other tx touching the same rows) and CAS them to
 *      'running' in the same tx.
 *   3. AFTER commit, enqueue each job's worker. QStash latency is kept out of
 *      the lock window. A job that fails to enqueue is reverted to 'queued'
 *      for the next tick; if even the revert fails it stays 'running' and the
 *      reaper recovers it. A job is therefore never silently lost.
 */
export async function dispatchReady(): Promise<{ claimed: number }> {
  const cap = env.BULK_CONCURRENCY;

  const claimedJobs = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${DISPATCH_LOCK_KEY})`);

    const [runningRow] = await tx
      .select({ value: count() })
      .from(generationJobs)
      .where(and(eq(generationJobs.status, 'running'), isNotNull(generationJobs.batchId)));

    const slots = cap - Number(runningRow?.value ?? 0);
    if (slots <= 0) return [];

    const ready = await tx
      .select({ id: generationJobs.id, phase: generationJobs.phase })
      .from(generationJobs)
      .where(and(eq(generationJobs.status, 'queued'), isNotNull(generationJobs.batchId)))
      .orderBy(asc(generationJobs.createdAt))
      .limit(slots)
      .for('update', { skipLocked: true });

    if (ready.length === 0) return [];

    await tx
      .update(generationJobs)
      .set({ status: 'running', updatedAt: new Date() })
      .where(
        inArray(
          generationJobs.id,
          ready.map((r) => r.id),
        ),
      );

    return ready;
  });

  let claimed = 0;
  for (const job of claimedJobs) {
    try {
      await enqueueTask(taskForPhase(job.phase), { jobId: job.id });
      claimed++;
    } catch (err) {
      console.error(`[dispatchReady] enqueue failed for job ${job.id}; reverting to queued`, err);
      await db
        .update(generationJobs)
        .set({ status: 'queued', updatedAt: new Date() })
        .where(eq(generationJobs.id, job.id))
        .catch((revertErr) => {
          console.error(
            `[dispatchReady] revert failed for job ${job.id}; reaper will recover`,
            revertErr,
          );
        });
    }
  }

  return { claimed };
}

/**
 * Recover jobs that are 'running' but have stopped making progress (updated_at
 * older than the lease). Covers BOTH bulk-upload batch jobs and single-generate
 * jobs (batchId null) — a single generation whose worker was SIGKILLed mid-phase
 * (e.g. the author call overran the 60s Hobby cap before the in-process timeout
 * could abort it) would otherwise sit in `running` forever, since the happy-path
 * failJob never ran and dispatchReady only manages batch slots. For each:
 *   - attempts < REAP_MAX_ATTEMPTS  → resume: renew the lease, bump attempts,
 *     re-enqueue the worker for the job's CURRENT phase (a resume, using the
 *     persisted phase_payload — not a re-scrape).
 *   - otherwise                     → fail: surface the failure in the UI (and,
 *     for batch jobs, free the slot); the admin or user can retry manually.
 *
 * Every state change is CAS-guarded on (status='running' AND still stale) so we
 * never fight a worker that came back to life and renewed its own lease.
 */
export async function reapStale(): Promise<{ resumed: number; failed: number }> {
  const cutoff = new Date(Date.now() - LEASE_MS);

  const stale = await db
    .select({
      id: generationJobs.id,
      phase: generationJobs.phase,
      attempts: generationJobs.attempts,
    })
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.status, 'running'),
        // No batchId filter: single-generate jobs (batchId null) must be reaped
        // too, otherwise a SIGKILLed single generation hangs in `running`
        // forever (dispatchReady only refills batch slots, never single jobs).
        lt(generationJobs.updatedAt, cutoff),
      ),
    )
    .orderBy(asc(generationJobs.updatedAt));

  let resumed = 0;
  let failed = 0;

  for (const job of stale) {
    if (job.attempts < REAP_MAX_ATTEMPTS) {
      const [renewed] = await db
        .update(generationJobs)
        .set({ attempts: job.attempts + 1, updatedAt: new Date() })
        .where(
          and(
            eq(generationJobs.id, job.id),
            eq(generationJobs.status, 'running'),
            lt(generationJobs.updatedAt, cutoff),
          ),
        )
        .returning({ id: generationJobs.id });

      if (!renewed) continue; // a live worker renewed the lease first — leave it alone

      try {
        await enqueueTask(taskForPhase(job.phase), { jobId: job.id });
        resumed++;
      } catch (err) {
        // Lease + attempts are already bumped; the next tick retries. We avoid
        // failing here so a transient QStash blip doesn't kill a recoverable job.
        console.error(`[reapStale] re-enqueue failed for job ${job.id}`, err);
      }
    } else {
      const [failedRow] = await db
        .update(generationJobs)
        .set({
          status: 'failed',
          errorStep: 'supervisor-reap',
          errorMessage: `Stalled in phase '${job.phase}' past ${REAP_MAX_ATTEMPTS} dispatch attempts`,
          phasePayload: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(generationJobs.id, job.id),
            eq(generationJobs.status, 'running'),
            lt(generationJobs.updatedAt, cutoff),
          ),
        )
        .returning({ id: generationJobs.id });

      if (failedRow) failed++;
    }
  }

  return { resumed, failed };
}
