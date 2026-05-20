'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import {
  BG,
  BORDER,
  BORDER_SOFT,
  INK,
  INK_ON_LIGHT,
  MONO,
  MUTED,
  SUB,
  SURFACE,
  SURFACE_2,
  VIOLET,
} from '@/lib/ui-data/tokens';
import { useBundles, type BundleSummary } from '@/hooks/useBundles';
import { HomeBundleCard } from '@/components/ui/HomeBundleCard';

const CATEGORY_CHIPS: { slug: string; label: string }[] = [
  { slug: 'productivity-saas', label: 'Productivity & SaaS' },
  { slug: 'developer-tools-ides', label: 'Developer Tools' },
  { slug: 'ai-llm-platforms', label: 'AI & ML' },
  { slug: 'database-devops', label: 'Backend & DevOps' },
  { slug: 'fintech-crypto', label: 'Fintech' },
  { slug: 'design-creative-tools', label: 'Design & Creative' },
  { slug: 'e-commerce-retail', label: 'E-commerce' },
  { slug: 'media-consumer-tech', label: 'Media & Consumer' },
];

const ALL = 'all';

export function HomeLibrary() {
  const { items, loading, error } = useBundles();
  const [category, setCategory] = useState<string>(ALL);
  const [query, setQuery] = useState('');

  const designBundles = useMemo(
    () => items.filter((b) => b.type === 'design_md'),
    [items],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return designBundles.filter((b) => {
      if (category !== ALL && b.primaryCategorySlug !== category) return false;
      if (!q) return true;
      const hay = [b.title, b.description, b.primaryCategoryName, b.sourceDomain]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [designBundles, category, query]);

  const allCount = designBundles.length;
  const hasFilters = category !== ALL || query.trim().length > 0;

  return (
    <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
      <div className="mx-auto max-w-6xl px-6 lg:px-8 py-10">
        {/* Filter row */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div
            className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1"
            style={{ scrollbarWidth: 'none' }}
            role="tablist"
            aria-label="Filter by category"
          >
            <Chip
              active={category === ALL}
              onClick={() => setCategory(ALL)}
              label={`All ${allCount}`}
            />
            {CATEGORY_CHIPS.map((c) => (
              <Chip
                key={c.slug}
                active={category === c.slug}
                onClick={() => setCategory(c.slug)}
                label={c.label}
              />
            ))}
          </div>

          <SearchBox value={query} onChange={setQuery} />
        </div>

        {/* Grid */}
        {error ? (
          <ErrorState message={error.message} />
        ) : loading ? (
          <LoadingState />
        ) : filtered.length === 0 ? (
          <EmptyState
            hasFilters={hasFilters}
            onClear={() => {
              setCategory(ALL);
              setQuery('');
            }}
          />
        ) : (
          <BundleGrid bundles={filtered} />
        )}
      </div>
    </section>
  );
}

// ─── Chip ────────────────────────────────────────────────────

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="text-[12px] px-3 py-1.5 rounded-full whitespace-nowrap transition-colors focus:outline-none"
      style={{
        background: active ? INK : SURFACE,
        color: active ? INK_ON_LIGHT : SUB,
        border: `1px solid ${active ? INK : BORDER}`,
      }}
    >
      {label}
    </button>
  );
}

// ─── Search ──────────────────────────────────────────────────

function SearchBox({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative w-full lg:w-[280px] shrink-0">
      <Search
        className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
        style={{ color: MUTED }}
        aria-hidden
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search..."
        aria-label="Search bundles"
        className="w-full pl-8 pr-3 py-2 text-[12.5px] rounded-full focus:outline-none"
        style={{
          background: SURFACE,
          color: INK,
          border: `1px solid ${BORDER}`,
          fontFamily: MONO,
        }}
      />
    </div>
  );
}

// ─── Grid ────────────────────────────────────────────────────

function BundleGrid({ bundles }: { bundles: BundleSummary[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {bundles.map((b, i) => (
        <HomeBundleCard key={b.id} bundle={b} priority={i < 3} />
      ))}
    </div>
  );
}

// ─── States ──────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i}>
          <div
            className="w-full rounded-xl animate-pulse"
            style={{
              aspectRatio: '16 / 11',
              background: SURFACE,
              border: `1px solid ${BORDER}`,
            }}
          />
          <div className="px-1 pt-3">
            <div
              className="h-3 rounded animate-pulse"
              style={{ background: SURFACE_2, width: '60%' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  hasFilters,
  onClear,
}: {
  hasFilters: boolean;
  onClear: () => void;
}) {
  return (
    <div
      className="rounded-lg py-16 px-6 text-center"
      style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
    >
      <div className="text-[14px] mb-2" style={{ color: INK }}>
        No bundles match your filters.
      </div>
      {hasFilters ? (
        <button
          type="button"
          onClick={onClear}
          className="text-[12px] underline"
          style={{ color: VIOLET, fontFamily: MONO }}
        >
          Clear filters
        </button>
      ) : (
        <div className="text-[12px]" style={{ color: SUB }}>
          The library is being curated — check back soon.
        </div>
      )}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div
      className="rounded-lg py-12 px-6 text-center"
      style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
    >
      <div className="text-[13px] mb-1" style={{ color: INK }}>
        Couldn&apos;t load the library.
      </div>
      <div className="text-[11.5px]" style={{ color: MUTED, fontFamily: MONO }}>
        {message}
      </div>
    </div>
  );
}
