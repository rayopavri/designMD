/**
 * Bundle read queries.
 *
 * Centralised so route handlers stay slim and we can reuse the same
 * filter/sort logic from the upcoming search index build and admin views.
 */
import { cache } from 'react';
import { and, arrayOverlaps, asc, desc, eq, ilike, inArray, ne, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { bundles, categories } from '@/lib/db/schema';

export interface BundleListFilters {
  category?: string; // category slug
  type?: 'design_md' | 'skill' | 'agent';
  designStyle?: string[]; // ['dark-mode', 'minimal', ...]
  tools?: string[]; // ['claude', 'cursor', ...]
  q?: string; // search query (matches title, description)
  sort?: 'recent' | 'top' | 'trending' | 'alpha';
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
  brandLogoUrl: string | null;
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
  const offset = filters.cursor ? Math.max(0, Number.parseInt(filters.cursor, 10) || 0) : 0;

  const conditions: SQL[] = [eq(bundles.status, 'published')];

  if (filters.category) {
    conditions.push(eq(categories.slug, filters.category));
  }
  if (filters.type) {
    conditions.push(eq(bundles.type, filters.type));
  }
  if (filters.designStyle?.length) {
    // array && array → true if they overlap. arrayOverlaps parameterizes the
    // values, so no manual quote-escaping / injection surface.
    conditions.push(arrayOverlaps(bundles.designStyle, filters.designStyle));
  }
  if (filters.tools?.length) {
    conditions.push(arrayOverlaps(bundles.compatibleTools, filters.tools));
  }
  if (filters.q) {
    const term = `%${filters.q.trim()}%`;
    const qCond = or(ilike(bundles.title, term), ilike(bundles.description, term));
    if (qCond) conditions.push(qCond);
  }
  // Sort: 'recent' = publishedAt desc; 'top' = positiveVoteRate desc, voteCount desc;
  // 'trending' = a simple recency-weighted score for now (positive rate * log(votes+1)).
  let orderBy: SQL[];
  switch (filters.sort) {
    case 'top':
      orderBy = [desc(bundles.positiveVoteRate), desc(bundles.voteCount), desc(bundles.publishedAt), desc(bundles.id)];
      break;
    case 'trending':
      orderBy = [
        desc(sql`(${bundles.positiveVoteRate}::numeric * ln(${bundles.voteCount} + 1))`),
        desc(bundles.publishedAt),
        desc(bundles.id),
      ];
      break;
    case 'recent':
    default:
      orderBy = [desc(bundles.publishedAt), desc(bundles.createdAt), desc(bundles.id)];
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
      publishedAt: bundles.publishedAt,
      updatedAt: bundles.updatedAt,
    })
    .from(bundles)
    .leftJoin(categories, eq(bundles.primaryCategoryId, categories.id))
    .where(and(...conditions))
    .orderBy(...orderBy)
    .limit(limit + 1)
    .offset(offset);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? String(offset + limit) : null;

  return { items: items as BundleListItem[], nextCursor };
}

/**
 * Every published bundle matching the (optional) filters, recent-first, in the
 * shape the client list hook expects. Used by the home + library Server
 * Components to seed `useBundleItems` — and by the category/tool landing pages
 * — so the first HTML payload contains all matching bundle links (crawlable by
 * Google + non-JS AI crawlers). Pages through `listPublishedBundles` so it
 * reuses the exact same select/sort logic.
 */
export async function listAllPublishedBundles(
  extra: Pick<BundleListFilters, 'category' | 'type' | 'designStyle' | 'tools' | 'q'> = {},
): Promise<BundleListItem[]> {
  const all: BundleListItem[] = [];
  let cursor: string | undefined;
  do {
    const { items, nextCursor } = await listPublishedBundles({
      ...extra,
      sort: 'recent',
      limit: MAX_LIMIT,
      cursor,
    });
    all.push(...items);
    cursor = nextCursor ?? undefined;
  } while (cursor);
  return all;
}

export interface CategoryWithCount {
  slug: string;
  name: string;
  count: number;
}

/**
 * Categories that have at least one published bundle, with counts, most-
 * populated first. Powers the category landing pages, their sitemap entries,
 * and the "browse by category" internal-link strip.
 */
export const listCategoriesWithPublishedCounts = cache(
  async (): Promise<CategoryWithCount[]> => {
    const rows = await db
      .select({
        slug: categories.slug,
        name: categories.name,
        count: sql<number>`count(${bundles.id})::int`,
      })
      .from(categories)
      .innerJoin(
        bundles,
        and(eq(bundles.primaryCategoryId, categories.id), eq(bundles.status, 'published')),
      )
      .groupBy(categories.slug, categories.name)
      .orderBy(desc(sql`count(${bundles.id})`), asc(categories.name));
    return rows;
  },
);

// ─── Admin list query ─────────────────────────────────────────
// Mirrors listPublishedBundles but does NOT clamp to status='published'.
// Editors use this to see every bundle across all lifecycle states.

