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
import { useBundleItems } from '@/hooks/useBundleItems';
import { ItemCard } from '@/components/ui/ItemCard';
import type { BundleItem } from '@/lib/ui-data/items';

// Chip labels are abbreviated; `match` is the full BundleItem.category
// value the hook produces (see ITEM_CATEGORY_BY_SLUG in useBundleItems).
const CATEGORY_CHIPS: { label: string; match: string }[] = [
  { label: 'Productivity & SaaS', match: 'Productivity & SaaS' },
  { label: 'Developer Tools', match: 'Developer Tools & IDEs' },
  { label: 'AI & ML', match: 'AI & LLM Platforms' },
  { label: 'Backend & DevOps', match: 'Database & DevOps' },
  { label: 'Fintech', match: 'Fintech & Crypto' },
  { label: 'Design & Creative', match: 'Design & Creative Tools' },
  { label: 'E-commerce', match: 'E-commerce & Retail' },
  { label: 'Media & Consumer', match: 'Media & Consumer Tech' },
];

const ALL = 'all';

export function HomeLibrary() {
  const { items, loading, error } = useBundleItems();
  const [match, setMatch] = useState<string>(ALL);
  const [query, setQuery] = useState('');

  // Only design-system bundles on the home grid — skills/agents/mcps stay
  // accessible from /library.
  const bundles = useMemo(
    () => items.filter((i) => i.type === 'bundle'),
    [items],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bundles.filter((b) => {
      if (match !== ALL && b.category !== match) return false;
      if (!q) return true;
      const hay = [b.name, b.tagline, b.description, b.category]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [bundles, match, query]);

  const allCount = bundles.length;
  const hasFilters = match !== ALL || query.trim().length > 0;

  return (
    <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
      <div className="mx-auto max-w-screen-2xl px-6 lg:px-10 py-10">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div
            className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1"
            style={{ scrollbarWidth: 'none' }}
            role="tablist"
            aria-label="Filter by category"
          >
            <Chip
              active={match === ALL}
              onClick={() => setMatch(ALL)}
              label={`All ${allCount}`}
            />
            {CATEGORY_CHIPS.map((c) => (
              <Chip
                key={c.match}
                active={match === c.match}
                onClick={() => setMatch(c.match)}
                label={c.label}
              />
            ))}
          </div>

          <SearchBox value={query} onChange={setQuery} />
        </div>

        {error ? (
          <ErrorState message={error.message} />
        ) : loading ? (
          <LoadingState />
        ) : filtered.length === 0 ? (
          <EmptyState
            hasFilters={hasFilters}
            onClear={() => {
              setMatch(ALL);
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

function BundleGrid({ bundles }: { bundles: BundleItem[] }) {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px rounded-lg overflow-hidden"
      style={{ background: BORDER }}
    >
      {bundles.map((b) => (
        <ItemCard key={b.id} item={b} />
      ))}
    </div>
  );
}

function LoadingState() {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px rounded-lg overflow-hidden"
      style={{ background: BORDER }}
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="p-5" style={{ background: BG }}>
          <div
            className="h-1.5 mb-5 animate-pulse rounded-sm"
            style={{ background: SURFACE_2 }}
          />
          <div
            className="h-4 mb-2 rounded animate-pulse"
            style={{ background: SURFACE_2, width: '60%' }}
          />
          <div
            className="h-3 mb-4 rounded animate-pulse"
            style={{ background: SURFACE_2, width: '85%' }}
          />
          <div
            className="h-2 rounded animate-pulse"
            style={{ background: SURFACE_2, width: '40%' }}
          />
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
