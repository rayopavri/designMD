"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { SectionLabel } from "@/components/ui/Shell";
import {
  BG,
  BORDER,
  BORDER_SOFT,
  INK,
  LIME,
  MONO,
  MUTED,
  SUB,
  SURFACE,
} from "@/lib/ui-data/tokens";
import { useAuth } from "@/lib/ui-data/mockAuth";

interface UserBundle {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: string;
  companionStatus: string;
  paletteColors: string[];
  brandLogoUrl: string | null;
  brandInitial: string | null;
  brandColor: string | null;
  primaryCategoryName: string | null;
  updatedAt: string;
}

type StatusVisual = { label: string; color: string };

const STATUS_VISUALS: Record<string, StatusVisual> = {
  personal: { label: "draft", color: MUTED },
  pending_review: { label: "in review", color: "#F5A623" },
  published: { label: "published", color: LIME },
  flagged: { label: "flagged", color: "#E5484D" },
  rejected: { label: "rejected", color: "#E5484D" },
  archived: { label: "archived", color: MUTED },
};

function statusVisual(s: string): StatusVisual {
  return STATUS_VISUALS[s] ?? { label: s, color: MUTED };
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  const y = Math.floor(d / 365);
  return `${y}y ago`;
}

function BundleRow({ b }: { b: UserBundle }) {
  const v = statusVisual(b.status);
  const palette = (b.paletteColors ?? []).slice(0, 3);
  return (
    <Link
      href={`/library/${b.slug}`}
      className="block border-b py-5 group"
      style={{ borderColor: BORDER_SOFT }}
    >
      <div className="flex items-start gap-4">
        {/* Brand glyph */}
        <div
          className="shrink-0 h-10 w-10 rounded-md border inline-flex items-center justify-center overflow-hidden"
          style={{
            borderColor: BORDER,
            background: b.brandColor || SURFACE,
            color: INK,
          }}
        >
          {b.brandLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={b.brandLogoUrl}
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <span className="text-[13px] font-medium" style={{ fontFamily: MONO }}>
              {(b.brandInitial || b.title.charAt(0) || "?").toUpperCase()}
            </span>
          )}
        </div>

        {/* Main */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h3
              className="text-[15px] font-medium tracking-[-0.012em] truncate"
              style={{ color: INK }}
            >
              {b.title}
            </h3>
            <div className="flex gap-0.5">
              {palette.map((c, i) => (
                <span
                  key={`${c}-${i}`}
                  className="h-2 w-2 rounded-full"
                  style={{ background: c, border: `1px solid ${BORDER}` }}
                />
              ))}
            </div>
          </div>
          <p
            className="mt-1 text-[12.5px] leading-[1.5] truncate"
            style={{ color: SUB }}
          >
            {b.description || "—"}
          </p>
          <div
            className="mt-1.5 text-[11px] inline-flex items-center gap-2"
            style={{ color: MUTED, fontFamily: MONO }}
          >
            <span>updated {timeAgo(b.updatedAt)}</span>
            {b.primaryCategoryName ? (
              <>
                <span>·</span>
                <span>{b.primaryCategoryName}</span>
              </>
            ) : null}
          </div>
        </div>

        {/* Status */}
        <div className="shrink-0 inline-flex items-center gap-1.5 mt-1">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: v.color }}
          />
          <span
            className="text-[10.5px] uppercase tracking-[0.22em]"
            style={{ color: v.color, fontFamily: MONO }}
          >
            {v.label}
          </span>
          <ArrowUpRight
            className="h-3.5 w-3.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: SUB }}
          />
        </div>
      </div>
    </Link>
  );
}

function SkeletonRow() {
  return (
    <div className="border-b py-5" style={{ borderColor: BORDER_SOFT }}>
      <div className="flex items-start gap-4 animate-pulse">
        <div
          className="shrink-0 h-10 w-10 rounded-md"
          style={{ background: SURFACE }}
        />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-40 rounded" style={{ background: SURFACE }} />
          <div className="h-3 w-64 rounded" style={{ background: SURFACE }} />
          <div className="h-2.5 w-24 rounded" style={{ background: SURFACE }} />
        </div>
        <div className="h-3 w-16 rounded" style={{ background: SURFACE }} />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="border rounded-xl px-6 py-12 text-center"
      style={{ borderColor: BORDER_SOFT, background: SURFACE }}
    >
      <p className="text-[14px]" style={{ color: SUB }}>
        You haven&apos;t generated any bundles yet.
      </p>
      <Link
        href="/generate"
        className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium"
        style={{ color: INK }}
      >
        Generate your first
        <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function YourBundles() {
  const { user } = useAuth();
  const router = useRouter();
  const location = usePathname();
  const [items, setItems] = useState<UserBundle[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      router.push(`/login?returnTo=${encodeURIComponent(location || "/account/bundles")}`);
    }
  }, [user, router, location]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me/bundles");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { data: UserBundle[] };
        if (!cancelled) setItems(json.data ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return null;

  const loading = items === null && !error;
  const count = items?.length ?? 0;

  return (
    <section className="flex-1" style={{ background: BG }}>
      <div className="mx-auto max-w-3xl px-6 lg:px-8 py-16">
        <SectionLabel t="Account" />
        <h1
          className="mt-4 text-[36px] leading-[1.06] font-medium tracking-[-0.022em] inline-flex items-baseline gap-3"
          style={{ color: INK }}
        >
          Your bundles
          {!loading && !error && count > 0 ? (
            <span
              className="text-[18px] font-normal"
              style={{ color: MUTED, fontFamily: MONO }}
            >
              {count}
            </span>
          ) : null}
        </h1>
        <p className="mt-3 text-[14px] leading-[1.6]" style={{ color: SUB }}>
          {loading
            ? "Loading…"
            : error
              ? "Something went wrong loading your bundles."
              : count === 0
                ? "Anything you generate from a URL shows up here."
                : `Generated by ${user.displayName || "you"}.`}
        </p>

        <div className="mt-8">
          {loading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : error ? (
            <div
              className="border rounded-lg p-4 text-[13px]"
              style={{ borderColor: BORDER, color: SUB, background: SURFACE }}
            >
              {error}
            </div>
          ) : count === 0 ? (
            <EmptyState />
          ) : (
            items?.map((b) => <BundleRow key={b.id} b={b} />)
          )}
        </div>
      </div>
    </section>
  );
}

export default YourBundles;
