import { useMemo, useState } from "react";
import { LibraryFilterPanel } from "../components/LibraryFilterPanel";
import {
  matchesCategory,
  matchesShelf,
  useLibraryFilters,
  type ShelfType,
} from "../lib/libraryFilters";
import { Link } from "wouter";
import { ArrowUpRight, X } from "lucide-react";
import { ItemCard } from "../components/ItemCard";
import {
  BG,
  BORDER,
  BORDER_SOFT,
  INK,
  MONO,
  MUTED,
  SUB,
  SURFACE,
  VIOLET,
} from "../lib/tokens";

import {
  DISPLAY_TYPES,
  ITEMS,
  TYPE_META,
  displayTypeOf,
  isDesignSystem,
  type Item,
} from "../lib/items";

type Sort = "popular" | "coverage" | "recent" | "alpha";

const SHELF_BLURBS: Record<"skill" | "agent" | "mcp", string> = {
  skill: "Single-purpose instruction files — including real brand design systems you can drop into Claude or Cursor.",
  agent: "Personas with a charter — UI engineer, design critic, architect.",
  mcp: "Connections that let your tool see Figma, Mobbin, and more.",
};

const TYPE_PATH: Record<"skill" | "agent" | "mcp", string> = {
  skill: "/library/skills",
  agent: "/library/agents",
  mcp: "/library/mcps",
};

