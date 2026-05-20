"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { saveDraft } from "@/lib/ui-data/draftStore";
import { queueSubmission } from "@/lib/ui-data/submissionStore";
import { Check, ChevronDown, Copy, Globe, Image as ImageIcon, Loader2, Lock, RefreshCw, Send, ShieldCheck, Upload, X as XIcon } from "lucide-react";
import { SectionLabel } from "@/components/ui/Shell";
import { CodePanel } from "@/components/ui/CodePanel";
import { openAuthModal, useAuth } from "@/lib/ui-data/mockAuth";
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
} from "@/lib/ui-data/tokens";
import { TYPE_META, type ItemType } from "@/lib/ui-data/items";

type Status = "idle" | "running" | "done" | "failed";
type SubmitState = "idle" | "submitting" | "submitted";

interface RealBundle {
  id: string;
  slug: string;
  designMd: string | null;
  companionPrompt: string;
  paletteColors: string[];
  coverageScore: number | null;
  status: string;
  reviewNotes: string | null;
}

interface JobPollResult {
  jobId: string;
  status: "queued" | "running" | "completed" | "failed";
  currentStep: string | null;
  errorMessage: string | null;
  errorStep: string | null;
  resultBundleId: string | null;
  resultBundleSlug: string | null;
}

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

/** Bundle pipeline steps — these mirror the backend `currentStep` strings
 * emitted by `lib/generator/scrape-and-extract.ts`. Order must match the
 * worker. `durationMs` is only used as a visual hint when polling is slow. */
const BUNDLE_STEPS_URL: PipelineStep[] = [
  { id: "scraping", label: "Page collection", tool: "Firecrawl", detail: "Crawling source + screenshot", durationMs: 8000 },
  { id: "parsing-computed", label: "Computed-style parse", tool: "node-html-parser", detail: "CSS variables · dominant hexes · fonts", durationMs: 1500 },
  { id: "extracting", label: "Brand extraction", tool: "Gemini 2.5 Flash", detail: "Multi-modal: text + computed + screenshot", durationMs: 12000 },
  { id: "resolving-orphans", label: "Orphan resolution", tool: "Deterministic pass", detail: "Wire every token to a component", durationMs: 600 },
  { id: "persisting", label: "Draft persisted", tool: "Postgres", detail: "Bundle row created", durationMs: 500 },
  { id: "writing-design-md", label: "Design.md authored", tool: "Claude Sonnet 4.6", detail: "Canonical Google DESIGN.md spec", durationMs: 18000 },
  { id: "linting", label: "Lint + WCAG check", tool: "@google/design.md", detail: "Contrast · orphans · section coverage", durationMs: 1500 },
  { id: "scoring", label: "Coverage scoring", tool: "Linter model", detail: "Section weights + WCAG factor", durationMs: 400 },
];

/** Upload variant — replaces the first three URL-pipeline steps
 * (scraping, parsing-computed, extracting) with a single image-only path. */
