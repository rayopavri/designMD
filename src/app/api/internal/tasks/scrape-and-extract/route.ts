/**
 * Internal worker endpoint for the scrape-and-extract pipeline.
 *
 * Auth: assertTaskAuth handles both QStash signature (production) and
 * x-internal-task-token (local dev).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { assertTaskAuth } from '@/lib/queue';
import { runScrapeAndExtract } from '@/lib/generator/scrape-and-extract';
import { db } from '@/lib/db/client';
import { generationJobs } from '@/lib/db/schema';
import { dispatchReady } from '@/lib/generator/batch';
import { perf } from '@/lib/generator/perf-log';

// This route makes outbound HTTP calls (Firecrawl, Gemini) and writes
// to Postgres. It must run on the Node runtime, not edge.
export const runtime = 'nodejs';
export const maxDuration = 60;

// Hard watchdog: mark the job failed before Vercel SIGKILLs the function.
// Critical for bulk-upload batches — when a job hangs on Firecrawl (JS-heavy
// sites can stall the API), the SIGKILL prevents failJob() AND dispatchReady()
// from running, stranding the row in `running` and tying up a concurrency slot
// until the supervisor cron reaps it. We run on the Vercel Hobby plan (60s
// function cap — see TECH-STACK.md), so 54s leaves a ~6s cleanup window (the
// failJob UPDATE races a 3s timeout) before the platform kills us at 60s.
const WATCHDOG_MS = 54_000;

const PayloadSchema = z.object({
  jobId: z.string().uuid(),
  feedback: z.string().max(2000).optional(),
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
    await Promise.race([runScrapeAndExtract(parsed), watchdog]);
    perf('worker.scrape-and-extract', 'done', Date.now() - t0, { jobId: parsed.jobId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    perf('worker.scrape-and-extract', watchdogFired ? 'watchdog' : 'err', Date.now() - t0, {
      jobId: parsed.jobId,
    });
    console.error('[task:scrape-and-extract] uncaught:', message);
    // If the watchdog fired, runScrapeAndExtract never reached failJob —
    // mark the row failed AND refill the batch slot via dispatchReady
    // (otherwise the batch loses a concurrency slot until the supervisor cron
    // reaps it).
    //
    // The UPDATE is CAS-guarded on status='running': if runScrapeAndExtract
    // already committed a terminal status (its in-process failJob ran, or the
    // success path advanced to Phase 2) before the watchdog tripped, the
    // UPDATE affects zero rows and we DON'T dispatch here — the in-process
    // handler already did. Without this guard the watchdog would clobber a
    // specific errorStep with 'watchdog' AND double-dispatch.
    //
    // We read batchId back from RETURNING: truthy → batch job, refill its
    // slot; null → single-generate, nothing to dispatch; zero rows → already
    // terminal. Each DB call races a 3s timeout so a hung connection can't
    // hold us past maxDuration.
    if (watchdogFired) {
      const jobId = parsed.jobId;
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
            .where(and(eq(generationJobs.id, jobId), eq(generationJobs.status, 'running')))
            .returning({ batchId: generationJobs.batchId }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('failJob db timeout')), 3_000).unref(),
          ),
        ]);
      } catch (failErr) {
        console.error('[task:scrape-and-extract] watchdog failJob failed:', failErr);
      }
      if (rows.length === 0) {
        console.warn(
          '[task:scrape-and-extract] watchdog fired but row no longer running — skipping dispatch (in-process handler already terminated)',
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
          console.error('[task:scrape-and-extract] watchdog dispatchReady failed:', dispErr);
        }
      }
      // else: single-generate job (batchId null) — nothing to dispatch.
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
