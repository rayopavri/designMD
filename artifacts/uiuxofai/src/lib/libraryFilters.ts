import { useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import type { Item } from "./items";

export const PROJECT_TYPES = [
  "All",
  "Mobile apps",
  "SaaS",
  "E-commerce",
  "Dashboards",
  "Marketing sites",
  "Design systems",
] as const;

export const STYLES = [
  "All",
  "Minimal",
  "Enterprise",
  "Bold",
  "Playful",
  "Accessible",
  "Dark mode",
] as const;

export const TOOL_OPTIONS = [
  "All",
  "Claude",
  "Cursor",
  "Lovable",
  "Figma Make",
  "ChatGPT",
] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];
export type StyleOption = (typeof STYLES)[number];
export type ToolOption = (typeof TOOL_OPTIONS)[number];

export type LibraryFilters = {
  type: ProjectType;
  style: StyleOption;
  tool: ToolOption;
};

export const slugify = (s: string): string =>
  s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

function fromSlug<T extends readonly string[]>(opts: T, slug: string | null): T[number] {
  if (!slug) return opts[0];
  const hit = opts.find((o) => slugify(o) === slug.toLowerCase());
  return hit ?? opts[0];
}

export function useLibraryFilters(): {
  filters: LibraryFilters;
  setFilter: (k: keyof LibraryFilters, v: string) => void;
  reset: () => void;
  activeCount: number;
} {
  const search = useSearch();
  const [location, navigate] = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);

  const filters: LibraryFilters = {
    type: fromSlug(PROJECT_TYPES, params.get("type")),
    style: fromSlug(STYLES, params.get("style")),
    tool: fromSlug(TOOL_OPTIONS, params.get("tool")),
  };

  const setFilter = (k: keyof LibraryFilters, v: string) => {
    const next = new URLSearchParams(search);
    if (v === "All") {
      next.delete(k);
    } else {
      next.set(k, slugify(v));
    }
    const qs = next.toString();
    navigate(qs ? `${location}?${qs}` : location, { replace: true });
  };

  const reset = () => {
    const next = new URLSearchParams(search);
    next.delete("type");
    next.delete("style");
    next.delete("tool");
    const qs = next.toString();
    navigate(qs ? `${location}?${qs}` : location, { replace: true });
  };

  const activeCount =
    (filters.type !== "All" ? 1 : 0) +
    (filters.style !== "All" ? 1 : 0) +
    (filters.tool !== "All" ? 1 : 0);

  return { filters, setFilter, reset, activeCount };
}

export function matchesFilters(it: Item, f: LibraryFilters): boolean {
  if (f.type !== "All") {
    if (it.projectType !== f.type) return false;
  }
  if (f.style !== "All") {
    if (it.style !== f.style) return false;
  }
  if (f.tool !== "All") {
    if (!(it.tools as string[]).includes(f.tool)) return false;
  }
  return true;
}
