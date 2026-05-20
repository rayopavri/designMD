/**
 * Internal worker endpoint for the scrape-and-extract pipeline.
 *
 * Auth: assertTaskAuth handles both QStash signature (production) and
 * x-internal-task-token (local dev).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { assertTaskAuth } from '@/lib/queue';
import { runScrapeAndExtract } from '@/lib/generator/scrape-and-extract';

// This route makes outbound HTTP calls (Firecrawl, Gemini) and writes
// to Postgres. It must run on the Node runtime, not edge.
export const runtime = 'nodejs';
export const maxDuration = 120;

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
