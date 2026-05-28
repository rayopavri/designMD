/**
 * POST /api/admin/bundles/[slug]/rerun-pipeline
 *
 * Editor-only. Re-runs the FULL generation pipeline against the bundle's
 * existing source URL and overwrites system-managed fields in place.
 * Preserves editor-managed fields (title, description, license,
 * attribution, featured/curated, primaryCategoryId), the slug, votes,
 * and the bundle's status.
 *
 * Rejects with 409 if:
 *   - the bundle has no scrapable source URL (upload-mode bundles)
 *   - a re-run is already in flight for this bundle
 *
 * Creates a new generation_jobs row with targetBundleId set and
 * enqueues it via QStash. The worker (scrape-and-extract.ts) branches
 * on targetBundleId to UPDATE the existing row instead of INSERTing.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { bundles, generationJobs } from '@/lib/db/schema';
import { requireEditor } from '@/lib/auth/session';
import { enqueueTask } from '@/lib/queue';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function POST(_req: NextRequest, ctx: RouteContext) {
  let editor;
  try {
    editor = await requireEditor();
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }

  const { slug } = await ctx.params;

  const [bundle] = await db
    .select({
      id: bundles.id,
      sourceUrl: bundles.sourceUrl,
      sourceUrlNormalized: bundles.sourceUrlNormalized,
    })
    .from(bundles)
    .where(eq(bundles.slug, slug))
    .limit(1);

  if (!bundle) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (!bundle.sourceUrl || bundle.sourceUrl.startsWith('upload://')) {
    return NextResponse.json(
      {
        error: 'Re-run requires a source URL. Upload-sourced bundles cannot be re-run.',
      },
      { status: 409 },
    );
  }

  const [inFlight] = await db
    .select({
      id: generationJobs.id,
      status: generationJobs.status,
      updatedAt: generationJobs.updatedAt,
    })
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.targetBundleId, bundle.id),
        inArray(generationJobs.status, ['queued', 'running']),
      ),
    )
    .limit(1);

  if (inFlight) {
    // A running job with no DB update for 15+ min is considered stuck (the
    // QStash worker timed out but never wrote a terminal status). Allow the
    // replacement by marking it failed first; queued jobs are always live.
    const STUCK_THRESHOLD_MS = 15 * 60 * 1000;
    const isStuck =
      inFlight.status === 'running' &&
      Date.now() - new Date(inFlight.updatedAt).getTime() > STUCK_THRESHOLD_MS;

    if (!isStuck) {
      return NextResponse.json(
        { error: 'A re-run is already in flight for this bundle.', jobId: inFlight.id },
        { status: 409 },
      );
    }

    // Mark the stuck job failed so it no longer blocks the new run.
    await db
      .update(generationJobs)
      .set({
        status: 'failed',
        errorStep: 'watchdog-superseded',
        errorMessage: 'Superseded by manual re-run — no DB update for 15+ min.',
        updatedAt: new Date(),
      })
      .where(eq(generationJobs.id, inFlight.id));
  }

  const [job] = await db
    .insert(generationJobs)
    .values({
      url: bundle.sourceUrl,
      normalizedUrl: bundle.sourceUrlNormalized,
      sourceType: 'url',
      status: 'queued',
      userId: editor.id,
      targetBundleId: bundle.id,
      autoPublish: false,
    })
    .returning({ id: generationJobs.id });

  if (!job) {
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500 });
  }

  try {
    await enqueueTask('scrape-and-extract', { jobId: job.id });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Failed to enqueue pipeline task',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, jobId: job.id, bundleId: bundle.id });
}
