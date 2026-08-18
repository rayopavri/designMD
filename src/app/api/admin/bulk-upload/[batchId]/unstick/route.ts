/**
 * POST /api/admin/bulk-upload/[batchId]/unstick
 *
 * Editor-only. Marks every job in the batch that has been stuck in
 * `status='running'` longer than UNSTUCK_THRESHOLD_MS as `failed` with
 * errorStep='manual-unstick', then calls dispatchReady() to refill the
 * freed concurrency slots so the batch keeps moving.
 *
 * Use when a Firecrawl / Gemini / Sonnet call hung past its worker watchdog
 * in production — a platform SIGKILL would have prevented
 * failJob() AND slot-refill from running, stranding the row AND
 * tying up a concurrency slot. The worker watchdogs and the
 * supervise-batches cron catch this automatically, but this endpoint
 * remains useful as an immediate manual escape hatch.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { and, eq, lt } from 'drizzle-orm';
import { requireEditor } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { generationJobs } from '@/lib/db/schema';
import { dispatchReady } from '@/lib/generator/batch';
import { safeDiagnosticErrorDetail } from '@/lib/security/diagnostics';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Four minutes without a DB heartbeat is beyond every individual provider
// substage timeout and intentionally offers a manual escape before the
// supervisor's 7-minute stale lease. The 300s scrape/author platform budgets
// are last-resort caps; live workers advance updatedAt between phases.
const UNSTUCK_THRESHOLD_MS = 4 * 60 * 1000;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> },
) {
  try {
    await requireEditor();
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }

  const { batchId } = await params;
  if (!batchId) {
    return NextResponse.json({ error: 'batchId required' }, { status: 400 });
  }

  const cutoff = new Date(Date.now() - UNSTUCK_THRESHOLD_MS);

  const stuck = await db
    .select({
      id: generationJobs.id,
      url: generationJobs.url,
      currentStep: generationJobs.currentStep,
      updatedAt: generationJobs.updatedAt,
    })
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.batchId, batchId),
        eq(generationJobs.status, 'running'),
        lt(generationJobs.updatedAt, cutoff),
      ),
    );

  if (stuck.length === 0) {
    return NextResponse.json({ unstuck: 0, advanced: false, jobs: [] });
  }

  for (const job of stuck) {
    await db
      .update(generationJobs)
      .set({
        status: 'failed',
        errorStep: 'manual-unstick',
        errorMessage: `Manually unstuck — was stuck at currentStep='${job.currentStep ?? 'unknown'}' since ${job.updatedAt.toISOString()}`,
        phasePayload: null,
        updatedAt: new Date(),
      })
      .where(eq(generationJobs.id, job.id));
  }

  // Refill the concurrency slots the unstuck jobs just freed. dispatchReady
  // claims up to BULK_CONCURRENCY queued rows and enqueues them; the
  // supervise-batches cron backstops this if it throws.
  let advanced = false;
  try {
    await dispatchReady();
    advanced = true;
  } catch (err) {
    console.error('[unstick] dispatchReady failed:', safeDiagnosticErrorDetail(err));
  }

  return NextResponse.json({
    unstuck: stuck.length,
    advanced,
    jobs: stuck.map((j) => ({ id: j.id, url: j.url, currentStep: j.currentStep })),
  });
}
