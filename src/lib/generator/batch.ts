/**
 * Batch sequencing helper for bulk-upload jobs.
 *
 * When a batch job reaches a terminal state (completed or failed) this
 * finds the next queued job in the same batch and enqueues it with a
 * short delay, giving upstream APIs a brief breathing gap between jobs.
 */
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { generationJobs } from '@/lib/db/schema';
import { enqueueTask } from '@/lib/queue';

const BATCH_GAP_SECONDS = 10;

export async function advanceBatch(batchId: string | null | undefined): Promise<void> {
  if (!batchId) return;

  const [next] = await db
    .select({ id: generationJobs.id })
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.batchId, batchId),
        eq(generationJobs.status, 'queued'),
      ),
    )
    .orderBy(asc(generationJobs.createdAt))
    .limit(1);

  if (!next) return; // batch complete

  try {
    await enqueueTask('scrape-and-extract', { jobId: next.id }, { delaySeconds: BATCH_GAP_SECONDS });
  } catch (err) {
    console.error('[batch] failed to enqueue next batch job:', err);
  }
}
