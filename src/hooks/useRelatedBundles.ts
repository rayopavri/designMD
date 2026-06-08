/**
 * useRelatedBundles — fetches related published bundles from
 * /api/bundles/[slug]/related and maps each row into the UI's BundleItem
 * shape so the existing library card components keep working unchanged.
 *
 * Reuses the list-row converter from useBundleItems. The mapper isn't
 * exported from that module, so (matching the existing convention where
 * useBundleDetail also re-declares its mappers) it is replicated here
 * minimally against the same ApiBundleListItem shape. Keep in sync with
 * useBundleItems.ts; future cleanup can extract a shared adapter.
 */
'use client';

import { useEffect, useState } from 'react';
import {
  type BundleItem,
  type DiscoveryMethod,
  type Tool,
  TYPE_META,
} from '@/lib/ui-data/items';
import type { Bundle as UiBundle, SectionCoverage } from '@/lib/ui-data/bundles';

interface ApiBundleListItem {
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
  publishedAt: string | null;
  updatedAt: string;
}

// ─── Reverse mappers (DB → UI) ──────────────────────────────
// Mirrors useBundleItems.ts.

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

function itemCategoryFor(apiCategoryName: string | null): ItemCategory {
  if (!apiCategoryName) return 'Productivity & SaaS';
  return apiCategoryName as ItemCategory;
}

function apiToBundleItem(row: ApiBundleListItem): BundleItem {
  const coverage = row.coverageScore ?? 0;
  const voteRate = parseFloat(row.positiveVoteRate);
  const palette = row.paletteColors.length > 0 ? row.paletteColors : ['#5E6AD2'];
  const worksWith = toolsFromCompatible(row.compatibleTools);
  const itemTools = itemToolsFromCompatible(row.compatibleTools);
  const sectionCoverage: SectionCoverage = {
    colors: 0,
    typography: 0,
    spacing: 0,
    elevation: 0,
    shapes: 0,
    components: 0,
    dosDonts: 0,
  };

  const tagSet = new Set<string>();
  if (row.primaryCategoryName) tagSet.add(row.primaryCategoryName);
  for (const s of row.designStyle) tagSet.add(s);
  const tags = Array.from(tagSet);

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
    coverage,
    sectionCoverage,
    tokens: 0,
    components: 0,
    voteRate: isNaN(voteRate) ? 0 : voteRate,
    voteCount: row.voteCount,
    forks: 0,
    updatedAgo: relativeAgo(row.updatedAt),
    url: row.sourceDomain ?? '',
    license: row.license ?? 'MIT',
    maintainer: row.authorName ?? '',
    version: '1.0.0',
    worksWith,
    tags,
    designMd: '',
    companionPrompt: '',
    scores: [],
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
    updatedAgo: uiBundle.updatedAgo,
    accent: TYPE_META.bundle.accent,
    icon: TYPE_META.bundle.icon,
    category: itemCategoryFor(row.primaryCategoryName),
    attribution: {
      sourceUrl: `https://${row.sourceDomain ?? ''}`,
      author: row.authorName ?? '',
      license: row.license ?? 'MIT',
      discoveryMethod: (row.isCurated ? 'Editorial' : 'Auto-discovered') as DiscoveryMethod,
      discoveredAt: uiBundle.updatedAgo,
      verifiedAt: uiBundle.updatedAgo,
    },
    bundle: uiBundle,
  };
}

// ─── Hook ───────────────────────────────────────────────────

interface UseRelatedBundlesResult {
  items: BundleItem[];
  loading: boolean;
  sourceCategoryName: string | null;
  sourceCategorySlug: string | null;
}

export function useRelatedBundles(slug: string | undefined): UseRelatedBundlesResult {
  const [items, setItems] = useState<BundleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceCategoryName, setSourceCategoryName] = useState<string | null>(null);
  const [sourceCategorySlug, setSourceCategorySlug] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/bundles/${encodeURIComponent(slug!)}/related`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const json = (await res.json()) as {
          data: ApiBundleListItem[];
          sourceCategoryName: string | null;
          sourceCategorySlug: string | null;
        };
        if (cancelled) return;
        setItems(json.data.map(apiToBundleItem));
        setSourceCategoryName(json.sourceCategoryName ?? null);
        setSourceCategorySlug(json.sourceCategorySlug ?? null);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { items, loading, sourceCategoryName, sourceCategorySlug };
}
