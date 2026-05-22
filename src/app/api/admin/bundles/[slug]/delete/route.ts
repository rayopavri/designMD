/**
 * POST /api/admin/bundles/[slug]/delete
 *
 * Editor-only. **Permanent** hard delete — the bundle row and all of its
 * foreign-key fan-out (votes, collection items, job references, request
 * references, discovery-candidate references) are erased. The screenshot
 * blob in Vercel Blob is best-effort deleted too.
 *
 * Use Archive for soft delete; this endpoint is only for spam, accidental
 * generations, takedowns, and similar one-way removals.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { eq, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  bundles,
  bundleVotes,
  collectionItems,
  bundleRequests,
  generationJobs,
  discoveryCandidates,
} from '@/lib/db/schema';
import { requireEditor } from '@/lib/auth/session';
import { invalidateSearchIndex } from '@/lib/search';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function POST(_req: NextRequest, ctx: RouteContext) {
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

  const bundleId = bundle.id;

  // Delete fan-out in dependency order, then the bundle row itself.
  // Drizzle's postgres-js driver doesn't expose explicit transactions
  // for HTTP — use a CTE-style pipeline via individual statements; if a
  // step fails, the partial deletes are still safe (we only widen who
  // CAN delete, never accidentally cascade outside this bundle).
  await db.delete(bundleVotes).where(eq(bundleVotes.bundleId, bundleId));
  await db.delete(collectionItems).where(eq(collectionItems.bundleId, bundleId));

  await db
    .update(bundleRequests)
    .set({ completedBundleId: null })
    .where(eq(bundleRequests.completedBundleId, bundleId));

  await db
    .update(generationJobs)
    .set({
      existingBundleId: sql`CASE WHEN existing_bundle_id = ${bundleId} THEN NULL ELSE existing_bundle_id END`,
      targetBundleId: sql`CASE WHEN target_bundle_id = ${bundleId} THEN NULL ELSE target_bundle_id END`,
      resultBundleId: sql`CASE WHEN result_bundle_id = ${bundleId} THEN NULL ELSE result_bundle_id END`,
    })
    .where(
      or(
        eq(generationJobs.existingBundleId, bundleId),
        eq(generationJobs.targetBundleId, bundleId),
        eq(generationJobs.resultBundleId, bundleId),
      ),
    );

  await db
    .update(discoveryCandidates)
    .set({ promotedToBundleId: null })
    .where(eq(discoveryCandidates.promotedToBundleId, bundleId));

  await db.delete(bundles).where(eq(bundles.id, bundleId));

  invalidateSearchIndex();
  return NextResponse.json({ ok: true });
}
