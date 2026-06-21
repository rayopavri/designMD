import { ArrowUpRight } from "lucide-react";
import type { Attribution } from "@/lib/ui-data/items";
import {
  BORDER,
  INK,
  MONO,
  MUTED,
  SUB,
  SURFACE,
  SURFACE_2,
} from "@/lib/ui-data/tokens";

export function AttributionRow({ attr }: { attr: Attribution }) {
  let host = attr.sourceUrl;
  try {
    host = new URL(attr.sourceUrl).host.replace(/^www\./, "");
  } catch {
    // keep raw
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2 text-[11px]"
      style={{ fontFamily: MONO, color: MUTED }}
    >
      <a
        href={attr.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 h-6 rounded-full border px-2.5"
        style={{ borderColor: BORDER, background: SURFACE, color: INK }}
      >
        <span>{host}</span>
        <ArrowUpRight className="h-3 w-3" style={{ color: SUB }} aria-hidden="true" />
      </a>
      <span style={{ color: BORDER }} aria-hidden="true">·</span>
      <span style={{ color: SUB }}>by {attr.author}</span>
      <span style={{ color: BORDER }} aria-hidden="true">·</span>
      <span
        className="inline-flex items-center h-5 rounded px-1.5 text-[10px] uppercase tracking-[0.18em]"
        style={{ background: SURFACE_2, border: `1px solid ${BORDER}`, color: SUB }}
      >
        {attr.license}
      </span>
    </div>
  );
}
