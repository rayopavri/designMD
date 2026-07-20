/**
 * bundleDetailAdapter — converts an API/DB bundle *detail* row into the UI's
 * BundleItem shape.
 *
 * Extracted from the (client-only) useBundleDetail hook so the bundle detail
 * Server Component can convert the bundle on the server and hand it to the
 * client as `initialItem`. That makes the first HTML payload contain the full
 * DESIGN.md, companion prompt, palette, and coverage — the content Google
 * indexes and (critically) the content AI crawlers see, since they don't run
 * JavaScript and previously received only a "Fetching…" placeholder.
 *
 * No 'use client' directive — see the note in bundleListAdapter.ts.
 */
import {
  type BundleItem,
  type DiscoveryMethod,
  type Tool,
  TYPE_META,
} from '@/lib/ui-data/items';
import type { Bundle as UiBundle, SectionCoverage } from '@/lib/ui-data/bundles';

export interface ApiBundleDetail {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: string;
  status: string;
  designMd: string | null;
  companionPrompt: string;
  companionPromptVersion: number;
  coverageScore: number | null;
  coverageColors: number | null;
  coverageTypography: number | null;
  coverageLayout: number | null;
  coverageElevation: number | null;
  coverageShapes: number | null;
  coverageComponents: number | null;
  coverageDosDonts: number | null;
  primaryCategorySlug: string | null;
  primaryCategoryName: string | null;
  designStyle: string[];
  compatibleTools: string[];
  paletteColors: string[];
  brandLogoUrl: string | null;
  previewImageUrl: string | null;
  brandInitial: string | null;
  brandColor: string | null;
  voteCount: number;
  positiveVoteCount: number;
  positiveVoteRate: string;
  copyCount: number;
  downloadCount: number;
  cliInstallCount: number;
  isFeatured: boolean;
  isCurated: boolean;
  sourceDomain: string | null;
  sourceUrl: string | null;
  authorName: string | null;
  authorUrl: string | null;
  license: string | null;
  attributionStatement: string | null;
  accessibilityNotes: string | null;
  companionStatus: string;
  publishedAt: string | null;
  updatedAt: string;
}

/** DB row shape (dates are Date objects); server-side callers pass this in. */
export interface DbBundleDetail
  extends Omit<ApiBundleDetail, 'publishedAt' | 'updatedAt' | 'previewImageUrl'> {
  publishedAt: Date | null;
  updatedAt: Date;
  previewImageUrl?: string | null;
}

/**
 * Serialise a DB detail row into the JSON shape the client hook consumes, so
 * server- and client-produced BundleItems are byte-identical (no hydration
 * mismatch). Mirrors `NextResponse.json()` for the /api/bundles/[slug] route.
 */
