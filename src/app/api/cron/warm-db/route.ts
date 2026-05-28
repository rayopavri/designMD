/**
 * Cron endpoint — three jobs per tick:
 *   1. SELECT 1 to keep Neon out of its 5-min idle autosuspend.
 *   2. Expire stuck `running` jobs (worker SIGKILL'd without cleanup) and
 *      advance the next queued sibling in any affected batch.
 *   3. Repair orphaned batch queues — batches that still have queued jobs
 *      but no running job and no recent activity. Catches the edge case
 *      where step 2's advanceBatch threw (QStash blip) so the running row
 *      was marked failed but the chain never advanced.
 *
 * Triggered by GitHub Actions (Vercel Hobby crons are once-per-day now).
 * Auth: optional Bearer via CRON_SECRET env var.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { and, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { generationJobs } from '@/lib/db/schema';
import { advanceBatch } from '@/lib/generator/batch';

export const runtime = 'nodejs';
export const maxDuration = 15;

// Workers now have in-process timeouts (90s on Gemini, similar on Anthropic)
// that throw inside the try/catch so failJob runs and the row flips to
// `failed` within seconds. The watchdog is the last-resort fallback for
// the case where the worker dies before its catch runs (Vercel SIGKILL on
// maxDuration, OOM, etc.). Cron runs every 5 min so 2 min stale is the
// tightest cutoff that's safe — anything shorter races the cron interval.
const STUCK_JOB_AGE_MS = 2 * 60_000;

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const startedAt = Date.now();
  try {
    // 1. Warm Neon.
    const [row] = (await db.execute(sql`SELECT 1 AS ping`)) as Array<{ ping: number }>;

    // 2. Expire stuck jobs. Two cases sweep here, one case is excluded:
    //
    //    a) 'running' past STUCK_JOB_AGE_MS — worker died mid-pipeline
    //       (Vercel SIGKILL on maxDuration, OOM, etc.) so failJob never ran.
    //    b) 'queued' with no batchId past STUCK_JOB_AGE_MS — single-URL
    //       /generate job whose QStash dispatch was lost.
    //    c) (EXCLUDED) 'queued' WITH a batchId — bulk-upload submits N
    //       siblings sharing one batchId, all queued at the same instant;
    //       only the first is enqueued to QStash and advanceBatch chains
    //       the rest as each finishes. A 150-URL run takes ~7h, so any
    //       age-based sweep on queued+batchId destroys the entire batch
    //       within 2 min of submission. Batched queued rows are managed
    //       exclusively by advanceBatch (success path) and the
    //       unstick / retry-failed admin endpoints (manual recovery).
    const cutoff = new Date(Date.now() - STUCK_JOB_AGE_MS);
    const expired = await db
      .update(generationJobs)
      .set({
        status: 'failed',
        errorStep: 'watchdog',
        errorMessage: `Worker exceeded ${Math.round(STUCK_JOB_AGE_MS / 60_000)}min budget without status update`,
        updatedAt: new Date(),
      })
      .where(
        and(
          lt(generationJobs.updatedAt, cutoff),
          or(
            eq(generationJobs.status, 'running'),
            and(eq(generationJobs.status, 'queued'), isNull(generationJobs.batchId)),
          ),
        ),
      )
      .returning({ id: generationJobs.id, batchId: generationJobs.batchId });

    // When the cron kills a 'running' batch job, the in-process failJob
    // path that normally calls advanceBatch never ran (that's why the
    // cron had to step in). Kick the next sibling here so the rest of
    // the batch doesn't idle forever waiting for an advance that never
    // comes. Dedupe by batchId — sequential semantics mean at most one
    // running row per batch in a healthy state, but be defensive in case
    // a race produced more.
    const advancedBatches = new Set<string>();
    for (const job of expired) {
      if (!job.batchId || advancedBatches.has(job.batchId)) continue;
      advancedBatches.add(job.batchId);
      try {
        await advanceBatch(job.batchId);
      } catch (advErr) {
        console.error('[cron:warm-db] advanceBatch failed for batch', job.batchId, advErr);
      }
    }

    // 3. Repair orphaned batch queues. A batch is orphaned when it has queued
    //    jobs, no running job, and no activity for STUCK_JOB_AGE_MS. This
    //    happens when step 2's advanceBatch call throws: the expired running
    //    row gets marked failed but the chain never advances, and because
    //    queued+batchId rows are excluded from the expiry sweep above they
    //    sit idle forever. The same 2-min guard avoids false-triggering
    //    during the normal 8s QStash delivery window between advanceBatch
    //    and the next worker starting.
    const orphanRows = (await db.execute(
      sql`
        SELECT batch_id
        FROM generation_jobs
        WHERE batch_id IS NOT NULL
        GROUP BY batch_id
        HAVING
          COUNT(*) FILTER (WHERE status = 'queued') > 0
          AND COUNT(*) FILTER (WHERE status = 'running') = 0
          AND MAX(updated_at) < ${cutoff}
      `,
    )) as Array<{ batch_id: string }>;

    let repairedBatches = 0;
    for (const { batch_id } of orphanRows) {
      if (advancedBatches.has(batch_id)) continue;
      advancedBatches.add(batch_id);
      repairedBatches++;
      try {
        await advanceBatch(batch_id);
      } catch (advErr) {
        console.error('[cron:warm-db] orphan repair advanceBatch failed for batch', batch_id, advErr);
      }
    }

    const elapsedMs = Date.now() - startedAt;
    return NextResponse.json({
      ok: true,
      ping: row?.ping ?? null,
      expiredJobs: expired.length,
      advancedBatches: advancedBatches.size,
      repairedBatches,
      elapsedMs,
    });
  } catch (err) {
    console.error('[cron:warm-db] failed:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
