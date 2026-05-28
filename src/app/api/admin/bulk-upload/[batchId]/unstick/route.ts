/**
 * POST /api/admin/bulk-upload/[batchId]/unstick
 *
 * Editor-only. Marks every job in the batch that has been stuck in
 * `status='running'` longer than UNSTUCK_THRESHOLD_MS as `failed` with
 * errorStep='manual-unstick', then calls advanceBatch() to kick the
 * next queued URL so the batch resumes.
 *
 * Use when a Firecrawl / Gemini / Sonnet call hung past Vercel's
 * maxDuration in production — the SIGKILL would have prevented
 * failJob() AND advanceBatch() from running, stranding the row AND
 * halting the rest of the queue. Newer deploys have worker-level
 * watchdogs that catch this automatically, but this endpoint
 * remains useful as a manual escape hatch.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { and, eq, lt } from 'drizzle-orm';
import { requireEditor } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { generationJobs } from '@/lib/db/schema';
import { advanceBatch } from '@/lib/generator/batch';

export const runtime = 'nodejs';
export const maxDuration = 30;

// A healthy job hits one of:
//   scrape:   maxDuration 300s + at most 1 QStash retry = ~610s worst case
//   author:   maxDuration 300s + at most 1 QStash retry = ~610s worst case
//   companion:maxDuration 300s + at most 1 QStash retry = ~610s worst case
// 12 minutes is comfortably past all of these, so anything older is
// definitively stuck — not a slow but legitimate run.
const UNSTUCK_THRESHOLD_MS = 12 * 60 * 1000;

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
        updatedAt: new Date(),
      })
      .where(eq(generationJobs.id, job.id));
  }

  // Kick the next queued job in the batch (only fires once even if
  // multiple stuck jobs were unstuck — advanceBatch picks the single
  // next queued row and enqueues scrape-and-extract for it).
  let advanced = false;
  try {
    await advanceBatch(batchId);
    advanced = true;
  } catch (err) {
    console.error('[unstick] advanceBatch failed:', err);
  }

  return NextResponse.json({
    unstuck: stuck.length,
    advanced,
    jobs: stuck.map((j) => ({ id: j.id, url: j.url, currentStep: j.currentStep })),
  });
}
