"use client";

import { SectionLabel } from "@/components/ui/Shell";
import { CodePanel } from "@/components/ui/CodePanel";
import {
  BORDER,
  BORDER_SOFT,
  INK,
  INK_ON_LIGHT,
  LIME,
  MONO,
  MUTED,
  SUB,
  SURFACE,
  SURFACE_2,
  VIOLET,
} from "@/lib/ui-data/tokens";
import { type Bundle } from "@/lib/ui-data/bundles";

export type CompanionTab = "design.md" | "companion";

/**
 * The two-file reader: design.md spec + companion prompt, behind a tab toggle.
 * The live preview that used to share this toggle now lives in the hero /
 * Overview, so this section is purely the source files.
 */
export function CompanionSection({
  bundle,
  tab,
  setTab,
  n,
}: {
  bundle: Bundle;
  tab: CompanionTab;
  setTab: (t: CompanionTab) => void;
  n: string;
}) {
  return (
    <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
      <div className="mx-auto max-w-6xl px-6 lg:px-8 py-16">
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-3">
            <SectionLabel n={n} t="The design system" />
            <h2 className="mt-3 text-[28px] leading-[1.08] font-medium tracking-[-0.018em]">
              Two files,{" "}
              <span style={{ color: SUB }}>versioned together.</span>
            </h2>
            <p className="mt-5 text-[13.5px] leading-[1.6]" style={{ color: SUB }}>
              Read the spec, then read the prompt that teaches the model how to use it.
            </p>
          </div>
          <div className="col-span-12 lg:col-span-9">
            <div
              className="text-[10.5px] uppercase tracking-[0.22em] mb-2"
              style={{ fontFamily: MONO, color: MUTED }}
            >
              explore the bundle
            </div>
            <div
              className="inline-flex items-center gap-1 rounded-full border p-1 mb-6"
              style={{ borderColor: BORDER, background: SURFACE_2 }}
            >
              {(["design.md", "companion"] as CompanionTab[]).map((t) => {
                const isActive = tab === t;
                return (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className="h-8 rounded-full px-4 text-[12.5px] transition-colors"
                    style={{
                      background: isActive ? INK : "transparent",
                      color: isActive ? INK_ON_LIGHT : SUB,
                      fontFamily: t === "design.md" ? MONO : undefined,
                    }}
                  >
                    {t === "design.md" ? "design.md" : "companion prompt"}
                  </button>
                );
              })}
            </div>

            {bundle.lifecycleStatus && bundle.lifecycleStatus !== "published" ? (
              <StatusBanner status={bundle.lifecycleStatus} />
            ) : null}

            {tab === "design.md" ? (
              <CodePanel
                title={`${bundle.name.toLowerCase()} / design.md`}
                language="yaml"
                source={bundle.designMd}
                rightMeta={
                  <>
                    <span>{bundle.tokens.toLocaleString()} tokens</span>
                    <span className="inline-flex items-center gap-1.5" style={{ color: INK }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: LIME }} />
                      {bundle.coverage}% coverage
                    </span>
                  </>
                }
              />
            ) : bundle.companionStatus === "pending" ? (
              <CompanionPending />
            ) : bundle.companionStatus === "failed" ? (
              <CompanionFailed />
            ) : (
              <CodePanel
                title={`${bundle.name.toLowerCase()} / companion.md`}
                language="md"
                source={bundle.companionPrompt}
                rightMeta={
                  <span className="inline-flex items-center gap-1.5" style={{ color: INK }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: VIOLET }} />
                    calibrated for Claude / GPT
                  </span>
                }
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function StatusBanner({
  status,
}: {
  status: "personal" | "pending_review" | "flagged" | "rejected";
}) {
  const COPY: Record<typeof status, { label: string; detail: string }> = {
    pending_review: {
      label: "Draft",
      detail: "Awaiting editorial review. Only published design skills are listed.",
    },
    personal: {
      label: "Personal draft",
      detail: "Held below the quality bar — usable, but not editor-approved.",
    },
    rejected: {
      label: "Rejected",
      detail: "An editor reviewed this and asked for changes before it can be published as a design skill.",
    },
    flagged: {
      label: "Flagged",
      detail: "This design skill has been flagged by community votes and is under re-review.",
    },
  };
  const { label, detail } = COPY[status];
  return (
    <div
      className="mb-3 rounded-md border px-3 py-2 text-[12px] flex items-center gap-3"
      style={{ borderColor: BORDER, background: SURFACE_2 }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full shrink-0"
        style={{ background: SUB }}
        aria-hidden
      />
      <div className="min-w-0">
        <span style={{ color: INK }}>{label}</span>
        <span className="ml-2" style={{ color: SUB }}>
          {detail}
        </span>
      </div>
    </div>
  );
}

function CompanionPending() {
  return (
    <div
      className="rounded-lg border p-8 flex flex-col items-center justify-center gap-3 text-center"
      style={{ borderColor: BORDER, background: SURFACE }}
    >
      <span
        className="inline-block h-2 w-2 rounded-full animate-pulse"
        style={{ background: VIOLET }}
        aria-hidden
      />
      <div className="text-[13.5px]" style={{ color: INK }}>
        Generating companion prompt…
      </div>
      <div className="text-[11px] max-w-sm" style={{ color: SUB, fontFamily: MONO }}>
        Sonnet 4.6 is writing the tool-agnostic system prompt. Usually ~10 seconds — this page auto-refreshes when it&apos;s ready.
      </div>
    </div>
  );
}

function CompanionFailed() {
  return (
    <div
      className="rounded-lg border p-8 flex flex-col items-center justify-center gap-3 text-center"
      style={{ borderColor: BORDER, background: SURFACE }}
    >
      <div className="text-[13.5px]" style={{ color: INK }}>
        Companion prompt unavailable
      </div>
      <div className="text-[11px] max-w-sm" style={{ color: SUB, fontFamily: MONO }}>
        Generation failed. The design.md is intact and copyable; the companion prompt can be regenerated later.
      </div>
    </div>
  );
}
