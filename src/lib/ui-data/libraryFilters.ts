"use client";

import { useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { Item } from "./items";

export const SHELF_TYPES = ["all", "skills", "agents", "mcps", "design-systems"] as const;
export type ShelfType = (typeof SHELF_TYPES)[number];

export const SHELF_LABEL: Record<ShelfType, string> = {
  all: "All",
  skills: "Skills",
  agents: "Agents",
  mcps: "MCPs",
  "design-systems": "Design systems",
};

export const CATEGORIES = [
  "All",
  "AI & LLM Platforms",
  "Developer Tools & IDEs",
  "Database & DevOps",
  "Productivity & SaaS",
  "Design & Creative Tools",
  "Fintech & Crypto",
  "E-commerce & Retail",
  "Media & Consumer Tech",
  "Automotive",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

const SHELF_FROM_SLUG = new Map<string, ShelfType>(SHELF_TYPES.map((s) => [s, s]));
const CATEGORY_FROM_SLUG = new Map<string, Category>(
  CATEGORIES.map((c) => [slugify(c), c]),
);

export function shelfFromParam(v: string | null): ShelfType {
  if (!v) return "all";
  return SHELF_FROM_SLUG.get(v.toLowerCase()) ?? "all";
}

export function categoryFromParam(v: string | null): Category {
  if (!v) return "All";
  return CATEGORY_FROM_SLUG.get(v.toLowerCase()) ?? "All";
}

export function categorySlug(c: Category): string {
  return c === "All" ? "" : slugify(c);
}

export function shelfOf(it: Item): Exclude<ShelfType, "all"> {
  if (it.type === "bundle") return "design-systems";
  if (it.type === "skill") return "skills";
  if (it.type === "agent") return "agents";
  return "mcps";
}

export function matchesShelf(it: Item, t: ShelfType): boolean {
  return t === "all" || shelfOf(it) === t;
}

export function matchesCategory(it: Item, c: Category): boolean {
  return c === "All" || it.category === c;
}

export type LibraryFilters = { type: ShelfType; category: Category };

export function matchesFilters(it: Item, f: LibraryFilters): boolean {
  return matchesShelf(it, f.type) && matchesCategory(it, f.category);
}

export function useLibraryFilters(): {
  filters: LibraryFilters;
  setType: (t: ShelfType) => void;
  setCategory: (c: Category) => void;
  reset: () => void;
  activeCount: number;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  const params = useMemo(() => new URLSearchParams(search), [search]);

  const filters: LibraryFilters = {
    type: shelfFromParam(params.get("type")),
    category: categoryFromParam(params.get("category")),
  };

  const setType = (t: ShelfType) => {
    const next = new URLSearchParams(search);
    if (t === "all") next.delete("type");
    else next.set("type", t);
    const qs = next.toString();
    router.replace(qs ? `/library?${qs}` : "/library");
  };

  const setCategory = (c: Category) => {
    const next = new URLSearchParams(search);
    if (c === "All") next.delete("category");
    else next.set("category", categorySlug(c));
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  const reset = () => {
    const next = new URLSearchParams(search);
    next.delete("type");
    next.delete("category");
    next.delete("q");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  const activeCount =
    (filters.type !== "all" ? 1 : 0) + (filters.category !== "All" ? 1 : 0);

  return { filters, setType, setCategory, reset, activeCount };
}
