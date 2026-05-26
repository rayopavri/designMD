/**
 * Internal worker endpoint for Phase 2 of the pipeline: Sonnet authors
 * DESIGN.md, fires the companion worker, then lints + scores.
 *
 * Auth: assertTaskAuth handles both QStash signature (production) and
 * x-internal-task-token (local dev).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { assertTaskAuth } from '@/lib/queue';
import { runAuthorDesignMd } from '@/lib/generator/author-design-md';
import { db } from '@/lib/db/client';
import { generationJobs } from '@/lib/db/schema';

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
    // path — mark the row failed here so the UI doesn't stay in `running`
    // forever. Best-effort with a tight timeout; if the DB itself is hung
    // this won't save us, but at least we tried.
    if (watchdogFired) {
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
            .where(eq(generationJobs.id, parsed.jobId)),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('failJob db timeout')), 3_000).unref(),
          ),
        ]);
      } catch (failErr) {
        console.error('[task:author-design-md] watchdog failJob failed:', failErr);
      }
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
