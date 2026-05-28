/**
 * GET /api/admin/bulk-upload/status?batchId=...
 *
 * Editor-only. Returns per-job status for a bulk-upload batch, including
 * the resulting bundle's slug + status so the UI can link directly to
 * published bundles or to the review queue.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireEditor } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { bundles, generationJobs } from '@/lib/db/schema';

export const runtime = 'nodejs';

// A running job whose updatedAt hasn't changed in 10 minutes is permanently
// stuck (worker SIGKILLed before cleanup). Surface it as failed so the UI
// shows the real state and the "unstick" button doesn't need to be clicked.
const STALE_JOB_MS = 10 * 60 * 1000;

export async function GET(req: NextRequest) {
  try {
    await requireEditor();
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }

  const batchId = req.nextUrl.searchParams.get('batchId');
  if (!batchId) {
    return NextResponse.json({ error: 'batchId required' }, { status: 400 });
  }

  const jobs = await db
    .select({
      id: generationJobs.id,
      url: generationJobs.url,
      normalizedUrl: generationJobs.normalizedUrl,
      status: generationJobs.status,
      currentStep: generationJobs.currentStep,
      errorMessage: generationJobs.errorMessage,
      createdAt: generationJobs.createdAt,
      updatedAt: generationJobs.updatedAt,
      bundleSlug: bundles.slug,
      bundleStatus: bundles.status,
      bundleTitle: bundles.title,
    })
    .from(generationJobs)
    .leftJoin(bundles, eq(bundles.id, generationJobs.resultBundleId))
    .where(eq(generationJobs.batchId, batchId))
    .orderBy(generationJobs.createdAt);

  const now = Date.now();
  const resolvedJobs = jobs.map((j) => {
    const isStuck =
      (j.status === 'running' || j.status === 'queued') &&
      j.updatedAt != null &&
      now - new Date(j.updatedAt).getTime() > STALE_JOB_MS;
    if (!isStuck) return j;
    return {
      ...j,
      status: 'failed' as const,
      errorMessage: 'Generation timed out — use retry-failed to re-queue.',
    };
  });

  const total = resolvedJobs.length;
  const completed = resolvedJobs.filter((j) => j.status === 'completed').length;
  const failed = resolvedJobs.filter((j) => j.status === 'failed').length;
  const running = resolvedJobs.filter((j) => j.status === 'running').length;
  const queued = resolvedJobs.filter((j) => j.status === 'queued').length;
  const done = completed + failed === total;

  return NextResponse.json({ batchId, total, completed, failed, running, queued, done, jobs: resolvedJobs });
}
