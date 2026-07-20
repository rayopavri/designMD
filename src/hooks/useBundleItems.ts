/**
 * useBundleItems — fetches published bundles from /api/bundles and maps
 * each row into the UI's BundleItem shape so the existing library
 * components keep working unchanged.
 *
 * Strategy: keep the UI's legacy Bundle/BundleItem types (used by the
 * shelf, cards, and filters) as the canonical UI contract. The row → UI
 * conversion lives in `@/lib/ui-data/bundleListAdapter` (a server-safe
 * module) so Server Components can pre-convert bundles and pass them here as
 * `initialItems`. When seeded, the hook skips the client fetch entirely: the
 * server HTML already carries every bundle link (crawlable), and a
 * client-side navigation re-runs the Server Component with fresh data.
 */
'use client';

import { useEffect, useState } from 'react';
import { type BundleItem } from '@/lib/ui-data/items';
import {
  type ApiBundleListItem,
  apiToBundleItem,
} from '@/lib/ui-data/bundleListAdapter';

// ─── Hook ───────────────────────────────────────────────────

interface UseBundleItemsResult {
  items: BundleItem[];
  loading: boolean;
  error: Error | null;
}

export function useBundleItems(initialItems?: BundleItem[]): UseBundleItemsResult {
  const hasInitial = initialItems != null;
  const [items, setItems] = useState<BundleItem[]>(initialItems ?? []);
  const [loading, setLoading] = useState(!hasInitial);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Seeded from the server → the list is already correct and rendered in the
    // SSR HTML. Skip the (potentially multi-page) client fetch; navigations
    // between routes re-run the Server Component and re-seed with fresh data.
    if (hasInitial) return;

    let cancelled = false;
    async function load() {
      try {
        const all: ApiBundleListItem[] = [];
        let cursor: string | undefined;
        do {
          const url = `/api/bundles?limit=60&sort=recent${cursor ? `&cursor=${cursor}` : ''}`;
          const res = await fetch(url, { credentials: 'include' });
          if (!res.ok) throw new Error(`API ${res.status}`);
          const json = (await res.json()) as { data: ApiBundleListItem[]; meta: { nextCursor: string | null } };
          if (cancelled) return;
          all.push(...json.data);
          cursor = json.meta.nextCursor ?? undefined;
        } while (cursor);
        if (!cancelled) setItems(all.map(apiToBundleItem));
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
  }, [hasInitial]);

  return { items, loading, error };
}