export function serializeDetail(row: DbBundleDetail): ApiBundleDetail {
  return {
    ...row,
    previewImageUrl: row.previewImageUrl ?? null,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ─── Reverse mappers (DB → UI) ──────────────────────────────

type UiFeel = UiBundle['feel'];
type UiCategory = UiBundle['category'];
type ItemCategory = BundleItem['category'];

function feelFromDesignStyle(styles: string[]): UiFeel {
  const s = styles[0];
  switch (s) {
    case 'dark-mode':
      return 'Dark';
    case 'minimal':
      return 'Editorial';
    case 'bold':
      return 'Bold';
    case 'playful':
      return 'Playful';
    case 'enterprise':
    case 'accessible':
      return 'Corporate';
    default:
      return 'Editorial';
  }
}

function uiCategoryFromSlug(slug: string | null, bundleSlug: string): UiCategory {
  const override: Record<string, UiCategory> = {
    linear: 'Devtools',
    stripe: 'Finance',
    notion: 'Editorial',
    carbon: 'Enterprise',
    arc: 'Consumer',
    vercel: 'Devtools',
    ramp: 'Finance',
    atlassian: 'Enterprise',
  };
  if (override[bundleSlug]) return override[bundleSlug];
  switch (slug) {
    case 'marketing-sites':
      return 'Marketing';
    case 'mobile-apps':
      return 'Consumer';
    default:
      return 'Devtools';
  }
}

function toolsFromCompatible(tools: string[]): UiBundle['worksWith'] {
  const out: UiBundle['worksWith'] = [];
  for (const t of tools) {
    if (t === 'claude') out.push('Claude');
    else if (t === 'cursor') out.push('Cursor');
    else if (t === 'lovable') out.push('Lovable');
    else if (t === 'figma-make') out.push('Figma Make');
  }
  return out;
}

function itemToolsFromCompatible(tools: string[]): Tool[] {
  const out: Tool[] = [];
  for (const t of tools) {
    if (t === 'claude') out.push('Claude');
    else if (t === 'cursor') out.push('Cursor');
    else if (t === 'lovable') out.push('Lovable');
    else if (t === 'figma-make') out.push('Figma Make');
  }
  return out;
}

export function isWithinLastMinutes(iso: string | undefined, minutes: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < minutes * 60_000;
}

function relativeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const h = Math.floor(diffMs / (60 * 60 * 1000));
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  const y = Math.floor(d / 365);
  return `${y}y ago`;
}

const ITEM_CATEGORY_BY_SLUG: Record<string, ItemCategory> = {
  linear: 'Developer Tools & IDEs',
  stripe: 'Fintech & Crypto',
  notion: 'Productivity & SaaS',
  carbon: 'Database & DevOps',
  arc: 'Media & Consumer Tech',
  vercel: 'Developer Tools & IDEs',
  ramp: 'Fintech & Crypto',
  atlassian: 'Productivity & SaaS',
};

function itemCategoryFor(bundleSlug: string): ItemCategory {
  return ITEM_CATEGORY_BY_SLUG[bundleSlug] ?? 'Productivity & SaaS';
}

export function detailToBundleItem(row: ApiBundleDetail): BundleItem {
  const coverage = row.coverageScore ?? 0;
  const voteRate = parseFloat(row.positiveVoteRate);
  const palette = row.paletteColors.length > 0 ? row.paletteColors : ['#5E6AD2'];
  const worksWith = toolsFromCompatible(row.compatibleTools);
  const itemTools = itemToolsFromCompatible(row.compatibleTools);

  const sectionCoverage: SectionCoverage = {
    colors: row.coverageColors ?? 0,
    typography: row.coverageTypography ?? 0,
    spacing: row.coverageLayout ?? 0, // UI calls it spacing, DB calls it layout
    elevation: row.coverageElevation ?? 0,
    shapes: row.coverageShapes ?? 0,
    components: row.coverageComponents ?? 0,
    dosDonts: row.coverageDosDonts ?? 0,
  };

  const tagSet = new Set<string>();
  if (row.primaryCategoryName) tagSet.add(row.primaryCategoryName);
  for (const s of row.designStyle) tagSet.add(s);
  const tags = Array.from(tagSet);

  const updatedAgo = relativeAgo(row.updatedAt);

  const uiBundle: UiBundle = {
    id: row.slug,
    num: '—',
    name: row.title,
    tagline: row.description.split('.')[0]?.slice(0, 60) ?? row.title,
    description: row.description,
    category: uiCategoryFromSlug(row.primaryCategorySlug, row.slug),
    feel: feelFromDesignStyle(row.designStyle),
    palette,
    brandLogoUrl: row.brandLogoUrl ?? undefined,
    previewImageUrl: row.previewImageUrl ?? undefined,
    updatedAt: row.updatedAt,
    coverage,
    sectionCoverage,
    tokens: 0,
    components: 0,
    voteRate: isNaN(voteRate) ? 0 : voteRate,
    voteCount: row.voteCount,
    forks: row.copyCount + row.downloadCount + row.cliInstallCount,
    updatedAgo,
    url: row.sourceUrl ?? (row.sourceDomain ? `https://${row.sourceDomain}` : ''),
    license: row.license ?? 'MIT',
    maintainer: row.authorName ?? '',
    version: `1.0.${row.companionPromptVersion}`,
    worksWith,
    tags,
    designMd: row.designMd ?? '',
    companionPrompt: row.companionPrompt,
    scores: [],
    accessibilityNotes: row.accessibilityNotes ?? undefined,
    companionStatus:
      row.companionStatus === 'pending' || row.companionStatus === 'failed'
        ? row.companionStatus
        : 'ready',
    lifecycleStatus:
      row.status === 'personal' ||
      row.status === 'pending_review' ||
      row.status === 'published' ||
      row.status === 'flagged' ||
      row.status === 'rejected'
        ? row.status
        : 'published',
  };

  return {
    id: row.slug,
    type: 'bundle',
    num: '—',
    name: row.title,
    tagline: uiBundle.tagline,
    description: row.description,
    tags,
    tools: itemTools,
    relatedIds: [],
    updatedAgo,
    accent: TYPE_META.bundle.accent,
    icon: TYPE_META.bundle.icon,
    category: itemCategoryFor(row.slug),
    attribution: {
      sourceUrl: row.sourceUrl ?? (row.sourceDomain ? `https://${row.sourceDomain}` : ''),
      author: row.authorName ?? '',
      license: row.license ?? 'MIT',
      discoveryMethod: (row.isCurated ? 'Editorial' : 'Auto-discovered') as DiscoveryMethod,
      discoveredAt: updatedAgo,
      verifiedAt: updatedAgo,
    },
    bundle: uiBundle,
  };
}
