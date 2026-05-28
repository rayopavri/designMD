/**
 * GET /api/admin/bundles/[slug]/job-status
 *
 * Editor-only. Returns the most recent generation_jobs row for this
 * bundle (where target_bundle_id = bundle.id) — used by the admin
 * edit panel to show a persistent pipeline status indicator across
 * page reloads.
 *
 * Returns 200 with `null` when the bundle has never been re-run.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { bundles, generationJobs } from '@/lib/db/schema';
import { requireEditor } from '@/lib/auth/session';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    await requireEditor();
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }

  const { slug } = await ctx.params;

  const [bundle] = await db
    .select({ id: bundles.id })
    .from(bundles)
    .where(eq(bundles.slug, slug))
    .limit(1);

  if (!bundle) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [job] = await db
    .select({
      jobId: generationJobs.id,
      status: generationJobs.status,
      currentStep: generationJobs.currentStep,
      errorStep: generationJobs.errorStep,
      errorMessage: generationJobs.errorMessage,
      createdAt: generationJobs.createdAt,
      updatedAt: generationJobs.updatedAt,
      firecrawlDoneAt: generationJobs.firecrawlDoneAt,
      geminiExtractDoneAt: generationJobs.geminiExtractDoneAt,
      designMdDoneAt: generationJobs.designMdDoneAt,
      lintDoneAt: generationJobs.lintDoneAt,
    })
    .from(generationJobs)
    .where(eq(generationJobs.targetBundleId, bundle.id))
    .orderBy(desc(generationJobs.createdAt))
    .limit(1);

  return NextResponse.json({ job: job ?? null });
}
