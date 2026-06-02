/**
 * Internal worker endpoint for Phase 2 of the pipeline: Sonnet authors
 * DESIGN.md, then lints + scores. The companion worker (Phase 3) is enqueued
 * by Phase 1 alongside this one and runs in parallel.
 *
 * The queue message is just { jobId }; runAuthorDesignMd hydrates brand /
 * markdown / bundleId from generation_jobs.phase_payload.
 *
 * Auth: assertTaskAuth handles both QStash signature (production) and
 * x-internal-task-token (local dev).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { assertTaskAuth } from '@/lib/queue';
import { runAuthorDesignMd } from '@/lib/generator/author-design-md';
import { db } from '@/lib/db/client';
import { generationJobs } from '@/lib/db/schema';
import { dispatchReady } from '@/lib/generator/batch';
import { perf } from '@/lib/generator/perf-log';

export const runtime = 'nodejs';
export const maxDuration = 300;

// Hard watchdog: mark the job failed before Vercel SIGKILLs the function.
// 290s leaves a 10s cleanup window inside the 300s Pro-plan maxDuration.
const WATCHDOG_MS = 290_000;

// The message is just { jobId }; the worker hydrates brand / markdown /
// bundleId from generation_jobs.phase_payload.
const PayloadSchema = z.object({
  jobId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  let rawPayload: unknown;
  try {
    rawPayload = await assertTaskAuth(req);
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }

  let parsed: z.infer<typeof PayloadSchema>;
  try {
    parsed = PayloadSchema.parse(rawPayload);
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid payload', details: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }

  let watchdogFired = false;
  const watchdog = new Promise<never>((_, reject) =>
    setTimeout(() => {
      watchdogFired = true;
      reject(new Error(`Worker watchdog: exceeded ${WATCHDOG_MS}ms budget`));
    }, WATCHDOG_MS).unref(),
  );

  const t0 = Date.now();
  try {
    await Promise.race([runAuthorDesignMd({ jobId: parsed.jobId }), watchdog]);
    perf('worker.author', 'done', Date.now() - t0, { jobId: parsed.jobId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    perf('worker.author', watchdogFired ? 'watchdog' : 'err', Date.now() - t0, {
      jobId: parsed.jobId,
    });
    console.error('[task:author-design-md] uncaught:', message);
    // If the watchdog fired, runAuthorDesignMd never reached its own failJob
    // path — mark the row failed AND refill the batch slot via dispatchReady
    // (otherwise the batch loses a concurrency slot until the supervisor cron
    // reaps it).
    //
    // The UPDATE is CAS-guarded on status='running': if runAuthorDesignMd
    // already committed a terminal status before the watchdog tripped (e.g.
    // the trailing await dispatchReady was the slow path, not the AI call),
    // the UPDATE affects zero rows and we DON'T dispatch here — the in-process
    // handler already refilled the slot. Without this guard the watchdog would
    // (a) flip completed → failed, (b) clobber a specific errorStep with
    // generic 'watchdog', (c) double-dispatch while the in-process
    // dispatchReady is still in flight.
    //
    // We read batchId back from the UPDATE's RETURNING (the queue message is
    // only { jobId } now): truthy → batch job, refill its slot; null →
    // single-generate, nothing to dispatch. Each DB call races a 3s timeout so
    // a hung DB can't hold us past maxDuration.
    if (watchdogFired) {
      let rows: { batchId: string | null }[] = [];
      try {
        rows = await Promise.race([
          db
            .update(generationJobs)
            .set({
              status: 'failed',
              errorStep: 'watchdog',
              errorMessage: message.slice(0, 1000),
              phasePayload: null,
              updatedAt: new Date(),
            })
            .where(and(eq(generationJobs.id, parsed.jobId), eq(generationJobs.status, 'running')))
            .returning({ batchId: generationJobs.batchId }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('failJob db timeout')), 3_000).unref(),
          ),
        ]);
      } catch (failErr) {
        console.error('[task:author-design-md] watchdog failJob failed:', failErr);
      }
      if (rows.length === 0) {
        console.warn(
          '[task:author-design-md] watchdog fired but row no longer running — skipping dispatch (in-process handler already terminated)',
        );
      } else if (rows[0].batchId) {
        try {
          await Promise.race([
            dispatchReady(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('dispatchReady timeout')), 3_000).unref(),
            ),
          ]);
        } catch (dispErr) {
          console.error('[task:author-design-md] watchdog dispatchReady failed:', dispErr);
        }
      }
      // else: single-generate job (batchId null) — nothing to dispatch.
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
