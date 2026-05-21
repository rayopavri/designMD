/**
 * GET /api/admin/bundles/bulk-rerun/status?since=<ISO>
 *
 * Editor-only. Returns counts of generation_jobs (limited to re-runs —
 * rows where targetBundleId IS NOT NULL) grouped by status since the
 * given timestamp, plus the 10 most recent failures so you can see
 * what broke.
 *
 * Default `since` window: last 60 minutes.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { and, desc, eq, gte, isNotNull, sql } from 'drizzle-orm';
import { requireEditor } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { bundles, generationJobs } from '@/lib/db/schema';

export const runtime = 'nodejs';

const DEFAULT_WINDOW_MS = 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  try {
    await requireEditor();
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }

  const sinceRaw = req.nextUrl.searchParams.get('since');
  const since = sinceRaw ? new Date(sinceRaw) : new Date(Date.now() - DEFAULT_WINDOW_MS);
  if (isNaN(since.getTime())) {
    return NextResponse.json({ error: 'Invalid `since` ISO timestamp' }, { status: 400 });
  }

  const counts = await db
    .select({
      status: generationJobs.status,
      count: sql<number>`count(*)::int`,
    })
    .from(generationJobs)
    .where(and(isNotNull(generationJobs.targetBundleId), gte(generationJobs.createdAt, since)))
    .groupBy(generationJobs.status);

  const byStatus: Record<string, number> = { queued: 0, running: 0, completed: 0, failed: 0 };
  for (const row of counts) byStatus[row.status] = row.count;

  const recentFailures = await db
    .select({
      jobId: generationJobs.id,
      slug: bundles.slug,
      errorStep: generationJobs.errorStep,
      errorMessage: generationJobs.errorMessage,
      updatedAt: generationJobs.updatedAt,
    })
    .from(generationJobs)
    .leftJoin(bundles, eq(generationJobs.targetBundleId, bundles.id))
    .where(
      and(
        isNotNull(generationJobs.targetBundleId),
        gte(generationJobs.createdAt, since),
        eq(generationJobs.status, 'failed'),
      ),
    )
    .orderBy(desc(generationJobs.updatedAt))
    .limit(10);

  return NextResponse.json({
    since: since.toISOString(),
    queued: byStatus.queued ?? 0,
    running: byStatus.running ?? 0,
    completed: byStatus.completed ?? 0,
    failed: byStatus.failed ?? 0,
    recentFailures,
  });
}
