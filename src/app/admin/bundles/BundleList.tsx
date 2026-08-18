import { ChevronRight, Search, Star, X } from "lucide-react";
import {
  BG,
  BORDER,
  BORDER_SOFT,
  CYAN,
  INK,
  LIME,
  MONO,
  MUTED,
  PEACH,
  SUB,
  SURFACE,
  SURFACE_2,
} from "@/lib/ui-data/tokens";
import { ALL_STATUSES, statusColor, statusLabel } from "./constants";
import { StatusPill } from "./StatusPill";
import type { BundleStatus, Category, ListRow } from "./types";

export interface BundleListProps {
  rows: ListRow[];
  categories: Category[];
  selectedSlug: string | null;
  selectedSlugs: Set<string>;
  activeJobSlugs: Set<string>;
  statusFilter: BundleStatus[];
  searchInput: string;
  categoryFilter: string;
  sort: "recent" | "top" | "trending" | "alpha";
  selectAllRef: React.RefObject<HTMLInputElement | null>;
  onToggleStatus: (status: BundleStatus) => void;
  onSearchInputChange: (value: string) => void;
  onSearchSubmit: () => void;
  onClearSearch: () => void;
  onCategoryFilterChange: (value: string) => void;
  onSortChange: (value: "recent" | "top" | "trending" | "alpha") => void;
  onSelectSlug: (slug: string) => void;
  onToggleSlug: (slug: string) => void;
  onToggleAll: () => void;
}

