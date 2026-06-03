"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Suspense, useEffect, useMemo, useState } from "react";
import { LibraryFilterPanel } from "@/components/ui/LibraryFilterPanel";
import { matchesCategory, useLibraryFilters } from "@/lib/ui-data/libraryFilters";
import { ArrowUpRight } from "lucide-react";
import { ItemCard } from "@/components/ui/ItemCard";
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
} from "@/lib/ui-data/tokens";

import { type Item } from "@/lib/ui-data/items";
import { useBundleItems } from "@/hooks/useBundleItems";

type Sort = "popular" | "coverage" | "recent" | "alpha";

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

function Library() {
  const search = useSearchParams().toString();
  const initialQ = useMemo(() => new URLSearchParams(search).get("q") ?? "", [search]);
  const [query, setQuery] = useState(initialQ);
  const [sort, setSort] = useState<Sort>("popular");
  const { filters, reset, activeCount } = useLibraryFilters();

  // Keep the query in sync if the URL ?q= changes (e.g. arriving from 404).
  useEffect(() => {
    setQuery(initialQ);
  }, [initialQ]);

  const clearAll = () => {
    setQuery("");
    reset();
  };

  const { items: dbBundleItems } = useBundleItems();

  // Orama search: fetch slug-set from /api/search when query >= 2 chars.
  const [searchSlugs, setSearchSlugs] = useState<Set<string> | null>(null);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setSearchSlugs(null); return; }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (!res.ok) return;
        const json = (await res.json()) as { data: { slug: string }[] };
        setSearchSlugs(new Set(json.data.map((h) => h.slug)));
      } catch {
        // aborted or network error — fall through to client filter
      }
    }, 250);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [query]);

  const allItems = dbBundleItems;

  const filtered = useMemo(() => {
    let list: Item[] = allItems.filter((it) => {
      if (!matchesCategory(it, filters.category)) return false;
      if (query.trim()) {
        // DB bundles use the Orama slug-set when available; non-bundle items
        // (skills/agents/mcps) always use the client-side haystack.
        if (searchSlugs !== null && it.type === "bundle") {
          if (!searchSlugs.has(it.id)) return false;
        } else {
          const q = query.toLowerCase();
          const haystack = [
            it.name, it.tagline, it.description, it.category,
            ...it.tags, ...(it.tools as string[]), it.type,
          ].join(" ").toLowerCase();
          if (!haystack.includes(q)) return false;
        }
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
  }, [allItems, query, filters.category, sort]);

  const headingNoun = filtered.length === 1 ? "design skill" : "design skills";

  const requestKind: { label: string; href: string } = {
    label: "Design skill",
    href: "/generate",
  };

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
                Design Skills
              </div>
              <h1 className="text-[44px] sm:text-[54px] leading-[1.02] font-medium tracking-[-0.022em]">
                Design systems.
                <br />
                <span style={{ color: SUB }}>Drop one in. Ship on-brand.</span>
              </h1>
              <p className="mt-5 max-w-[36rem] text-[14.5px] leading-[1.6]" style={{ color: SUB }}>
                design.md files for real brands and design systems — drop one in and your AI tool ships on-brand UI. Use the grid below to search across design skills.
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
                Every entry pairs a design.md spec with a companion prompt. Copy both into
                Claude, Cursor, Lovable, or Figma Make and your AI ships on-brand. Need a brand
                that isn&apos;t here yet?{" "}
                <Link href="/generate" style={{ color: VIOLET }}>
                  Generate one from a URL
                </Link>
                .
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Unified grid + filters */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-12">
        <div className="grid grid-cols-12 gap-8 items-start">
          <aside className="col-span-12 md:col-span-3 md:sticky md:top-20 md:max-h-[calc(100vh-6rem)] md:overflow-y-auto">
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
                <SortSelect value={sort} onChange={setSort} />
              </div>
            </div>

            {filtered.length === 0 ? (
              <div
                className="rounded-lg border p-12 text-center"
                style={{ borderColor: BORDER, background: SURFACE }}
              >
                <p className="text-[14px]" style={{ color: INK }}>
                  {query.trim() ? (
                    <>
                      No results for{" "}
                      <span style={{ fontFamily: MONO, color: VIOLET }}>&quot;{query.trim()}&quot;</span>
                      {activeCount > 0 ? " with the current filters." : "."}
                    </>
                  ) : (
                    "Nothing matches these filters."
                  )}
                </p>
                <p className="mt-2 text-[12.5px]" style={{ color: SUB }}>
                  Try a broader search, drop a filter, or request a draft from the URL.
                </p>
                <div className="mt-6 inline-flex items-center gap-4 flex-wrap justify-center">
                  <button
                    onClick={clearAll}
                    className="h-8 rounded-full px-4 text-[12px] border"
                    style={{ borderColor: BORDER, background: BG, color: INK }}
                  >
                    Clear all filters
                  </button>
                  <Link
                    href="/generate"
                    className="inline-flex items-center gap-1.5 text-[12.5px]"
                    style={{ color: VIOLET }}
                  >
                    Generate from a URL
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ) : (
              <div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px rounded-lg overflow-hidden"
                style={{ background: BG }}
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
        Can&apos;t find what you need? Paste a source URL — we&apos;ll draft it and route to the curation desk.
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

export default function LibraryClient() {
  return (
    <Suspense fallback={null}>
      <Library />
    </Suspense>
  );
}
