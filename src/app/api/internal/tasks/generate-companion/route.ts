/**
 * Internal worker endpoint for the deferred companion-prompt step.
 *
 * Fires in parallel with author-design-md (both enqueued by Phase 1).
 *
 * The queue message is just { jobId }; runGenerateCompanion hydrates brand /
 * designStyles / bundleId from generation_jobs.phase_payload.
 *
 * Auth: assertTaskAuth handles both QStash signature (production) and
 * x-internal-task-token (local dev).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { assertTaskAuth } from '@/lib/queue';
import { runGenerateCompanion } from '@/lib/generator/generate-companion-task';
import { perf } from '@/lib/generator/perf-log';

export const runtime = 'nodejs';
// Vercel Hobby plan: 60s function cap (see TECH-STACK.md). The Sonnet call is
// bounded below this by SONNET_TIMEOUT_MS + maxRetries in generate-companion-prompt.ts.
export const maxDuration = 60;

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

  const t0 = Date.now();
  try {
    await runGenerateCompanion({ jobId: parsed.jobId });
    perf('worker.companion', 'done', Date.now() - t0, { jobId: parsed.jobId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    perf('worker.companion', 'err', Date.now() - t0, { jobId: parsed.jobId });
    console.error('[task:generate-companion] uncaught:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
