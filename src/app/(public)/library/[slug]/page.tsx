"use client";

import Link from "next/link";
import { useSearchParams, useParams } from "next/navigation";

import { Suspense, useEffect, useState } from "react";
import { ArrowUpRight, Check, ChevronRight, Copy, GitFork } from "lucide-react";
import { SectionLabel } from "@/components/ui/Shell";
import { CodePanel } from "@/components/ui/CodePanel";
import { AttributionRow } from "@/components/ui/AttributionRow";
import { WorksWellWith } from "@/components/ui/WorksWellWith";
import { SectionCoverage } from "@/components/ui/SectionCoverage";
import { PulseRow } from "@/components/ui/PulseRow";
import { compatibleTools, nonBundleSteps } from "@/lib/ui-data/nonBundleInstall";
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
import {
  getItem,
  TYPE_META,
  type BundleItem,
  type Item,
  type AgentItem,
  type McpItem,
  type SkillItem,
} from "@/lib/ui-data/items";
import { TOOLS, toolLabel, type ToolId } from "@/lib/ui-data/toolPref";
import { useToolPref } from "@/lib/ui-data/useToolPref";
import { INSTALL_STEPS } from "@/lib/ui-data/installSteps";
import { downloadBundleZip } from "@/lib/ui-data/bundleZip";
import { useBundleDetail } from "@/hooks/useBundleDetail";

type Tab = "design.md" | "companion" | "preview";

