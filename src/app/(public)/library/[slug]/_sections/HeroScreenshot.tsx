"use client";

import { ArrowUpRight } from "lucide-react";
import { BORDER, BORDER_SOFT, MONO, MUTED, SUB, SURFACE, SURFACE_2 } from "@/lib/ui-data/tokens";
import { type Bundle } from "@/lib/ui-data/bundles";
import { PreviewPane } from "./PreviewPane";

function hostnameSafe(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Detail-page hero visual. Shows a durably-stored, above-the-fold website
 * screenshot in a browser frame when one exists; otherwise falls back to the
 * live token-rendered PreviewPane so the slot is never empty.
 */
export function HeroScreenshot({ bundle }: { bundle: Bundle }) {
  if (!bundle.previewImageUrl) {
    return <PreviewPane bundle={bundle} />;
  }

  const host = hostnameSafe(bundle.url) ?? bundle.name.toLowerCase();

  return (
    <figure
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: BORDER, background: SURFACE }}
    >
      {/* Browser chrome */}
      <div
        className="flex items-center gap-2 h-9 px-4 border-b"
        style={{ borderColor: BORDER_SOFT, background: SURFACE_2 }}
      >
        <span className="flex gap-1.5" aria-hidden>
          {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
            <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: c, opacity: 0.7 }} />
          ))}
        </span>
        <span
          className="ml-3 truncate text-[11px]"
          style={{ fontFamily: MONO, color: MUTED }}
        >
          {host}
        </span>
      </div>

      {/* Screenshot — fixed ~16:10 crop, top-aligned. Plain <img> (we already
          compress to webp) avoids the next/image optimization quota. */}
      <a
        href={bundle.previewImageUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative block"
        style={{ aspectRatio: "16 / 10" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={bundle.previewImageUrl}
          alt={`${bundle.name} website, above the fold`}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
        <span
          className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] opacity-0 transition-opacity group-hover:opacity-100"
          style={{ background: SURFACE, border: `1px solid ${BORDER}`, color: SUB, fontFamily: MONO }}
        >
          open full size
          <ArrowUpRight className="h-3 w-3" />
        </span>
      </a>
    </figure>
  );
}
