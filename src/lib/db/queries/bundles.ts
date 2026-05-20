/**
 * Bundle read queries.
 *
 * Centralised so route handlers stay slim and we can reuse the same
 * filter/sort logic from the upcoming search index build and admin views.
 */
import { and, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { bundles, categories } from '@/lib/db/schema';

export interface BundleListFilters {
  category?: string; // category slug
  type?: 'design_md' | 'skill' | 'agent';
  designStyle?: string[]; // ['dark-mode', 'minimal', ...]
  tools?: string[]; // ['claude', 'cursor', ...]
  q?: string; // search query (matches title, description)
  sort?: 'recent' | 'top' | 'trending';
  limit?: number;
  cursor?: string; // bundle id of the last item from previous page
}

export interface BundleListItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: string;
  coverageScore: number | null;
  primaryCategorySlug: string | null;
  primaryCategoryName: string | null;
  designStyle: string[];
  compatibleTools: string[];
  paletteColors: string[];
  brandInitial: string | null;
  brandColor: string | null;
  voteCount: number;
  positiveVoteRate: string;
  isFeatured: boolean;
  isCurated: boolean;
  sourceDomain: string | null;
  authorName: string | null;
  license: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
}

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 60;

export async function listPublishedBundles(
  filters: BundleListFilters
): Promise<{ items: BundleListItem[]; nextCursor: string | null }> {
  const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  const conditions: SQL[] = [eq(bundles.status, 'published')];

  if (filters.category) {
    conditions.push(eq(categories.slug, filters.category));
  }
  if (filters.type) {
    conditions.push(eq(bundles.type, filters.type));
  }
  if (filters.designStyle?.length) {
    // array && array → true if they overlap
    conditions.push(
      sql`${bundles.designStyle} && ${sql.raw(`ARRAY[${filters.designStyle.map((s) => `'${s.replace(/'/g, "''")}'`).join(',')}]::text[]`)}`
    );
  }
  if (filters.tools?.length) {
    conditions.push(
      sql`${bundles.compatibleTools} && ${sql.raw(`ARRAY[${filters.tools.map((s) => `'${s.replace(/'/g, "''")}'`).join(',')}]::text[]`)}`
    );
  }
  if (filters.q) {
    const term = `%${filters.q.trim()}%`;
    const qCond = or(ilike(bundles.title, term), ilike(bundles.description, term));
    if (qCond) conditions.push(qCond);
  }
  if (filters.cursor) {
    conditions.push(sql`${bundles.id} > ${filters.cursor}`);
  }

  // Sort: 'recent' = publishedAt desc; 'top' = positiveVoteRate desc, voteCount desc;
  // 'trending' = a simple recency-weighted score for now (positive rate * log(votes+1)).
  let orderBy: SQL[];
  switch (filters.sort) {
    case 'top':
      orderBy = [desc(bundles.positiveVoteRate), desc(bundles.voteCount), desc(bundles.publishedAt)];
      break;
    case 'trending':
      orderBy = [
        desc(sql`(${bundles.positiveVoteRate}::numeric * ln(${bundles.voteCount} + 1))`),
        desc(bundles.publishedAt),
      ];
      break;
    case 'recent':
    default:
      orderBy = [desc(bundles.publishedAt), desc(bundles.createdAt)];
      break;
  }

  const rows = await db
    .select({
      id: bundles.id,
      slug: bundles.slug,
      title: bundles.title,
      description: bundles.description,
      type: bundles.type,
      coverageScore: bundles.coverageScore,
      primaryCategorySlug: categories.slug,
      primaryCategoryName: categories.name,
      designStyle: bundles.designStyle,
      compatibleTools: bundles.compatibleTools,
      paletteColors: bundles.paletteColors,
      brandInitial: bundles.brandInitial,
      brandColor: bundles.brandColor,
      voteCount: bundles.voteCount,
      positiveVoteRate: bundles.positiveVoteRate,
      isFeatured: bundles.isFeatured,
      isCurated: bundles.isCurated,
      sourceDomain: bundles.sourceDomain,
      authorName: bundles.authorName,
      license: bundles.license,
      publishedAt: bundles.publishedAt,
      updatedAt: bundles.updatedAt,
    })
    .from(bundles)
    .leftJoin(categories, eq(bundles.primaryCategoryId, categories.id))
    .where(and(...conditions))
    .orderBy(...orderBy)
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

  return { items: items as BundleListItem[], nextCursor };
}

export interface BundleDetail extends BundleListItem {
  designMd: string | null;
  companionPrompt: string;
  companionPromptVersion: number;
  coverageColors: number | null;
  coverageTypography: number | null;
  coverageLayout: number | null;
  coverageElevation: number | null;
  coverageShapes: number | null;
  coverageComponents: number | null;
  coverageDosDonts: number | null;
  positiveVoteCount: number;
  copyCount: number;
  downloadCount: number;
  cliInstallCount: number;
  attributionStatement: string | null;
  authorUrl: string | null;
  sourceUrl: string | null;
}

