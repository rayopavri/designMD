/**
 * Internal worker endpoint for the deferred companion-prompt step.
 *
 * Fires after the main scrape-and-extract worker finishes. Keeps each
 * Vercel function comfortably under the 60s Hobby cap by splitting the
 * pipeline in two.
 *
 * Auth: assertTaskAuth handles both QStash signature (production) and
 * x-internal-task-token (local dev).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { assertTaskAuth } from '@/lib/queue';
import { runGenerateCompanion } from '@/lib/generator/generate-companion-task';

export const runtime = 'nodejs';
export const maxDuration = 60;

const PayloadSchema = z.object({
  bundleId: z.string().uuid(),
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
    await runGenerateCompanion(parsed);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[task:generate-companion] uncaught:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
