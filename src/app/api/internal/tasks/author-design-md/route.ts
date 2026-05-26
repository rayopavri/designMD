/**
 * Internal worker endpoint for Phase 2 of the pipeline: Sonnet authors
 * DESIGN.md, fires the companion worker, then lints + scores.
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
import { advanceBatch } from '@/lib/generator/batch';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Hard watchdog: any single execution that exceeds 55s gets force-failed
// before Vercel SIGKILLs the function at 60s. This is belt-and-suspenders
// for the in-process Sonnet timeout (50s) — if ANY other operation hangs
// (DB write, QStash publish, lint), we still mark the job failed instead
// of stranding the row in `running` forever.
const WATCHDOG_MS = 55_000;

// We deliberately don't validate brand exhaustively here — Phase 1 already
// ran it through sanitize() in gemini.ts. Treat the inbound shape as
// trusted ExtractedBrand JSON and let TypeScript narrow at the boundary.
const PayloadSchema = z.object({
  jobId: z.string().uuid(),
  bundleId: z.string().uuid(),
  url: z.string(),
  scrapedMarkdown: z.string(),
  brand: z.unknown(),
  isRerun: z.boolean(),
  autoPublish: z.boolean().default(false),
  batchId: z.string().uuid().nullable().default(null),
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
    await Promise.race([
      runAuthorDesignMd({
        jobId: parsed.jobId,
        bundleId: parsed.bundleId,
        url: parsed.url,
        scrapedMarkdown: parsed.scrapedMarkdown,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        brand: parsed.brand as any,
        isRerun: parsed.isRerun,
        autoPublish: parsed.autoPublish,
        batchId: parsed.batchId,
      }),
      watchdog,
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[task:author-design-md] uncaught:', message);
    // If the watchdog fired, runAuthorDesignMd never reached its own failJob
    // path — mark the row failed AND kick the next batch job (otherwise a
    // bulk-upload batch stalls forever at this job since no advanceBatch
    // fires).
    //
    // The UPDATE is CAS-guarded on status='running': if runAuthorDesignMd
    // already committed status='completed' or 'failed' before the watchdog
    // tripped (e.g. the trailing await advanceBatch was the slow path, not
    // the AI call), the UPDATE affects zero rows and we DON'T call
    // advanceBatch here — the in-process handler already enqueued the next
    // job. Without this guard the watchdog would (a) flip completed → failed,
    // (b) clobber a specific errorStep with generic 'watchdog', (c)
    // double-enqueue the next batch job since the in-process advanceBatch
    // is still in flight.
    //
    // Each DB call races a 3s timeout so a hung DB can't hold us past
    // maxDuration. The payload already carries batchId so no lookup
    // round-trip is needed when we do need to advance.
    if (watchdogFired) {
      let affectedCount = 0;
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
            .where(and(eq(generationJobs.id, parsed.jobId), eq(generationJobs.status, 'running')))
            .returning({ id: generationJobs.id }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('failJob db timeout')), 3_000).unref(),
          ),
        ]);
        affectedCount = rows.length;
      } catch (failErr) {
        console.error('[task:author-design-md] watchdog failJob failed:', failErr);
      }
      if (affectedCount > 0) {
        try {
          await Promise.race([
            advanceBatch(parsed.batchId),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('advanceBatch timeout')), 3_000).unref(),
            ),
          ]);
        } catch (advErr) {
          console.error('[task:author-design-md] watchdog advanceBatch failed:', advErr);
        }
      } else {
        console.warn(
          '[task:author-design-md] watchdog fired but row no longer running — skipping advanceBatch (in-process handler already terminated)',
        );
      }
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
