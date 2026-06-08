"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Check, ChevronDown, Copy, Globe, Image as ImageIcon, Loader2, Lock, RefreshCw, Send, ShieldCheck, Upload, X as XIcon } from "lucide-react";
import { SectionLabel } from "@/components/ui/Shell";
import { saveActiveGenJob, clearActiveGenJob, readStoredJob } from "@/hooks/useActiveGenJob";
import { CodePanel } from "@/components/ui/CodePanel";
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
import { TYPE_META } from "@/lib/ui-data/items";
import { openAuthModal } from "@/lib/ui-data/mockAuth";
import {
  compressImageForUpload,
  formatBytes,
  MAX_RAW_BYTES,
  MAX_UPLOAD_BYTES,
} from "@/lib/image/compress";

type Status = "idle" | "running" | "done" | "failed";
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
  /**
   * Backend `currentStep` values that mark this phase as active. A phase
   * is `active` when the polled `currentStep` is in this list, `done`
   * when stepIdx has advanced past it.
   */
  steps?: string[];
};

/**
 * Bundle pipeline phases (URL mode). 4 visible phases that each group
 * one or more backend `currentStep` values from
 * `lib/generator/scrape-and-extract.ts`. Each phase contains at least
 * one slow operation (Firecrawl, Gemini, or Sonnet) so the elapsed
 * timer always shows meaningful real time — never "0.0s".
 */
const BUNDLE_STEPS_URL: PipelineStep[] = [
  {
    id: "collect",
    label: "Page collection",
    tool: "Firecrawl",
    detail: "Crawl + screenshot + computed-style parse",
    durationMs: 10000,
    steps: ["scraping", "parsing-computed"],
  },
  {
    id: "extract",
    label: "Brand extraction",
    tool: "Gemini 3.1 Flash-Lite",
    detail: "Multi-modal token extraction + token wiring",
    durationMs: 13000,
    steps: ["extracting", "resolving-orphans"],
  },
  {
    id: "author",
    label: "Design.md authored",
    tool: "Gemini 3.1 Flash-Lite",
    detail: "Direct Gemini 3.1 Flash-Lite · write canonical DESIGN.md",
    durationMs: 19000,
    steps: ["persisting", "writing-design-md"],
  },
  {
    id: "validate",
    label: "Validate & score",
    tool: "@google/design.md",
    detail: "Lint, WCAG check, coverage scoring",
    durationMs: 2000,
    steps: ["linting", "scoring"],
  },
];

