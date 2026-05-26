"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ArrowUpRight, Search } from "lucide-react";
import { SectionLabel } from "@/components/ui/Shell";
import { BORDER, INK, MONO, MUTED, SUB, SURFACE, VIOLET } from "@/lib/ui-data/tokens";

export default function NotFound() {
  const _router = useRouter();
  const navigate = (path: string) => _router.push(path);
  const [q, setQ] = useState("");

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const v = q.trim();
    navigate(v ? `/library?q=${encodeURIComponent(v)}` : "/library");
  }

  return (
    <div className="mx-auto max-w-3xl px-6 lg:px-8 py-32 text-center">
      <SectionLabel n="404" t="Off the index" />
      <h1 className="mt-6 text-[56px] leading-[1.02] font-medium tracking-[-0.022em]">
        That route isn&apos;t
        <br />
        <span style={{ color: SUB }}>in the catalog.</span>
      </h1>
      <p className="mt-5 text-[14px]" style={{ color: SUB, fontFamily: MONO }}>
        The page or item you were looking for is not registered in this index.
      </p>

      <form
        onSubmit={onSearch}
        className="mt-8 mx-auto max-w-md flex items-center gap-2 rounded-full border p-1.5"
        style={{ borderColor: BORDER, background: SURFACE }}
      >
        <Search className="h-3.5 w-3.5 ml-3" style={{ color: MUTED }} aria-hidden="true" />
        <label htmlFor="nf-search" className="sr-only">Search the library</label>
        <input
          id="nf-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search the library — Linear, Figma, agent…"
          className="flex-1 h-8 bg-transparent text-[13px] px-1 min-w-0"
          style={{ color: INK }}
        />
        <button
          type="submit"
          className="h-8 rounded-full px-4 text-[12px]"
          style={{ background: VIOLET, color: "#0A0A0B" }}
        >
          Search
        </button>
      </form>

      <div className="mt-6 flex items-center justify-center gap-5 flex-wrap text-[13px]">
        <Link href="/" className="inline-flex items-center gap-1.5" style={{ color: SUB }}>
          Home
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
        <Link href="/library" className="inline-flex items-center gap-1.5" style={{ color: VIOLET }}>
          Back to the library
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
        <Link href="/generate" className="inline-flex items-center gap-1.5" style={{ color: SUB }}>
          Generate from a URL
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div
        className="mt-10 text-[11px] inline-block px-3 py-1 rounded-md"
        style={{ color: MUTED, fontFamily: MONO, border: `1px solid #1F1F23` }}
        title="Plate = our internal name for a catalog entry"
      >
        ERR_NO_PLATE · 404
      </div>
    </div>
  );
}
