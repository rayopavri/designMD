/**
 * useBundleDetail — fetches a single published bundle from
 * /api/bundles/[slug] and maps it into the UI's BundleItem shape so the
 * existing library detail components keep working unchanged.
 *
 * The row → UI conversion lives in `@/lib/ui-data/bundleDetailAdapter` (a
 * server-safe module) so the detail Server Component can pre-convert the
 * bundle and pass it here as `initialItem`. When seeded, the hook renders the
 * full spec immediately (no loading spinner) — which is what lands in the SSR
 * HTML for Google and non-JS AI crawlers — and skips the redundant initial
 * fetch. The polling leg still runs to upgrade a freshly-generated bundle
 * whose companion prompt / screenshot land after first paint.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { type BundleItem } from '@/lib/ui-data/items';
import {
  type ApiBundleDetail,
  detailToBundleItem,
  isWithinLastMinutes,
} from '@/lib/ui-data/bundleDetailAdapter';

// ─── Hook ───────────────────────────────────────────────────

interface UseBundleDetailResult {
  item: BundleItem | null;
  loading: boolean;
  notFound: boolean;
  error: Error | null;
}

export function useBundleDetail(
  slug: string | undefined,
  initialItem?: BundleItem | null,
): UseBundleDetailResult {
  const [item, setItem] = useState<BundleItem | null>(initialItem ?? null);
  const [loading, setLoading] = useState(!initialItem);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Slug we were SSR-seeded with. The initial fetch is skipped for this slug
  // (the server already gave us correct, rendered data), but a client-side
  // navigation to a *different* slug still fetches normally.
  const seededSlugRef = useRef<string | null>(initialItem ? (slug ?? null) : null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    if (seededSlugRef.current === slug) {
      // Consume the seed once so a later refetch (e.g. same-slug remount) still
      // works, but we don't flash a spinner over already-rendered SSR content.
      seededSlugRef.current = null;
      setLoading(false);
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

  // Two pieces of a freshly-generated bundle land asynchronously *after* the
  // row (and its slug) already exist, so a visitor can arrive mid-flight:
  //   1. the companion prompt — written by the Sonnet worker (Phase 3);
  //   2. the durable hero screenshot — captured by the capture-screenshot
  //      task that runs in parallel with Phases 2/3.
  // Poll the detail endpoint every 3s while either is still outstanding so the
  // page upgrades in place. Without the screenshot leg, a visitor who landed
  // before the capture task stored `previewImageUrl` was stuck with the
  // PreviewPane fallback forever (nothing refetched once the companion was
  // ready). That most visibly bit anonymous users viewing a bundle right after
  // generating it — signed-in owners tend to revisit later, once the capture
  // has landed — which looked like "screenshots only work for some people".
  //
  // Attempts are tracked in a ref (reset only when the slug changes) so the
  // cap survives the item-reference churn each poll causes, guaranteeing we
  // stop even when a screenshot never arrives (capture failed, or the source
  // genuinely produced none).
  const pollAttemptsRef = useRef(0);
  useEffect(() => {
    pollAttemptsRef.current = 0;
  }, [slug]);

  useEffect(() => {
    if (!slug || item?.type !== 'bundle') return;
    const b = item.bundle;

    const companionPending = b.companionStatus === 'pending';
    // A screenshot can still be in flight only for URL-sourced bundles
    // (uploads never produce one — `url` is empty) updated recently enough for
    // the capture task to plausibly still be running. The attempt cap is the
    // hard backstop against polling forever when capture failed.
    const screenshotPending =
      !b.previewImageUrl && !!b.url && isWithinLastMinutes(b.updatedAt, 10);

    if (!companionPending && !screenshotPending) return;
    const MAX_POLL_ATTEMPTS = 40; // ~2 min at 3s cadence — covers both legs
    if (pollAttemptsRef.current >= MAX_POLL_ATTEMPTS) return;

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      pollAttemptsRef.current += 1;
      try {
        const res = await fetch(`/api/bundles/${encodeURIComponent(slug)}`, {
          credentials: 'include',
        });
        if (!res.ok) return;
        const json = (await res.json()) as { data: ApiBundleDetail };
        if (cancelled) return;
        setItem(detailToBundleItem(json.data));
      } catch {
        // Soft fail; the effect re-runs and schedules the next attempt.
      }
    }, 3000);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [slug, item]);

  return { item, loading, notFound, error };
}
