import { useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowUpRight, Check, Copy } from "lucide-react";
import { SectionLabel } from "../components/Shell";
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
} from "../lib/tokens";
import { getItem, TYPE_META } from "../lib/items";
import { CodePanel } from "../components/CodePanel";
import { getDraft, isDraftId } from "../lib/draftStore";

type Target = "claude" | "cursor" | "lovable" | "figma";

const STEPS: Record<Target, { n: string; t: string; cmd?: string }[]> = {
  claude: [
    { n: "1", t: "Create a new Project in Claude and open Project Instructions", cmd: "Projects → New project → Instructions" },
    { n: "2", t: "Paste the design.md spec as project knowledge" },
    { n: "3", t: "Paste the companion prompt as the project's custom instructions" },
    { n: "4", t: "Start designing — Claude will treat the spec as truth" },
  ],
  cursor: [
    { n: "1", t: "Open .cursorrules in your project root (create if missing)" },
    { n: "2", t: "Paste the companion prompt at the top of the rules file" },
    { n: "3", t: "Drop design.md into the repo at /docs/design.md and reference it" },
    { n: "4", t: "Use @design.md in Cursor chat to anchor every generation" },
  ],
  lovable: [
    { n: "1", t: "Open the Lovable project settings → Custom prompt" },
    { n: "2", t: "Paste the companion prompt into the custom instructions" },
    { n: "3", t: "Upload design.md as a project attachment" },
    { n: "4", t: "Reference design.md by name in every Lovable prompt" },
  ],
  figma: [
    { n: "1", t: "In Figma Make, open the design system panel" },
    { n: "2", t: "Paste design.md into the tokens import" },
    { n: "3", t: "Set the companion prompt as the generator's system prompt" },
    { n: "4", t: "Generate — Figma Make will honor the declared tokens" },
  ],
};

