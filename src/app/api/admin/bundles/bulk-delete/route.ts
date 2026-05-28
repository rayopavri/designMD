/**
 * POST /api/admin/bundles/bulk-delete
 *
 * Editor-only. Permanently deletes up to 50 bundles by slug. Mirrors the
 * fan-out cleanup in the single-delete endpoint — votes, collection items,
 * FK nullification in bundleRequests / generationJobs / discoveryCandidates —
 * but in a single pass per table using inArray.
 *
 * Body: { slugs: string[] }   (1–50 items, each 1–120 chars)
 *
 * Response: { ok: true, deleted: number, notFound: string[] }
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { inArray, or, sql } from 'drizzle-orm';
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

const BodySchema = z.object({
  slugs: z
    .array(z.string().min(1).max(120))
    .min(1, 'Provide at least one slug.')
    .max(50, 'Maximum 50 slugs per request.'),
});

export async function POST(req: NextRequest) {
  try {
    await requireEditor();
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { slugs } = parsed.data;

  // Resolve slugs → IDs, surface any not found.
  const found = await db
    .select({ id: bundles.id, slug: bundles.slug })
    .from(bundles)
    .where(inArray(bundles.slug, slugs));

  const foundSlugs = new Set(found.map((r) => r.slug));
  const notFound = slugs.filter((s) => !foundSlugs.has(s));

  if (found.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0, notFound });
  }

  const ids = found.map((r) => r.id);

  // Fan-out cleanup in dependency order.
  await db.delete(bundleVotes).where(inArray(bundleVotes.bundleId, ids));
  await db.delete(collectionItems).where(inArray(collectionItems.bundleId, ids));

  await db
    .update(bundleRequests)
    .set({ completedBundleId: null })
    .where(inArray(bundleRequests.completedBundleId, ids));

  await db
    .update(generationJobs)
    .set({
      existingBundleId: sql`CASE WHEN existing_bundle_id = ANY(${ids}) THEN NULL ELSE existing_bundle_id END`,
      targetBundleId: sql`CASE WHEN target_bundle_id = ANY(${ids}) THEN NULL ELSE target_bundle_id END`,
      resultBundleId: sql`CASE WHEN result_bundle_id = ANY(${ids}) THEN NULL ELSE result_bundle_id END`,
    })
    .where(
      or(
        inArray(generationJobs.existingBundleId, ids),
        inArray(generationJobs.targetBundleId, ids),
        inArray(generationJobs.resultBundleId, ids),
      ),
    );

  await db
    .update(discoveryCandidates)
    .set({ promotedToBundleId: null })
    .where(inArray(discoveryCandidates.promotedToBundleId, ids));

  await db.delete(bundles).where(inArray(bundles.id, ids));

  invalidateSearchIndex();

  return NextResponse.json({ ok: true, deleted: found.length, notFound });
}
