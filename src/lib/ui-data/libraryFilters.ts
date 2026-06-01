"use client";

import { useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { Item } from "./items";

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

const CATEGORY_FROM_SLUG = new Map<string, Category>(
  CATEGORIES.map((c) => [slugify(c), c]),
);

export function categoryFromParam(v: string | null): Category {
  if (!v) return "All";
  return CATEGORY_FROM_SLUG.get(v.toLowerCase()) ?? "All";
}

export function categorySlug(c: Category): string {
  return c === "All" ? "" : slugify(c);
}

export function matchesCategory(it: Item, c: Category): boolean {
  return c === "All" || it.category === c;
}

export type LibraryFilters = { category: Category };

export function useLibraryFilters(): {
  filters: LibraryFilters;
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
    category: categoryFromParam(params.get("category")),
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
    next.delete("category");
    next.delete("q");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  const activeCount = filters.category !== "All" ? 1 : 0;

  return { filters, setCategory, reset, activeCount };
}
