/**
 * POST /api/admin/bulk-upload/[batchId]/retry-failed
 *
 * Editor-only. Resets every job in the batch with status='failed' back to
 * 'queued' and clears its error fields. Each reset rewinds phase to
 * 'scrape_extract' (the failJob path nulled phase_payload, so a partially-
 * advanced job must re-scrape from the top) and resets attempts to 1 (a fresh
 * reaper-resume budget). Then dispatchReady() claims up to the concurrency cap
 * and restarts processing; the supervise-batches cron backstops any lost
 * dispatch.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { requireEditor } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { generationJobs } from '@/lib/db/schema';
import { dispatchReady } from '@/lib/generator/batch';

export const runtime = 'nodejs';
export const maxDuration = 30;

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

  const reset = await db
    .update(generationJobs)
    .set({
      status: 'queued',
      currentStep: 'queued',
      errorStep: null,
      errorMessage: null,
      phase: 'scrape_extract',
      attempts: 1,
      updatedAt: new Date(),
    })
    .where(and(eq(generationJobs.batchId, batchId), eq(generationJobs.status, 'failed')))
    .returning({ id: generationJobs.id });

  if (reset.length === 0) {
    return NextResponse.json({ retried: 0, dispatched: false });
  }

  // Restart processing. dispatchReady counts running jobs and only fills the
  // remaining slots, so it's safe to call regardless of what's already
  // in-flight for this (or any) batch.
  let dispatched = false;
  try {
    await dispatchReady();
    dispatched = true;
  } catch (err) {
    console.error('[retry-failed] dispatchReady failed:', err);
  }

  return NextResponse.json({ retried: reset.length, dispatched });
}