const ADMIN_STATUSES = [
  'personal',
  'pending_review',
  'published',
  'flagged',
  'rejected',
  'archived',
] as const;
type AdminStatus = (typeof ADMIN_STATUSES)[number];

export interface AdminBundleListFilters extends BundleListFilters {
  /** When omitted, all statuses are returned. */
  status?: AdminStatus[];
}

export interface AdminBundleListItem extends BundleListItem {
  status: string;
  companionStatus: string;
  submittedAt: Date | null;
  reviewedAt: Date | null;
}

export async function listAdminBundles(
  filters: AdminBundleListFilters,
): Promise<{ items: AdminBundleListItem[]; nextCursor: string | null }> {
  const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const offset = filters.cursor ? Math.max(0, Number.parseInt(filters.cursor, 10) || 0) : 0;

  const conditions: SQL[] = [];

  if (filters.status?.length) {
    conditions.push(inArray(bundles.status, filters.status));
  }
  if (filters.category) {
    conditions.push(eq(categories.slug, filters.category));
  }
  if (filters.type) {
    conditions.push(eq(bundles.type, filters.type));
  }
  if (filters.designStyle?.length) {
    conditions.push(arrayOverlaps(bundles.designStyle, filters.designStyle));
  }
  if (filters.tools?.length) {
    conditions.push(arrayOverlaps(bundles.compatibleTools, filters.tools));
  }
  if (filters.q) {
    const term = `%${filters.q.trim()}%`;
    const qCond = or(ilike(bundles.title, term), ilike(bundles.description, term));
    if (qCond) conditions.push(qCond);
  }
  // Admin sort modes: 'recent' = updatedAt desc, 'submitted' = submittedAt desc,
  // 'score' = coverageScore desc, 'alpha' = title asc.
  let orderBy: SQL[];
  switch (filters.sort) {
    case 'top':
      orderBy = [desc(bundles.coverageScore), desc(bundles.updatedAt), desc(bundles.id)];
      break;
    case 'trending':
      orderBy = [desc(bundles.submittedAt), desc(bundles.updatedAt), desc(bundles.id)];
      break;
    case 'alpha':
      orderBy = [asc(bundles.title), asc(bundles.id)];
      break;
    case 'recent':
    default:
      orderBy = [desc(bundles.updatedAt), desc(bundles.createdAt), desc(bundles.id)];
      break;
  }

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
      updatedAt: bundles.updatedAt,
    })
    .from(bundles)
    .leftJoin(categories, eq(bundles.primaryCategoryId, categories.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(...orderBy)
    .limit(limit + 1)
    .offset(offset);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? String(offset + limit) : null;

  return { items: items as AdminBundleListItem[], nextCursor };
}

export interface BundleDetail extends BundleListItem {
  status: string;
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
  accessibilityNotes: string | null;
  companionStatus: string;
  previewImageUrl?: string | null;
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
  brandLogoUrl: bundles.brandLogoUrl,
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
  accessibilityNotes: bundles.accessibilityNotes,
  companionStatus: bundles.companionStatus,
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

/**
 * Returns the bundle by slug as long as it isn't archived. Used by
 * the public detail page (`/library/[slug]`) so freshly-generated
 * bundles (status='pending_review' or 'personal') can be linked
 * directly by their slug. The listing page still filters to
 * status='published' separately, so non-published bundles only appear
 * if you know the slug.
 */
export const getVisibleBundleBySlug = cache(async (slug: string): Promise<BundleDetail | null> => {
  // Column set excluding preview_image_url, so we can transparently fall back
  // when that column hasn't been migrated yet (mirrors setJobStep's
  // migration-tolerant retry in the scrape worker).
  const cols = {
    id: bundles.id,
    slug: bundles.slug,
    title: bundles.title,
    description: bundles.description,
    type: bundles.type,
    status: bundles.status,
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
    brandLogoUrl: bundles.brandLogoUrl,
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
    accessibilityNotes: bundles.accessibilityNotes,
    companionStatus: bundles.companionStatus,
    publishedAt: bundles.publishedAt,
    updatedAt: bundles.updatedAt,
  };
  const visible = and(eq(bundles.slug, slug), ne(bundles.status, 'archived'));
  try {
    const [row] = await db
      .select({ ...cols, previewImageUrl: bundles.previewImageUrl })
      .from(bundles)
      .leftJoin(categories, eq(bundles.primaryCategoryId, categories.id))
      .where(visible)
      .limit(1);
    return (row as BundleDetail | undefined) ?? null;
  } catch {
    // preview_image_url not present yet (migration pending) — degrade so the
    // detail page keeps working; the hero falls back to the live PreviewPane.
    const [row] = await db
      .select(cols)
      .from(bundles)
      .leftJoin(categories, eq(bundles.primaryCategoryId, categories.id))
      .where(visible)
      .limit(1);
    return row ? ({ ...row, previewImageUrl: null } as BundleDetail) : null;
  }
});

/** @deprecated use getVisibleBundleBySlug. Kept as an alias for any
 * callers we haven't migrated yet — same query path now returns
 * non-archived too. */
export const getPublishedBundleBySlug = getVisibleBundleBySlug;

// ─── Owner list query ─────────────────────────────────────────
// Used by /account/bundles — returns every bundle the user created,
// regardless of status, ordered by most-recently-updated.

export interface UserBundleListItem extends BundleListItem {
  status: string;
  companionStatus: string;
  submittedAt: Date | null;
  reviewedAt: Date | null;
}

export async function listUserBundles(userId: string): Promise<UserBundleListItem[]> {
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
      updatedAt: bundles.updatedAt,
    })
    .from(bundles)
    .leftJoin(categories, eq(bundles.primaryCategoryId, categories.id))
    .where(eq(bundles.createdBy, userId))
    .orderBy(desc(bundles.updatedAt), desc(bundles.createdAt));
  return rows as UserBundleListItem[];
}

