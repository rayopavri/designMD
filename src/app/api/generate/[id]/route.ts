/**
 * GET /api/generate/[id]
 *
 * Poll a generator job's status. No auth — the UUID jobId is the access
 * token. IDs are not enumerable and are only known to the requester
 * (the response of POST /api/generate). This lets anonymous users poll
 * their own job through to completion.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { bundles, generationJobs } from '@/lib/db/schema';

export const runtime = 'nodejs';

// A running job whose updatedAt hasn't changed in 4 minutes is permanently
// stuck (Vercel SIGKILL'd at the 60s Hobby cap before the watchdog could mark
// it failed, and the 3-min supervisor reaper hasn't caught it yet). Treat it as
// failed in the response so the client stops polling and clears the entry — the
// DB row stays as-is but no UI will ever show it again.
const STALE_JOB_MS = 4 * 60 * 1000;

interface RouteContext {
  params: Promise<{ id: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const [job] = await db
    .select()
    .from(generationJobs)
    .where(eq(generationJobs.id, id))
    .limit(1);

  if (!job) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Detect stuck-running rows: job never transitioned out of running because
  // the worker process was killed before cleanup could run.
  const isStuck =
    (job.status === 'running' || job.status === 'queued') &&
    job.updatedAt != null &&
    Date.now() - new Date(job.updatedAt).getTime() > STALE_JOB_MS;

  let resultBundleSlug: string | null = null;
  if (job.resultBundleId) {
    const [b] = await db
      .select({ slug: bundles.slug })
      .from(bundles)
      .where(eq(bundles.id, job.resultBundleId))
      .limit(1);
    resultBundleSlug = b?.slug ?? null;
  }

  return NextResponse.json({
    jobId: job.id,
    url: job.url,
    status: isStuck ? 'failed' : job.status,
    currentStep: job.currentStep,
    errorMessage: isStuck ? 'Generation timed out — please try again.' : job.errorMessage,
    errorStep: isStuck ? 'watchdog' : job.errorStep,
    resultBundleId: job.resultBundleId,
    resultBundleSlug,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  });
}