export function BundleList({
  rows,
  categories,
  selectedSlug,
  selectedSlugs,
  activeJobSlugs,
  statusFilter,
  searchInput,
  categoryFilter,
  sort,
  selectAllRef,
  onToggleStatus,
  onSearchInputChange,
  onSearchSubmit,
  onClearSearch,
  onCategoryFilterChange,
  onSortChange,
  onSelectSlug,
  onToggleSlug,
  onToggleAll,
}: BundleListProps) {
  return (
    <div className="flex flex-col" style={{ background: BG, minHeight: 540 }}>
      {/* Filters */}
      <div className="p-3 border-b" style={{ borderColor: BORDER_SOFT }}>
        <form onSubmit={onSearchSubmit} className="flex items-center gap-2">
          <div
            className="flex-1 h-9 rounded-full border flex items-center gap-2 px-3"
            style={{ borderColor: BORDER, background: SURFACE }}
          >
            <Search className="h-3.5 w-3.5" style={{ color: MUTED }} />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => onSearchInputChange(e.target.value)}
              placeholder="search title or description"
              className="flex-1 bg-transparent text-[12.5px] outline-none"
              style={{ color: INK, fontFamily: MONO }}
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  onClearSearch();
                }}
                className="opacity-60 hover:opacity-100"
                style={{ color: SUB }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </form>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {ALL_STATUSES.map((s) => {
            const active = statusFilter.includes(s);
            const color = statusColor(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => onToggleStatus(s)}
                className="text-[10.5px] uppercase tracking-[0.18em] rounded-full px-2 py-1"
                style={{
                  fontFamily: MONO,
                  background: active ? `${color}1A` : "transparent",
                  border: `1px solid ${active ? `${color}55` : BORDER}`,
                  color: active ? color : MUTED,
                }}
              >
                {statusLabel(s)}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-2 items-center">
          <select
            value={categoryFilter}
            onChange={(e) => onCategoryFilterChange(e.target.value)}
            className="h-7 rounded-full border bg-transparent text-[11px] px-2"
            style={{ borderColor: BORDER, color: INK, fontFamily: MONO }}
          >
            <option value="">all categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) =>
              onSortChange(e.target.value as "recent" | "top" | "trending" | "alpha")
            }
            className="h-7 rounded-full border bg-transparent text-[11px] px-2"
            style={{ borderColor: BORDER, color: INK, fontFamily: MONO }}
          >
            <option value="recent">recent</option>
            <option value="top">top (coverage)</option>
            <option value="trending">submitted</option>
            <option value="alpha">A → Z</option>
          </select>
        </div>
        {rows.length > 0 && (
          <div
            className="mt-2.5 pt-2.5 border-t flex items-center gap-2"
            style={{ borderColor: BORDER_SOFT }}
          >
            <label
              className="flex items-center gap-2 cursor-pointer text-[10.5px]"
              style={{ color: MUTED, fontFamily: MONO }}
            >
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={selectedSlugs.size === rows.length && rows.length > 0}
                onChange={onToggleAll}
                className="cursor-pointer"
                style={{ accentColor: CYAN }}
              />
              {selectedSlugs.size > 0
                ? `${selectedSlugs.size} of ${rows.length} selected`
                : "select all"}
            </label>
          </div>
        )}
      </div>

      {/* List rows */}
      <div className="flex-1 overflow-y-auto p-2" style={{ maxHeight: 720 }}>
        {rows.length === 0 ? (
          <div
            className="h-full flex items-center justify-center text-[12px] py-20"
            style={{ color: MUTED, fontFamily: MONO }}
          >
            no bundles match these filters
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {rows.map((row) => {
              const isActive = row.slug === selectedSlug;
              const hasActiveJob = activeJobSlugs.has(row.slug);
              const isChecked = selectedSlugs.has(row.slug);
              return (
                <li
                  key={row.id}
                  className="group flex items-stretch rounded-lg transition-colors"
                  style={{
                    background: isActive ? SURFACE_2 : "transparent",
                    border: `1px solid ${isActive ? BORDER : "transparent"}`,
                  }}
                >
                  {/* Checkbox — independent click target; doesn't open detail pane */}
                  <label
                    htmlFor={`select-${row.id}`}
                    className={`flex items-center justify-center w-7 shrink-0 cursor-pointer transition-opacity${
                      selectedSlugs.size > 0 ? "" : " opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    <input
                      id={`select-${row.id}`}
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => onToggleSlug(row.slug)}
                      aria-label={`Select ${row.title}`}
                      className="h-3 w-3 cursor-pointer"
                      style={{ accentColor: CYAN }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => onSelectSlug(row.slug)}
                    className="flex-1 text-left px-3 py-2.5 min-w-0"
                    style={{ background: "transparent" }}
                  >
                    <div className="flex items-center gap-2">
                      {/* Active pipeline indicator */}
                      {hasActiveJob ? (
                        <span
                          className="h-1.5 w-1.5 rounded-full animate-pulse shrink-0"
                          style={{ background: CYAN }}
                          title="Pipeline re-run in progress"
                        />
                      ) : null}
                      <span
                        className="text-[13px] truncate flex-1"
                        style={{ color: INK, fontWeight: isActive ? 600 : 400 }}
                      >
                        {row.title}
                      </span>
                      {row.isFeatured ? (
                        <Star
                          className="h-3 w-3 shrink-0"
                          style={{ color: CYAN }}
                          aria-label="Featured"
                        />
                      ) : null}
                      {isActive ? (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: SUB }} />
                      ) : null}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <StatusPill status={row.status} />
                      {row.coverageScore !== null ? (
                        <span
                          className="text-[10px] rounded px-1.5 py-0.5"
                          style={{
                            fontFamily: MONO,
                            color:
                              row.coverageScore >= 70
                                ? LIME
                                : row.coverageScore >= 40
                                  ? PEACH
                                  : MUTED,
                            border: `1px solid ${
                              row.coverageScore >= 70
                                ? LIME
                                : row.coverageScore >= 40
                                  ? PEACH
                                  : MUTED
                            }55`,
                          }}
                        >
                          {row.coverageScore}
                        </span>
                      ) : null}
                      {hasActiveJob ? (
                        <span
                          className="text-[9.5px] uppercase tracking-[0.18em]"
                          style={{ color: CYAN, fontFamily: MONO }}
                        >
                          running
                        </span>
                      ) : (
                        <span
                          className="text-[10px] truncate"
                          style={{ color: MUTED, fontFamily: MONO }}
                        >
                          {row.sourceDomain ?? "—"}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex gap-1">
                      {row.paletteColors?.slice(0, 6).map((c, i) => (
                        <span
                          key={`${row.id}-${c}-${i}`}
                          className="h-2.5 w-2.5 rounded-sm"
                          style={{ background: c, border: `1px solid ${BORDER_SOFT}` }}
                        />
                      ))}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
