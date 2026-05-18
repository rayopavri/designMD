import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import { Check, ChevronDown, Copy, Globe, Loader2, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { SectionLabel } from "../components/Shell";
import { CodePanel } from "../components/CodePanel";
import {
  BG,
  BORDER,
  BORDER_SOFT,
  INK,
  INK_ON_LIGHT,
  LIME,
  MONO,
  MUTED,
  PEACH,
  SUB,
  SURFACE,
  SURFACE_2,
  VIOLET,
} from "../lib/tokens";
import { TYPE_META, type ItemType } from "../lib/items";

type Status = "idle" | "running" | "done";
type SubmitState = "idle" | "submitting" | "submitted";

type PipelineStep = {
  id: string;
  label: string;
  tool: string;
  detail: string;
  durationMs: number;
};

const COMPLIANCE_STEP: PipelineStep = {
  id: "compliance",
  label: "Compliance check",
  tool: "robots.txt + ToS",
  detail: "Verifying source allows curation · attribution preserved",
  durationMs: 900,
};

const BUNDLE_STEPS: PipelineStep[] = [
  COMPLIANCE_STEP,
  { id: "scrape", label: "Page collection", tool: "Firecrawl", detail: "14 pages · 2.4s", durationMs: 1300 },
  { id: "palette", label: "Palette extraction", tool: "Gemini Flash", detail: "OKLCH clustering · 8 colors", durationMs: 1100 },
  { id: "tokens", label: "Token & type inference", tool: "Claude Sonnet", detail: "7 sizes · 3 weights · spacing scale", durationMs: 1200 },
  { id: "companion", label: "Companion prompt", tool: "Claude Sonnet", detail: "Calibrated for Claude / Cursor / Lovable", durationMs: 1100 },
  { id: "score", label: "Coverage scoring", tool: "Google linter", detail: "94% — drafting bundle preview", durationMs: 900 },
];

const SKILL_STEPS: PipelineStep[] = [
  COMPLIANCE_STEP,
  { id: "fetch", label: "Source fetch", tool: "GitHub API", detail: "README + skill.md", durationMs: 1000 },
  { id: "parse", label: "Frontmatter parse", tool: "AST walker", detail: "Trigger, role, tools", durationMs: 800 },
  { id: "summary", label: "Editorial summary", tool: "Claude Sonnet", detail: "1-line tagline · 3-tag taxonomy", durationMs: 1100 },
  { id: "install", label: "Install path detection", tool: "Heuristic match", detail: "~/.claude/skills/* · .cursor/rules/*", durationMs: 800 },
  { id: "verify", label: "Drift check vs upstream", tool: "Gemini Flash", detail: "Cross-checked against source repo", durationMs: 900 },
];

const AGENT_STEPS: PipelineStep[] = [
  COMPLIANCE_STEP,
  { id: "fetch", label: "Source fetch", tool: "GitHub API", detail: "Agent manifest + tools", durationMs: 1000 },
  { id: "charter", label: "Charter extraction", tool: "Claude Sonnet", detail: "Role · workflow · constraints", durationMs: 1200 },
  { id: "tooling", label: "Tool surface mapping", tool: "Gemini Flash", detail: "Framework: Claude Code", durationMs: 900 },
  { id: "summary", label: "Editorial summary", tool: "Claude Sonnet", detail: "Tagline + taxonomy", durationMs: 1000 },
  { id: "verify", label: "Drift check vs upstream", tool: "Gemini Flash", detail: "Manifest matches commit hash", durationMs: 900 },
];

const MCP_STEPS: PipelineStep[] = [
  COMPLIANCE_STEP,
  { id: "fetch", label: "Registry lookup", tool: "MCP registry", detail: "Transport · package · auth model", durationMs: 1000 },
  { id: "schema", label: "Schema introspection", tool: "MCP probe", detail: "Tools · resources · prompts", durationMs: 1100 },
  { id: "config", label: "mcp.json synthesis", tool: "Claude Sonnet", detail: "Per-tool install block", durationMs: 1000 },
  { id: "summary", label: "Editorial summary", tool: "Claude Sonnet", detail: "Tagline + taxonomy + license", durationMs: 1000 },
  { id: "verify", label: "Health probe", tool: "Replit sandbox", detail: "Boot + handshake confirmed", durationMs: 900 },
];

const STEPS_FOR: Record<ItemType, PipelineStep[]> = {
  bundle: BUNDLE_STEPS,
  skill: SKILL_STEPS,
  agent: AGENT_STEPS,
  mcp: MCP_STEPS,
};

function detectType(raw: string): { type: ItemType; reason: string } | null {
  const url = raw.trim();
  if (!url) return null;
  let host = "";
  let path = "";
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    host = u.hostname.replace(/^www\./, "");
    path = u.pathname;
  } catch {
    return null;
  }
  if (!host.includes(".")) return null;

  // MCP detection
  if (host === "figma.com" && path.includes("/mcp")) return { type: "mcp", reason: "figma.com/mcp pattern" };
  if (path.endsWith("/mcp") || path.includes("/mcp/") || path.includes("mcp-catalog")) {
    return { type: "mcp", reason: "MCP registry path" };
  }
  if (host.includes("mobbin.com") && path.includes("mcp")) return { type: "mcp", reason: "Mobbin MCP" };
  if (host.includes("refero.design") && path.includes("mcp")) return { type: "mcp", reason: "Refero MCP" };

  // Skill / Agent detection (GitHub repos default to Skill; "agent" or ".claude/agents" → Agent)
  if (host === "github.com") {
    const lower = (path + " " + url).toLowerCase();
    if (lower.includes("agent") || lower.includes(".claude/agents")) {
      return { type: "agent", reason: "GitHub repo (agent)" };
    }
    return { type: "skill", reason: "GitHub repo (skill)" };
  }
  if (host.includes("skills.sh") || host.includes("aitmpl.com")) {
    return { type: "skill", reason: `${host} skill source` };
  }

  // Default: brand URL → Bundle
  return { type: "bundle", reason: "Brand site → bundle" };
}

