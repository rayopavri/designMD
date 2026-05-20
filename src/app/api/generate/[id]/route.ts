/**
 * GET /api/generate/[id]
 *
 * Poll a generator job's status. Returns 404 if the job doesn't exist
 * or belongs to another user.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { bundles, generationJobs } from '@/lib/db/schema';
import { requireAuth } from '@/lib/auth/session';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: NextRequest, ctx: RouteContext) {
  let user;
  try {
    user = await requireAuth();
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const [job] = await db
    .select()
    .from(generationJobs)
    .where(and(eq(generationJobs.id, id), eq(generationJobs.userId, user.id)))
    .limit(1);

  if (!job) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

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
    status: job.status,
    currentStep: job.currentStep,
    errorMessage: job.errorMessage,
    errorStep: job.errorStep,
    resultBundleId: job.resultBundleId,
    resultBundleSlug,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  });
}
