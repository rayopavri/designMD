import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { bundles, categories, userFavorites } from '@/lib/db/schema';
import type { UserBundleListItem } from './bundles';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listUserFavorites(userId: string): Promise<UserBundleListItem[]> {
  if (!UUID_RE.test(userId)) return [];
  const rows = await db
    .select({
      id: bundles.id,
      slug: bundles.slug,
      title: bundles.title,
      description: bundles.description,
      type: bundles.type,
      status: bundles.status,
      companionStatus: bundles.companionStatus,
      coverageScore: bundles.coverageScore,
      primaryCategorySlug: categories.slug,
      primaryCategoryName: categories.name,
      designStyle: bundles.designStyle,
      compatibleTools: bundles.compatibleTools,
      paletteColors: bundles.paletteColors,
      brandLogoUrl: bundles.brandLogoUrl,
      brandInitial: bundles.brandInitial,
      brandColor: bundles.brandColor,
      voteCount: bundles.voteCount,
      positiveVoteRate: bundles.positiveVoteRate,
      isFeatured: bundles.isFeatured,
      isCurated: bundles.isCurated,
      sourceDomain: bundles.sourceDomain,
      authorName: bundles.authorName,
      license: bundles.license,
      submittedAt: bundles.submittedAt,
      reviewedAt: bundles.reviewedAt,
      publishedAt: bundles.publishedAt,
      updatedAt: userFavorites.createdAt, // "updated at" for favorites = when saved
    })
    .from(userFavorites)
    .innerJoin(bundles, eq(userFavorites.bundleId, bundles.id))
    .leftJoin(categories, eq(bundles.primaryCategoryId, categories.id))
    .where(eq(userFavorites.userId, userId))
    .orderBy(desc(userFavorites.createdAt));
  return rows as UserBundleListItem[];
}

export async function getFavoriteBundleIds(userId: string): Promise<string[]> {
  if (!UUID_RE.test(userId)) return [];
  const rows = await db
    .select({ bundleId: userFavorites.bundleId })
    .from(userFavorites)
    .where(eq(userFavorites.userId, userId));
  return rows.map((r: { bundleId: string }) => r.bundleId);
}

export async function addFavorite(userId: string, bundleId: string): Promise<void> {
  if (!UUID_RE.test(userId) || !UUID_RE.test(bundleId)) return;
  await db
    .insert(userFavorites)
    .values({ userId, bundleId })
    .onConflictDoNothing();
}

export async function removeFavorite(userId: string, bundleId: string): Promise<void> {
  if (!UUID_RE.test(userId) || !UUID_RE.test(bundleId)) return;
  await db
    .delete(userFavorites)
    .where(and(eq(userFavorites.userId, userId), eq(userFavorites.bundleId, bundleId)));
}

export async function isBundleFavorited(userId: string, bundleId: string): Promise<boolean> {
  if (!UUID_RE.test(userId) || !UUID_RE.test(bundleId)) return false;
  const [row] = await db
    .select({ id: userFavorites.id })
    .from(userFavorites)
    .where(and(eq(userFavorites.userId, userId), eq(userFavorites.bundleId, bundleId)))
    .limit(1);
  return !!row;
}
