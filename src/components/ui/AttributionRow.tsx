import { ArrowUpRight } from "lucide-react";
import type { Attribution, DiscoveryMethod } from "@/lib/ui-data/items";
import {
  BORDER,
  INK,
  LIME,
  MONO,
  MUTED,
  PEACH,
  SUB,
  SURFACE,
  SURFACE_2,
  VIOLET,
} from "@/lib/ui-data/tokens";

function methodColor(m: DiscoveryMethod): string {
  if (m === "Editorial") return VIOLET;
  if (m === "Community") return LIME;
  return PEACH;
}

function methodLabel(m: DiscoveryMethod, handle?: string): string {
  if (m === "Community") return handle ? `Community by ${handle}` : "Community";
  if (m === "Auto-discovered") return "Auto-discovered";
  return "Editorial";
}

export function AttributionRow({ attr }: { attr: Attribution }) {
  const color = methodColor(attr.discoveryMethod);
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
        <ArrowUpRight className="h-3 w-3" style={{ color: SUB }} />
      </a>
      <span style={{ color: BORDER }}>·</span>
      <span style={{ color: SUB }}>by {attr.author}</span>
      <span style={{ color: BORDER }}>·</span>
      <span
        className="inline-flex items-center h-5 rounded px-1.5 text-[10px] uppercase tracking-[0.18em]"
        style={{ background: SURFACE_2, border: `1px solid ${BORDER}`, color: SUB }}
      >
        {attr.license}
      </span>
      <span style={{ color: BORDER }}>·</span>
      <span
        className="inline-flex items-center gap-1.5 h-5 rounded px-1.5 text-[10px] uppercase tracking-[0.18em]"
        style={{ background: `${color}14`, border: `1px solid ${color}55`, color: INK }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        {methodLabel(attr.discoveryMethod, attr.communityHandle)}
      </span>
      <span style={{ color: BORDER }}>·</span>
      <span
        style={{ color: SUB }}
        className="cursor-help"
        tabIndex={0}
        title="When this spec was first added to the library"
        aria-label={`Discovered ${attr.discoveredAt} — when this spec was first added to the library`}
      >
        discovered {attr.discoveredAt}
      </span>
      <span style={{ color: BORDER }}>·</span>
      <span
        style={{ color: SUB }}
        className="cursor-help"
        tabIndex={0}
        title="When the spec was last re-checked against its source — confirms it still matches the live brand"
        aria-label={`Verified ${attr.verifiedAt} — when the spec was last re-checked against its source`}
      >
        verified {attr.verifiedAt}
      </span>
    </div>
  );
}
