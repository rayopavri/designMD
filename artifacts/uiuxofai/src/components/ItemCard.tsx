import { Link } from "wouter";
import { ArrowUpRight } from "lucide-react";
import {
  BG,
  BORDER,
  INK,
  MONO,
  MUTED,
  SUB,
  SURFACE_2,
} from "../lib/tokens";
import {
  TYPE_META,
  type BundleItem,
  type Item,
  type Tool,
} from "../lib/items";

export function ItemCard({ item }: { item: Item }) {
  const meta = TYPE_META[item.type];
  return (
    <Link
      href={`/library/${item.id}`}
      className="p-5 group transition-colors hover:bg-[#101013] block"
      style={{ background: BG }}
    >
      {item.type === "bundle" ? (
        <div className="flex h-1.5 mb-5">
          {(item as BundleItem).bundle.palette.map((c, i) => (
            <span
              key={i}
              className="flex-1 first:rounded-l-sm last:rounded-r-sm"
              style={{ background: c }}
            />
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 h-1.5 mb-5">
          <span
            className="h-1.5 flex-1 rounded-sm"
            style={{ background: meta.accent }}
          />
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <span
          className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em]"
          style={{ fontFamily: MONO, color: MUTED }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.accent }} />
          <span style={{ color: meta.accent, fontSize: 11, lineHeight: 1 }}>{meta.icon}</span>
          {meta.label}
        </span>
        {item.type === "bundle" ? null : (
          <span
            className="text-[10.5px]"
            style={{ fontFamily: MONO, color: SUB }}
          >
            {item.attribution.discoveryMethod === "Community"
              ? "community"
              : item.attribution.discoveryMethod === "Auto-discovered"
              ? "auto"
              : "editorial"}
          </span>
        )}
      </div>

      <div className="text-[16px] font-medium mb-1" style={{ color: INK }}>
        {item.name}
      </div>
      <div className="text-[12.5px] mb-5" style={{ color: SUB }}>
        {item.tagline}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          {(item.tools as Tool[]).slice(0, 3).map((m) => (
            <span
              key={m}
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{
                background: SURFACE_2,
                color: SUB,
                fontFamily: MONO,
                border: `1px solid ${BORDER}`,
              }}
            >
              {m.toLowerCase()}
            </span>
          ))}
        </div>
        {item.type === "bundle" ? (
          <span
            className="inline-flex items-center gap-1 text-[10.5px]"
            style={{ fontFamily: MONO, color: MUTED }}
          >
            <span className="whitespace-nowrap">
              works in {item.tools.length} {item.tools.length === 1 ? "tool" : "tools"}
            </span>
            <span className="mx-1.5" aria-hidden>·</span>
            <span className="whitespace-nowrap">{item.updatedAgo}</span>
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 text-[10.5px]"
            style={{ fontFamily: MONO, color: MUTED }}
          >
            <ArrowUpRight className="h-3 w-3" style={{ color: SUB }} />
            <span>{item.updatedAgo}</span>
          </span>
        )}
      </div>
    </Link>
  );
}
