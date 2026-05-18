import { Link } from "wouter";
import { ArrowUpRight, Check } from "lucide-react";
import { SectionLabel } from "../components/Shell";
import {
  BG,
  BORDER,
  INK,
  LIME,
  MONO,
  MUTED,
  SUB,
} from "../lib/tokens";
import { BUNDLES } from "../lib/bundles";

export function VoteIndex() {
  return (
    <div className="mx-auto max-w-6xl px-6 lg:px-8 py-16">
      <div className="text-center mb-12">
        <SectionLabel n="00" t="Calibrate the queue" />
        <h1 className="mt-5 text-[44px] sm:text-[52px] leading-[1.02] font-medium tracking-[-0.018em]">
          Pick a bundle{" "}
          <span style={{ color: SUB }}>and tell us if it held.</span>
        </h1>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px rounded-lg overflow-hidden" style={{ background: BORDER }}>
        {BUNDLES.map((b) => (
          <Link
            key={b.id}
            href={`/vote/${b.id}`}
            className="p-5 group transition-colors hover:bg-[#101013] block"
            style={{ background: BG }}
          >
            <div className="flex h-1.5 mb-5">
              {b.palette.map((c, i) => (
                <span
                  key={i}
                  className="flex-1 first:rounded-l-sm last:rounded-r-sm"
                  style={{ background: c }}
                />
              ))}
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-[0.2em]" style={{ fontFamily: MONO, color: MUTED }}>
                № {b.num}
              </span>
              <ArrowUpRight className="h-3.5 w-3.5" style={{ color: SUB }} />
            </div>
            <div className="text-[15px] font-medium" style={{ color: INK }}>
              {b.name}
            </div>
            <div
              className="mt-3 inline-flex items-center gap-1.5 text-[10.5px]"
              style={{ fontFamily: MONO, color: SUB }}
            >
              <Check className="h-2.5 w-2.5" style={{ color: LIME }} />
              {b.voteRate}% working · {b.voteCount.toLocaleString()} votes
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
