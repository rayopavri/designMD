"use client";

import Link from "next/link";
import { useSearchParams, useParams } from "next/navigation";

import { Suspense, useEffect, useState } from "react";
import { ArrowUpRight, Check, ChevronRight, Copy, Download, GitFork, Heart } from "lucide-react";
import { SectionLabel } from "@/components/ui/Shell";
import { CodePanel } from "@/components/ui/CodePanel";
import { AttributionRow } from "@/components/ui/AttributionRow";
import { LegalDisclaimer } from "@/components/ui/LegalDisclaimer";
import { SectionCoverage } from "@/components/ui/SectionCoverage";
import { PulseRow } from "@/components/ui/PulseRow";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { VoteWidget } from "@/components/ui/VoteWidget";

function hostnameSafe(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
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
import { type BundleItem } from "@/lib/ui-data/items";
import { TOOLS, toolLabel } from "@/lib/ui-data/toolPref";
import { parseDesignMd, isLuminanceDark, parsePx, type ParsedTokens } from "@/lib/ui-data/parse-design-md";
import { useToolPref } from "@/lib/ui-data/useToolPref";
import { INSTALL_STEPS } from "@/lib/ui-data/installSteps";
import { downloadBundleZip } from "@/lib/ui-data/bundleZip";
import { useBundleDetail } from "@/hooks/useBundleDetail";
import { openAuthModal, useAuth } from "@/lib/ui-data/mockAuth";

type Tab = "design.md" | "companion" | "preview";

function BundleDetail() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const { item: dbBundle, loading, notFound, error } = useBundleDetail(slug);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-6 lg:px-8 py-32 text-center">
        <SectionLabel n="·" t="Loading" />
        <h1 className="mt-4 text-[28px] font-medium" style={{ color: SUB }}>
          Fetching design skill…
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
          Back to design skills
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
          Back to design skills
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
  const routeParams = useParams<{ slug: string }>();
  const slug = routeParams?.slug ?? "";
  const [tab, setTab] = useState<Tab>("preview");
  const [tool, setTool] = useToolPref();
  const search = useSearchParams().toString();
  const [showInstall, setShowInstall] = useState<boolean>(() => {
    const params = new URLSearchParams(search);
    return params.get("install") === "1";
  });
  const [copiedSpec, setCopiedSpec] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [zipping, setZipping] = useState(false);
  const { user } = useAuth();
  const [isSaved, setIsSaved] = useState(false);
  const [savePending, setSavePending] = useState(false);

  useEffect(() => {
    if (showInstall && typeof window !== "undefined") {
      requestAnimationFrame(() => {
        document.getElementById("install-steps")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [showInstall]);

  // Hydrate saved state when the user is signed in
  useEffect(() => {
    if (!user || !slug) return;
    let cancelled = false;
    fetch(`/api/bundles/${slug}/favorite/check`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: { saved: boolean } | null) => {
        if (!cancelled && data) setIsSaved(data.saved);
      })
      .catch(() => {/* best-effort */});
    return () => { cancelled = true; };
  }, [user, slug]);

  async function toggleFavorite() {
    if (!user) {
      openAuthModal(typeof window !== "undefined" ? window.location.pathname : null);
      return;
    }
    const next = !isSaved;
    setIsSaved(next);
    setSavePending(true);
    try {
      const res = await fetch(`/api/bundles/${slug}/favorite`, {
        method: next ? "POST" : "DELETE",
      });
      if (!res.ok) throw new Error("Request failed");
    } catch {
      setIsSaved(!next); // rollback
    } finally {
      setSavePending(false);
    }
  }

  const designLines = bundle.designMd.split("\n").length;
  const promptLines = bundle.companionPrompt.split("\n").length;
  const promptTokensApprox = Math.max(1, Math.round(bundle.companionPrompt.length / 4));

  async function copyText(text: string, kind: "spec" | "prompt") {
    try {
      await navigator.clipboard.writeText(text);
      if (kind === "spec") {
        setCopiedSpec(true);
        setTimeout(() => setCopiedSpec(false), 2000);
      } else if (kind === "prompt") {
        setCopiedPrompt(true);
        setTimeout(() => setCopiedPrompt(false), 2000);
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
            <div className="flex items-center justify-between gap-6">
              <h1 className="text-[52px] sm:text-[64px] leading-[0.98] font-medium tracking-[-0.022em] min-w-0">
                {bundle.name}
                <span style={{ color: SUB }}>.</span>
              </h1>
              {bundle.brandLogoUrl && (
                <BrandLogo
                  src={bundle.brandLogoUrl}
                  fallbackDomain={hostnameSafe(bundle.brandLogoUrl)}
                  size={72}
                />
              )}
            </div>
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
              <div className="mt-2.5 flex items-center gap-5">
                <button
                  onClick={onZip}
                  disabled={zipping}
                  className="h-9 rounded-full border inline-flex items-center gap-1.5 px-4 text-[12px] transition-opacity hover:opacity-80"
                  style={{
                    borderColor: BORDER,
                    color: SUB,
                    opacity: zipping ? 0.5 : 1,
                    cursor: zipping ? "not-allowed" : "pointer",
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                  {zipping ? "preparing…" : "Download .zip"}
                </button>
                <button
                  onClick={toggleFavorite}
                  disabled={savePending}
                  title={user ? (isSaved ? "Remove from favorites" : "Save to favorites") : "Sign in to save"}
                  className="inline-flex items-center gap-1.5 text-[12px] transition-colors"
                  style={{ color: isSaved ? LIME : SUB, opacity: savePending ? 0.6 : 1 }}
                >
                  <Heart
                    className="h-3.5 w-3.5"
                    style={{ fill: isSaved ? LIME : "none", stroke: isSaved ? LIME : "currentColor" }}
                  />
                  {isSaved ? "Saved" : "Save"}
                </button>
                <VoteWidget
                  bundleSlug={slug}
                  initialVoteCount={bundle.voteCount}
                  initialPositiveVoteRate={bundle.voteRate}
                />
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
                What you&apos;ll get
              </div>
              <div className="grid grid-cols-1 gap-3">
                <ArtifactChip
                  filename="design.md"
                  hint="the brand spec — tokens, component anatomy, forbidden rules"
                  meta={`${bundle.tokens.toLocaleString()} tokens · ${designLines} lines`}
                  accent={LIME}
                  onCopy={() => copyText(bundle.designMd, "spec")}
                  copied={copiedSpec}
                />
                <ArtifactChip
                  filename="companion.md"
                  hint="system instructions that teach your AI how to use the spec"
                  meta={`~${promptTokensApprox.toLocaleString()} tokens · ${promptLines} lines`}
                  accent={VIOLET}
                  onCopy={() => copyText(bundle.companionPrompt, "prompt")}
                  copied={copiedPrompt}
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
                  <span style={{ color: SUB }}>then you&apos;re shipping.</span>
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

                <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
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
                {(["preview", "design.md", "companion"] as Tab[]).map((t) => {
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
                      {t === "design.md" ? "design.md" : t === "companion" ? "companion prompt" : "live preview"}
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

      <LegalDisclaimer name={bundle.name} />
    </>
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

function ArtifactChip({
  filename,
  hint,
  meta,
  accent,
  onCopy,
  copied,
}: {
  filename: string;
  hint: string;
  meta: string;
  accent: string;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <div
      className="rounded-lg border p-3.5"
      style={{ borderColor: BORDER, background: SURFACE_2 }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
          <span className="text-[12.5px] font-medium" style={{ color: INK, fontFamily: MONO }}>
            {filename}
          </span>
        </div>
        {onCopy && (
          <button
            type="button"
            onClick={onCopy}
            title={copied ? "Copied!" : `Copy ${filename}`}
            className="h-6 w-6 rounded flex items-center justify-center transition-colors hover:opacity-80"
            style={{ color: copied ? LIME : MUTED }}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        )}
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
// Shared
// ─────────────────────────────────────────────────────────────

function Breadcrumb({ item }: { item: BundleItem }) {
  return (
    <div className="mx-auto max-w-6xl px-6 lg:px-8 pt-6 pb-2">
      <div
        className="flex items-center gap-2 text-[12px]"
        style={{ fontFamily: MONO, color: MUTED }}
      >
        <Link href="/library" style={{ color: SUB }}>
          design skills
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span style={{ color: INK }}>
          {item.name.toLowerCase()} · № {item.num}
        </span>
      </div>
    </div>
  );
}

// ─── Preview section label ────────────────────────────────────────────────────
function PreviewSectionLabel({ label, muted, isDark }: { label: string; muted: string; isDark: boolean }) {
  return (
    <div
      className="text-[9px] uppercase tracking-[0.22em] mb-3 pb-2 border-b"
      style={{
        fontFamily: MONO,
        color: muted,
        borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
      }}
    >
      {label}
    </div>
  );
}

function PreviewPane({ bundle }: { bundle: BundleItem["bundle"] }) {
  const parsed: ParsedTokens = parseDesignMd(bundle.designMd ?? "");

  // Default to the brand's native color scheme
  const [mode, setMode] = useState<"dark" | "light">(
    parsed.colorScheme === "light" ? "light" : "dark"
  );

  // ── Surface backgrounds ────────────────────────────────────────────────────
  const lightSurface =
    parsed.colors.find(c => !isLuminanceDark(c.hex) && /^(canvas|background|surface)$/.test(c.name))?.hex ??
    parsed.colors.find(c => !isLuminanceDark(c.hex) && /canvas|background|surface/.test(c.name))?.hex ??
    "#FAFAFA";

  // For light brands: their ink/foreground token makes a great dark background
  const darkSurface =
    parsed.colors.find(c => isLuminanceDark(c.hex) && /^(surface|bg|background|canvas)$/.test(c.name))?.hex ??
    parsed.colors.find(c => isLuminanceDark(c.hex) && /surface|bg|canvas/.test(c.name))?.hex ??
    parsed.colors.find(c => isLuminanceDark(c.hex) && /^(ink|foreground|text[-_]primary|text[-_]main)$/.test(c.name))?.hex ??
    (bundle.palette[1] && isLuminanceDark(bundle.palette[1]) ? bundle.palette[1] : undefined) ??
    "#101012";

  const bgColor  = mode === "dark" ? darkSurface : lightSurface;
  const bgIsDark = isLuminanceDark(bgColor);

  // ── Text — validated against the actual bgColor luminance ─────────────────
  const textColor = bgIsDark
    ? (parsed.colors.find(c => !isLuminanceDark(c.hex) && /^(on-surface|on-canvas|on-bg|on-primary-container)$/.test(c.name))?.hex
    ?? parsed.colors.find(c => !isLuminanceDark(c.hex) && /^(foreground|on-primary|canvas)$/.test(c.name))?.hex
    ?? "#F0EFEC")
    : (parsed.colors.find(c => isLuminanceDark(c.hex) && /^(ink|text[-_]main|text[-_]primary|foreground)$/.test(c.name))?.hex
    ?? parsed.colors.find(c => isLuminanceDark(c.hex) && /^(text|ink)/.test(c.name))?.hex
    ?? "#1A1A1A");

  // Muted: only use brand token if it actually contrasts with current bg
  const mutedText = (() => {
    const brand = parsed.colors.find(c =>
      /^(ink-mute|ink-mute-2|text[-_]muted|text[-_]secondary|on-surface-variant|muted|sub)$/.test(c.name)
    );
    if (brand && bgIsDark !== isLuminanceDark(brand.hex)) return brand.hex;
    return bgIsDark ? "#9090A0" : "#6B7280";
  })();

  // ── Card + border ──────────────────────────────────────────────────────────
  const darkCard =
    parsed.colors.find(c => isLuminanceDark(c.hex) && /^(surface-container|surface-container-low|card)$/.test(c.name))?.hex ??
    parsed.colors.find(c => isLuminanceDark(c.hex) && /^(ink-secondary|text[-_]secondary)$/.test(c.name))?.hex ??
    darkSurface;
  const lightCard =
    parsed.colors.find(c => !isLuminanceDark(c.hex) && /^(canvas-soft|surface-container-low|surface-variant|card)$/.test(c.name))?.hex ??
    lightSurface;

  const borderCol =
    parsed.colors.find(c => /^(hairline|outline|border|divider|surface-container-high)$/.test(c.name))?.hex ??
    (bgIsDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)");

  // Accent — never changes by mode
  const findColor = (test: RegExp) => parsed.colors.find(c => test.test(c.name))?.hex;
  const accent = findColor(/^(primary|accent[-_]brand|accent|brand)$/) ?? bundle.palette[0] ?? VIOLET;
  const accentText = findColor(/^(on-primary)$/) ??
    (isLuminanceDark(accent) ? "#FFFFFF" : "#000000");

  const cardBg = mode === "dark" ? darkCard : lightCard;

  // ── Typography selection (up to 5 key levels) ─────────────────────────────
  const typoLevels = (() => {
    if (!parsed.typography.length) return [];
    const pick = (patterns: RegExp[]) =>
      patterns.map(p => parsed.typography.find(t => p.test(t.name))).find(Boolean);
    const display  = pick([/display-xxl/i, /display-xl/i, /display-lg/i, /display/i]);
    const heading  = pick([/heading-md/i, /heading-lg/i, /headline-md/i, /heading/i, /headline/i]);
    const body     = pick([/body-lg/i, /body-md/i, /body/i]);
    const label    = pick([/button-md/i, /label-md/i, /label/i, /button/i]);
    const caption  = pick([/caption/i, /micro/i, /small/i, /label-sm/i]);
    return [display, heading, body, label, caption].filter(Boolean).slice(0, 5);
  })();

  // ── Component selection ───────────────────────────────────────────────────
  const btnPrimary  = parsed.components.find(c => /button-primary-pill$|^button-primary$/.test(c.name))
                    ?? parsed.components.find(c => /button-primary/.test(c.name));
  const btnSecondary = parsed.components.find(c => /button-secondary/.test(c.name));
  const cardComp    = parsed.components.find(c => /^card(-feature)?$/.test(c.name))
                    ?? parsed.components.find(c => /^card/.test(c.name));
  const inputComp   = parsed.components.find(c => /^text-input$|^input-field$/.test(c.name))
                    ?? parsed.components.find(c => /input/.test(c.name));

  const btnBg       = btnPrimary?.backgroundColor ?? accent;
  const btnFg       = btnPrimary?.textColor       ?? accentText;
  const btnRadius   = btnPrimary?.rounded         ?? "6px";
  const btnPadding  = btnPrimary?.padding         ?? "0 16px";

  const cardBgResolved = cardComp?.backgroundColor ?? cardBg;
  const cardBorder     = cardComp?.borderColor     ?? borderCol;
  const cardRadius     = cardComp?.rounded         ?? "8px";
  // Card may have different luminance than canvas (e.g. white card on dark bg) — pick text that contrasts with it
  const cardIsDark     = isLuminanceDark(cardBgResolved);
  const cardText       = cardIsDark !== bgIsDark
    ? (cardIsDark
        ? (parsed.colors.find(c => !isLuminanceDark(c.hex) && /^(on-surface|canvas|foreground|on-primary)$/.test(c.name))?.hex ?? "#F0EFEC")
        : (parsed.colors.find(c => isLuminanceDark(c.hex) && /^(ink|text[-_]main|foreground)$/.test(c.name))?.hex ?? "#1A1A1A"))
    : textColor;
  const cardMuted      = cardIsDark !== bgIsDark
    ? (cardIsDark ? "#9090A0" : "#6B7280")
    : mutedText;

  const inputBg       = inputComp?.backgroundColor ?? cardBg;
  const inputBorder   = inputComp?.borderColor     ?? borderCol;
  const inputRadius   = inputComp?.rounded         ?? "6px";
  const inputIsDark   = isLuminanceDark(inputBg);
  const inputText     = inputIsDark !== bgIsDark ? (inputIsDark ? "#9090A0" : "#6B7280") : mutedText;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const sectionDivider: import("react").CSSProperties = {
    borderTop: `1px solid ${bgIsDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}`,
    marginTop: "20px",
    paddingTop: "20px",
  };

  const hasParsedColors = parsed.colors.length > 0;
  const hasTypo         = typoLevels.length > 0;
  const hasSpacing      = parsed.spacing.length >= 2;
  const hasRounded      = parsed.rounded.length >= 2;

  return (
    <div
      className="rounded-xl border p-6"
      style={{ borderColor: BORDER, background: SURFACE }}
    >
      {/* ── Header: label + toggle ── */}
      <div className="flex items-center justify-between mb-5">
        <div className="text-[10.5px] uppercase tracking-[0.22em]" style={{ fontFamily: MONO, color: MUTED }}>
          rendered with {bundle.name.toLowerCase()} tokens
        </div>
        <div className="flex gap-1">
          {(["dark", "light"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="px-2 py-0.5 rounded text-[10px] uppercase tracking-[0.15em]"
              style={{
                fontFamily: MONO,
                background: mode === m ? VIOLET : "transparent",
                color: mode === m ? "#fff" : MUTED,
                border: `1px solid ${mode === m ? VIOLET : BORDER}`,
                cursor: "pointer",
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* ── Canvas ── */}
      <div
        className="rounded-lg p-6 transition-colors duration-200"
        style={{ background: bgColor }}
      >

        {/* ─── Section 1: Color Palette ─── */}
        <PreviewSectionLabel label={`Color Palette · ${hasParsedColors ? parsed.colors.length : bundle.palette.length} tokens`} muted={mutedText} isDark={bgIsDark} />
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mb-1">
          {(hasParsedColors ? parsed.colors.slice(0, 18) : bundle.palette.map((h, i) => ({ name: `color-${i}`, hex: h }))).map(c => (
            <div key={c.name} className="flex items-center gap-2 min-w-0">
              <span
                className="shrink-0 h-4 w-7 rounded-sm border"
                style={{ background: c.hex, borderColor: mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }}
              />
              <span
                className="text-[10px] truncate"
                style={{ fontFamily: MONO, color: mutedText }}
                title={c.name}
              >
                {c.name}
              </span>
              <span
                className="text-[10px] shrink-0 ml-auto"
                style={{ fontFamily: MONO, color: textColor, opacity: 0.7 }}
              >
                {c.hex.toUpperCase()}
              </span>
            </div>
          ))}
        </div>

        {/* ─── Section 2: Typography Scale ─── */}
        {hasTypo && (
          <div style={sectionDivider}>
            <PreviewSectionLabel label={`Typography Scale · ${parsed.typography.length} levels`} muted={mutedText} isDark={bgIsDark} />
            <div className="space-y-2">
              {typoLevels.map(t => {
                const rawPx = parsePx(t!.fontSize);
                const displayPx = Math.min(rawPx, 44);
                const sampleText = t!.name.replace(/-/g, ' ');
                return (
                  <div key={t!.name} className="flex items-baseline gap-3 overflow-hidden">
                    <span
                      className="shrink-0 text-[9px] uppercase tracking-[0.15em] w-20"
                      style={{ fontFamily: MONO, color: mutedText }}
                    >
                      {t!.name}
                    </span>
                    <span
                      className="truncate leading-tight"
                      style={{
                        fontFamily: t!.fontFamily,
                        fontSize: `${displayPx}px`,
                        fontWeight: t!.fontWeight ?? 400,
                        letterSpacing: t!.letterSpacing ?? undefined,
                        color: textColor,
                      }}
                    >
                      {sampleText.charAt(0).toUpperCase() + sampleText.slice(1)}
                    </span>
                    <span
                      className="shrink-0 text-[9px] ml-auto"
                      style={{ fontFamily: MONO, color: mutedText }}
                    >
                      {rawPx}px{t!.fontWeight ? ` / ${t!.fontWeight}` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Section 3: Components ─── */}
        <div style={sectionDivider}>
          <PreviewSectionLabel label="Components" muted={mutedText} isDark={bgIsDark} />
          <div className="flex flex-wrap gap-3 mb-4">
            {/* Primary button */}
            <button
              className="text-[13px] font-medium"
              style={{
                background: btnBg,
                color: btnFg,
                borderRadius: btnRadius,
                padding: btnPadding,
                height: "36px",
                border: "none",
                cursor: "default",
              }}
            >
              Primary action
            </button>
            {/* Secondary button */}
            {btnSecondary ? (
              <button
                className="text-[13px]"
                style={{
                  background: btnSecondary.backgroundColor ?? "transparent",
                  color: btnSecondary.textColor ?? accent,
                  borderRadius: btnPrimary?.rounded ?? "6px",
                  padding: btnSecondary.padding ?? "0 16px",
                  height: "36px",
                  border: `1px solid ${btnSecondary.textColor ?? accent}`,
                  cursor: "default",
                }}
              >
                Secondary
              </button>
            ) : (
              <button
                className="text-[13px]"
                style={{
                  background: "transparent",
                  color: accent,
                  borderRadius: btnRadius,
                  padding: btnPadding,
                  height: "36px",
                  border: `1px solid ${accent}`,
                  cursor: "default",
                }}
              >
                Secondary
              </button>
            )}
          </div>
          {/* Card + Input row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div
              className="rounded p-4"
              style={{
                background: cardBgResolved,
                border: `1px solid ${cardBorder}`,
                borderRadius: cardRadius,
              }}
            >
              <div className="text-[13px] font-medium mb-1" style={{ color: cardText }}>
                {bundle.name} card
              </div>
              <div className="text-[11.5px]" style={{ color: cardMuted }}>
                {bundle.tokens > 0 ? `${bundle.tokens.toLocaleString()} tokens` : "design.md"} · {bundle.components > 0 ? `${bundle.components} components` : parsed.components.length > 0 ? `${parsed.components.length} components` : "live preview"}
              </div>
            </div>
            <div>
              <div
                className="w-full text-[12.5px] px-3"
                style={{
                  background: inputBg,
                  border: `1px solid ${inputBorder}`,
                  borderRadius: inputRadius,
                  height: "36px",
                  display: "flex",
                  alignItems: "center",
                  color: inputText,
                }}
              >
                Input field
              </div>
            </div>
          </div>
        </div>

        {/* ─── Section 4: Scales ─── */}
        {(hasSpacing || hasRounded) && (
          <div style={sectionDivider}>
            {hasSpacing && (
              <>
                <PreviewSectionLabel label="Spacing Scale" muted={mutedText} isDark={bgIsDark} />
                <div className="flex flex-wrap items-end gap-2 mb-4">
                  {parsed.spacing.map(s => {
                    const px = parsePx(s.value);
                    const w = Math.max(8, Math.min(px, 64));
                    return (
                      <div key={s.name} className="flex flex-col items-center gap-1">
                        <div
                          className="rounded-sm"
                          style={{
                            width: `${w}px`,
                            height: "12px",
                            background: accent,
                            opacity: 0.7,
                          }}
                        />
                        <span className="text-[8.5px]" style={{ fontFamily: MONO, color: mutedText }}>
                          {s.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            {hasRounded && (
              <>
                <PreviewSectionLabel label="Border Radius Scale" muted={mutedText} isDark={bgIsDark} />
                <div className="flex flex-wrap items-center gap-3">
                  {parsed.rounded.map(r => (
                    <div key={r.name} className="flex flex-col items-center gap-1">
                      <div
                        style={{
                          width: "28px",
                          height: "28px",
                          background: accent,
                          opacity: 0.75,
                          borderRadius: r.value === "9999px" ? "9999px" : r.value,
                        }}
                      />
                      <span className="text-[8.5px]" style={{ fontFamily: MONO, color: mutedText }}>
                        {r.name}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

export default function BundleDetailClient() {
  return (
    <Suspense fallback={null}>
      <BundleDetail />
    </Suspense>
  );
}
