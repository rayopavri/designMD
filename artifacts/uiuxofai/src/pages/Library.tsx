import { useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { Check, Search, X } from "lucide-react";
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
import { BUNDLES, CATEGORIES, FEELS, MODELS } from "../lib/bundles";

type Sort = "popular" | "coverage" | "recent" | "alpha";

export function Library() {
  const search = useSearch();
  const initialFeel = useMemo(() => new URLSearchParams(search).get("feel") ?? "All", [search]);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [feel, setFeel] = useState<string>(initialFeel);
  const [minCoverage, setMinCoverage] = useState<number>(0);
  const [model, setModel] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("popular");

  const filtered = useMemo(() => {
    let list = BUNDLES.filter((b) => {
      if (category !== "All" && b.category !== category) return false;
      if (feel !== "All" && b.feel !== feel) return false;
      if (b.coverage < minCoverage) return false;
      if (model && !b.worksWith.includes(model as any)) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        if (
          !b.name.toLowerCase().includes(q) &&
          !b.tagline.toLowerCase().includes(q) &&
          !b.tags.some((t) => t.toLowerCase().includes(q))
        )
          return false;
      }
      return true;
    });
    list = [...list];
    if (sort === "popular") list.sort((a, b) => b.voteCount - a.voteCount);
    if (sort === "coverage") list.sort((a, b) => b.coverage - a.coverage);
    if (sort === "alpha") list.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "recent") {
      const order = ["5h", "1d", "3d", "4d", "1w", "2w"];
      const rank = (s: string) => order.findIndex((p) => s.startsWith(p));
      list.sort((a, b) => rank(a.updatedAgo) - rank(b.updatedAgo));
    }
    return list;
  }, [query, category, feel, minCoverage, model, sort]);

  const activeFilters: { label: string; clear: () => void }[] = [];
  if (category !== "All") activeFilters.push({ label: category, clear: () => setCategory("All") });
  if (feel !== "All") activeFilters.push({ label: feel, clear: () => setFeel("All") });
  if (minCoverage > 0)
    activeFilters.push({ label: `${minCoverage}%+ coverage`, clear: () => setMinCoverage(0) });
  if (model) activeFilters.push({ label: model, clear: () => setModel(null) });

  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-8 py-12 grid grid-cols-12 gap-8">
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
              placeholder="Linear, Stripe…"
              className="w-full h-9 rounded-md border pl-9 pr-3 text-[12.5px]"
              style={{
                borderColor: BORDER,
                background: SURFACE,
                color: INK,
              }}
            />
          </div>
        </div>

        <FilterBlock label="Category">
          {CATEGORIES.map((c) => (
            <RadioRow key={c} label={c} checked={category === c} onChange={() => setCategory(c)} />
          ))}
        </FilterBlock>

        <FilterBlock label="Feel">
          {FEELS.map((f) => (
            <RadioRow key={f} label={f} checked={feel === f} onChange={() => setFeel(f)} />
          ))}
        </FilterBlock>

        <FilterBlock label="Coverage score">
          {[0, 80, 90, 95].map((v) => (
            <RadioRow
              key={v}
              label={v === 0 ? "Any" : `${v}%+ coverage`}
              checked={minCoverage === v}
              onChange={() => setMinCoverage(v)}
            />
          ))}
        </FilterBlock>

        <FilterBlock label="Model">
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
                {filtered.length === 1 ? "bundle in stock." : "bundles in stock."}
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
              No bundles match these filters.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px rounded-lg overflow-hidden" style={{ background: BORDER }}>
            {filtered.map((b) => (
              <Link
                key={b.id}
                href={`/library/${b.id}`}
                className="p-5 group transition-colors hover:bg-[#101013] block"
                style={{ background: BG }}
              >
                <div className="flex h-1.5 mb-5">
                  {b.palette.map((c, i) => (
                    <span
                      key={i}
                      className="flex-1 first:rounded-l-sm last:rounded-r-sm"
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between mb-4">
                  <span
                    className="text-[10px] uppercase tracking-[0.2em]"
                    style={{ fontFamily: MONO, color: MUTED }}
                  >
                    № {b.num}
                  </span>
                  <span
                    className="inline-flex items-center gap-1.5 text-[10.5px]"
                    style={{ fontFamily: MONO, color: SUB }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: LIME }} />
                    {b.voteRate}% working
                  </span>
                </div>
                <div className="text-[16px] font-medium mb-1" style={{ color: INK }}>
                  {b.name}
                </div>
                <div className="text-[12.5px] mb-5" style={{ color: SUB }}>
                  {b.tagline}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {b.worksWith.slice(0, 3).map((m) => (
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
                  <span
                    className="inline-flex items-center gap-1 text-[10.5px]"
                    style={{ fontFamily: MONO, color: MUTED }}
                  >
                    <Check className="h-2.5 w-2.5" style={{ color: LIME }} />
                    {b.coverage}%
                    <span className="ml-2">{b.updatedAgo}</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FilterBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        className="text-[10.5px] uppercase tracking-[0.22em] mb-3"
        style={{ fontFamily: MONO, color: MUTED }}
      >
        {label}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function RadioRow({
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
        className="relative inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border"
        style={{ borderColor: checked ? VIOLET : BORDER, background: SURFACE }}
      >
        {checked ? <span className="h-1.5 w-1.5 rounded-full" style={{ background: VIOLET }} /> : null}
      </span>
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
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