/** Upload variant — same 4-phase shape, image-only first phase. */
const BUNDLE_STEPS_UPLOAD: PipelineStep[] = [
  {
    id: "process",
    label: "Image processing",
    tool: "Decode + validate",
    detail: "SHA-256, mime check, base64 ready for Gemini",
    durationMs: 1500,
    steps: ["processing-image"],
  },
  {
    id: "extract",
    label: "Brand extraction",
    tool: "Gemini 3.1 Flash-Lite",
    detail: "Vision-only token extraction + token wiring",
    durationMs: 15000,
    steps: ["extracting", "resolving-orphans"],
  },
  {
    id: "author",
    label: "Design.md authored",
    tool: "Gemini 3.1 Flash-Lite",
    detail: "Direct Gemini 3.1 Flash-Lite · write canonical DESIGN.md",
    durationMs: 19000,
    steps: ["persisting", "writing-design-md"],
  },
  {
    id: "validate",
    label: "Validate & score",
    tool: "@google/design.md",
    detail: "Lint, WCAG check, coverage scoring",
    durationMs: 2000,
    steps: ["linting", "scoring"],
  },
];

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
  const _router = useRouter();
  const navigate = (path: string) => _router.push(path);
  const search = useSearchParams().toString();
  const prefillUrl = useMemo(() => {
    const raw = new URLSearchParams(search).get("url");
    if (!raw) return "";
    // Reject obviously-invalid prefills so a bad inbound link doesn't
    // wedge the input. /generate's own validation surfaces detail.
    if (raw.length > 2000) return "";
    return raw;
  }, [search]);
  const [url, setUrl] = useState(prefillUrl);
  const [status, setStatus] = useState<Status>("idle");
  const [stepIdx, setStepIdx] = useState(-1);
  const [palette, setPalette] = useState<string[]>([]);
  const [validation, setValidation] = useState<string | null>(null);
  const timersRef = useRef<number[]>([]);
  // Real-pipeline state (bundle type only)
  const [jobId, setJobId] = useState<string | null>(null);
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
  // Source mode: 'url' uses the scrape pipeline; 'upload' takes a screenshot.
  const [bundleMode, setBundleMode] = useState<"url" | "upload">("url");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [brandName, setBrandName] = useState("");
  // Browser-side image prep: we downscale + re-encode large screenshots
  // before upload so they clear Vercel's ~4.5 MB request-body cap.
  const [preparing, setPreparing] = useState(false);
  const [origBytes, setOrigBytes] = useState<number | null>(null);

  // On mount, check if there's an active generation job from a previous
  // page visit and reconnect to it so the user doesn't lose progress.
  useEffect(() => {
    const stored = readStoredJob();
    if (!stored) return;
    setUrl(stored.url);
    setJobId(stored.jobId);
    setStatus("running");
    setStepIdx(0);
    pollJob(stored.jobId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Steps for the visual pipeline — URL vs upload variant.
  const steps = useMemo(
    () => (bundleMode === "upload" ? BUNDLE_STEPS_UPLOAD : BUNDLE_STEPS_URL),
    [bundleMode],
  );
  const meta = TYPE_META.bundle;
  const bundleSteps = steps;

  const host = (() => {
    try {
      if (!url) return "";
      const u = url.startsWith("http") ? url : `https://${url}`;
      return new URL(u).hostname.replace(/^www\./, "");
    } catch {
      return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    }
  })();

  // Handle a picked/dropped file: validate, then downscale + re-encode in
  // the browser so big screenshots clear the platform body-size cap. Falls
  // back to the raw file if compression isn't possible; the server guard is
  // the backstop. Async, with a "preparing" state to gate submit.
  async function handlePickFile(raw: File | null) {
    setValidation(null);
    if (uploadPreview) URL.revokeObjectURL(uploadPreview);
    if (!raw) {
      setUploadFile(null);
      setUploadPreview(null);
      setOrigBytes(null);
      return;
    }
    if (!raw.type.startsWith("image/")) {
      setValidation("That file isn't an image. Use a PNG, JPEG, or WebP screenshot.");
      return;
    }
    if (raw.size > MAX_RAW_BYTES) {
      setValidation(
        `That image is ${formatBytes(raw.size)} — please use one under ${formatBytes(MAX_RAW_BYTES)}.`,
      );
      return;
    }

    setPreparing(true);
    setOrigBytes(raw.size);
    setUploadFile(null);
    setUploadPreview(null);
    try {
      const result = await compressImageForUpload(raw);
      setUploadFile(result.file);
      setUploadPreview(URL.createObjectURL(result.file));
      if (result.file.size > MAX_UPLOAD_BYTES) {
        setValidation(
          "This screenshot is still too large after optimizing. Try cropping it or uploading a smaller capture.",
        );
      }
    } catch {
      setUploadFile(raw);
      setUploadPreview(URL.createObjectURL(raw));
    } finally {
      setPreparing(false);
    }
  }

  function start() {
    setValidation(null);

    // No auth gate — anonymous users can generate. Sign-in is now an
    // upsell for upcoming history/favorites features, surfaced in the
    // header rather than blocking the generator.

    // ─── Upload mode ──────────────────────────────────────
    if (bundleMode === "upload") {
      if (preparing) {
        setValidation("Hang on — still optimizing the image.");
        return;
      }
      if (!uploadFile) {
        setValidation("Pick a screenshot to upload.");
        return;
      }
      if (!brandName.trim()) {
        setValidation("Give the brand a name so we can title the design skill.");
        return;
      }
      clearTimers();
      stopPolling();
      setStatus("running");
      setStepIdx(0);
      setPalette([]);
      setExistingSlug(null);
      setErrorMsg(null);
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

    clearTimers();
    stopPolling();
    setStatus("running");
    setStepIdx(0);
    setPalette([]);
    setExistingSlug(null);
    setErrorMsg(null);

    void startBundleJob(parsedUrl.toString());
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
      if (res.status === 429) {
        const body = await res.json().catch(() => ({} as Record<string, unknown>));
        setErrorMsg(
          typeof body.message === "string"
            ? body.message
            : "You've hit the generation rate limit. Try again later.",
        );
        setStatus("failed");
        // Anonymous visitors get one free generation — open the sign-in wall.
        if (body.tier === "anonymous") {
          openAuthModal(
            "/generate",
            "You've used your free generation. Sign in to keep generating.",
          );
        }
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        setErrorMsg(body.error || `Failed to start (${res.status})`);
        setStatus("failed");
        return;
      }
      const body = (await res.json()) as { jobId: string; currentStep: string | null };
      saveActiveGenJob(body.jobId, submitUrl);
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
      if (res.status === 429) {
        const body = await res.json().catch(() => ({} as Record<string, unknown>));
        setErrorMsg(
          typeof body.message === "string"
            ? body.message
            : "You've hit the generation rate limit. Try again later.",
        );
        setStatus("failed");
        // Anonymous visitors get one free generation — open the sign-in wall.
        if (body.tier === "anonymous") {
          openAuthModal(
            "/generate",
            "You've used your free generation. Sign in to keep generating.",
          );
        }
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        setErrorMsg(body.error || `Failed to start (${res.status})`);
        setStatus("failed");
        return;
      }
      const body = (await res.json()) as { jobId: string };
      saveActiveGenJob(body.jobId, `upload:${name}`);
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
          clearActiveGenJob();
          setStatus("done");
          // Redirect straight to the bundle's library detail page. The
          // library page loads its own data and handles all statuses
          // (pending_review, personal, published) with the appropriate
          // banner. Brief delay lets the user see the "Done" state.
          if (job.resultBundleSlug) {
            const slug = job.resultBundleSlug;
            window.setTimeout(() => {
              navigate(`/library/${slug}`);
            }, 600);
          }
          return;
        }
        if (job.status === "failed") {
          clearActiveGenJob();
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
    // Each phase declares which backend step IDs it owns via `steps[]`.
    // Find the phase whose list contains the currently-active backend step.
    const idx = bundleSteps.findIndex((phase) =>
      phase.steps ? phase.steps.includes(step) : phase.id === step,
    );
    if (idx >= 0) setStepIdx(idx);
  }


  function reset() {
    clearTimers();
    stopPolling();
    clearActiveGenJob();
    setStatus("idle");
    setStepIdx(-1);
    setPalette([]);
    setValidation(null);
    setJobId(null);
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

  return (
    <>
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-3xl px-6 lg:px-8 pt-20 pb-12 text-center">
          <SectionLabel n="01" t="From any URL" />
          <h1 className="mt-5 text-[44px] sm:text-[56px] leading-[1.02] font-medium tracking-[-0.022em]">
            Paste any URL —
            <br />
            <span style={{ color: SUB }}>get a design.md in seconds.</span>
          </h1>
          <p className="mt-6 text-[15px] leading-[1.65] max-w-[34rem] mx-auto" style={{ color: SUB }}>
            Point us at a brand site, or upload a screenshot. We extract the palette, type, and
            components, write a canonical design.md spec, and pair it with a companion prompt your
            AI tool can follow.
          </p>

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

          <form
            className={
              bundleMode === "upload"
                ? "mt-5 mx-auto max-w-2xl flex flex-col gap-3"
                : "mt-10 mx-auto max-w-2xl flex items-center gap-2 rounded-full border p-1.5"
            }
            style={
              bundleMode === "upload"
                ? undefined
                : { borderColor: BORDER, background: SURFACE }
            }
            onSubmit={(e) => {
              e.preventDefault();
              start();
            }}
          >
            {bundleMode === "upload" ? (
              <UploadFields
                file={uploadFile}
                preview={uploadPreview}
                onFile={handlePickFile}
                preparing={preparing}
                originalBytes={origBytes}
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
                      disabled={!uploadFile || !brandName.trim() || preparing}
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
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setValidation(null);
                  }}
                  placeholder="linear.app  ·  stripe.com  ·  vercel.com"
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

          {validation ? (
            <div
              className="mt-4 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-[11.5px]"
              style={{ borderColor: PEACH, background: `${PEACH}10`, color: INK, fontFamily: MONO }}
            >
              {validation}
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
              already a design skill —
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
              ? "real pipeline · free · review-required"
              : status === "running"
              ? `${(elapsedMs / 1000).toFixed(1)}s · step ${stepIdx + 1} of ${steps.length} · ${steps[Math.max(0, Math.min(stepIdx, steps.length - 1))]?.label ?? "starting"}`
              : status === "failed"
              ? "pipeline failed — try another URL or refresh"
              : `done · ${(elapsedMs / 1000).toFixed(1)}s · opening design skill…`}
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
                detected palette
              </div>
              {palette.length === 0 ? (
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

      </section>

    </>
  );
}

function UploadFields(props: {
  file: File | null;
  preview: string | null;
  onFile: (f: File | null) => void;
  preparing: boolean;
  originalBytes: number | null;
  brandName: string;
  onBrandName: (v: string) => void;
  status: "idle" | "running" | "done" | "failed";
  onSubmitButton: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const disabled = props.status === "running" || props.preparing;

  const accept = "image/png,image/jpeg,image/webp";

  // Show "12.4 MB → 0.8 MB" when we shrank the file, else just the size.
  const sizeLabel =
    props.file && props.originalBytes && props.originalBytes !== props.file.size
      ? `${formatBytes(props.originalBytes)} → ${formatBytes(props.file.size)}`
      : props.file
        ? formatBytes(props.file.size)
        : "";

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
        {props.preparing ? (
          <div className="flex items-center gap-3 py-2" style={{ color: SUB }}>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-[12.5px]">Optimizing screenshot…</span>
          </div>
        ) : props.file && props.preview ? (
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
                {sizeLabel} · {props.file.type}
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
              PNG, JPEG, WebP — big screenshots are auto-optimized
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

export default Generate;
