/**
 * useBundleDetail — fetches a single published bundle from
 * /api/bundles/[slug] and maps it into the UI's BundleItem shape so the
 * existing library detail components keep working unchanged.
 *
 * Mirrors the converter in useBundleItems but adds the detail-only
 * fields: design.md body, companion prompt, and the per-section
 * coverage breakdown.
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

interface ApiBundleDetail {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: string;
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

// ─── Reverse mappers (DB → UI) ──────────────────────────────
// NOTE: these mirror useBundleItems.ts. Keep them in sync; future cleanup
// can extract them into a shared adapter module.

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

function detailToBundleItem(row: ApiBundleDetail): BundleItem {
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

// ─── Hook ───────────────────────────────────────────────────

interface UseBundleDetailResult {
  item: BundleItem | null;
  loading: boolean;
  notFound: boolean;
  error: Error | null;
}

export function useBundleDetail(slug: string | undefined): UseBundleDetailResult {
  const [item, setItem] = useState<BundleItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setNotFound(false);
      setError(null);
      try {
        const res = await fetch(`/api/bundles/${encodeURIComponent(slug!)}`, {
          credentials: 'include',
        });
        if (res.status === 404) {
          if (!cancelled) {
            setNotFound(true);
            setItem(null);
          }
          return;
        }
        if (!res.ok) throw new Error(`API ${res.status}`);
        const json = (await res.json()) as { data: ApiBundleDetail };
        if (cancelled) return;
        setItem(detailToBundleItem(json.data));
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error('Failed to load bundle'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // While the companion prompt is still being generated by the second
  // worker function, poll every 3s until it flips to ready/failed.
  useEffect(() => {
    if (!slug) return;
    const status = item?.type === 'bundle' ? item.bundle.companionStatus : undefined;
    if (status !== 'pending') return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/bundles/${encodeURIComponent(slug)}`, {
          credentials: 'include',
        });
        if (!res.ok) return;
        const json = (await res.json()) as { data: ApiBundleDetail };
        if (cancelled) return;
        setItem(detailToBundleItem(json.data));
      } catch {
        // Soft fail; next tick will retry.
      }
    };
    const interval = window.setInterval(() => void tick(), 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [slug, item]);

  return { item, loading, notFound, error };
}
