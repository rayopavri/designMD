import { useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { ArrowUpRight, Check, Search, X } from "lucide-react";
import { SectionLabel } from "../components/Shell";
import {
  BG,
  BORDER,
  INK,
  LIME,
  MONO,
  MUTED,
  SUB,
  SURFACE,
  SURFACE_2,
  VIOLET,
} from "../lib/tokens";
import { CATEGORIES, FEELS, MODELS } from "../lib/bundles";
import {
  ITEMS,
  TYPE_FILTERS,
  TYPE_META,
  type BundleItem,
  type Item,
  type ItemType,
  type Tool,
} from "../lib/items";

type Sort = "popular" | "coverage" | "recent" | "alpha";

function recentRank(ago: string): number {
  // smaller = more recent
  const m = ago.match(/^(\d+)\s*(h|d|w|mo|y)/);
  if (!m) return 999;
  const n = parseInt(m[1] ?? "1", 10);
  const u = m[2];
  if (u === "h") return n;
  if (u === "d") return 24 + n * 24;
  if (u === "w") return 24 * 7 * (n + 1);
  if (u === "mo") return 24 * 30 * (n + 5);
  return 24 * 365 * (n + 12);
}

export function Library() {
  const search = useSearch();
  const initialFeel = useMemo(() => new URLSearchParams(search).get("feel") ?? "All", [search]);
  const initialType = useMemo(() => {
    const v = new URLSearchParams(search).get("type");
    return (v && (TYPE_FILTERS as string[]).includes(v) ? v : "All") as "All" | ItemType;
  }, [search]);

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"All" | ItemType>(initialType);
  const [category, setCategory] = useState<string>("All");
  const [feel, setFeel] = useState<string>(initialFeel);
  const [minCoverage, setMinCoverage] = useState<number>(0);
  const [model, setModel] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("popular");

  const filtered = useMemo(() => {
    let list = ITEMS.filter((it) => {
      if (typeFilter !== "All" && it.type !== typeFilter) return false;
      // Bundle-only filters only apply to bundles. Skip non-bundles when bundle-only filters are active.
      if (it.type === "bundle") {
        const b = it.bundle;
        if (category !== "All" && b.category !== category) return false;
        if (feel !== "All" && b.feel !== feel) return false;
        if (b.coverage < minCoverage) return false;
      } else {
        if (category !== "All" || feel !== "All" || minCoverage > 0) return false;
      }
      if (model && !(it.tools as string[]).includes(model)) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const haystack = [
          it.name,
          it.tagline,
          it.description,
          ...it.tags,
          ...(it.tools as string[]),
          it.type,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
    list = [...list];
    if (sort === "popular") {
      list.sort((a, b) => {
        const av = a.type === "bundle" ? a.bundle.voteCount : 0;
        const bv = b.type === "bundle" ? b.bundle.voteCount : 0;
        return bv - av;
      });
    }
    if (sort === "coverage") {
      list.sort((a, b) => {
        const av = a.type === "bundle" ? a.bundle.coverage : 0;
        const bv = b.type === "bundle" ? b.bundle.coverage : 0;
        return bv - av;
      });
    }
    if (sort === "alpha") list.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "recent") {
      list.sort((a, b) => recentRank(a.updatedAgo) - recentRank(b.updatedAgo));
    }
    return list;
  }, [query, typeFilter, category, feel, minCoverage, model, sort]);

  const activeFilters: { label: string; clear: () => void }[] = [];
  if (typeFilter !== "All")
    activeFilters.push({ label: TYPE_META[typeFilter].plural, clear: () => setTypeFilter("All") });
  if (category !== "All") activeFilters.push({ label: category, clear: () => setCategory("All") });
  if (feel !== "All") activeFilters.push({ label: feel, clear: () => setFeel("All") });
  if (minCoverage > 0)
    activeFilters.push({ label: `${minCoverage}%+ coverage`, clear: () => setMinCoverage(0) });
  if (model) activeFilters.push({ label: model, clear: () => setModel(null) });

  const bundleFiltersDisabled = typeFilter !== "All" && typeFilter !== "bundle";

  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-8 py-12">
      {/* Type filter chip row */}
      <div className="mb-8 flex items-center gap-2 flex-wrap">
        <span
          className="text-[10.5px] uppercase tracking-[0.22em] mr-2"
          style={{ fontFamily: MONO, color: MUTED }}
        >
          surface
        </span>
        {TYPE_FILTERS.map((t) => {
          const isAll = t === "All";
          const isActive = typeFilter === t;
          const count = isAll
            ? ITEMS.length
            : ITEMS.filter((i) => i.type === t).length;
          const label = isAll ? "All" : TYPE_META[t as ItemType].plural;
          const accent = isAll ? VIOLET : TYPE_META[t as ItemType].accent;
          return (
            <button
              key={t}
              onClick={() => setTypeFilter(t as "All" | ItemType)}
              className="inline-flex items-center gap-2 h-8 rounded-full border px-3 text-[12px]"
              style={{
                borderColor: isActive ? accent : BORDER,
                background: isActive ? `${accent}1A` : SURFACE,
                color: isActive ? INK : SUB,
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
              {label}
              <span style={{ fontFamily: MONO, color: MUTED }}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Sidebar */}
        <aside className="col-span-12 md:col-span-3 space-y-8">
          <div>
            <div
              className="text-[10.5px] uppercase tracking-[0.22em] mb-3"
              style={{ fontFamily: MONO, color: MUTED }}
            >
              Search
            </div>
            <div className="relative">
              <Search
                className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: MUTED }}
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Linear, Figma, agent…"
                className="w-full h-9 rounded-md border pl-9 pr-3 text-[12.5px]"
                style={{
                  borderColor: BORDER,
                  background: SURFACE,
                  color: INK,
                }}
              />
            </div>
          </div>

          <FilterBlock label="Category" disabled={bundleFiltersDisabled}>
            {CATEGORIES.map((c) => (
              <RadioRow
                key={c}
                label={c}
                checked={category === c}
                onChange={() => setCategory(c)}
                disabled={bundleFiltersDisabled}
              />
            ))}
          </FilterBlock>

          <FilterBlock label="Feel" disabled={bundleFiltersDisabled}>
            {FEELS.map((f) => (
              <RadioRow
                key={f}
                label={f}
                checked={feel === f}
                onChange={() => setFeel(f)}
                disabled={bundleFiltersDisabled}
              />
            ))}
          </FilterBlock>

          <FilterBlock label="Coverage score" disabled={bundleFiltersDisabled}>
            {[0, 80, 90, 95].map((v) => (
              <RadioRow
                key={v}
                label={v === 0 ? "Any" : `${v}%+ coverage`}
                checked={minCoverage === v}
                onChange={() => setMinCoverage(v)}
                disabled={bundleFiltersDisabled}
              />
            ))}
          </FilterBlock>

          <FilterBlock label="Tool">
            {MODELS.map((m) => (
              <CheckRow
                key={m}
                label={m}
                checked={model === m}
                onChange={() => setModel(model === m ? null : m)}
              />
            ))}
          </FilterBlock>
        </aside>

        {/* Results */}
        <section className="col-span-12 md:col-span-9">
          <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
            <div>
              <SectionLabel n="02" t="Spring 2026" />
              <h1 className="mt-3 text-[34px] leading-[1.08] font-medium tracking-[-0.018em]">
                {filtered.length}{" "}
                <span style={{ color: SUB }}>
                  {filtered.length === 1
                    ? `${typeFilter === "All" ? "item" : TYPE_META[typeFilter as ItemType].label.toLowerCase()} in stock.`
                    : `${typeFilter === "All" ? "items" : TYPE_META[typeFilter as ItemType].plural.toLowerCase()} in stock.`}
                </span>
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {activeFilters.length > 0 ? (
                <div className="flex items-center gap-2 flex-wrap">
                  {activeFilters.map((f) => (
                    <button
                      key={f.label}
                      onClick={f.clear}
                      className="inline-flex items-center gap-1.5 h-7 rounded-full border px-2.5 text-[11.5px]"
                      style={{ borderColor: BORDER, background: SURFACE, color: SUB }}
                    >
                      {f.label}
                      <X className="h-3 w-3" style={{ color: MUTED }} />
                    </button>
                  ))}
                </div>
              ) : null}
              <SortSelect value={sort} onChange={setSort} />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div
              className="rounded-lg border p-12 text-center"
              style={{ borderColor: BORDER, background: SURFACE }}
            >
              <p className="text-[14px]" style={{ color: SUB }}>
                Nothing matches these filters.
              </p>
            </div>
          ) : (
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px rounded-lg overflow-hidden"
              style={{ background: BORDER }}
            >
              {filtered.map((it) => (
                <ItemCard key={it.id} item={it} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ItemCard({ item }: { item: Item }) {
  const meta = TYPE_META[item.type];
  return (
    <Link
      href={`/library/${item.id}`}
      className="p-5 group transition-colors hover:bg-[#101013] block"
      style={{ background: BG }}
    >
      {/* Header strip — palette for bundles, single accent for others */}
      {item.type === "bundle" ? (
        <div className="flex h-1.5 mb-5">
          {(item as BundleItem).bundle.palette.map((c, i) => (
            <span
              key={i}
              className="flex-1 first:rounded-l-sm last:rounded-r-sm"
              style={{ background: c }}
            />
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 h-1.5 mb-5">
          <span
            className="h-1.5 flex-1 rounded-sm"
            style={{ background: `${meta.accent}` }}
          />
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <span
          className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em]"
          style={{ fontFamily: MONO, color: MUTED }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.accent }} />
          <span style={{ color: meta.accent, fontSize: 11, lineHeight: 1 }}>{meta.icon}</span>
          {meta.label} · № {item.num}
        </span>
        {item.type === "bundle" ? (
          <span
            className="inline-flex items-center gap-1.5 text-[10.5px]"
            style={{ fontFamily: MONO, color: SUB }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: LIME }} />
            {item.bundle.voteRate}% working
          </span>
        ) : (
          <span
            className="text-[10.5px]"
            style={{ fontFamily: MONO, color: SUB }}
          >
            {item.attribution.discoveryMethod === "Community" ? "community" : item.attribution.discoveryMethod === "Auto-discovered" ? "auto" : "editorial"}
          </span>
        )}
      </div>

      <div className="text-[16px] font-medium mb-1" style={{ color: INK }}>
        {item.name}
      </div>
      <div className="text-[12.5px] mb-5" style={{ color: SUB }}>
        {item.tagline}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          {(item.tools as Tool[]).slice(0, 3).map((m) => (
            <span
              key={m}
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{
                background: SURFACE_2,
                color: SUB,
                fontFamily: MONO,
                border: `1px solid ${BORDER}`,
              }}
            >
              {m.toLowerCase()}
            </span>
          ))}
        </div>
        {item.type === "bundle" ? (
          <span
            className="inline-flex items-center gap-1 text-[10.5px]"
            style={{ fontFamily: MONO, color: MUTED }}
          >
            <Check className="h-2.5 w-2.5" style={{ color: LIME }} />
            {item.bundle.coverage}%
            <span className="ml-2">{item.updatedAgo}</span>
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 text-[10.5px]"
            style={{ fontFamily: MONO, color: MUTED }}
          >
            <ArrowUpRight className="h-3 w-3" style={{ color: SUB }} />
            <span>{item.updatedAgo}</span>
          </span>
        )}
      </div>
    </Link>
  );
}

function FilterBlock({
  label,
  children,
  disabled,
}: {
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div style={{ opacity: disabled ? 0.4 : 1 }}>
      <div
        className="text-[10.5px] uppercase tracking-[0.22em] mb-3"
        style={{ fontFamily: MONO, color: MUTED }}
      >
        {label}
        {disabled ? <span className="ml-2" style={{ color: SUB }}>· bundles only</span> : null}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function RadioRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-2.5 text-[12.5px] ${
        disabled ? "cursor-not-allowed" : "cursor-pointer"
      }`}
    >
      <span
        className="relative inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border"
        style={{ borderColor: checked ? VIOLET : BORDER, background: SURFACE }}
      >
        {checked ? <span className="h-1.5 w-1.5 rounded-full" style={{ background: VIOLET }} /> : null}
      </span>
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="sr-only"
      />
      <span style={{ color: checked ? INK : SUB }}>{label}</span>
    </label>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2.5 text-[12.5px] cursor-pointer">
      <span
        className="inline-flex h-3.5 w-3.5 items-center justify-center rounded border"
        style={{ borderColor: checked ? VIOLET : BORDER, background: checked ? VIOLET : SURFACE }}
      >
        {checked ? <Check className="h-2.5 w-2.5" style={{ color: "#0A0A0B" }} strokeWidth={3} /> : null}
      </span>
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      <span style={{ color: checked ? INK : SUB }}>{label}</span>
    </label>
  );
}

function SortSelect({ value, onChange }: { value: Sort; onChange: (s: Sort) => void }) {
  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-[11px] uppercase tracking-[0.2em]" style={{ fontFamily: MONO, color: MUTED }}>
        sort
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Sort)}
        className="h-8 rounded-md border bg-transparent px-2 text-[12px]"
        style={{ borderColor: BORDER, background: SURFACE, color: INK }}
      >
        <option value="popular">Most popular</option>
        <option value="coverage">Highest coverage</option>
        <option value="recent">Recently updated</option>
        <option value="alpha">A → Z</option>
      </select>
    </div>
  );
}
