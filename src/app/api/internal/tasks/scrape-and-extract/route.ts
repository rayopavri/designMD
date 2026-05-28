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
import { advanceBatch } from '@/lib/generator/batch';

// This route makes outbound HTTP calls (Firecrawl, Gemini) and writes
// to Postgres. It must run on the Node runtime, not edge.
export const runtime = 'nodejs';
export const maxDuration = 300;

// Hard watchdog: mark the job failed before Vercel SIGKILLs the function.
// Critical for bulk-upload batches — when a job hangs on Firecrawl (JS-heavy
// sites can stall the API), the SIGKILL prevents failJob() AND advanceBatch()
// from running, stranding the row in `running` and halting the whole batch.
// 290s leaves a 10s cleanup window inside the 300s Pro-plan maxDuration.
const WATCHDOG_MS = 290_000;

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

  try {
    await Promise.race([runScrapeAndExtract(parsed), watchdog]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[task:scrape-and-extract] uncaught:', message);
    // If the watchdog fired, runScrapeAndExtract never reached failJob —
    // mark the row failed AND kick the next batch job (otherwise the
    // entire bulk batch stalls forever).
    //
    // The UPDATE is CAS-guarded on status='running': if runScrapeAndExtract
    // already committed a terminal status (its in-process failJob ran,
    // or the success path enqueued the next worker) before the watchdog
    // tripped, the UPDATE affects zero rows and we DON'T call advanceBatch
    // here — the in-process handler already did. Without this guard the
    // watchdog would clobber a specific errorStep with 'watchdog' AND
    // double-enqueue the next batch job. The .returning() also gives us
    // batchId in the same round-trip when we DO need to advance, avoiding
    // a separate lookup.
    //
    // Each DB call races a 3s timeout so a hung connection can't hold us
    // past maxDuration.
    if (watchdogFired) {
      const jobId = parsed.jobId;
      let advancedBatchId: string | null | undefined = undefined;
      try {
        const rows = await Promise.race([
          db
            .update(generationJobs)
            .set({
              status: 'failed',
              errorStep: 'watchdog',
              errorMessage: message.slice(0, 1000),
              updatedAt: new Date(),
            })
            .where(and(eq(generationJobs.id, jobId), eq(generationJobs.status, 'running')))
            .returning({ batchId: generationJobs.batchId }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('failJob db timeout')), 3_000).unref(),
          ),
        ]);
        if (rows.length > 0) advancedBatchId = rows[0].batchId;
      } catch (failErr) {
        console.error('[task:scrape-and-extract] watchdog failJob failed:', failErr);
      }
      if (advancedBatchId !== undefined) {
        try {
          await Promise.race([
            advanceBatch(advancedBatchId),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('advanceBatch timeout')), 3_000).unref(),
            ),
          ]);
        } catch (advErr) {
          console.error('[task:scrape-and-extract] watchdog advanceBatch failed:', advErr);
        }
      } else {
        console.warn(
          '[task:scrape-and-extract] watchdog fired but row no longer running — skipping advanceBatch (in-process handler already terminated)',
        );
      }
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
