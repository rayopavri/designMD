/**
 * POST /api/admin/bulk-upload/[batchId]/retry-failed
 *
 * Editor-only. Resets every job in the batch with status='failed' back
 * to 'queued', clears the error fields, then enqueues
 * scrape-and-extract for the first reset job so processing resumes.
 *
 * Sequential semantics preserved: only one job is enqueued; the rest
 * wait in queue and advanceBatch picks them up as each completes.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { requireEditor } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { generationJobs } from '@/lib/db/schema';
import { enqueueTask } from '@/lib/queue';

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

  const failed = await db
    .select({
      id: generationJobs.id,
      url: generationJobs.url,
    })
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.batchId, batchId),
        eq(generationJobs.status, 'failed'),
      ),
    )
    .orderBy(asc(generationJobs.createdAt));

  if (failed.length === 0) {
    return NextResponse.json({ retried: 0, enqueuedFirst: null });
  }

  // Check whether something is already in-flight for this batch — if so,
  // we'll let advanceBatch chain naturally; we still flip failed rows
  // back to queued but don't double-enqueue.
  const [inFlight] = await db
    .select({ id: generationJobs.id })
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.batchId, batchId),
        eq(generationJobs.status, 'running'),
      ),
    )
    .limit(1);

  for (const job of failed) {
    await db
      .update(generationJobs)
      .set({
        status: 'queued',
        errorStep: null,
        errorMessage: null,
        currentStep: null,
        updatedAt: new Date(),
      })
      .where(eq(generationJobs.id, job.id));
  }

  let enqueuedFirst: string | null = null;
  if (!inFlight) {
    try {
      await enqueueTask('scrape-and-extract', { jobId: failed[0].id });
      enqueuedFirst = failed[0].id;
    } catch (err) {
      console.error('[retry-failed] enqueue failed:', err);
    }
  }

  return NextResponse.json({
    retried: failed.length,
    enqueuedFirst,
    inFlight: Boolean(inFlight),
  });
}
