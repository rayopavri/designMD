/**
 * Internal worker endpoint for Phase 2 of the pipeline: Sonnet authors
 * DESIGN.md, fires the companion worker, then lints + scores.
 *
 * Auth: assertTaskAuth handles both QStash signature (production) and
 * x-internal-task-token (local dev).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { assertTaskAuth } from '@/lib/queue';
import { runAuthorDesignMd } from '@/lib/generator/author-design-md';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

  try {
    await runAuthorDesignMd({
      jobId: parsed.jobId,
      bundleId: parsed.bundleId,
      url: parsed.url,
      scrapedMarkdown: parsed.scrapedMarkdown,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      brand: parsed.brand as any,
      isRerun: parsed.isRerun,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[task:author-design-md] uncaught:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
