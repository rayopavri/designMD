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

const BATCH_GAP_SECONDS = 8;

// Retry the QStash publish up to 3 times with exponential backoff (100ms,
// 200ms). Transient blips are recovered inline in ≤300ms without waiting
// for the next cron tick. If all attempts fail, the error is rethrown so
// callers (cron orphan sweep, worker watchdog) can log and the cron retries
// on the next tick as a last resort.
const ADVANCE_MAX_ATTEMPTS = 3;

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

  let lastErr: unknown;
  for (let attempt = 0; attempt < ADVANCE_MAX_ATTEMPTS; attempt++) {
    try {
      await enqueueTask('scrape-and-extract', { jobId: next.id }, { delaySeconds: BATCH_GAP_SECONDS });
      return;
    } catch (err) {
      lastErr = err;
      if (attempt < ADVANCE_MAX_ATTEMPTS - 1) {
        await new Promise<void>((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
      }
    }
  }
  throw lastErr;
}
