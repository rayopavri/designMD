/**
 * useBundles — minimal client hook returning the raw /api/bundles
 * response. Used by the home gallery; the legacy useBundleItems hook
 * lives next door and continues to feed the library page's mixed
 * Skill/Agent/MCP grid.
 */
'use client';

import { useEffect, useState } from 'react';

export interface BundleSummary {
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
  screenshotUrl: string | null;
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

interface UseBundlesResult {
  items: BundleSummary[];
  loading: boolean;
  error: Error | null;
}

export function useBundles(): UseBundlesResult {
  const [items, setItems] = useState<BundleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/bundles?limit=60&sort=top', {
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const json = (await res.json()) as { data: BundleSummary[] };
        if (cancelled) return;
        setItems(json.data);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error('Failed to load bundles'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { items, loading, error };
}