// ─── Related bundles query ────────────────────────────────────
// Surfaces other published design systems that share a primary
// category, design style, or compatible tool with the source bundle.
// Returns the same row shape as listPublishedBundles so the existing
// list→BundleItem mapper works unchanged.

const RELATED_DEFAULT_LIMIT = 6;

export interface RelatedBundlesResult {
  items: BundleListItem[];
  sourceCategoryName: string | null;
  sourceCategorySlug: string | null;
}

export async function getRelatedBundles(
  slug: string,
  limit = RELATED_DEFAULT_LIMIT,
): Promise<RelatedBundlesResult> {
  // Look up the source bundle's matchable attributes by slug.
  const [source] = await db
    .select({
      id: bundles.id,
      primaryCategoryId: bundles.primaryCategoryId,
      primaryCategoryName: categories.name,
      primaryCategorySlug: categories.slug,
      designStyle: bundles.designStyle,
      compatibleTools: bundles.compatibleTools,
    })
    .from(bundles)
    .leftJoin(categories, eq(bundles.primaryCategoryId, categories.id))
    .where(eq(bundles.slug, slug))
    .limit(1);

  if (!source) return { items: [], sourceCategoryName: null, sourceCategorySlug: null };

  // Match on any of: same primary category, overlapping design styles,
  // or overlapping compatible tools. Skip the array-overlap predicates
  // when the source arrays are empty so we never emit `ARRAY[]::text[]`.
  const matchConditions: SQL[] = [];
  if (source.primaryCategoryId) {
    matchConditions.push(eq(bundles.primaryCategoryId, source.primaryCategoryId));
  }
  if (source.designStyle.length) {
    matchConditions.push(arrayOverlaps(bundles.designStyle, source.designStyle));
  }
  if (source.compatibleTools.length) {
    matchConditions.push(arrayOverlaps(bundles.compatibleTools, source.compatibleTools));
  }

  // Nothing to relate on (no category, no styles, no tools).
  if (matchConditions.length === 0) return { items: [], sourceCategoryName: source.primaryCategoryName, sourceCategorySlug: source.primaryCategorySlug };

  const matchClause = matchConditions.length === 1 ? matchConditions[0] : or(...matchConditions);

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
      publishedAt: bundles.publishedAt,
      updatedAt: bundles.updatedAt,
    })
    .from(bundles)
    .leftJoin(categories, eq(bundles.primaryCategoryId, categories.id))
    .where(and(eq(bundles.status, 'published'), ne(bundles.id, source.id), matchClause))
    .orderBy(desc(bundles.positiveVoteRate), desc(bundles.voteCount))
    .limit(limit);

  return {
    items: rows as BundleListItem[],
    sourceCategoryName: source.primaryCategoryName,
    sourceCategorySlug: source.primaryCategorySlug,
  };
}

export interface BundleIndexItem {
  id: string;
  slug: string;
  title: string | null;
  description: string | null;
  designMd: string | null;
  compatibleTools: string[];
  primaryCategoryName: string | null;
}

export async function listPublishedForIndex(): Promise<BundleIndexItem[]> {
  const rows = await db
    .select({
      id: bundles.id,
      slug: bundles.slug,
      title: bundles.title,
      description: bundles.description,
      designMd: bundles.designMd,
      compatibleTools: bundles.compatibleTools,
      primaryCategoryName: categories.name,
    })
    .from(bundles)
    .leftJoin(categories, eq(bundles.primaryCategoryId, categories.id))
    .where(eq(bundles.status, 'published'));
  return rows;
}

// Auto-captured screenshots (new generation + backfill) live at the unversioned
// `{id}.webp` path. Admin uploads and recaptures write `{id}-{timestamp}.webp`.
// Matching this pattern lets recapture jobs refresh auto-captured images while
// leaving every admin-touched screenshot alone.
export const isAutoCapturedScreenshot = sql`${bundles.previewImageUrl} LIKE '%/' || ${bundles.id}::text || '.webp'`;
