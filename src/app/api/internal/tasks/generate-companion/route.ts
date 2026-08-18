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
import { safeGenerationErrorDetail } from '@/lib/auth/job-access';

export const runtime = 'nodejs';
// Vercel Pro plan: 300s standard / 800s Fluid cap (see TECH-STACK.md), pinned
// to 180s here. The Sonnet call is bounded below this by SONNET_TIMEOUT_MS +
// maxRetries in generate-companion-prompt.ts.
export const maxDuration = 180;

const PayloadSchema = z.object({
  jobId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  let rawPayload: unknown;
  try {
    rawPayload = await assertTaskAuth(req);
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('[task:generate-companion] task authentication failed:', safeGenerationErrorDetail(err));
    return NextResponse.json({ error: 'internal_worker_failed' }, { status: 500 });
  }

  let parsed: z.infer<typeof PayloadSchema>;
  try {
    parsed = PayloadSchema.parse(rawPayload);
  } catch {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const t0 = Date.now();
  try {
    await runGenerateCompanion({ jobId: parsed.jobId });
    perf('worker.companion', 'done', Date.now() - t0, { jobId: parsed.jobId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    perf('worker.companion', 'err', Date.now() - t0, { jobId: parsed.jobId });
    console.error('[task:generate-companion] uncaught:', safeGenerationErrorDetail(err));
    return NextResponse.json({ error: 'internal_worker_failed' }, { status: 500 });
  }
}
