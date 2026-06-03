'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import {
  BG,
  BORDER,
  BORDER_SOFT,
  INK,
  MONO,
  MUTED,
  SUB,
  SURFACE_2,
  VIOLET,
} from '@/lib/ui-data/tokens';
import { useBundleItems } from '@/hooks/useBundleItems';
import { ItemCard } from '@/components/ui/ItemCard';

const TOP_N = 20;

export function HomeFeaturedBundles() {
  const { items, loading, error } = useBundleItems();

  const top20 = useMemo(() => {
    const bundles = items.filter((i) => i.type === 'bundle');
    return [...bundles]
      .sort((a, b) => (b.bundle.coverage ?? 0) - (a.bundle.coverage ?? 0))
      .slice(0, TOP_N);
  }, [items]);

  return (
    <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
      <div className="mx-auto max-w-screen-2xl px-6 lg:px-10 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div
            className="text-[10.5px] uppercase tracking-[0.22em]"
            style={{ fontFamily: MONO, color: MUTED }}
          >
            Top design skills by coverage
          </div>
          {!loading && top20.length > 0 && (
            <span className="text-[10.5px]" style={{ fontFamily: MONO, color: MUTED }}>
              {top20.length} of {items.filter((i) => i.type === 'bundle').length}
            </span>
          )}
        </div>

        {/* Grid */}
        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="py-10 text-center text-[13px]" style={{ color: SUB }}>
            Couldn&apos;t load design skills.
          </div>
        ) : (
          <BundleGrid bundles={top20} />
        )}

        {/* CTA */}
        {!loading && !error && (
          <Link
            href="/library"
            className="mt-px flex items-center justify-center gap-2 py-4 text-[13px] font-medium rounded-b-lg transition-opacity hover:opacity-70"
            style={{
              background: BG,
              color: INK,
              border: `1px solid ${BORDER}`,
              borderTop: 'none',
            }}
          >
            View all design skills
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </section>
  );
}

function BundleGrid({ bundles }: { bundles: ReturnType<typeof useBundleItems>['items'] }) {
  const fillers = (4 - (bundles.length % 4)) % 4;
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px rounded-t-lg overflow-hidden"
      style={{ background: BORDER }}
    >
      {bundles.map((b) => (
        <ItemCard key={b.id} item={b} />
      ))}
      {Array.from({ length: fillers }).map((_, i) => (
        <div key={`filler-${i}`} style={{ background: BG }} />
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px rounded-lg overflow-hidden"
      style={{ background: BORDER }}
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="p-5" style={{ background: BG }}>
          <div className="h-1.5 mb-5 animate-pulse rounded-sm" style={{ background: SURFACE_2 }} />
          <div className="h-4 mb-2 rounded animate-pulse" style={{ background: SURFACE_2, width: '60%' }} />
          <div className="h-3 mb-4 rounded animate-pulse" style={{ background: SURFACE_2, width: '85%' }} />
          <div className="h-2 rounded animate-pulse" style={{ background: SURFACE_2, width: '40%' }} />
        </div>
      ))}
    </div>
  );
}
