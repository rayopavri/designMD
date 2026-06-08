"use client";

import { SectionLabel } from "@/components/ui/Shell";
import { SectionCoverage } from "@/components/ui/SectionCoverage";
import {
  BORDER,
  BORDER_SOFT,
  INK,
  LIME,
  MONO,
  MUTED,
  SUB,
  SURFACE,
} from "@/lib/ui-data/tokens";
import { type Bundle } from "@/lib/ui-data/bundles";

/**
 * Overview: the per-surface coverage breakdown, the brand palette, and any
 * accessibility advisory. When the hero is showing a stored screenshot, this
 * section also carries the live token-rendered PreviewPane; when the hero is
 * already the PreviewPane (no screenshot yet) we skip it to avoid duplication.
 */
export function OverviewSection({ bundle, n }: { bundle: Bundle; n: string }) {
  return (
    <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
      <div className="mx-auto max-w-6xl px-6 lg:px-8 py-16">
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-3">
            <SectionLabel n={n} t="Coverage & preview" />
            <h2 className="mt-3 text-[28px] leading-[1.08] font-medium tracking-[-0.018em]">
              What&apos;s{" "}
              <span style={{ color: SUB }}>actually defined.</span>
            </h2>
            <p className="mt-5 text-[13.5px] leading-[1.6]" style={{ color: SUB }}>
              Per-surface coverage of this spec — the higher each bar, the fewer gaps your AI has to guess.
            </p>
          </div>
          <div className="col-span-12 lg:col-span-9 space-y-6">
            <div className="rounded-xl border p-6" style={{ borderColor: BORDER, background: SURFACE }}>
              <div className="flex items-start justify-between mb-4">
                <div
                  className="text-[10.5px] uppercase tracking-[0.22em] mt-1"
                  style={{ fontFamily: MONO, color: MUTED }}
                >
                  coverage by surface
                </div>
                <div className="text-[56px] leading-none font-medium tracking-[-0.03em]" style={{ color: INK }}>
                  {bundle.coverage}
                  <span className="text-[24px]" style={{ color: SUB }}>%</span>
                </div>
              </div>
              {bundle.sectionCoverage ? (
                <SectionCoverage coverage={bundle.sectionCoverage} />
              ) : null}
              <div className="h-1.5 mt-4 flex">
                {bundle.palette.map((c, i) => (
                  <span
                    key={i}
                    className="flex-1 first:rounded-l-sm last:rounded-r-sm"
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>

            {bundle.accessibilityNotes ? (
              <AccessibilityNote notes={bundle.accessibilityNotes} />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function AccessibilityNote({ notes }: { notes: string }) {
  const lines = notes.split("\n").map((l) => l.trim()).filter(Boolean);
  const [summary, ...rest] = lines;
  return (
    <div className="rounded-xl border p-5" style={{ borderColor: BORDER, background: SURFACE }}>
      <div
        className="text-[10.5px] uppercase tracking-[0.22em] mb-2.5 inline-flex items-center gap-2"
        style={{ fontFamily: MONO, color: MUTED }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: LIME }} />
        accessibility advisory
      </div>
      {summary ? (
        <p className="text-[13px] leading-[1.6]" style={{ color: SUB }}>
          {summary}
        </p>
      ) : null}
      {rest.length > 0 ? (
        <div className="mt-3 space-y-1.5">
          {rest.map((line, i) => (
            <div
              key={i}
              className="text-[11.5px] leading-[1.5]"
              style={{ fontFamily: MONO, color: MUTED }}
            >
              {line}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