const BUNDLE_STEPS_UPLOAD: PipelineStep[] = [
  { id: "processing-image", label: "Image processing", tool: "Hashing + decoding", detail: "Computing SHA-256 + preparing for Gemini", durationMs: 800 },
  { id: "extracting", label: "Brand extraction", tool: "Gemini 2.5 Flash", detail: "Vision-only: reading tokens from screenshot", durationMs: 14000 },
  { id: "resolving-orphans", label: "Orphan resolution", tool: "Deterministic pass", detail: "Wire every token to a component", durationMs: 600 },
  { id: "persisting", label: "Draft persisted", tool: "Postgres", detail: "Bundle row created", durationMs: 500 },
  { id: "writing-design-md", label: "Design.md authored", tool: "Claude Sonnet 4.6", detail: "Canonical Google DESIGN.md spec", durationMs: 18000 },
  { id: "linting", label: "Lint + WCAG check", tool: "@google/design.md", detail: "Contrast · orphans · section coverage", durationMs: 1500 },
  { id: "scoring", label: "Coverage scoring", tool: "Linter model", detail: "Section weights + WCAG factor", durationMs: 400 },
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
  bundle: BUNDLE_STEPS_URL,
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
  if (host === "figma.com" && path.includes("/mcp")) return { type: "mcp", reason: "Figma MCP endpoint" };
  if (path.endsWith("/mcp") || path.includes("/mcp/") || path.includes("mcp-catalog")) {
    return { type: "mcp", reason: "MCP registry path" };
  }
  if (host.includes("mobbin.com") && path.includes("mcp")) return { type: "mcp", reason: "Mobbin MCP" };
  if (host.includes("refero.design") && path.includes("mcp")) return { type: "mcp", reason: "Refero MCP" };

  // Skill / Agent detection (GitHub repos default to designer Skill;
  // "agent" or ".claude/agents" in the path → designer Agent)
  if (host === "github.com") {
    const lower = (path + " " + url).toLowerCase();
    if (lower.includes("agent") || lower.includes(".claude/agents")) {
      return { type: "agent", reason: "GitHub repo → designer agent" };
    }
    return { type: "skill", reason: "GitHub repo → designer skill" };
  }
  if (host.includes("skills.sh") || host.includes("aitmpl.com")) {
    return { type: "skill", reason: `${host} → designer skill` };
  }

  // Brand / product host → design.md (single-label TLDs)
  const parts = host.split(".");
  const tld = parts[parts.length - 1];
  const KNOWN_TLDS = new Set([
    // existing
    "com", "io", "co", "app", "dev", "ai", "design", "studio", "shop",
    "org", "net", "xyz", "sh", "so", "to", "cloud", "page", "site", "tech",
    // modern brand TLDs
    "fyi", "me", "new", "build", "agency", "pro", "fund", "fashion",
    "world", "global", "club",
  ]);
  if (parts.length >= 2 && KNOWN_TLDS.has(tld)) {
    return { type: "bundle", reason: "Brand site → design.md" };
  }
  // Unknown / unusual pattern — let the user override explicitly.
  return null;
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

/** Anyone can run the generator and see metadata for the resulting draft;
 * the draft body itself is blurred until they sign in. Keeping a single
 * component (no signed-out branch with different hook count) means hook
 * order stays stable across the signed-out → signed-in transition. */
function Generate() {
  return (
    <Suspense fallback={null}>
      <GenerateContent />
    </Suspense>
  );
}

function GenerateContent() {
  const { user } = useAuth();
  const gated = !user;
  const _router = useRouter();
  const navigate = (path: string) => _router.push(path);
  const search = useSearchParams().toString();
  const prefillType = useMemo(() => {
    const v = new URLSearchParams(search).get("type");
    return v && (["bundle", "skill", "agent", "mcp"] as string[]).includes(v) ? (v as ItemType) : null;
  }, [search]);
  const [url, setUrl] = useState("");
  const [override, setOverride] = useState<ItemType | null>(prefillType);
  const [overrideTouched, setOverrideTouched] = useState<boolean>(!!prefillType);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [stepIdx, setStepIdx] = useState(-1);
  const [palette, setPalette] = useState<string[]>([]);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [validation, setValidation] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const timersRef = useRef<number[]>([]);
  // Real-pipeline state (bundle type only)
  const [jobId, setJobId] = useState<string | null>(null);
  const [realBundle, setRealBundle] = useState<RealBundle | null>(null);
  const [existingSlug, setExistingSlug] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  // Per-step start times keyed by step index. Captured every time stepIdx
  // advances. Used to compute real elapsed for done steps + live elapsed
  // for the active step.
  const [stepTimes, setStepTimes] = useState<{ startedAt: number; endedAt: number | null }[]>([]);
  // Force re-render every 250ms while pipeline runs so the active step's
  // live timer ticks up smoothly without spamming setState.
  const [, setTick] = useState(0);
  // Bundle source mode — only meaningful when activeType === "bundle".
  // 'url' uses the existing scrape pipeline; 'upload' takes a screenshot.
  const [bundleMode, setBundleMode] = useState<"url" | "upload">("url");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [brandName, setBrandName] = useState("");

  const detection = useMemo(() => detectType(url), [url]);
  const typeResolved: boolean = !!override || !!detection;
  const activeType: ItemType = override ?? detection?.type ?? "bundle";
  // Steps for the visual pipeline. Bundle picks URL vs upload variant.
  const steps = useMemo(() => {
    if (activeType !== "bundle") return STEPS_FOR[activeType];
    return bundleMode === "upload" ? BUNDLE_STEPS_UPLOAD : BUNDLE_STEPS_URL;
  }, [activeType, bundleMode]);
  const meta = TYPE_META[activeType];
  const bundleSteps = bundleMode === "upload" ? BUNDLE_STEPS_UPLOAD : BUNDLE_STEPS_URL;

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

    // Auth gate first — applies to both URL and upload bundle flows.
    if (gated && activeType === "bundle") {
      openAuthModal("/generate");
      return;
    }

    // ─── Upload mode (bundle only) ────────────────────────
    if (activeType === "bundle" && bundleMode === "upload") {
      if (!uploadFile) {
        setValidation("Pick a screenshot to upload.");
        return;
      }
      if (!brandName.trim()) {
        setValidation("Give the brand a name so we can title the bundle.");
        return;
      }
      clearTimers();
      stopPolling();
      setStatus("running");
      setStepIdx(0);
      setPalette([]);
      setRealBundle(null);
      setExistingSlug(null);
      setErrorMsg(null);
      setSubmitState("idle");
      void startBundleUpload(uploadFile, brandName.trim());
      return;
    }

    // ─── URL mode ─────────────────────────────────────────
    const raw = url.trim();
    if (!raw) {
      setValidation("Paste a URL to begin.");
      return;
    }
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    } catch {
      setValidation("That doesn't look like a valid URL. Try https://linear.app or github.com/owner/repo.");
      return;
    }
    const parsedHost = parsedUrl.hostname.replace(/^www\./, "");
    if (!parsedHost.includes(".") || parsedHost.length < 4) {
      setValidation("URL needs a real host (e.g. https://linear.app).");
      return;
    }
    if (!detection && !override) {
      setValidation("That URL pattern isn't recognised — pick a type below to submit anyway.");
      setOverrideOpen(true);
      return;
    }

    clearTimers();
    stopPolling();
    setStatus("running");
    setStepIdx(0);
    setPalette([]);
    setRealBundle(null);
    setExistingSlug(null);
    setErrorMsg(null);
    setSubmitState("idle");

    if (activeType === "bundle") {
      void startBundleJob(parsedUrl.toString());
      return;
    }

    // Mock pipeline for skill/agent/mcp (real pipelines not yet built).
    const seed = host || "demo";
    const next = generatePalette(seed);
    let acc = 0;
    steps.forEach((s, i) => {
      acc += s.durationMs;
      const t = window.setTimeout(() => {
        setStepIdx(i + 1);
        if (i === steps.length - 1) setStatus("done");
      }, acc);
      timersRef.current.push(t);
    });
    // Non-bundle types still use the seeded mock palette.
    void next;
  }

  async function startBundleJob(submitUrl: string) {
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: submitUrl }),
      });
      if (res.status === 409) {
        const body = (await res.json()) as { existingBundleSlug?: string };
        setExistingSlug(body.existingBundleSlug ?? null);
        setStatus("done");
        setStepIdx(bundleSteps.length);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        setErrorMsg(body.error || `Failed to start (${res.status})`);
        setStatus("failed");
        return;
      }
      const body = (await res.json()) as { jobId: string; currentStep: string | null };
      setJobId(body.jobId);
      pollJob(body.jobId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Network error");
      setStatus("failed");
    }
  }

  async function startBundleUpload(file: File, name: string) {
    try {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("brandName", name);
      const res = await fetch("/api/generate", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        setErrorMsg(body.error || `Failed to start (${res.status})`);
        setStatus("failed");
        return;
      }
      const body = (await res.json()) as { jobId: string };
      setJobId(body.jobId);
      pollJob(body.jobId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Network error");
      setStatus("failed");
    }
  }

  function pollJob(id: string) {
    const tick = async () => {
      try {
        const res = await fetch(`/api/generate/${id}`);
        if (!res.ok) {
          if (res.status === 404) {
            setErrorMsg("Job not found.");
            setStatus("failed");
            return;
          }
          // Transient — try again on next tick.
          schedulePoll(id);
          return;
        }
        const job = (await res.json()) as JobPollResult;
        applyJobUpdate(job);
        if (job.status === "completed") {
          if (job.resultBundleId) {
            await loadBundle(job.resultBundleId);
          }
          setStatus("done");
          return;
        }
        if (job.status === "failed") {
          setErrorMsg(job.errorMessage || `Failed at ${job.errorStep ?? "unknown step"}`);
          setStatus("failed");
          return;
        }
        schedulePoll(id);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Polling error");
        schedulePoll(id);
      }
    };
    void tick();
  }

  function schedulePoll(id: string) {
    pollRef.current = window.setTimeout(() => pollJob(id), 2000);
  }

  function stopPolling() {
    if (pollRef.current !== null) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }

  function applyJobUpdate(job: JobPollResult) {
    const step = job.currentStep;
    if (!step) return;
    if (step === "ready_for_review" || step === "held_as_draft") {
      setStepIdx(bundleSteps.length);
      return;
    }
    const idx = bundleSteps.findIndex((s) => s.id === step);
    if (idx >= 0) setStepIdx(idx);
  }

  async function loadBundle(bundleId: string) {
    try {
      const res = await fetch(`/api/me/bundles/${bundleId}`);
      if (!res.ok) return;
      const body = (await res.json()) as { data: RealBundle };
      setRealBundle(body.data);
      if (body.data.paletteColors?.length) setPalette(body.data.paletteColors);
    } catch {
      // Soft failure — preview just won't render; the bundle still exists.
    }
  }

  function reset() {
    clearTimers();
    stopPolling();
    setStatus("idle");
    setStepIdx(-1);
    setPalette([]);
    setSubmitState("idle");
    setValidation(null);
    setJobId(null);
    setRealBundle(null);
    setExistingSlug(null);
    setErrorMsg(null);
    // Keep bundleMode + uploadFile + brandName so a "Try another" doesn't
    // wipe what the user just configured; they can clear manually.
  }

  function clearTimers() {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  }
  useEffect(() => () => { clearTimers(); stopPolling(); }, []);

  // Record step transitions for the real-time timer. Closes the previous
  // step's endedAt and opens the new one. Resets cleanly when stepIdx
  // goes back to -1.
  useEffect(() => {
    if (stepIdx < 0) {
      setStepTimes([]);
      return;
    }
    setStepTimes((prev) => {
      const now = Date.now();
      const next = [...prev];
      // Close any earlier step that's still open.
      for (let i = 0; i < stepIdx; i++) {
        if (!next[i]) next[i] = { startedAt: now, endedAt: now };
        else if (next[i].endedAt === null) next[i] = { ...next[i], endedAt: now };
      }
      // Open the current step. If we passed the end (>= steps.length),
      // it means the pipeline finished — close the last step.
      if (stepIdx >= steps.length) {
        const last = steps.length - 1;
        if (next[last] && next[last].endedAt === null) {
          next[last] = { ...next[last], endedAt: now };
        }
      } else if (!next[stepIdx]) {
        next[stepIdx] = { startedAt: now, endedAt: null };
      }
      return next;
    });
  }, [stepIdx, steps.length]);

  // Tick the active step's live timer while the pipeline is running.
  useEffect(() => {
    if (status !== "running") return;
    const id = window.setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, [status]);

  function submitForReview() {
    if (gated) {
      openAuthModal("/generate");
      return;
    }
    setSubmitState("submitting");
    const filename =
      activeType === "bundle"
        ? "design.md"
        : activeType === "mcp"
        ? "mcp.json"
        : `${activeType}.md`;
    const language: "yaml" | "md" | "json" =
      activeType === "bundle" ? "yaml" : activeType === "mcp" ? "json" : "md";
    queueSubmission({
      type: activeType,
      source: host ? `https://${host}` : "draft.local",
      host: host || "draft.local",
      filename,
      language,
      body: draftSource,
    });
    window.setTimeout(() => setSubmitState("submitted"), 700);
  }

  async function copyDraft() {
    if (gated) {
      openAuthModal("/generate");
      return;
    }
    // Best-effort clipboard write, then hand off to CopySuccess with the draft payload
    try {
      await navigator.clipboard.writeText(draftSource);
    } catch {
      // clipboard may be restricted in iframe — CopySuccess offers re-copy buttons
    }
    setCopied(true);
    const filename =
      activeType === "bundle"
        ? "design.md"
        : activeType === "mcp"
        ? "mcp.json"
        : `${activeType}.md`;
    const language: "yaml" | "md" | "json" =
      activeType === "bundle" ? "yaml" : activeType === "mcp" ? "json" : "md";
    const draft = saveDraft({
      type: activeType,
      source: host ? `https://${host}` : "draft.local",
      host: host || "draft.local",
      filename,
      language,
      body: draftSource,
    });
    navigate(`/copy/${draft.id}`);
  }

  // Total real elapsed across all steps so far (live for active step).
  const elapsedMs = (() => {
    if (stepTimes.length === 0) return 0;
    const first = stepTimes[0]?.startedAt;
    if (!first) return 0;
    const lastEnd =
      stepTimes[stepTimes.length - 1]?.endedAt ??
      (status === "running" ? Date.now() : stepTimes[stepTimes.length - 1]?.startedAt ?? first);
    return Math.max(0, lastEnd - first);
  })();
  const total = steps.reduce((s, x) => s + x.durationMs, 0);

  const draftSource =
    activeType === "bundle"
      ? realBundle?.designMd
        ? realBundle.designMd
        : presetBundleSpec(host || "draft.local", palette.length > 0 ? palette : generatePalette(host || "demo"))
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

          {activeType === "bundle" ? (
            <div className="mt-10 mx-auto inline-flex items-center gap-1 rounded-full border p-1" style={{ borderColor: BORDER, background: SURFACE_2 }}>
              {(["url", "upload"] as const).map((m) => {
                const active = bundleMode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      if (status === "running") return;
                      setBundleMode(m);
                      setValidation(null);
                    }}
                    disabled={status === "running"}
                    className="inline-flex items-center gap-2 h-8 rounded-full px-4 text-[12px] disabled:opacity-50"
                    style={{
                      background: active ? INK : "transparent",
                      color: active ? INK_ON_LIGHT : SUB,
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {m === "url" ? <Globe className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
                    {m === "url" ? "URL" : "Upload image"}
                  </button>
                );
              })}
            </div>
          ) : null}

          <form
            className={
              activeType === "bundle" && bundleMode === "upload"
                ? "mt-5 mx-auto max-w-2xl flex flex-col gap-3"
                : "mt-10 mx-auto max-w-2xl flex items-center gap-2 rounded-full border p-1.5"
            }
            style={
              activeType === "bundle" && bundleMode === "upload"
                ? undefined
                : { borderColor: BORDER, background: SURFACE }
            }
            onSubmit={(e) => {
              e.preventDefault();
              start();
            }}
          >
            {activeType === "bundle" && bundleMode === "upload" ? (
              <UploadFields
                file={uploadFile}
                preview={uploadPreview}
                onFile={(f) => {
                  setUploadFile(f);
                  setValidation(null);
                  if (uploadPreview) URL.revokeObjectURL(uploadPreview);
                  setUploadPreview(f ? URL.createObjectURL(f) : null);
                }}
                brandName={brandName}
                onBrandName={(v) => {
                  setBrandName(v);
                  setValidation(null);
                }}
                status={status}
                onSubmitButton={
                  status === "idle" ? (
                    <button
                      type="submit"
                      disabled={!uploadFile || !brandName.trim()}
                      className="h-10 rounded-full px-5 text-[12.5px] font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
                      style={{ background: INK, color: INK_ON_LIGHT }}
                    >
                      Generate from image
                    </button>
                  ) : status === "running" ? (
                    <button
                      type="button"
                      disabled
                      className="h-10 rounded-full px-5 text-[12.5px] font-medium inline-flex items-center justify-center gap-2"
                      style={{ background: INK, color: INK_ON_LIGHT }}
                    >
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Generating
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={reset}
                      className="h-10 rounded-full px-5 text-[12.5px] font-medium inline-flex items-center justify-center gap-2"
                      style={{ background: INK, color: INK_ON_LIGHT }}
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Try another
                    </button>
                  )
                }
              />
            ) : (
              <>
                <Globe className="h-4 w-4 ml-3" style={{ color: MUTED }} />
                <input
                  type="url"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (!overrideTouched) setOverride(null);
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
              <div className="inline-flex items-center gap-2">
                <button
                  type="button"
                  className="h-9 rounded-full px-5 text-[12.5px] font-medium inline-flex items-center gap-2"
                  style={{ background: INK, color: INK_ON_LIGHT }}
                  disabled
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Generating
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="h-9 rounded-full px-3 text-[11.5px]"
                  style={{ color: SUB, fontFamily: MONO }}
                  aria-label="Cancel generation"
                >
                  cancel
                </button>
              </div>
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
              </>
            )}
          </form>

          {/* Detection / override row — only meaningful in URL mode (uploads
              are always bundle-type and have no URL pattern to inspect). */}
          {activeType === "bundle" && bundleMode === "upload" ? null : (
          <div className="mt-5 flex items-center justify-center gap-3 flex-wrap">
            <span className="text-[11px]" style={{ fontFamily: MONO, color: MUTED }}>
              submitting as
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setOverrideOpen((v) => !v)}
                disabled={status === "running"}
                className="inline-flex items-center gap-2 h-7 rounded-full border px-3 text-[12px] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  borderColor: typeResolved ? meta.accent : BORDER,
                  background: typeResolved ? `${meta.accent}14` : SURFACE,
                  color: typeResolved ? INK : SUB,
                }}
              >
                {typeResolved ? (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.accent }} />
                    <span style={{ color: meta.accent, fontSize: 12, lineHeight: 1 }}>{meta.icon}</span>
                    {meta.label}
                  </>
                ) : (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: MUTED }} />
                    <span style={{ color: MUTED }}>Pick a type</span>
                  </>
                )}
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
                          setOverrideTouched(true);
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
          )}

          {detection?.type === "skill" && host && host.includes("github.com") && !override ? (
            <div className="mt-3 text-[11px]" style={{ fontFamily: MONO, color: MUTED }}>
              heads up — Skills are for repos that help designers (research, critique,
              token enforcement). Confirm before submitting.
            </div>
          ) : null}

          {validation ? (
            <div
              className="mt-4 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-[11.5px]"
              style={{ borderColor: PEACH, background: `${PEACH}10`, color: INK, fontFamily: MONO }}
            >
              {validation}
            </div>
          ) : null}

          {activeType === "bundle" && !typeResolved ? null : activeType !== "bundle" ? (
            <div
              className="mt-4 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-[11px]"
              style={{ borderColor: BORDER, background: SURFACE_2, color: SUB, fontFamily: MONO }}
            >
              preview-only · {activeType} pipeline not yet wired to the real generator
            </div>
          ) : null}

          {status === "failed" && errorMsg ? (
            <div
              className="mt-4 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-[11.5px] max-w-2xl text-left"
              style={{ borderColor: PEACH, background: `${PEACH}10`, color: INK, fontFamily: MONO }}
            >
              <span style={{ color: PEACH }}>error</span>
              <span>{errorMsg}</span>
            </div>
          ) : null}

          {existingSlug ? (
            <div className="mt-4 inline-flex items-center gap-2 text-[11.5px]" style={{ fontFamily: MONO, color: SUB }}>
              already in the library —
              <a
                href={`/library/${existingSlug}`}
                className="underline underline-offset-4"
                style={{ color: INK }}
              >
                view /library/{existingSlug}
              </a>
            </div>
          ) : null}

          <div className="mt-4 text-[11px]" style={{ fontFamily: MONO, color: MUTED }}>
            {status === "idle"
              ? activeType === "bundle"
                ? "real pipeline · free · review-required"
                : "preview only · free · MDN-style public reference"
              : status === "running"
              ? activeType === "bundle"
                ? `${(elapsedMs / 1000).toFixed(1)}s · step ${stepIdx + 1} of ${steps.length} · ${steps[Math.max(0, Math.min(stepIdx, steps.length - 1))]?.label ?? "starting"}`
                : `${(elapsedMs / 1000).toFixed(1)}s elapsed of ~${(total / 1000).toFixed(0)}s`
              : status === "failed"
              ? "pipeline failed — try another URL or refresh"
              : activeType === "bundle" && realBundle
              ? `generated ${realBundle.slug} · ${(elapsedMs / 1000).toFixed(1)}s · status: ${realBundle.status} · coverage: ${realBundle.coverageScore ?? "—"}`
              : `generated from ${host} · ${(elapsedMs / 1000).toFixed(1)}s`}
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
                      className="text-[10.5px] shrink-0 mt-1.5 tabular-nums"
                      style={{
                        fontFamily: MONO,
                        color: state === "done" ? LIME : state === "active" ? meta.accent : MUTED,
                      }}
                    >
                      {formatStepElapsed(stepTimes[i], state)}
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
              <div className="relative">
                <CodePanel
                  title={`${host}/${
                    activeType === "bundle" ? "design.md" : activeType === "mcp" ? "mcp.json" : `${activeType}.md`
                  }`}
                  language={activeType === "bundle" ? "yaml" : activeType === "mcp" ? "json" : "md"}
                  source={draftSource}
                  onCopyOverride={gated ? () => openAuthModal("/generate") : undefined}
                  rightMeta={
                    <span className="inline-flex items-center gap-1.5" style={{ color: INK }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: PEACH }} />
                      draft · review before shipping
                    </span>
                  }
                />
                {gated ? (
                  // Overlay is positioned to cover only the code body — the
                  // CodePanel header (~42px) and footer (~34px) stay crisp.
                  // backdrop-filter blurs the body text behind this layer
                  // while leaving the chrome untouched.
                  <div
                    className="absolute left-0 right-0 flex items-center justify-center p-6"
                    style={{
                      top: 42,
                      bottom: 34,
                      backdropFilter: "blur(7px)",
                      WebkitBackdropFilter: "blur(7px)",
                      background: "rgba(10, 10, 12, 0.55)",
                      userSelect: "none",
                    }}
                    role="region"
                    aria-label="Sign in to view your draft"
                  >
                    <div
                      className="w-full max-w-[360px] rounded-xl border p-6 text-center shadow-2xl"
                      style={{ background: SURFACE, borderColor: BORDER }}
                    >
                      <span
                        className="inline-flex items-center justify-center h-9 w-9 rounded-full mb-3"
                        style={{ background: SURFACE_2, color: INK, border: `1px solid ${BORDER_SOFT}` }}
                      >
                        <Lock className="h-4 w-4" />
                      </span>
                      <h3
                        className="text-[17px] leading-[1.2] font-medium tracking-[-0.012em]"
                        style={{ color: INK }}
                      >
                        Sign in to view your draft
                      </h3>
                      <p className="mt-2 text-[12.5px] leading-[1.55]" style={{ color: SUB }}>
                        Your {activeType === "mcp" ? "mcp.json" : `${activeType === "bundle" ? "design" : activeType}.md`} for {host} is ready — sign in to view, copy, or submit it.
                      </p>
                      <div className="mt-4 flex flex-col items-stretch gap-2">
                        <button
                          type="button"
                          onClick={() => openAuthModal("/generate")}
                          className="h-9 rounded-full px-4 text-[12.5px] font-medium"
                          style={{ background: INK, color: INK_ON_LIGHT }}
                        >
                          Sign in to continue
                        </button>
                        <a
                          href="/login?returnTo=%2Fgenerate"
                          onClick={(e) => {
                            e.preventDefault();
                            openAuthModal("/generate");
                          }}
                          className="text-[12.5px] underline underline-offset-4"
                          style={{ color: SUB }}
                        >
                          Create an account
                        </a>
                      </div>
                      <p className="mt-3 text-[10.5px]" style={{ color: MUTED, fontFamily: MONO }}>
                        free · no credit card · keeps this draft
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
              <aside
                className="rounded-xl border p-6 flex flex-col gap-5"
                style={{ borderColor: BORDER, background: SURFACE }}
              >
                <div>
                  <SectionLabel n="04" t="What's next" />
                  {activeType === "bundle" && realBundle ? (
                    <p className="mt-3 text-[13px] leading-[1.6]" style={{ color: SUB }}>
                      {realBundle.status === "pending_review"
                        ? "Submitted to the editorial queue automatically. An editor reviews within 48h."
                        : realBundle.status === "published"
                        ? "Already published in the public library."
                        : realBundle.status === "personal"
                        ? "Held as a personal draft — coverage fell below the quality bar for the public queue."
                        : "Draft saved."}
                    </p>
                  ) : (
                    <p className="mt-3 text-[13px] leading-[1.6]" style={{ color: SUB }}>
                      Use the draft yourself right now, or hand it to the editorial desk for inclusion
                      in the public library.
                    </p>
                  )}
                  {activeType === "bundle" && realBundle?.coverageScore !== null && realBundle?.coverageScore !== undefined ? (
                    <div className="mt-3 inline-flex items-center gap-2 text-[11px]" style={{ fontFamily: MONO, color: SUB }}>
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: realBundle.coverageScore >= 70 ? LIME : realBundle.coverageScore >= 40 ? PEACH : MUTED }}
                      />
                      coverage {realBundle.coverageScore} / 100
                    </div>
                  ) : null}
                </div>

                {/* Equal-weight CTAs */}
                <div className="grid grid-cols-1 gap-2.5">
                  <button
                    type="button"
                    onClick={copyDraft}
                    className="h-10 rounded-full px-4 text-[12.5px] font-medium inline-flex items-center justify-center gap-2"
                    style={
                      gated
                        ? {
                            background: SURFACE_2,
                            color: SUB,
                            border: `1px solid ${BORDER}`,
                          }
                        : {
                            background: INK,
                            color: INK_ON_LIGHT,
                            boxShadow: `0 0 0 1px ${meta.accent}55, 0 10px 36px -10px ${meta.accent}88`,
                          }
                    }
                    title={gated ? "Sign in to copy your draft" : undefined}
                  >
                    {gated ? (
                      <>
                        <Lock className="h-3.5 w-3.5" />
                        Sign in to copy
                      </>
                    ) : copied ? (
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
                  {activeType === "bundle" && realBundle ? (
                    realBundle.status === "published" ? (
                      <a
                        href={`/library/${realBundle.slug}`}
                        className="h-10 rounded-full px-4 text-[12.5px] font-medium inline-flex items-center justify-center gap-2"
                        style={{
                          background: INK,
                          color: INK_ON_LIGHT,
                          boxShadow: `0 0 0 1px ${LIME}55, 0 10px 36px -10px ${LIME}88`,
                        }}
                      >
                        <Check className="h-3.5 w-3.5" style={{ color: LIME }} />
                        View in library
                      </a>
                    ) : (
                      <div
                        className="h-10 rounded-full px-4 text-[12.5px] font-medium inline-flex items-center justify-center gap-2"
                        style={{
                          background: `${realBundle.status === "pending_review" ? LIME : PEACH}1A`,
                          border: `1px solid ${realBundle.status === "pending_review" ? LIME : PEACH}66`,
                          color: INK,
                        }}
                      >
                        <Check
                          className="h-3.5 w-3.5"
                          style={{ color: realBundle.status === "pending_review" ? LIME : PEACH }}
                        />
                        {realBundle.status === "pending_review" ? "Sent to editors" : "Held as draft"}
                      </div>
                    )
                  ) : submitState === "submitted" ? (
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
                      style={
                        gated
                          ? {
                              background: SURFACE_2,
                              color: SUB,
                              border: `1px solid ${BORDER}`,
                            }
                          : {
                              background: INK,
                              color: INK_ON_LIGHT,
                              boxShadow: `0 0 0 1px ${VIOLET}55, 0 10px 36px -10px ${VIOLET}88`,
                            }
                      }
                      title={gated ? "Sign in to submit for review" : undefined}
                    >
                      {gated ? (
                        <>
                          <Lock className="h-3.5 w-3.5" />
                          Sign in to submit
                        </>
                      ) : submitState === "submitting" ? (
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

function UploadFields(props: {
  file: File | null;
  preview: string | null;
  onFile: (f: File | null) => void;
  brandName: string;
  onBrandName: (v: string) => void;
  status: "idle" | "running" | "done" | "failed";
  onSubmitButton: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const disabled = props.status === "running";

  const accept = "image/png,image/jpeg,image/webp";

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          if (disabled) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          if (disabled) return;
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) props.onFile(f);
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        aria-label="Upload screenshot"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className="rounded-xl border-2 border-dashed px-6 py-8 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors"
        style={{
          borderColor: dragOver ? INK : BORDER,
          background: dragOver ? SURFACE_2 : SURFACE,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            props.onFile(f);
          }}
          disabled={disabled}
        />
        {props.file && props.preview ? (
          <div className="flex items-center gap-4 w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={props.preview}
              alt={props.file.name}
              className="rounded-md border"
              style={{ borderColor: BORDER, maxHeight: 96, maxWidth: 160, objectFit: "cover" }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] truncate" style={{ color: INK }}>
                {props.file.name}
              </div>
              <div className="text-[10.5px]" style={{ color: MUTED, fontFamily: MONO }}>
                {(props.file.size / 1024).toFixed(0)} KB · {props.file.type}
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                props.onFile(null);
              }}
              className="h-7 w-7 rounded-full inline-flex items-center justify-center"
              style={{ background: SURFACE_2, color: SUB, border: `1px solid ${BORDER}` }}
              aria-label="Remove image"
              disabled={disabled}
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <>
            <span
              className="inline-flex h-9 w-9 rounded-full items-center justify-center"
              style={{ background: SURFACE_2, color: INK, border: `1px solid ${BORDER_SOFT}` }}
            >
              <Upload className="h-4 w-4" />
            </span>
            <div className="text-[13.5px]" style={{ color: INK }}>
              Drop a screenshot or click to browse
            </div>
            <div className="text-[11px]" style={{ color: MUTED, fontFamily: MONO }}>
              PNG, JPEG, WebP · up to 6 MB
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-stretch">
        <input
          type="text"
          value={props.brandName}
          onChange={(e) => props.onBrandName(e.target.value)}
          placeholder="Brand name (e.g. Acme Design)"
          maxLength={120}
          className="flex-1 h-10 rounded-full border px-4 text-[13px] bg-transparent"
          style={{ color: INK, borderColor: BORDER, background: SURFACE }}
          disabled={disabled}
        />
        {props.onSubmitButton}
      </div>
    </div>
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

/** Formats per-step elapsed time. Pending shows nothing, active shows
 * live counter, done shows actual measured duration. */
function formatStepElapsed(
  entry: { startedAt: number; endedAt: number | null } | undefined,
  state: "done" | "active" | "pending",
): string {
  if (state === "pending" || !entry) return "—";
  const end = entry.endedAt ?? Date.now();
  const seconds = (end - entry.startedAt) / 1000;
  return `${seconds.toFixed(1)}s`;
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

export default Generate;
