import Link from "next/link";
import {
  BG,
  BORDER,
  INK,
  MONO,
  MUTED,
  SUB,
  SURFACE_2,
} from "@/lib/ui-data/tokens";
import { TYPE_META, type Item } from "@/lib/ui-data/items";
import { BrandLogo } from "./BrandLogo";

function hostnameFromUrl(maybeUrl: string | undefined): string | null {
  if (!maybeUrl) return null;
  try {
    return new URL(maybeUrl).hostname;
  } catch {
    return null;
  }
}

export function ItemCard({ item }: { item: Item }) {
  const meta = TYPE_META[item.type];
  return (
    <Link
      href={`/library/${item.id}`}
      className="p-5 group transition-colors hover:bg-[#101013] block"
      style={{ background: BG }}
    >
      <div className="flex h-1.5 mb-5">
        {item.bundle.palette.map((c, i) => (
          <span
            key={i}
            className="flex-1 first:rounded-l-sm last:rounded-r-sm"
            style={{ background: c }}
          />
        ))}
      </div>

      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-medium mb-2" style={{ color: INK }}>
            {item.name}
          </div>
          <div className="text-[12.5px]" style={{ color: SUB }}>
            {item.tagline}
          </div>
        </div>
        {item.bundle.brandLogoUrl && (
          <BrandLogo
            src={item.bundle.brandLogoUrl as string}
            fallbackDomain={hostnameFromUrl(item.bundle.brandLogoUrl)}
          />
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
        <span
          className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em]"
          style={{ fontFamily: MONO, color: MUTED }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.accent }} />
          <span style={{ color: meta.accent, fontSize: 11, lineHeight: 1 }}>{meta.icon}</span>
          {meta.label}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="text-[9px] px-1.5 py-0.5 rounded"
            style={{
              background: SURFACE_2,
              color: SUB,
              fontFamily: MONO,
              border: `1px solid ${BORDER}`,
            }}
          >
            {item.category.toLowerCase()}
          </span>
        </div>
        <span
          className="inline-flex items-center gap-1 text-[10.5px]"
          style={{ fontFamily: MONO, color: MUTED }}
        >
          <span className="whitespace-nowrap">
            {item.tools.length} {item.tools.length === 1 ? "tool" : "tools"}
          </span>
          <span className="mx-1.5" aria-hidden="true">·</span>
          <span className="whitespace-nowrap">{item.updatedAgo}</span>
        </span>
      </div>
    </Link>
  );
}
