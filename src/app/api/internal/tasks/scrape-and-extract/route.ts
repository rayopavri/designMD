/**
 * Internal worker endpoint for the scrape-and-extract pipeline.
 *
 * Auth: assertTaskAuth handles both QStash signature (production) and
 * x-internal-task-token (local dev).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { assertTaskAuth } from '@/lib/queue';
import { runScrapeAndExtract } from '@/lib/generator/scrape-and-extract';
import { db } from '@/lib/db/client';
import { generationJobs } from '@/lib/db/schema';
import { advanceBatch } from '@/lib/generator/batch';

// This route makes outbound HTTP calls (Firecrawl, Gemini) and writes
// to Postgres. It must run on the Node runtime, not edge.
export const runtime = 'nodejs';
export const maxDuration = 120;

// Hard watchdog: any single execution that exceeds 110s gets force-failed
// before Vercel SIGKILLs the function at 120s. Critical for bulk-upload
// batches — when a job hangs on Firecrawl (JS-heavy sites can stall the
// API), the SIGKILL prevents failJob() AND advanceBatch() from running,
// which strands the row in `running` AND halts the whole batch because
// no next-job kick fires. The 10s gap to maxDuration leaves room for
// the cleanup DB writes and the advanceBatch enqueue.
const WATCHDOG_MS = 110_000;

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

  try {
    await Promise.race([runScrapeAndExtract(parsed), watchdog]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[task:scrape-and-extract] uncaught:', message);
    // If the watchdog fired, runScrapeAndExtract never reached failJob —
    // mark the row failed AND kick the next batch job (otherwise the
    // entire bulk batch stalls forever). Both DB calls race a tight
    // timeout so a hung DB connection can't hold us past maxDuration.
    if (watchdogFired) {
      const jobId = parsed.jobId;
      let batchId: string | null = null;
      try {
        const [row] = await Promise.race([
          db
            .select({ batchId: generationJobs.batchId })
            .from(generationJobs)
            .where(eq(generationJobs.id, jobId))
            .limit(1),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('watchdog batch lookup timeout')), 3_000).unref(),
          ),
        ]);
        batchId = row?.batchId ?? null;
      } catch (lookupErr) {
        console.error('[task:scrape-and-extract] watchdog batch lookup failed:', lookupErr);
      }
      try {
        await Promise.race([
          db
            .update(generationJobs)
            .set({
              status: 'failed',
              errorStep: 'watchdog',
              errorMessage: message.slice(0, 1000),
              updatedAt: new Date(),
            })
            .where(eq(generationJobs.id, jobId)),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('failJob db timeout')), 3_000).unref(),
          ),
        ]);
      } catch (failErr) {
        console.error('[task:scrape-and-extract] watchdog failJob failed:', failErr);
      }
      try {
        await Promise.race([
          advanceBatch(batchId),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('advanceBatch timeout')), 3_000).unref(),
          ),
        ]);
      } catch (advErr) {
        console.error('[task:scrape-and-extract] watchdog advanceBatch failed:', advErr);
      }
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
