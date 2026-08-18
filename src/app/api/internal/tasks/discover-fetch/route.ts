/**
 * Internal worker endpoint for the discovery fetch phase (P2-1).
 *
 * Auth: assertTaskAuth handles both QStash signature (production) and
 * x-internal-task-token (local dev) — same as the generation workers.
 *
 * This only fans out HTTP fetches + DB writes (no AI), so it stays well under
 * the function cap; maxDuration 60 matches the Hobby ceiling.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { assertTaskAuth } from '@/lib/queue';
import { DISCOVERY_SOURCES, runDiscoverFetch } from '@/lib/discovery/run-fetch';
import { safeGenerationErrorDetail } from '@/lib/auth/job-access';

export const runtime = 'nodejs';
export const maxDuration = 60;

const PayloadSchema = z.object({
  source: z.enum([...DISCOVERY_SOURCES] as [string, ...string[]]),
  limit: z.number().int().min(1).max(100).optional(),
});

export async function POST(req: NextRequest) {
  let rawPayload: unknown;
  try {
    rawPayload = await assertTaskAuth(req);
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('[task:discover-fetch] task authentication failed:', safeGenerationErrorDetail(err));
    return NextResponse.json({ error: 'internal_worker_failed' }, { status: 500 });
  }

  let parsed: z.infer<typeof PayloadSchema>;
  try {
    parsed = PayloadSchema.parse(rawPayload);
  } catch {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  try {
    const summary = await runDiscoverFetch({
      source: parsed.source as (typeof DISCOVERY_SOURCES)[number],
      limit: parsed.limit,
    });
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    console.error('[task:discover-fetch] uncaught:', safeGenerationErrorDetail(err));
    return NextResponse.json({ error: 'internal_worker_failed' }, { status: 500 });
  }
}
