"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BORDER,
  INK,
  MONO,
  SUB,
  VIOLET,
} from "@/lib/ui-data/tokens";

type Tab = { label: string; href: string; match: (p: string) => boolean };

const TABS: Tab[] = [
  { label: "Bundles", href: "/admin/bundles", match: (p) => p.startsWith("/admin/bundles") },
  { label: "Reviewer queue", href: "/admin/queue", match: (p) => p.startsWith("/admin/queue") },
  { label: "Bulk upload", href: "/admin/bulk-upload", match: (p) => p.startsWith("/admin/bulk-upload") },
  { label: "Screenshots", href: "/admin/backfill-screenshots", match: (p) => p.startsWith("/admin/backfill-screenshots") },
];

export function AdminNav() {
  const pathname = usePathname() ?? "";
  if (!pathname.startsWith("/admin")) return null;

  return (
    <div
      className="sticky top-14 z-40 w-full border-b backdrop-blur-md"
      style={{ background: "rgba(10,10,11,0.78)", borderColor: BORDER }}
    >
      <div className="mx-auto max-w-6xl px-6 lg:px-8 h-10 flex items-center gap-6">
        <span
          className="text-[10.5px] uppercase tracking-[0.22em]"
          style={{ fontFamily: MONO, color: SUB }}
        >
          admin
        </span>
        <nav className="flex items-center gap-6 text-[12.5px]" style={{ fontFamily: MONO }} aria-label="Admin navigation">
          {TABS.map((tab) => {
            const isActive = tab.match(pathname);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="relative inline-flex items-center gap-1.5"
                style={{ color: isActive ? INK : SUB }}
                aria-current={isActive ? "page" : undefined}
              >
                {isActive ? (
                  <span className="h-1 w-1 rounded-full" style={{ background: VIOLET }} />
                ) : null}
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
