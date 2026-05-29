/**
 * POST /api/admin/bulk-upload/[batchId]/cancel
 *
 * Editor-only. Marks all queued and running jobs in the batch as failed
 * (cancelled). Already-completed and already-failed jobs are untouched.
 *
 * The running worker (if any) will still finish its current QStash task,
 * but when it calls dispatchReady there will be no queued rows left in the
 * batch, so nothing refills. No DB rows are deleted.
 *
 * Response: { cancelled: number }
 */
import { NextResponse, type NextRequest } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { requireEditor } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { generationJobs } from '@/lib/db/schema';

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

  const result = await db
    .update(generationJobs)
    .set({
      status: 'failed',
      errorMessage: 'Cancelled by admin',
      phasePayload: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(generationJobs.batchId, batchId),
        inArray(generationJobs.status, ['queued', 'running']),
      ),
    )
    .returning({ id: generationJobs.id });

  return NextResponse.json({ cancelled: result.length });
}