export function CopySuccess() {
  const [, params] = useRoute<{ id: string }>("/copy/:id");
  const paramId = params?.id ?? "";
  const draft = paramId && isDraftId(paramId) ? getDraft(paramId) : undefined;
  const item = paramId && !isDraftId(paramId) ? getItem(paramId) : undefined;
  // The two-file copy flow (design.md + companion prompt) is bundle-specific.
  // Non-bundle items have their own install flow on the detail page.
  const bundle = item && item.type === "bundle" ? item.bundle : undefined;
  const [target, setTarget] = useState<Target>("claude");
  const [copiedSpec, setCopiedSpec] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedDraft, setCopiedDraft] = useState(false);

  if (draft) {
    const meta = TYPE_META[draft.type];
    async function copyDraftBody() {
      try {
        await navigator.clipboard.writeText(draft!.body);
      } catch {
        // ignore
      }
      setCopiedDraft(true);
      setTimeout(() => setCopiedDraft(false), 2000);
    }
    return (
      <>
        <section className="border-b text-center" style={{ borderColor: BORDER_SOFT }}>
          <div className="mx-auto max-w-3xl px-6 lg:px-8 pt-20 pb-12">
            <span
              className="inline-flex items-center gap-2 h-7 px-3 rounded-full text-[10.5px] uppercase tracking-[0.22em]"
              style={{ background: SURFACE_2, border: `1px solid ${BORDER}`, color: SUB, fontFamily: MONO }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.accent }} />
              <Check className="h-3 w-3" style={{ color: LIME }} />
              draft copied · {meta.label.toLowerCase()} from {draft.host}
            </span>
            <h1 className="mt-7 text-[48px] sm:text-[60px] leading-[1.02] font-medium tracking-[-0.022em]">
              Your draft is on
              <br />
              <span style={{ color: SUB }}>your clipboard.</span>
            </h1>
            <p className="mt-6 text-[14.5px] leading-[1.65] max-w-[34rem] mx-auto" style={{ color: SUB }}>
              Generated drafts are for personal use. Paste{" "}
              <span
                className="px-1.5 py-0.5 rounded mx-0.5"
                style={{ fontFamily: MONO, color: INK, background: SURFACE_2, border: `1px solid ${BORDER}` }}
              >
                {draft.filename}
              </span>{" "}
              into your tool of choice — or submit it to the editorial desk for review.
            </p>
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-4xl px-6 lg:px-8 py-12">
            <SectionLabel n="01" t="Your draft" />
            <div className="mt-6">
              <CodePanel
                title={draft.filename}
                language={draft.language}
                source={draft.body}
                rightMeta={`${meta.label.toLowerCase()} · ${draft.host}`}
              />
            </div>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={copyDraftBody}
                className="rounded-xl border p-5 text-left transition-colors"
                style={{ borderColor: copiedDraft ? `${LIME}88` : BORDER, background: SURFACE }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-[10.5px] uppercase tracking-[0.22em]"
                    style={{ fontFamily: MONO, color: MUTED }}
                  >
                    draft
                  </span>
                  {copiedDraft ? (
                    <Check className="h-4 w-4" style={{ color: LIME }} />
                  ) : (
                    <Copy className="h-4 w-4" style={{ color: SUB }} />
                  )}
                </div>
                <div className="text-[14px] font-medium" style={{ color: INK }}>
                  {copiedDraft ? "Draft copied" : `Copy ${draft.filename}`}
                </div>
                <div className="text-[11.5px] mt-1" style={{ color: SUB }}>
                  {draft.body.split("\n").length} lines · personal use
                </div>
              </button>
              <Link
                href="/generate"
                className="rounded-xl border p-5 text-left transition-colors block"
                style={{ borderColor: BORDER, background: SURFACE }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-[10.5px] uppercase tracking-[0.22em]"
                    style={{ fontFamily: MONO, color: MUTED }}
                  >
                    desk
                  </span>
                  <ArrowUpRight className="h-4 w-4" style={{ color: SUB }} />
                </div>
                <div className="text-[14px] font-medium" style={{ color: INK }}>
                  Submit for editorial review
                </div>
                <div className="text-[11.5px] mt-1" style={{ color: SUB }}>
                  curators verify compliance and publish to the public library
                </div>
              </Link>
            </div>

            <div className="mt-10 flex items-center justify-between pt-6 border-t" style={{ borderColor: BORDER_SOFT }}>
              <Link href="/generate" className="text-[12.5px]" style={{ color: SUB }}>
                ← generate another
              </Link>
              <Link
                href="/library"
                className="inline-flex items-center gap-1.5 text-[12.5px]"
                style={{ color: VIOLET }}
              >
                Browse the curated library
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </section>
      </>
    );
  }

  if (!bundle) {
    const isNonBundle = !!item && item.type !== "bundle";
    return (
      <div className="mx-auto max-w-3xl px-6 lg:px-8 py-32 text-center">
        <h1 className="text-[28px] font-medium">
          {isNonBundle ? `${item!.name} installs differently.` : "Bundle not found."}
        </h1>
        {isNonBundle ? (
          <p className="mt-4 text-[14px]" style={{ color: SUB }}>
            This is a {item!.type}. Use the per-tool install steps on its detail page instead of the bundle copy flow.
          </p>
        ) : null}
        <Link
          href={isNonBundle ? `/library/${item!.id}` : "/library"}
          className="mt-4 inline-flex items-center gap-1.5 text-[13px]"
          style={{ color: VIOLET }}
        >
          {isNonBundle ? `View ${item!.name}` : "Back to library"}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  async function copyText(text: string, kind: "spec" | "prompt") {
    try {
      await navigator.clipboard.writeText(text);
      if (kind === "spec") {
        setCopiedSpec(true);
        setTimeout(() => setCopiedSpec(false), 2000);
      } else {
        setCopiedPrompt(true);
        setTimeout(() => setCopiedPrompt(false), 2000);
      }
    } catch {
      // ignore
    }
  }

  return (
    <>
      <section className="border-b text-center" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-3xl px-6 lg:px-8 pt-20 pb-12">
          <span
            className="inline-flex items-center gap-2 h-7 px-3 rounded-full text-[10.5px] uppercase tracking-[0.22em]"
            style={{ background: SURFACE_2, border: `1px solid ${BORDER}`, color: SUB, fontFamily: MONO }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: LIME }} />
            <Check className="h-3 w-3" style={{ color: LIME }} />
            copied · plate {bundle.num} · {bundle.name}
          </span>
          <h1 className="mt-7 text-[48px] sm:text-[60px] leading-[1.02] font-medium tracking-[-0.022em]">
            The bundle is on
            <br />
            <span style={{ color: SUB }}>your clipboard.</span>
          </h1>
          <p className="mt-6 text-[14.5px] leading-[1.65] max-w-[34rem] mx-auto" style={{ color: SUB }}>
            {bundle.tokens.toLocaleString()} tokens — companion prompt and{" "}
            <span
              className="px-1.5 py-0.5 rounded mx-0.5"
              style={{ fontFamily: MONO, color: INK, background: SURFACE_2, border: `1px solid ${BORDER}` }}
            >
              design.md
            </span>{" "}
            together. Pick where it should land.
          </p>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-4xl px-6 lg:px-8 py-12">
          <div className="flex items-center gap-0 border-b" style={{ borderColor: BORDER }}>
            {(["claude", "cursor", "lovable", "figma"] as Target[]).map((t) => {
              const isActive = target === t;
              return (
                <button
                  key={t}
                  onClick={() => setTarget(t)}
                  className="relative flex-1 px-4 py-3 text-[13px] font-medium capitalize"
                  style={{ color: isActive ? INK : SUB }}
                >
                  {t === "figma" ? "Figma Make" : t}
                  {isActive ? (
                    <span className="absolute left-0 right-0 -bottom-px h-px" style={{ background: VIOLET }} />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-8">
            <SectionLabel
              n="01"
              t={`How to apply this in ${target === "figma" ? "Figma Make" : target.charAt(0).toUpperCase() + target.slice(1)}`}
            />
            <div className="mt-6 space-y-5">
              {STEPS[target].map((s) => (
                <div key={s.n} className="flex items-start gap-4">
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full shrink-0 text-[12px] font-medium"
                    style={{ background: INK, color: INK_ON_LIGHT }}
                  >
                    {s.n}
                  </span>
                  <div className="flex-1 pt-0.5">
                    <div className="text-[14px]" style={{ color: INK }}>
                      {s.t}
                    </div>
                    {s.cmd ? (
                      <div
                        className="mt-2 inline-block rounded-md px-2 py-1 text-[11.5px]"
                        style={{
                          background: SURFACE_2,
                          border: `1px solid ${BORDER}`,
                          color: SUB,
                          fontFamily: MONO,
                        }}
                      >
                        {s.cmd}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => copyText(bundle.designMd, "spec")}
              className="rounded-xl border p-5 text-left transition-colors"
              style={{ borderColor: copiedSpec ? `${LIME}88` : BORDER, background: SURFACE }}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-[10.5px] uppercase tracking-[0.22em]"
                  style={{ fontFamily: MONO, color: MUTED }}
                >
                  spec
                </span>
                {copiedSpec ? (
                  <Check className="h-4 w-4" style={{ color: LIME }} />
                ) : (
                  <Copy className="h-4 w-4" style={{ color: SUB }} />
                )}
              </div>
              <div className="text-[14px] font-medium" style={{ color: INK }}>
                {copiedSpec ? "Spec copied" : "Copy design.md"}
              </div>
              <div className="text-[11.5px] mt-1" style={{ color: SUB }}>
                {bundle.designMd.split("\n").length} lines · {bundle.tokens.toLocaleString()} tokens
              </div>
            </button>
            <button
              onClick={() => copyText(bundle.companionPrompt, "prompt")}
              className="rounded-xl border p-5 text-left transition-colors"
              style={{ borderColor: copiedPrompt ? `${LIME}88` : BORDER, background: SURFACE }}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-[10.5px] uppercase tracking-[0.22em]"
                  style={{ fontFamily: MONO, color: MUTED }}
                >
                  prompt
                </span>
                {copiedPrompt ? (
                  <Check className="h-4 w-4" style={{ color: LIME }} />
                ) : (
                  <Copy className="h-4 w-4" style={{ color: SUB }} />
                )}
              </div>
              <div className="text-[14px] font-medium" style={{ color: INK }}>
                {copiedPrompt ? "Prompt copied" : "Copy companion prompt"}
              </div>
              <div className="text-[11.5px] mt-1" style={{ color: SUB }}>
                calibrated for {bundle.worksWith.join(" · ")}
              </div>
            </button>
          </div>

          <div className="mt-10 flex items-center justify-between pt-6 border-t" style={{ borderColor: BORDER_SOFT }}>
            <Link href={`/library/${bundle.id}`} className="text-[12.5px]" style={{ color: SUB }}>
              ← back to {bundle.name}
            </Link>
            <Link
              href={`/vote/${bundle.id}`}
              className="inline-flex items-center gap-1.5 text-[12.5px]"
              style={{ color: VIOLET }}
            >
              Did it land? Vote on this bundle
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