function recentRank(ago: string): number {
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
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("popular");
  const { filters, setType, setCategory, activeCount } = useLibraryFilters();

  const filtered = useMemo(() => {
    let list: Item[] = ITEMS.filter((it) => {
      if (!matchesShelf(it, filters.type)) return false;
      if (!matchesCategory(it, filters.category)) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const haystack = [
          it.name,
          it.tagline,
          it.description,
          it.category,
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
        const av = a.type === "bundle" ? a.bundle.forks : 0;
        const bv = b.type === "bundle" ? b.bundle.forks : 0;
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
  }, [query, filters.type, filters.category, sort]);

  const headingNoun =
    filters.type === "all"
      ? filtered.length === 1
        ? "item"
        : "items"
      : filters.type === "design-systems"
      ? filtered.length === 1
        ? "design system"
        : "design systems"
      : filters.type === "skills"
      ? filtered.length === 1
        ? "skill"
        : "skills"
      : filters.type === "agents"
      ? filtered.length === 1
        ? "agent"
        : "agents"
      : filtered.length === 1
      ? "MCP"
      : "MCPs";

  const requestKind: { label: string; href: string } = (() => {
    switch (filters.type) {
      case "skills":
        return { label: "Skill", href: "/generate?type=skill" };
      case "agents":
        return { label: "Agent", href: "/generate?type=agent" };
      case "mcps":
        return { label: "MCP", href: "/generate?type=mcp" };
      case "design-systems":
        return { label: "Design system", href: "/generate?type=bundle" };
      default:
        return { label: "Design system", href: "/generate?type=bundle" };
    }
  })();

  return (
    <>
      {/* Hub intro + three shelves */}
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-7xl px-6 lg:px-8 pt-12 pb-14">
          <div className="grid grid-cols-12 gap-8 items-end mb-10">
            <div className="col-span-12 lg:col-span-7">
              <div
                className="text-[10.5px] uppercase tracking-[0.22em] mb-3"
                style={{ fontFamily: MONO, color: MUTED }}
              >
                The library
              </div>
              <h1 className="text-[44px] sm:text-[54px] leading-[1.02] font-medium tracking-[-0.022em]">
                Pick your shelf.
                <br />
                <span style={{ color: SUB }}>Install what fits. Ship.</span>
              </h1>
              <p className="mt-5 max-w-[36rem] text-[14.5px] leading-[1.6]" style={{ color: SUB }}>
                Three shelves: Skills (including real brand design systems), Agents, and MCPs.
                Each one slots into Claude, Cursor, Lovable, or Figma Make. Open a shelf to see
                what's inside — or use the grid below to search across everything.
              </p>
            </div>
            <div className="col-span-12 lg:col-span-5">
              <div
                className="rounded-xl border p-5 text-[12.5px] leading-[1.6]"
                style={{ borderColor: BORDER, background: SURFACE, color: SUB }}
              >
                <div
                  className="text-[10.5px] uppercase tracking-[0.22em] mb-2"
                  style={{ fontFamily: MONO, color: MUTED }}
                >
                  New here?
                </div>
                Each shelf has a short "how to use one" walkthrough at the top — three steps, no
                jargon. Start with{" "}
                <Link href="/library?type=design-systems" style={{ color: VIOLET }}>
                  Design systems
                </Link>{" "}
                if you want fast on-brand UI.
              </div>
            </div>
          </div>

          <div
            className="grid grid-cols-1 sm:grid-cols-3 gap-px rounded-lg overflow-hidden"
            style={{ background: BORDER }}
          >
            {DISPLAY_TYPES.map((t) => {
              const m = TYPE_META[t];
              const count = ITEMS.filter((i) => displayTypeOf(i) === t).length;
              const dsCount = t === "skill" ? ITEMS.filter(isDesignSystem).length : 0;
              return (
                <Link
                  key={t}
                  href={TYPE_PATH[t]}
                  className="p-6 block transition-colors hover:bg-[#101013] group"
                  style={{ background: BG }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.22em]"
                      style={{ fontFamily: MONO, color: MUTED }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.accent }} />
                      <span style={{ color: m.accent }}>{m.icon}</span>
                      {m.plural}
                    </span>
                    <ArrowUpRight
                      className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      style={{ color: SUB }}
                    />
                  </div>
                  <div className="text-[24px] leading-[1] font-medium tracking-[-0.018em] mb-3" style={{ color: INK }}>
                    {count}
                    {dsCount > 0 ? (
                      <span
                        className="ml-2 text-[11px] align-middle"
                        style={{ fontFamily: MONO, color: VIOLET }}
                      >
                        incl. {dsCount} design systems
                      </span>
                    ) : null}
                  </div>
                  <div className="text-[12.5px] leading-[1.55]" style={{ color: SUB }}>
                    {SHELF_BLURBS[t]}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Unified grid + filters */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-12">
        <div className="grid grid-cols-12 gap-8">
          <aside className="col-span-12 md:col-span-3">
            <LibraryFilterPanel query={query} onQueryChange={setQuery} />
          </aside>

          <section className="col-span-12 md:col-span-9">
            <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
              <div>
                <div
                  className="text-[10.5px] uppercase tracking-[0.22em]"
                  style={{ fontFamily: MONO, color: MUTED }}
                >
                  Browse everything
                </div>
                <h2 className="mt-3 text-[28px] leading-[1.08] font-medium tracking-[-0.018em]">
                  {filtered.length}{" "}
                  <span style={{ color: SUB }}>{headingNoun} in stock.</span>
                </h2>
              </div>
              <div className="flex items-center gap-3">
                {activeCount > 0 ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    {filters.type !== "all" ? (
                      <ActivePill
                        label={shelfPillLabel(filters.type)}
                        onClear={() => setType("all")}
                      />
                    ) : null}
                    {filters.category !== "All" ? (
                      <ActivePill
                        label={filters.category}
                        onClear={() => setCategory("All")}
                      />
                    ) : null}
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
                <RequestCard label={requestKind.label} href={requestKind.href} />
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function shelfPillLabel(t: ShelfType): string {
  if (t === "design-systems") return "Design systems";
  if (t === "skills") return "Skills";
  if (t === "agents") return "Agents";
  if (t === "mcps") return "MCPs";
  return "All";
}

function ActivePill({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      onClick={onClear}
      className="inline-flex items-center gap-1.5 h-7 rounded-full border px-2.5 text-[11.5px]"
      style={{ borderColor: BORDER, background: SURFACE, color: SUB }}
    >
      {label}
      <X className="h-3 w-3" style={{ color: MUTED }} />
    </button>
  );
}

function RequestCard({ label, href }: { label: string; href: string }) {
  const accent = VIOLET;
  return (
    <Link
      href={href}
      className="p-5 group transition-colors hover:bg-[#101013] block"
      style={{ background: BG, border: `1px dashed ${accent}55`, borderRadius: 0 }}
    >
      <div className="flex h-1.5 mb-5 items-center gap-1.5">
        <span className="h-1.5 flex-1 rounded-sm" style={{ background: `${accent}55` }} />
      </div>
      <div
        className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] mb-4"
        style={{ fontFamily: MONO, color: MUTED }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
        request · open slot
      </div>
      <div className="text-[16px] font-medium mb-1" style={{ color: INK }}>
        Request a {label}
      </div>
      <div className="text-[12.5px] mb-5" style={{ color: SUB }}>
        Can't find what you need? Paste a source URL — we'll draft it and route to the curation desk.
      </div>
      <div
        className="inline-flex items-center gap-1.5 text-[11.5px]"
        style={{ color: accent, fontFamily: MONO }}
      >
        generate from URL
        <ArrowUpRight className="h-3 w-3" />
      </div>
    </Link>
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