export interface OwnerBundleDetail extends BundleDetail {
  status: string;
  reviewNotes: string | null;
  submittedAt: Date | null;
}

const bundleDetailColumns = {
  id: bundles.id,
  slug: bundles.slug,
  title: bundles.title,
  description: bundles.description,
  type: bundles.type,
  designMd: bundles.designMd,
  companionPrompt: bundles.companionPrompt,
  companionPromptVersion: bundles.companionPromptVersion,
  coverageScore: bundles.coverageScore,
  coverageColors: bundles.coverageColors,
  coverageTypography: bundles.coverageTypography,
  coverageLayout: bundles.coverageLayout,
  coverageElevation: bundles.coverageElevation,
  coverageShapes: bundles.coverageShapes,
  coverageComponents: bundles.coverageComponents,
  coverageDosDonts: bundles.coverageDosDonts,
  primaryCategorySlug: categories.slug,
  primaryCategoryName: categories.name,
  designStyle: bundles.designStyle,
  compatibleTools: bundles.compatibleTools,
  paletteColors: bundles.paletteColors,
  brandInitial: bundles.brandInitial,
  brandColor: bundles.brandColor,
  voteCount: bundles.voteCount,
  positiveVoteCount: bundles.positiveVoteCount,
  positiveVoteRate: bundles.positiveVoteRate,
  copyCount: bundles.copyCount,
  downloadCount: bundles.downloadCount,
  cliInstallCount: bundles.cliInstallCount,
  isFeatured: bundles.isFeatured,
  isCurated: bundles.isCurated,
  sourceDomain: bundles.sourceDomain,
  sourceUrl: bundles.sourceUrl,
  authorName: bundles.authorName,
  authorUrl: bundles.authorUrl,
  license: bundles.license,
  attributionStatement: bundles.attributionStatement,
  publishedAt: bundles.publishedAt,
  updatedAt: bundles.updatedAt,
} as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Returns the bundle if it exists AND belongs to `userId`. Bypasses
 * the published-status filter so owners can preview their own drafts
 * (status=personal | pending_review | rejected | published).
 */
export async function getOwnerBundleById(
  bundleId: string,
  userId: string,
): Promise<OwnerBundleDetail | null> {
  if (!UUID_RE.test(bundleId)) return null;
  const [row] = await db
    .select({
      ...bundleDetailColumns,
      status: bundles.status,
      reviewNotes: bundles.reviewNotes,
      submittedAt: bundles.submittedAt,
    })
    .from(bundles)
    .leftJoin(categories, eq(bundles.primaryCategoryId, categories.id))
    .where(and(eq(bundles.id, bundleId), eq(bundles.createdBy, userId)))
    .limit(1);
  return (row as OwnerBundleDetail | undefined) ?? null;
}

export async function getPublishedBundleBySlug(slug: string): Promise<BundleDetail | null> {
  const [row] = await db
    .select({
      id: bundles.id,
      slug: bundles.slug,
      title: bundles.title,
      description: bundles.description,
      type: bundles.type,
      designMd: bundles.designMd,
      companionPrompt: bundles.companionPrompt,
      companionPromptVersion: bundles.companionPromptVersion,
      coverageScore: bundles.coverageScore,
      coverageColors: bundles.coverageColors,
      coverageTypography: bundles.coverageTypography,
      coverageLayout: bundles.coverageLayout,
      coverageElevation: bundles.coverageElevation,
      coverageShapes: bundles.coverageShapes,
      coverageComponents: bundles.coverageComponents,
      coverageDosDonts: bundles.coverageDosDonts,
      primaryCategorySlug: categories.slug,
      primaryCategoryName: categories.name,
      designStyle: bundles.designStyle,
      compatibleTools: bundles.compatibleTools,
      paletteColors: bundles.paletteColors,
      brandInitial: bundles.brandInitial,
      brandColor: bundles.brandColor,
      voteCount: bundles.voteCount,
      positiveVoteCount: bundles.positiveVoteCount,
      positiveVoteRate: bundles.positiveVoteRate,
      copyCount: bundles.copyCount,
      downloadCount: bundles.downloadCount,
      cliInstallCount: bundles.cliInstallCount,
      isFeatured: bundles.isFeatured,
      isCurated: bundles.isCurated,
      sourceDomain: bundles.sourceDomain,
      sourceUrl: bundles.sourceUrl,
      authorName: bundles.authorName,
      authorUrl: bundles.authorUrl,
      license: bundles.license,
      attributionStatement: bundles.attributionStatement,
      publishedAt: bundles.publishedAt,
      updatedAt: bundles.updatedAt,
    })
    .from(bundles)
    .leftJoin(categories, eq(bundles.primaryCategoryId, categories.id))
    .where(and(eq(bundles.slug, slug), eq(bundles.status, 'published')))
    .limit(1);
  return (row as BundleDetail | undefined) ?? null;
}
