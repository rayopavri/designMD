import { Link } from "wouter";
import { ArrowUpRight } from "lucide-react";
import { getRelatedItems, TYPE_META } from "../lib/items";
import { SectionLabel } from "./Shell";
import { BG, BORDER, INK, MONO, MUTED, SUB } from "../lib/tokens";

export function WorksWellWith({ itemId, sectionNum = "03" }: { itemId: string; sectionNum?: string }) {
  const related = getRelatedItems(itemId);
  if (related.length === 0) return null;

  return (
    <section className="border-t" style={{ borderColor: BORDER }}>
      <div className="mx-auto max-w-6xl px-6 lg:px-8 py-16">
        <SectionLabel n={sectionNum} t="Works well with" />
        <p className="mt-3 text-[13.5px]" style={{ color: SUB }}>
          Cross-recommendations from the curation desk — mix types to ship the same idea across tools.
        </p>
        <div
          className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px rounded-lg overflow-hidden"
          style={{ background: BORDER }}
        >
          {related.slice(0, 6).map((it) => {
            const meta = TYPE_META[it.type];
            return (
              <Link
                key={it.id}
                href={`/library/${it.id}`}
                className="p-5 block transition-colors hover:bg-[#101013]"
                style={{ background: BG }}
              >
                <div className="flex items-center justify-between mb-4">
                  <span
                    className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em]"
                    style={{ fontFamily: MONO, color: MUTED }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.accent }} />
                    {meta.label}
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5" style={{ color: SUB }} />
                </div>
                <div className="text-[15px] font-medium mb-1" style={{ color: INK }}>
                  {it.name}
                </div>
                <div className="text-[12px]" style={{ color: SUB }}>
                  {it.tagline}
                </div>
                <div
                  className="mt-3 text-[10.5px] truncate"
                  style={{ fontFamily: MONO, color: MUTED }}
                >
                  {it.attribution.author} · {it.attribution.license}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