function presetBundleSpec(host: string, palette: string[]): string {
  return `---
brand: ${host}
version: 0.1.0-draft
source: https://${host}
extracted_at: ${new Date().toISOString()}
license: review-required
---

# DETECTED PALETTE
- primary:    ${palette[0]}
- surface:    ${palette[1]}
- text_main:  ${palette[2]}
- text_muted: ${palette[3]}
- accent:     ${palette[4]}

# TYPOGRAPHY
- family: Inter
- scale:  [12, 14, 16, 18, 24, 32, 48]
- weight: { body: 400, medium: 510, bold: 600 }
- tracking: -0.012em

# SPACING
- scale: [4, 8, 12, 16, 24, 32, 48, 64]

# COMPONENT ANATOMY
## Button (primary)
- height: 36px
- padding-x: 16px
- radius: 8px
- bg: accent
- fg: surface

## Card
- bg: surface
- border: 1px solid ${palette[3]}33
- radius: 12px
- padding: 24px

# FORBIDDEN
- Pure black on surface chrome
- Decorative shadows on document blocks
`;
}

function presetSkillDraft(host: string): string {
  return `---
name: ${host.split(".")[0]}-skill
description: Draft skill extracted from ${host}.
trigger: When the user pastes a URL or asks about ${host}.
license: review-required
source: https://${host}
---

# ROLE
You are an editorial assistant operating on content from ${host}. Treat the upstream README as the source of truth.

# STEPS
1. Read the upstream README before generating any output.
2. Map the user request to a known capability in the source.
3. Return a structured response with citation links back to the source.

# FORBIDDEN
- Inventing capabilities not declared in the source.
- Rewriting upstream content as if it were yours.
`;
}

function presetAgentDraft(host: string): string {
  return `---
name: ${host.split(".")[0]}-agent
role: domain-assistant
model: claude-sonnet
tools: [read, write, bash]
source: https://${host}
license: review-required
---

# CHARTER
You are a draft agent generated from ${host}. Edit before shipping.

# WORKFLOW
1. Inspect the user request.
2. Use only the tools declared above.
3. Return a structured plan, then ask before executing.

# CONSTRAINTS
- Do not add new dependencies without asking.
- Surface attribution to ${host} on every artifact you produce.
`;
}

function presetMcpDraft(host: string): string {
  return `{
  "mcpServers": {
    "${host.split(".")[0]}": {
      "command": "npx",
      "args": ["-y", "@${host.split(".")[0]}/mcp@latest"],
      "env": {}
    }
  },
  "_source": "https://${host}",
  "_license": "review-required",
  "_status": "draft"
}`;
}

