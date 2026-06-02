/**
 * POST /api/admin/bulk-upload/[batchId]/unstick
 *
 * Editor-only. Marks every job in the batch that has been stuck in
 * `status='running'` longer than UNSTUCK_THRESHOLD_MS as `failed` with
 * errorStep='manual-unstick', then calls dispatchReady() to refill the
 * freed concurrency slots so the batch keeps moving.
 *
 * Use when a Firecrawl / Gemini / Sonnet call hung past Vercel's 60s
 * maxDuration in production — the SIGKILL would have prevented
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

export const runtime = 'nodejs';
export const maxDuration = 30;

// A healthy job hits one of (Vercel Hobby 60s function cap — see TECH-STACK.md):
//   scrape:   maxDuration 60s + at most 1 QStash retry = ~130s worst case
//   author:   maxDuration 60s + at most 1 QStash retry = ~130s worst case
//   companion:maxDuration 60s + at most 1 QStash retry = ~130s worst case
// 4 minutes is comfortably past all of these (and past the 3-min supervisor
// reaper), so anything older is definitively stuck — not a slow legitimate run.
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
    console.error('[unstick] dispatchReady failed:', err);
  }

  return NextResponse.json({
    unstuck: stuck.length,
    advanced,
    jobs: stuck.map((j) => ({ id: j.id, url: j.url, currentStep: j.currentStep })),
  });
}