function BundleDetail() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  // Non-bundle items (skill/agent/mcp) still live in the hardcoded ITEMS list.
  // Look those up first; if no match, fall through to the DB-backed bundle hook.
  const staticItem = slug ? getItem(slug) : undefined;
  const isStaticNonBundle = staticItem && staticItem.type !== "bundle";

  const { item: dbBundle, loading, notFound, error } = useBundleDetail(
    isStaticNonBundle ? undefined : slug
  );

  if (isStaticNonBundle) {
    return <NonBundleView item={staticItem as SkillItem | AgentItem | McpItem} />;
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-6 lg:px-8 py-32 text-center">
        <SectionLabel n="·" t="Loading" />
        <h1 className="mt-4 text-[28px] font-medium" style={{ color: SUB }}>
          Fetching bundle…
        </h1>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-6 lg:px-8 py-32 text-center">
        <SectionLabel n="!" t="Error" />
        <h1 className="mt-4 text-[28px] font-medium">Something went wrong.</h1>
        <p className="mt-3 text-[13.5px]" style={{ color: SUB }}>
          {error.message}
        </p>
        <Link
          href="/library"
          className="mt-6 inline-flex items-center gap-1.5 text-[13px]"
          style={{ color: VIOLET }}
        >
          Back to library
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  if (notFound || !dbBundle) {
    return (
      <div className="mx-auto max-w-3xl px-6 lg:px-8 py-32 text-center">
        <SectionLabel n="404" t="Not found" />
        <h1 className="mt-4 text-[28px] font-medium">No item with that slug.</h1>
        <Link
          href="/library"
          className="mt-6 inline-flex items-center gap-1.5 text-[13px]"
          style={{ color: VIOLET }}
        >
          Back to library
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  return <BundleView item={dbBundle} />;
}

// ─────────────────────────────────────────────────────────────
// BUNDLE
// ─────────────────────────────────────────────────────────────

function BundleView({ item }: { item: BundleItem }) {
  const bundle = item.bundle;
  const [tab, setTab] = useState<Tab>("preview");
  const [tool, setTool] = useToolPref();
  const search = useSearchParams().toString();
  const [showInstall, setShowInstall] = useState<boolean>(() => {
    const params = new URLSearchParams(search);
    return params.get("install") === "1";
  });
  const [copiedSpec, setCopiedSpec] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);
  const [zipping, setZipping] = useState(false);

  useEffect(() => {
    if (showInstall && typeof window !== "undefined") {
      requestAnimationFrame(() => {
        document.getElementById("install-steps")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [showInstall]);

  const designLines = bundle.designMd.split("\n").length;
  const promptLines = bundle.companionPrompt.split("\n").length;
  const promptTokensApprox = Math.max(1, Math.round(bundle.companionPrompt.length / 4));

  async function copyText(text: string, kind: "spec" | "prompt" | "cli") {
    try {
      await navigator.clipboard.writeText(text);
      if (kind === "spec") {
        setCopiedSpec(true);
        setTimeout(() => setCopiedSpec(false), 2000);
      } else if (kind === "prompt") {
        setCopiedPrompt(true);
        setTimeout(() => setCopiedPrompt(false), 2000);
      } else if (kind === "cli") {
        setCopiedCli(true);
        setTimeout(() => setCopiedCli(false), 2000);
      }
    } catch {
      // ignore
    }
  }

  async function onZip() {
    setZipping(true);
    try {
      await downloadBundleZip({
        slug: bundle.id,
        name: bundle.name,
        version: bundle.version,
        designMd: bundle.designMd,
        companionMd: bundle.companionPrompt,
        tool,
      });
    } finally {
      setZipping(false);
    }
  }

  return (
    <>
      <Breadcrumb item={item} />

      {/* Hero */}
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-6xl px-6 lg:px-8 pt-6 pb-12 grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-7">
            <div className="mb-5">
              <AttributionRow attr={item.attribution} />
            </div>
            <div
              className="text-[10.5px] uppercase tracking-[0.22em] mb-3 inline-flex items-center gap-2"
              style={{ fontFamily: MONO, color: MUTED }}
            >
              <span>plate {bundle.num}</span>
              <span style={{ color: BORDER }}>·</span>
              <span>maintained by {bundle.maintainer}</span>
              <span style={{ color: BORDER }}>·</span>
              <span>v{bundle.version}</span>
            </div>
            <h1 className="text-[52px] sm:text-[64px] leading-[0.98] font-medium tracking-[-0.022em]">
              {bundle.name}
              <span style={{ color: SUB }}>.</span>
            </h1>
            <p className="mt-6 text-[15px] leading-[1.65] max-w-[36rem]" style={{ color: SUB }}>
              {bundle.description}
            </p>
            <div className="mt-6 flex items-center gap-2 flex-wrap">
              {bundle.tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full"
                  style={{
                    background: SURFACE_2,
                    border: `1px solid ${BORDER}`,
                    color: SUB,
                    fontFamily: MONO,
                  }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: VIOLET }} />
                  {t}
                </span>
              ))}
            </div>
            <p className="mt-6 text-[15px] leading-[1.65] max-w-[36rem]" style={{ color: SUB }}>
              Paste both files into Claude, Cursor, Lovable, or Figma Make. The AI will follow this design system on every component it generates.
            </p>
            {/* Tool picker */}
            <div className="mt-6">
              <div
                className="text-[10.5px] uppercase tracking-[0.22em] mb-2.5"
                style={{ fontFamily: MONO, color: MUTED }}
              >
                Pick your tool
              </div>
              <div className="inline-flex items-center rounded-full border p-1" style={{ borderColor: BORDER, background: SURFACE }}>
                {TOOLS.map((t) => {
                  const active = tool === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTool(t.id)}
                      className="h-7 px-3 rounded-full text-[12px] font-medium transition-colors"
                      style={{
                        background: active ? INK : "transparent",
                        color: active ? INK_ON_LIGHT : SUB,
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Primary CTA + zip link */}
            <div className="mt-5">
              <button
                onClick={() => setShowInstall(true)}
                className="h-11 rounded-full px-6 text-[13px] font-medium inline-flex items-center gap-2"
                style={{
                  background: INK,
                  color: INK_ON_LIGHT,
                  boxShadow: `0 0 0 1px ${VIOLET}55, 0 10px 36px -10px ${VIOLET}88`,
                }}
              >
                Use in {toolLabel(tool)}
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <div className="mt-2.5">
                <button
                  onClick={onZip}
                  disabled={zipping}
                  className="inline-flex items-center gap-1 text-[12px]"
                  style={{ color: SUB, opacity: zipping ? 0.6 : 1 }}
                >
                  <span aria-hidden>↓</span>
                  {zipping ? "preparing…" : "download as .zip"}
                </button>
              </div>
            </div>
          </div>

          <aside className="col-span-12 lg:col-span-5">
            <div className="rounded-xl border p-6" style={{ borderColor: BORDER, background: SURFACE }}>
              <div className="flex items-baseline justify-between mb-5">
                <div>
                  <div
                    className="text-[10.5px] uppercase tracking-[0.22em] mb-1.5 cursor-help"
                    style={{ fontFamily: MONO, color: MUTED }}
                    tabIndex={0}
                    role="note"
                    title="Coverage = the % of common UI surface (tokens, components, motion, content) this spec actually defines. Higher = your AI has fewer gaps to guess."
                    aria-label="Overall coverage — the percent of common UI surface (tokens, components, motion, content) this spec actually defines. Higher means your AI has fewer gaps to guess."
                  >
                    overall coverage
                  </div>
                  <div className="text-[32px] leading-none font-medium" style={{ color: INK }}>
                    {bundle.coverage}
                    <span className="text-[18px]" style={{ color: SUB }}>%</span>
                  </div>
                </div>
                <span
                  className="text-[11px] inline-flex items-center gap-1.5"
                  style={{ fontFamily: MONO, color: MUTED }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: LIME }} />
                  verified {item.updatedAgo}
                </span>
              </div>
              {bundle.sectionCoverage ? (
                <SectionCoverage coverage={bundle.sectionCoverage} />
              ) : null}
              <div className="h-1.5 my-5 flex">
                {bundle.palette.map((c, i) => (
                  <span
                    key={i}
                    className="flex-1 first:rounded-l-sm last:rounded-r-sm"
                    style={{ background: c }}
                  />
                ))}
              </div>
              <div
                className="flex items-center justify-between pt-4 border-t text-[11.5px]"
                style={{ borderColor: BORDER, fontFamily: MONO, color: MUTED }}
              >
                <span
                  className="cursor-help"
                  tabIndex={0}
                  title="Tokens = named design values (colors, sizes, spacing) declared in the spec. Components = named UI patterns with full anatomy."
                  aria-label={`${bundle.tokens.toLocaleString()} tokens (named design values like colors, sizes, spacing) and ${bundle.components} components (named UI patterns with full anatomy)`}
                >
                  {bundle.tokens.toLocaleString()} tokens · {bundle.components} components
                </span>
                <span
                  className="inline-flex items-center gap-1.5 cursor-help"
                  tabIndex={0}
                  title="How many people have copied this spec into their tool"
                  aria-label={`${bundle.forks} forks — how many people have copied this spec into their tool`}
                >
                  <GitFork className="h-3 w-3" />
                  {bundle.forks} forks
                </span>
              </div>
            </div>
            <div
              className="mt-4 rounded-xl border p-5"
              style={{ borderColor: BORDER, background: SURFACE }}
            >
              <div
                className="text-[10.5px] uppercase tracking-[0.22em] mb-3"
                style={{ fontFamily: MONO, color: MUTED }}
              >
                What you'll get
              </div>
              <div className="grid grid-cols-1 gap-3">
                <ArtifactChip
                  filename="design.md"
                  hint="the brand spec — tokens, component anatomy, forbidden rules"
                  meta={`${bundle.tokens.toLocaleString()} tokens · ${designLines} lines`}
                  accent={LIME}
                />
                <ArtifactChip
                  filename="companion.md"
                  hint="system instructions that teach your AI how to use the spec"
                  meta={`~${promptTokensApprox.toLocaleString()} tokens · ${promptLines} lines`}
                  accent={VIOLET}
                />
              </div>
            </div>
            <div className="mt-3 text-[11.5px]" style={{ fontFamily: MONO, color: MUTED }}>
              free forever · no install · paste into any AI tool
            </div>
          </aside>
        </div>
      </section>

      {showInstall ? (
        <section id="install-steps" className="border-b" style={{ borderColor: BORDER_SOFT }}>
          <div className="mx-auto max-w-6xl px-6 lg:px-8 py-14">
            <div className="grid grid-cols-12 gap-8">
              <div className="col-span-12 lg:col-span-3">
                <SectionLabel n="02" t={`Install in ${toolLabel(tool)}`} />
                <h2 className="mt-3 text-[28px] leading-[1.08] font-medium tracking-[-0.018em]">
                  Four steps,{" "}
                  <span style={{ color: SUB }}>then you're shipping.</span>
                </h2>
                <p className="mt-5 text-[13.5px] leading-[1.6]" style={{ color: SUB }}>
                  Copy each file as you go. Switch tools above to see the steps for a different surface.
                </p>
                <button
                  onClick={() => setShowInstall(false)}
                  className="mt-6 text-[12.5px] inline-flex items-center gap-1"
                  style={{ color: MUTED }}
                >
                  ← hide install steps
                </button>
              </div>
              <div className="col-span-12 lg:col-span-9">
                <div className="space-y-5">
                  {INSTALL_STEPS[tool].map((s) => (
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

                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      {copiedSpec ? "Copied ✓" : "Copy design.md"}
                    </div>
                    <div className="text-[11.5px] mt-1" style={{ color: SUB }}>
                      {designLines} lines · {bundle.tokens.toLocaleString()} tokens
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
                      {copiedPrompt ? "Copied ✓" : "Copy companion prompt"}
                    </div>
                    <div className="text-[11.5px] mt-1" style={{ color: SUB }}>
                      calibrated for {bundle.worksWith.join(" · ")}
                    </div>
                  </button>
                  {/* TODO: wire to real CLI */}
                  <button
                    onClick={() => copyText(`npx uiuxofai add ${bundle.id}`, "cli")}
                    className="rounded-xl border p-5 text-left transition-colors"
                    style={{ borderColor: copiedCli ? `${LIME}88` : BORDER, background: SURFACE }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="text-[10.5px] uppercase tracking-[0.22em]"
                        style={{ fontFamily: MONO, color: MUTED }}
                      >
                        cli
                      </span>
                      {copiedCli ? (
                        <Check className="h-4 w-4" style={{ color: LIME }} />
                      ) : (
                        <Copy className="h-4 w-4" style={{ color: SUB }} />
                      )}
                    </div>
                    <div
                      className="text-[13px] font-medium truncate"
                      style={{ color: INK, fontFamily: MONO }}
                    >
                      {copiedCli ? "Copied ✓" : `npx uiuxofai add ${bundle.id}`}
                    </div>
                    <div className="text-[11.5px] mt-1" style={{ color: SUB }}>
                      writes the same files to your {toolLabel(tool)} project, one command
                    </div>
                  </button>
                </div>
                <PulseRow bundleId={bundle.id} />
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* The design system */}
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-6xl px-6 lg:px-8 py-16">
          <div className="grid grid-cols-12 gap-8">
            <div className="col-span-12 lg:col-span-3">
              <SectionLabel n={showInstall ? "03" : "02"} t="The design system" />
              <h2 className="mt-3 text-[28px] leading-[1.08] font-medium tracking-[-0.018em]">
                Two files,{" "}
                <span style={{ color: SUB }}>versioned together.</span>
              </h2>
              <p className="mt-5 text-[13.5px] leading-[1.6]" style={{ color: SUB }}>
                Read the spec, then read the prompt that teaches the model how to use it.
              </p>
            </div>
            <div className="col-span-12 lg:col-span-9">
              <div className="flex items-center gap-1 border-b mb-6" style={{ borderColor: BORDER }}>
                {(["preview", "design.md", "companion"] as Tab[]).map((t) => {
                  const isActive = tab === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className="relative px-4 py-3 text-[12.5px]"
                      style={{
                        color: isActive ? INK : SUB,
                        fontFamily: t === "design.md" ? MONO : undefined,
                      }}
                    >
                      {t === "design.md" ? "design.md" : t === "companion" ? "companion prompt" : "live preview"}
                      {isActive ? (
                        <span
                          className="absolute left-0 right-0 -bottom-px h-px"
                          style={{ background: VIOLET }}
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>

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
              ) : tab === "companion" ? (
                bundle.companionStatus === "pending" ? (
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
                )
              ) : (
                <PreviewPane bundle={bundle} />
              )}
            </div>
          </div>
        </div>
      </section>

      <WorksWellWith itemId={item.id} sectionNum={showInstall ? "04" : "03"} />
    </>
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
        Sonnet 4.6 is writing the tool-agnostic system prompt. Usually ~10 seconds — this page auto-refreshes when it's ready.
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

function ArtifactChip({
  filename,
  hint,
  meta,
  accent,
}: {
  filename: string;
  hint: string;
  meta: string;
  accent: string;
}) {
  return (
    <div
      className="rounded-lg border p-3.5"
      style={{ borderColor: BORDER, background: SURFACE_2 }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
        <span className="text-[12.5px] font-medium" style={{ color: INK, fontFamily: MONO }}>
          {filename}
        </span>
      </div>
      <div className="text-[11.5px] leading-[1.5]" style={{ color: SUB }}>
        {hint}
      </div>
      <div className="text-[10.5px] mt-2" style={{ fontFamily: MONO, color: MUTED }}>
        {meta}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// NON-BUNDLE (skill / agent / mcp)
// ─────────────────────────────────────────────────────────────

function NonBundleView({ item }: { item: SkillItem | AgentItem | McpItem }) {
  const meta = TYPE_META[item.type];
  const compatTools = compatibleTools(item.tools);
  const [tool, setTool] = useToolPref();
  const search = useSearchParams().toString();
  const [showInstall, setShowInstall] = useState<boolean>(() => {
    const params = new URLSearchParams(search);
    return params.get("install") === "1";
  });
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    if (showInstall && typeof window !== "undefined") {
      requestAnimationFrame(() => {
        document.getElementById("install-steps")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [showInstall]);

  // If saved preference isn't compatible with this item, fall back to first compatible tool
  const activeTool = compatTools.includes(tool) ? tool : compatTools[0];

  const surfaceLabel =
    item.type === "skill"
      ? item.surface
      : item.type === "agent"
      ? item.framework
      : `MCP · ${item.transport}`;

  const payload =
    item.type === "mcp" ? item.mcpJson : (item as SkillItem | AgentItem).body;
  const payloadLang: "json" | "md" | "yaml" =
    item.type === "mcp" ? "json" : item.type === "agent" ? "yaml" : "md";
  const filename =
    item.type === "mcp"
      ? "mcp.json"
      : item.type === "skill"
      ? item.installPath.split("/").pop() ?? `${item.id}.md`
      : item.installPath.split("/").pop() ?? `${item.id}.md`;

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  function onDownload() {
    const blob = new Blob([payload], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  }

  const steps = nonBundleSteps(item, activeTool);

  return (
    <>
      <Breadcrumb item={item} />

      {/* Hero */}
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-6xl px-6 lg:px-8 pt-6 pb-12 grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-7">
            <div className="mb-5">
              <AttributionRow attr={item.attribution} />
            </div>
            <div
              className="text-[10.5px] uppercase tracking-[0.22em] mb-3 inline-flex items-center gap-2"
              style={{ fontFamily: MONO, color: MUTED }}
            >
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.accent }} />
                <span style={{ color: meta.accent, fontSize: 13, lineHeight: 1 }}>{meta.icon}</span>
                {meta.label}
              </span>
              <span style={{ color: BORDER }}>·</span>
              <span>plate {item.num}</span>
              <span style={{ color: BORDER }}>·</span>
              <span>{surfaceLabel}</span>
            </div>
            <h1 className="text-[52px] sm:text-[64px] leading-[0.98] font-medium tracking-[-0.022em]">
              {item.name}
              <span style={{ color: SUB }}>.</span>
            </h1>
            <p className="mt-6 text-[15px] leading-[1.65] max-w-[36rem]" style={{ color: SUB }}>
              {item.description}
            </p>
            <div className="mt-6 flex items-center gap-2 flex-wrap">
              {item.tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full"
                  style={{
                    background: SURFACE_2,
                    border: `1px solid ${BORDER}`,
                    color: SUB,
                    fontFamily: MONO,
                  }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.accent }} />
                  {t}
                </span>
              ))}
            </div>

            {/* Tool picker */}
            <div className="mt-8">
              <div
                className="text-[10.5px] uppercase tracking-[0.22em] mb-2.5"
                style={{ fontFamily: MONO, color: MUTED }}
              >
                Pick your tool
              </div>
              <div className="inline-flex items-center rounded-full border p-1" style={{ borderColor: BORDER, background: SURFACE }}>
                {TOOLS.map((t) => {
                  const enabled = compatTools.includes(t.id);
                  const active = enabled && activeTool === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => enabled && setTool(t.id)}
                      disabled={!enabled}
                      title={enabled ? "" : `Not made for ${t.label}`}
                      className="h-7 px-3 rounded-full text-[12px] font-medium transition-colors"
                      style={{
                        background: active ? INK : "transparent",
                        color: active ? INK_ON_LIGHT : enabled ? SUB : MUTED,
                        opacity: enabled ? 1 : 0.5,
                        cursor: enabled ? "pointer" : "not-allowed",
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Single primary CTA + optional download */}
            <div className="mt-5">
              <button
                onClick={() => setShowInstall(true)}
                className="h-11 rounded-full px-6 text-[13px] font-medium inline-flex items-center gap-2"
                style={{
                  background: INK,
                  color: INK_ON_LIGHT,
                  boxShadow: `0 0 0 1px ${meta.accent}55, 0 10px 36px -10px ${meta.accent}88`,
                }}
              >
                Use in {toolLabel(activeTool)}
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <div className="mt-2.5">
                <button
                  onClick={onDownload}
                  className="inline-flex items-center gap-1 text-[12px]"
                  style={{ color: SUB }}
                >
                  <span aria-hidden>↓</span>
                  {downloaded ? "downloaded ✓" : `download ${filename}`}
                </button>
              </div>
            </div>

            {/* What you'll get */}
            <div
              className="mt-8 rounded-xl border p-5"
              style={{ borderColor: BORDER, background: SURFACE }}
            >
              <div
                className="text-[10.5px] uppercase tracking-[0.22em] mb-3"
                style={{ fontFamily: MONO, color: MUTED }}
              >
                What you'll get
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div
                  className="rounded-lg border p-3.5"
                  style={{ borderColor: BORDER, background: SURFACE_2 }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.accent }} />
                    <span className="text-[12.5px] font-medium" style={{ color: INK, fontFamily: MONO }}>
                      {filename}
                    </span>
                  </div>
                  <div className="text-[11.5px] leading-[1.5]" style={{ color: SUB }}>
                    {item.type === "mcp"
                      ? "The mcp.json block your client reads to spawn or call the server."
                      : item.type === "skill"
                      ? "The instruction file your tool reads when you call this skill."
                      : "The agent definition — charter, workflow, and constraints."}
                  </div>
                  <div className="text-[10.5px] mt-2" style={{ fontFamily: MONO, color: MUTED }}>
                    {payload.split("\n").length} lines · {surfaceLabel}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 text-[11.5px]" style={{ fontFamily: MONO, color: MUTED }}>
              free forever · no SDK · paste it into {toolLabel(activeTool)}
            </div>
          </div>

          <aside className="col-span-12 lg:col-span-5">
            <div className="rounded-xl border p-6" style={{ borderColor: BORDER, background: SURFACE }}>
              <div className="grid grid-cols-2 gap-6">
                <Stat label="surface" value={surfaceLabel} accent={meta.accent} />
                <Stat label="last verified" value={item.updatedAgo} />
                <Stat label="license" value={item.attribution.license} />
                <Stat
                  label="discovery"
                  value={
                    item.attribution.discoveryMethod === "Community"
                      ? "Community"
                      : item.attribution.discoveryMethod === "Auto-discovered"
                      ? "Auto"
                      : "Editorial"
                  }
                />
              </div>
              <div className="h-1.5 my-5 rounded-sm" style={{ background: meta.accent }} />
              <div
                className="flex items-center justify-between pt-5 border-t text-[12px]"
                style={{ borderColor: BORDER, fontFamily: MONO, color: MUTED }}
              >
                <span>made for</span>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {item.tools.map((t) => (
                    <span
                      key={t}
                      className="text-[10.5px] px-1.5 py-0.5 rounded"
                      style={{
                        background: SURFACE_2,
                        color: SUB,
                        border: `1px solid ${BORDER}`,
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {showInstall ? (
        <section id="install-steps" className="border-b" style={{ borderColor: BORDER_SOFT }}>
          <div className="mx-auto max-w-6xl px-6 lg:px-8 py-14">
            <div className="grid grid-cols-12 gap-8">
              <div className="col-span-12 lg:col-span-3">
                <SectionLabel t={`Install in ${toolLabel(activeTool)}`} />
                <h2 className="mt-3 text-[28px] leading-[1.08] font-medium tracking-[-0.018em]">
                  {steps.length} steps,{" "}
                  <span style={{ color: SUB }}>then you're using it.</span>
                </h2>
                <p className="mt-5 text-[13.5px] leading-[1.6]" style={{ color: SUB }}>
                  Switch tools above to see different steps.
                </p>
                <button
                  onClick={() => setShowInstall(false)}
                  className="mt-6 text-[12.5px] inline-flex items-center gap-1"
                  style={{ color: MUTED }}
                >
                  ← hide install steps
                </button>
              </div>
              <div className="col-span-12 lg:col-span-9">
                <div className="space-y-5">
                  {steps.map((s) => (
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

                <div className="mt-8">
                  <button
                    onClick={onCopy}
                    className="rounded-xl border p-5 text-left w-full transition-colors"
                    style={{ borderColor: copied ? `${LIME}88` : BORDER, background: SURFACE }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="text-[10.5px] uppercase tracking-[0.22em]"
                        style={{ fontFamily: MONO, color: MUTED }}
                      >
                        the file
                      </span>
                      {copied ? (
                        <Check className="h-4 w-4" style={{ color: LIME }} />
                      ) : (
                        <Copy className="h-4 w-4" style={{ color: SUB }} />
                      )}
                    </div>
                    <div className="text-[14px] font-medium" style={{ color: INK }}>
                      {copied ? "Copied ✓" : `Copy ${filename}`}
                    </div>
                    <div className="text-[11.5px] mt-1" style={{ color: SUB }}>
                      {payload.split("\n").length} lines · {surfaceLabel}
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* The file */}
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-6xl px-6 lg:px-8 py-16">
          <div className="grid grid-cols-12 gap-8">
            <div className="col-span-12 lg:col-span-3">
              <SectionLabel t="The file" />
              <h2 className="mt-3 text-[28px] leading-[1.08] font-medium tracking-[-0.018em]">
                Read it before{" "}
                <span style={{ color: SUB }}>you install it.</span>
              </h2>
              <p className="mt-5 text-[13.5px] leading-[1.6]" style={{ color: SUB }}>
                Plain text, version-controlled. Audit it, fork it, change it.
              </p>
              {item.type === "mcp" && item.notes ? (
                <div
                  className="mt-5 rounded-md border p-3 text-[12px]"
                  style={{ borderColor: BORDER, background: SURFACE, color: SUB }}
                >
                  {item.notes}
                </div>
              ) : null}
            </div>
            <div className="col-span-12 lg:col-span-9">
              <CodePanel
                title={`${item.id} · ${filename}`}
                language={payloadLang}
                source={payload}
                rightMeta={<span>{surfaceLabel}</span>}
              />
            </div>
          </div>
        </div>
      </section>

      <WorksWellWith itemId={item.id} sectionNum={showInstall ? "04" : "03"} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Shared
// ─────────────────────────────────────────────────────────────

function Breadcrumb({ item }: { item: Item }) {
  // Design systems (bundles) live on their own shelf, surfaced via ?type=design-systems.
  const shelf =
    item.type === "bundle"
      ? { href: "/library?type=design-systems", label: "design systems" }
      : item.type === "mcp"
      ? { href: "/library/mcps", label: "mcps" }
      : { href: `/library/${item.type}s`, label: TYPE_META[item.type].plural.toLowerCase() };
  return (
    <div className="mx-auto max-w-6xl px-6 lg:px-8 pt-6 pb-2">
      <div
        className="flex items-center gap-2 text-[12px]"
        style={{ fontFamily: MONO, color: MUTED }}
      >
        <Link href="/library" style={{ color: SUB }}>
          library
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link href={shelf.href} style={{ color: SUB }}>
          {shelf.label}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span style={{ color: INK }}>
          {item.name.toLowerCase()} · № {item.num}
        </span>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div
        className="text-[10.5px] uppercase tracking-[0.22em] mb-2"
        style={{ fontFamily: MONO, color: MUTED }}
      >
        {label}
      </div>
      <div className="text-[22px] font-medium tracking-[-0.018em] flex items-baseline gap-2">
        <span style={{ color: INK }}>{value}</span>
        {accent ? (
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
        ) : null}
      </div>
    </div>
  );
}

function PreviewPane({ bundle }: { bundle: BundleItem["bundle"] }) {
  return (
    <div
      className="rounded-xl border p-8"
      style={{ borderColor: BORDER, background: SURFACE }}
    >
      <div className="text-[10.5px] uppercase tracking-[0.22em] mb-4" style={{ fontFamily: MONO, color: MUTED }}>
        rendered with {bundle.name.toLowerCase()} tokens
      </div>
      <div
        className="rounded-lg p-8 grid grid-cols-1 md:grid-cols-2 gap-6"
        style={{ background: bundle.palette[1] ?? "#101012" }}
      >
        <div>
          <div
            className="text-[10px] uppercase tracking-[0.2em] mb-3"
            style={{ fontFamily: MONO, color: bundle.palette[2] ?? "#888" }}
          >
            sample · button + card
          </div>
          <button
            className="h-9 rounded-md px-4 text-[12.5px] font-medium"
            style={{ background: bundle.palette[0], color: bundle.palette[3] ?? "#fff" }}
          >
            Primary action
          </button>
          <div
            className="mt-6 rounded-lg p-5 border"
            style={{
              borderColor: `${bundle.palette[2] ?? "#444"}33`,
              background: `${bundle.palette[3] ?? "#fff"}06`,
            }}
          >
            <div
              className="text-[14px] font-medium mb-1"
              style={{ color: bundle.palette[3] ?? "#fff" }}
            >
              {bundle.name} sample card
            </div>
            <div
              className="text-[12px]"
              style={{ color: bundle.palette[2] ?? "#888" }}
            >
              Rendered live from {bundle.tokens.toLocaleString()} tokens declared in design.md.
            </div>
          </div>
        </div>
        <div className="space-y-3">
          {bundle.palette.map((c) => (
            <div
              key={c}
              className="flex items-center gap-3 text-[11.5px]"
              style={{ fontFamily: MONO, color: bundle.palette[2] ?? "#888" }}
            >
              <span className="h-6 w-12 rounded" style={{ background: c }} />
              <span style={{ color: bundle.palette[3] ?? "#fff" }}>{c.toUpperCase()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function BundleDetailPage() {
  return (
    <Suspense fallback={null}>
      <BundleDetail />
    </Suspense>
  );
}