export function Generate() {
  const search = useSearch();
  const prefillType = useMemo(() => {
    const v = new URLSearchParams(search).get("type");
    return v && (["bundle", "skill", "agent", "mcp"] as string[]).includes(v) ? (v as ItemType) : null;
  }, [search]);
  const [url, setUrl] = useState("");
  const [override, setOverride] = useState<ItemType | null>(prefillType);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [stepIdx, setStepIdx] = useState(-1);
  const [palette, setPalette] = useState<string[]>([]);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [validation, setValidation] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const timersRef = useRef<number[]>([]);

  const detection = useMemo(() => detectType(url), [url]);
  const activeType: ItemType = override ?? detection?.type ?? "bundle";
  const steps = STEPS_FOR[activeType];
  const meta = TYPE_META[activeType];

  const host = (() => {
    try {
      if (!url) return "";
      const u = url.startsWith("http") ? url : `https://${url}`;
      return new URL(u).hostname.replace(/^www\./, "");
    } catch {
      return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    }
  })();

  function start() {
    setValidation(null);
    if (!url.trim()) return;
    if (!detection && !override) {
      setValidation("That URL pattern isn't recognised — pick a type below to submit anyway.");
      setOverrideOpen(true);
      return;
    }
    clearTimers();
    setStatus("running");
    setStepIdx(0);
    setPalette([]);
    setSubmitState("idle");
    const seed = host || "demo";
    const next = generatePalette(seed);
    let acc = 0;
    steps.forEach((s, i) => {
      acc += s.durationMs;
      const t = window.setTimeout(() => {
        setStepIdx(i + 1);
        // Palette appears after step 2 for bundles (after compliance + scrape)
        if (activeType === "bundle" && i === 2) setPalette(next);
        if (i === steps.length - 1) setStatus("done");
      }, acc);
      timersRef.current.push(t);
    });
  }

  function reset() {
    clearTimers();
    setStatus("idle");
    setStepIdx(-1);
    setPalette([]);
    setSubmitState("idle");
    setValidation(null);
  }

  function clearTimers() {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  }
  useEffect(() => () => clearTimers(), []);

  function submitForReview() {
    setSubmitState("submitting");
    window.setTimeout(() => setSubmitState("submitted"), 700);
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draftSource);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // clipboard may be restricted in iframe — surface a soft signal
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    }
  }

  const elapsed = stepIdx >= 0 ? steps.slice(0, stepIdx).reduce((s, x) => s + x.durationMs, 0) : 0;
  const total = steps.reduce((s, x) => s + x.durationMs, 0);

  const draftSource =
    activeType === "bundle"
      ? presetBundleSpec(host || "draft.local", palette.length > 0 ? palette : generatePalette(host || "demo"))
      : activeType === "skill"
      ? presetSkillDraft(host || "draft.local")
      : activeType === "agent"
      ? presetAgentDraft(host || "draft.local")
      : presetMcpDraft(host || "draft.local");

  return (
    <>
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-3xl px-6 lg:px-8 pt-20 pb-12 text-center">
          <SectionLabel n="01" t="From any URL" />
          <h1 className="mt-5 text-[44px] sm:text-[56px] leading-[1.02] font-medium tracking-[-0.022em]">
            Paste any URL —
            <br />
            <span style={{ color: SUB }}>we'll figure out the type.</span>
          </h1>
          <p className="mt-6 text-[15px] leading-[1.65] max-w-[34rem] mx-auto" style={{ color: SUB }}>
            Brand site, GitHub repo, MCP registry link — we detect what it is, run a compliance
            check first, and produce a draft you can use or submit for editor review.
          </p>

          <form
            className="mt-10 mx-auto max-w-2xl flex items-center gap-2 rounded-full border p-1.5"
            style={{ borderColor: BORDER, background: SURFACE }}
            onSubmit={(e) => {
              e.preventDefault();
              start();
            }}
          >
            <Globe className="h-4 w-4 ml-3" style={{ color: MUTED }} />
            <input
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setOverride(null);
                setValidation(null);
              }}
              placeholder="https://linear.app  ·  github.com/owner/skill  ·  figma.com/mcp"
              className="flex-1 h-9 bg-transparent text-[13.5px] px-1 min-w-0"
              style={{ color: INK, fontFamily: MONO }}
              disabled={status === "running"}
            />
            {status === "idle" ? (
              <button
                type="submit"
                disabled={!url.trim()}
                className="h-9 rounded-full px-5 text-[12.5px] font-medium inline-flex items-center gap-2 disabled:opacity-50"
                style={{ background: INK, color: INK_ON_LIGHT }}
              >
                Generate <span style={{ fontFamily: MONO, color: MUTED }}>⏎</span>
              </button>
            ) : status === "running" ? (
              <button
                type="button"
                className="h-9 rounded-full px-5 text-[12.5px] font-medium inline-flex items-center gap-2"
                style={{ background: INK, color: INK_ON_LIGHT }}
                disabled
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generating
              </button>
            ) : (
              <button
                type="button"
                onClick={reset}
                className="h-9 rounded-full px-5 text-[12.5px] font-medium inline-flex items-center gap-2"
                style={{ background: INK, color: INK_ON_LIGHT }}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Try another
              </button>
            )}
          </form>

          {/* Detection / override row */}
          <div className="mt-5 flex items-center justify-center gap-3 flex-wrap">
            <span className="text-[11px]" style={{ fontFamily: MONO, color: MUTED }}>
              submitting as
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setOverrideOpen((v) => !v)}
                className="inline-flex items-center gap-2 h-7 rounded-full border px-3 text-[12px]"
                style={{
                  borderColor: meta.accent,
                  background: `${meta.accent}14`,
                  color: INK,
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.accent }} />
                <span style={{ color: meta.accent, fontSize: 12, lineHeight: 1 }}>{meta.icon}</span>
                {meta.label}
                <ChevronDown className="h-3 w-3" style={{ color: SUB }} />
              </button>
              {overrideOpen ? (
                <div
                  className="absolute z-20 mt-1.5 left-1/2 -translate-x-1/2 min-w-[180px] rounded-lg border p-1.5 shadow-xl"
                  style={{ borderColor: BORDER, background: SURFACE }}
                >
                  {(["bundle", "skill", "agent", "mcp"] as ItemType[]).map((t) => {
                    const m = TYPE_META[t];
                    const isActive = activeType === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          setOverride(t);
                          setOverrideOpen(false);
                        }}
                        className="w-full inline-flex items-center gap-2 h-8 rounded-md px-2 text-[12px] text-left"
                        style={{
                          background: isActive ? `${m.accent}1A` : "transparent",
                          color: INK,
                        }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.accent }} />
                        <span style={{ color: m.accent }}>{m.icon}</span>
                        <span className="flex-1">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
            {detection ? (
              <span className="text-[11px]" style={{ fontFamily: MONO, color: SUB }}>
                · detected: {detection.reason}
              </span>
            ) : url.trim() ? (
              <span className="text-[11px]" style={{ fontFamily: MONO, color: PEACH }}>
                · pattern not recognised — pick a type
              </span>
            ) : null}
          </div>

          {validation ? (
            <div
              className="mt-4 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-[11.5px]"
              style={{ borderColor: PEACH, background: `${PEACH}10`, color: INK, fontFamily: MONO }}
            >
              {validation}
            </div>
          ) : null}

          <div className="mt-4 text-[11px]" style={{ fontFamily: MONO, color: MUTED }}>
            {status === "idle"
              ? "compliance check runs first · free · MDN-style public reference"
              : status === "running"
              ? `${(elapsed / 1000).toFixed(1)}s elapsed of ~${(total / 1000).toFixed(0)}s`
              : `generated from ${host} · ${(total / 1000).toFixed(0)}s total`}
          </div>
        </div>
      </section>

      {/* Pipeline + Preview */}
      <section>
        <div
          className="mx-auto max-w-6xl px-6 lg:px-8 py-16 grid grid-cols-1 lg:grid-cols-2 gap-px rounded-xl overflow-hidden"
          style={{ background: BORDER }}
        >
          <div className="p-8" style={{ background: BG }}>
            <SectionLabel n="02" t={`${meta.label} pipeline`} />
            <div className="mt-6 space-y-1.5">
              {steps.map((s, i) => {
                const state: "done" | "active" | "pending" =
                  stepIdx > i ? "done" : stepIdx === i ? "active" : "pending";
                const isCompliance = s.id === "compliance";
                return (
                  <div
                    key={s.id}
                    className="flex items-start gap-4 rounded-md px-3 py-2.5 transition-colors"
                    style={{
                      background: state === "active" ? `${meta.accent}10` : "transparent",
                    }}
                  >
                    <span
                      className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border shrink-0"
                      style={{
                        borderColor:
                          state === "done" ? LIME : state === "active" ? meta.accent : BORDER,
                        background: state === "done" ? `${LIME}22` : SURFACE,
                      }}
                    >
                      {state === "done" ? (
                        <Check className="h-3 w-3" style={{ color: LIME }} />
                      ) : state === "active" ? (
                        <Loader2 className="h-3 w-3 animate-spin" style={{ color: meta.accent }} />
                      ) : isCompliance ? (
                        <ShieldCheck className="h-3 w-3" style={{ color: MUTED }} />
                      ) : (
                        <span
                          className="text-[10px]"
                          style={{ fontFamily: MONO, color: MUTED }}
                        >
                          {i + 1}
                        </span>
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span
                          className="text-[13.5px]"
                          style={{
                            color: state === "pending" ? SUB : INK,
                            fontWeight: state === "active" ? 600 : 400,
                          }}
                        >
                          {s.label}
                        </span>
                        <span
                          className="text-[10.5px] px-1.5 py-0.5 rounded uppercase tracking-[0.18em]"
                          style={{
                            fontFamily: MONO,
                            color: isCompliance ? LIME : meta.accent,
                            border: `1px solid ${isCompliance ? LIME : meta.accent}55`,
                            background: isCompliance ? `${LIME}10` : `${meta.accent}10`,
                          }}
                        >
                          {s.tool}
                        </span>
                      </div>
                      <div
                        className="text-[11px] mt-1"
                        style={{ fontFamily: MONO, color: state === "pending" ? MUTED : SUB }}
                      >
                        {s.detail}
                      </div>
                    </div>
                    <span
                      className="text-[10.5px] shrink-0 mt-1.5"
                      style={{
                        fontFamily: MONO,
                        color: state === "done" ? LIME : state === "active" ? meta.accent : MUTED,
                      }}
                    >
                      {(s.durationMs / 1000).toFixed(1)}s
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-8" style={{ background: BG }}>
            <SectionLabel n="03" t="Early preview" />
            <div
              className="mt-6 rounded-lg border p-6"
              style={{ borderColor: BORDER, background: SURFACE }}
            >
              <div
                className="text-[11px] uppercase tracking-[0.22em] mb-4"
                style={{ fontFamily: MONO, color: MUTED }}
              >
                {activeType === "bundle" ? "detected palette" : `${meta.label.toLowerCase()} signals`}
              </div>
              {activeType === "bundle" ? (
                palette.length === 0 ? (
                  <div
                    className="h-12 rounded border-dashed border flex items-center justify-center text-[12px]"
                    style={{ borderColor: BORDER, color: MUTED, fontFamily: MONO }}
                  >
                    waiting for extraction…
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex h-8 rounded overflow-hidden">
                      {palette.map((c) => (
                        <span key={c} className="flex-1" style={{ background: c }} />
                      ))}
                    </div>
                    <div className="grid grid-cols-5 gap-2 text-[10.5px]" style={{ fontFamily: MONO, color: SUB }}>
                      {palette.map((c) => (
                        <span key={c}>{c.toUpperCase()}</span>
                      ))}
                    </div>
                  </div>
                )
              ) : (
                <div
                  className="h-12 rounded flex items-center justify-center text-[11.5px] gap-2"
                  style={{ background: SURFACE_2, color: SUB, fontFamily: MONO }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.accent }} />
                  {status === "done"
                    ? `${meta.label.toLowerCase()} draft ready · review the preview below`
                    : "waiting for pipeline…"}
                </div>
              )}
              <div
                className="mt-6 grid grid-cols-2 gap-4 text-[12px]"
                style={{ color: SUB }}
              >
                <Field label="source" value={host || "—"} />
                <Field label="type" value={meta.label} accent={meta.accent} />
                <Field label="status" value={status === "done" ? "draft ready" : status === "running" ? "running" : "idle"} accent={status === "done" ? LIME : undefined} />
                <Field label="license" value={status === "done" ? "review-required" : "—"} />
              </div>
            </div>
          </div>
        </div>

        {/* Draft preview + dual CTAs */}
        {status === "done" ? (
          <div className="mx-auto max-w-6xl px-6 lg:px-8 pb-20">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
              <CodePanel
                title={`${host}/${
                  activeType === "bundle" ? "design.md" : activeType === "mcp" ? "mcp.json" : `${activeType}.md`
                }`}
                language={activeType === "bundle" ? "yaml" : activeType === "mcp" ? "json" : "md"}
                source={draftSource}
                rightMeta={
                  <span className="inline-flex items-center gap-1.5" style={{ color: INK }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: PEACH }} />
                    draft · review before shipping
                  </span>
                }
              />
              <aside
                className="rounded-xl border p-6 flex flex-col gap-5"
                style={{ borderColor: BORDER, background: SURFACE }}
              >
                <div>
                  <SectionLabel n="04" t="What's next" />
                  <p className="mt-3 text-[13px] leading-[1.6]" style={{ color: SUB }}>
                    Use the draft yourself right now, or hand it to the editorial desk for inclusion
                    in the public library.
                  </p>
                </div>

                {/* Equal-weight CTAs */}
                <div className="grid grid-cols-1 gap-2.5">
                  <button
                    type="button"
                    onClick={copyDraft}
                    className="h-10 rounded-full px-4 text-[12.5px] font-medium inline-flex items-center justify-center gap-2"
                    style={{
                      background: INK,
                      color: INK_ON_LIGHT,
                      boxShadow: `0 0 0 1px ${meta.accent}55, 0 10px 36px -10px ${meta.accent}88`,
                    }}
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5" style={{ color: LIME }} />
                        Copied to clipboard
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy for personal use
                      </>
                    )}
                  </button>
                  {submitState === "submitted" ? (
                    <div
                      className="h-10 rounded-full px-4 text-[12.5px] font-medium inline-flex items-center justify-center gap-2"
                      style={{
                        background: `${LIME}1A`,
                        border: `1px solid ${LIME}66`,
                        color: INK,
                      }}
                    >
                      <Check className="h-3.5 w-3.5" style={{ color: LIME }} />
                      Sent to editors
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={submitForReview}
                      disabled={submitState === "submitting"}
                      className="h-10 rounded-full px-4 text-[12.5px] font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60"
                      style={{
                        background: INK,
                        color: INK_ON_LIGHT,
                        boxShadow: `0 0 0 1px ${VIOLET}55, 0 10px 36px -10px ${VIOLET}88`,
                      }}
                    >
                      {submitState === "submitting" ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Sending
                        </>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" />
                          Submit for review
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div
                  className="text-[11px] pt-4 border-t leading-[1.6]"
                  style={{ borderColor: BORDER_SOFT, color: MUTED, fontFamily: MONO }}
                >
                  reviewed within 48h · attribution preserved · free, public, MDN-style
                </div>
              </aside>
            </div>
          </div>
        ) : null}
      </section>

    </>
  );
}

function Field({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[0.22em]" style={{ fontFamily: MONO, color: MUTED }}>
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-[14px]" style={{ color: INK, fontFamily: MONO }}>
          {value}
        </span>
        {accent ? <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} /> : null}
      </div>
    </div>
  );
}

function generatePalette(seed: string): string[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  const accent = `hsl(${hue}, 78%, 60%)`;
  const surface = `hsl(${hue}, 18%, 8%)`;
  const muted = `hsl(${hue}, 14%, 45%)`;
  const text = `hsl(${hue}, 20%, 96%)`;
  const warm = `hsl(${(hue + 32) % 360}, 70%, 65%)`;
  return [accent, surface, muted, text, warm].map(hslToHex);
}

function hslToHex(hsl: string): string {
  const m = hsl.match(/hsl\((\d+),\s*(\d+)%?,\s*(\d+)%?\)/);
  if (!m) return hsl;
  let h = +m[1],
    s = +m[2] / 100,
    l = +m[3] / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m2 = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) => {
    const n = Math.round((v + m2) * 255);
    return n.toString(16).padStart(2, "0");
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}
