/**
 * Internal worker endpoint for the scrape-and-extract pipeline.
 *
 * Auth: requires x-internal-task-token header to match env.INTERNAL_TASK_TOKEN.
 * Cloud Tasks (prod) and INLINE_TASKS dispatch (dev) both call here.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { assertInternalTaskAuth } from '@/lib/queue';
import { runScrapeAndExtract } from '@/lib/generator/scrape-and-extract';

// This route makes outbound HTTP calls (Firecrawl, Gemini) and writes
// to Postgres. It must run on the Node runtime, not edge.
export const runtime = 'nodejs';
export const maxDuration = 120;

const PayloadSchema = z.object({
  jobId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    assertInternalTaskAuth(req);
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }

  let parsed: z.infer<typeof PayloadSchema>;
  try {
    const json = await req.json();
    parsed = PayloadSchema.parse(json);
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid payload', details: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }

  try {
    await runScrapeAndExtract(parsed);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[task:scrape-and-extract] uncaught:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
