import { useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowUpRight, Check, ChevronRight, Copy, Download, GitFork, Star } from "lucide-react";
import { SectionLabel } from "../components/Shell";
import { CodePanel } from "../components/CodePanel";
import { AttributionRow } from "../components/AttributionRow";
import { WorksWellWith } from "../components/WorksWellWith";
import { AgentInstall, McpInstall, SkillInstall } from "../components/InstallSteps";
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
import {
  getItem,
  TYPE_META,
  type BundleItem,
  type Item,
  type AgentItem,
  type McpItem,
  type SkillItem,
} from "../lib/items";

type Tab = "design.md" | "companion" | "preview";

export function BundleDetail() {
  const [, params] = useRoute<{ id: string }>("/library/:id");
  const item = params ? getItem(params.id) : undefined;

  if (!item) {
    return (
      <div className="mx-auto max-w-3xl px-6 lg:px-8 py-32 text-center">
        <SectionLabel n="404" t="Not found" />
        <h1 className="mt-4 text-[28px] font-medium">No item with that id.</h1>
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

  return item.type === "bundle" ? (
    <BundleView item={item} />
  ) : (
    <NonBundleView item={item} />
  );
}

// ─────────────────────────────────────────────────────────────
// BUNDLE
// ─────────────────────────────────────────────────────────────

function BundleView({ item }: { item: BundleItem }) {
  const bundle = item.bundle;
  const [tab, setTab] = useState<Tab>("design.md");
  const [copied, setCopied] = useState(false);

  const onCopyBundle = async () => {
    const payload = `${bundle.designMd}\n\n---\n\n# Companion prompt\n\n${bundle.companionPrompt}`;
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

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
            <div className="mt-8 flex items-center gap-3 flex-wrap">
              <button
                onClick={onCopyBundle}
                className="h-10 rounded-full px-5 text-[12.5px] font-medium inline-flex items-center gap-2"
                style={{
                  background: INK,
                  color: INK_ON_LIGHT,
                  boxShadow: `0 0 0 1px ${VIOLET}55, 0 10px 36px -10px ${VIOLET}88`,
                }}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Copied bundle
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copy bundle
                  </>
                )}
              </button>
              <Link
                href={`/copy/${bundle.id}`}
                className="h-10 rounded-full border px-5 text-[12.5px] font-medium inline-flex items-center gap-2"
                style={{ borderColor: BORDER, color: INK, background: SURFACE }}
              >
                <Download className="h-3.5 w-3.5" />
                Apply to project
              </Link>
            </div>
          </div>

          <aside className="col-span-12 lg:col-span-5">
            <div className="rounded-xl border p-6" style={{ borderColor: BORDER, background: SURFACE }}>
              <div className="grid grid-cols-2 gap-6">
                <Stat label="coverage" value={`${bundle.coverage}%`} accent={LIME} />
                <Stat label="tokens" value={bundle.tokens.toLocaleString()} />
                <Stat label="components" value={String(bundle.components)} />
                <Stat label="last verified" value={item.updatedAgo} />
              </div>
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
                className="flex items-center justify-between pt-5 border-t text-[12px]"
                style={{ borderColor: BORDER, fontFamily: MONO, color: MUTED }}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Star className="h-3 w-3" style={{ color: VIOLET }} />
                  <span style={{ color: INK }}>{bundle.voteRate}%</span>
                  <span>community vote</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <GitFork className="h-3 w-3" />
                  {bundle.forks} forks
                </span>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* The bundle */}
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-6xl px-6 lg:px-8 py-16">
          <div className="grid grid-cols-12 gap-8">
            <div className="col-span-12 lg:col-span-3">
              <SectionLabel n="02" t="The bundle" />
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
                {(["design.md", "companion", "preview"] as Tab[]).map((t) => {
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
              ) : (
                <PreviewPane bundle={bundle} />
              )}
            </div>
          </div>
        </div>
      </section>

      <WorksWellWith itemId={item.id} sectionNum="03" />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// NON-BUNDLE (skill / agent / mcp)
// ─────────────────────────────────────────────────────────────

function NonBundleView({ item }: { item: SkillItem | AgentItem | McpItem }) {
  const meta = TYPE_META[item.type];

  const surfaceLabel =
    item.type === "skill"
      ? item.surface
      : item.type === "agent"
      ? item.framework
      : `MCP · ${item.transport}`;

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
            <div className="mt-8 flex items-center gap-3 flex-wrap">
              <a
                href={item.attribution.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="h-10 rounded-full px-5 text-[12.5px] font-medium inline-flex items-center gap-2"
                style={{
                  background: INK,
                  color: INK_ON_LIGHT,
                  boxShadow: `0 0 0 1px ${meta.accent}55, 0 10px 36px -10px ${meta.accent}88`,
                }}
              >
                View source
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
              <Link
                href="/library"
                className="h-10 rounded-full border px-5 text-[12.5px] font-medium inline-flex items-center gap-2"
                style={{ borderColor: BORDER, color: INK, background: SURFACE }}
              >
                Back to library
              </Link>
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
                <span>tools</span>
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

      {/* Install */}
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-6xl px-6 lg:px-8 py-16">
          <div className="grid grid-cols-12 gap-8">
            <div className="col-span-12 lg:col-span-3">
              <SectionLabel n="02" t="Install" />
              <h2 className="mt-3 text-[28px] leading-[1.08] font-medium tracking-[-0.018em]">
                Drop it in,{" "}
                <span style={{ color: SUB }}>reload, invoke.</span>
              </h2>
              <p className="mt-5 text-[13.5px] leading-[1.6]" style={{ color: SUB }}>
                Per-tool install steps and the file you'll paste. No SDK, no runtime.
              </p>
            </div>
            <div className="col-span-12 lg:col-span-9">
              {item.type === "skill" ? (
                <SkillInstall skill={item} />
              ) : item.type === "agent" ? (
                <AgentInstall agent={item} />
              ) : (
                <McpInstall mcp={item} />
              )}
            </div>
          </div>
        </div>
      </section>

      <WorksWellWith itemId={item.id} sectionNum="03" />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Shared
// ─────────────────────────────────────────────────────────────

function Breadcrumb({ item }: { item: Item }) {
  const meta = TYPE_META[item.type];
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
        <Link href={`/library?type=${item.type}`} style={{ color: SUB }}>
          {meta.plural.toLowerCase()}
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
