"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, ShieldCheck, Upload, XCircle } from "lucide-react";
import { SectionLabel } from "@/components/ui/Shell";
import {
  BG,
  BORDER,
  INK,
  INK_ON_LIGHT,
  LIME,
  MONO,
  MUTED,
  PEACH,
  SANS,
  SUB,
  SURFACE,
  SURFACE_2,
} from "@/lib/ui-data/tokens";

// ── URL parsing ──────────────────────────────────────────────────────────────

function parseUrls(text: string): { urls: string[]; invalidCount: number; duplicateCount: number } {
  const lines = text.split("\n");
  const seen = new Set<string>();
  const urls: string[] = [];
  let invalidCount = 0;
  let duplicateCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("|---|")) continue;

    let candidate: string;
    if (trimmed.includes("|")) {
      const match = trimmed.match(/https?:\/\/[^\s|)>\]"]+/g);
      if (!match) continue;
      candidate = match[match.length - 1].replace(/\/$/, "");
    } else {
      candidate = trimmed;
    }

    try {
      const u = new URL(candidate);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        invalidCount++;
        continue;
      }
    } catch {
      invalidCount++;
      continue;
    }

    const key = candidate.replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) {
      duplicateCount++;
      continue;
    }
    seen.add(key);
    urls.push(candidate);
  }

  return { urls, invalidCount, duplicateCount };
}

// ── Types ────────────────────────────────────────────────────────────────────

type SubmitState = "idle" | "submitting" | "polling" | "done" | "forbidden" | "error";

interface EnqueueOutcome {
  url: string;
  status: "enqueued" | "skipped";
  jobId?: string;
  reason?: string;
}

interface SubmitResponse {
  batchId: string | null;
  enqueued: number;
  skipped: Record<string, number>;
  outcomes: EnqueueOutcome[];
  etaSeconds: number;
}

interface JobStatus {
  id: string;
  url: string;
  normalizedUrl: string | null;
  status: "queued" | "running" | "completed" | "failed";
  currentStep: string | null;
  errorMessage: string | null;
  updatedAt: string;
}

interface BatchStatus {
  batchId: string;
  total: number;
  completed: number;
  failed: number;
  running: number;
  queued: number;
  done: boolean;
  jobs: JobStatus[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function stepLabel(job: JobStatus): string {
  if (job.status === "queued") return "waiting";
  if (job.status === "failed") return job.errorMessage?.slice(0, 60) ?? "failed";
  if (job.status === "completed") return job.currentStep ?? "done";
  return job.currentStep ?? "processing";
}

// ── Component ────────────────────────────────────────────────────────────────

export default function BulkUploadPage() {
  const [text, setText] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResponse | null>(null);
  const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { urls, invalidCount, duplicateCount } = parseUrls(text);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(async (batchId: string, manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const res = await fetch(`/api/admin/bulk-upload/status?batchId=${encodeURIComponent(batchId)}`);
      if (!res.ok) return;
      const data = (await res.json()) as BatchStatus;
      setBatchStatus(data);
      if (data.done) {
        stopPolling();
        setSubmitState("done");
      }
    } catch {
      // Ignore transient poll errors
    } finally {
      if (manual) setIsRefreshing(false);
    }
  }, [stopPolling]);

  const startPolling = useCallback((batchId: string) => {
    void pollStatus(batchId);
    pollRef.current = setInterval(() => void pollStatus(batchId), 5000);
  }, [pollStatus]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const onFileChange = useCallback((e: { target: HTMLInputElement & EventTarget }) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setText((ev.target?.result as string) ?? "");
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  const onSubmit = async () => {
    if (urls.length === 0 || submitState === "submitting") return;
    setSubmitState("submitting");
    setErrorMsg(null);
    setSubmitResult(null);
    setBatchStatus(null);

    try {
      const res = await fetch("/api/admin/bulk-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });

      if (res.status === 401 || res.status === 403) {
        setSubmitState("forbidden");
        return;
      }

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setErrorMsg(body?.error ?? `Request failed (${res.status})`);
        setSubmitState("error");
        return;
      }

      const result = body as SubmitResponse;
      setSubmitResult(result);

      if (result.batchId && result.enqueued > 0) {
        setSubmitState("polling");
        startPolling(result.batchId);
      } else {
        setSubmitState("done");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Network error");
      setSubmitState("error");
    }
  };

  if (submitState === "forbidden") {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <ShieldCheck className="h-8 w-8 mx-auto mb-4" style={{ color: PEACH }} />
        <h1 className="text-[28px] font-medium tracking-[-0.018em]">Editor access required</h1>
        <p className="mt-3 text-[14px] leading-[1.6]" style={{ color: SUB }}>
          This page is restricted to verified editors.
        </p>
      </div>
    );
  }

  const isPolling = submitState === "polling";
  const isDone = submitState === "done";
  const showResults = (isPolling || isDone) && submitResult;

  return (
    <div className="mx-auto max-w-4xl px-6 lg:px-8 py-12">
      <div className="mb-8">
        <SectionLabel t="Admin" />
        <h1 className="mt-3 text-[32px] font-medium tracking-[-0.018em]">Bulk upload</h1>
        <p className="mt-2 text-[13px] leading-[1.65]" style={{ color: SUB }}>
          Paste a URL list or a markdown table. Each URL is processed one at a time — the next
          starts 10 s after the previous completes. Bundles scoring ≥ 50 publish automatically;
          lower scores land in the reviewer queue.
        </p>
      </div>

      {/* ── Input card ─────────────────────────────────────────────────────── */}
      <div
        className="rounded-xl border p-6 flex flex-col gap-4"
        style={{ borderColor: BORDER, background: SURFACE }}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <span className="text-[11px] uppercase tracking-[0.22em]" style={{ fontFamily: MONO, color: MUTED }}>
            URL list
          </span>
          <div className="flex items-center gap-3 flex-wrap">
            {urls.length > 0 && (
              <span
                className="text-[11px] px-2.5 py-1 rounded-full border"
                style={{ fontFamily: MONO, color: LIME, borderColor: `${LIME}44` }}
              >
                {urls.length} URL{urls.length !== 1 ? "s" : ""} detected
              </span>
            )}
            {(invalidCount > 0 || duplicateCount > 0) && (
              <span
                className="text-[11px] px-2.5 py-1 rounded-full border"
                style={{ fontFamily: MONO, color: PEACH, borderColor: `${PEACH}44` }}
              >
                {[
                  invalidCount > 0 ? `${invalidCount} invalid` : null,
                  duplicateCount > 0 ? `${duplicateCount} duplicate` : null,
                ].filter(Boolean).join(" · ")}
              </span>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-8 rounded-md border px-3 text-[11.5px] inline-flex items-center gap-1.5"
              style={{ borderColor: BORDER, color: SUB, fontFamily: MONO, background: SURFACE_2 }}
              disabled={submitState === "submitting"}
            >
              <Upload className="h-3.5 w-3.5" />
              Upload .md / .txt
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.txt,.csv"
              className="hidden"
              onChange={onFileChange}
            />
          </div>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder={`Plain list:\nhttps://www.stripe.com\nhttps://linear.app\n\nOR paste a markdown table:\n| 1 | Stripe | https://stripe.com |\n| 2 | Linear | https://linear.app |`}
          className="w-full rounded-lg border px-3 py-3 text-[12px] leading-[1.7] resize-y bg-transparent focus:outline-none"
          style={{ borderColor: BORDER, color: INK, fontFamily: MONO, minHeight: 180 }}
          disabled={submitState === "submitting" || isPolling}
        />

        <div className="flex items-center justify-between gap-4">
          <p className="text-[11px]" style={{ color: MUTED, fontFamily: MONO }}>
            Jobs run one at a time with a 10 s gap.{" "}
            {urls.length > 0 ? `~${Math.ceil((urls.length * 180 + (urls.length - 1) * 10) / 60)} min total` : ""}
          </p>
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={urls.length === 0 || submitState === "submitting" || isPolling}
            className="h-9 rounded-full px-5 text-[12.5px] font-medium inline-flex items-center gap-2 disabled:opacity-50"
            style={{ background: INK, color: INK_ON_LIGHT, fontFamily: SANS }}
          >
            {submitState === "submitting" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Starting…
              </>
            ) : (
              `Queue ${urls.length > 0 ? urls.length : ""} bundle${urls.length !== 1 ? "s" : ""}`
            )}
          </button>
        </div>

        {submitState === "error" && errorMsg && (
          <div
            className="rounded-md border px-3 py-2 text-[11.5px]"
            style={{ borderColor: PEACH, background: `${PEACH}10`, color: INK, fontFamily: MONO }}
          >
            {errorMsg}
          </div>
        )}
      </div>

      {/* ── Skip summary (shown once after submit) ──────────────────────────── */}
      {submitResult && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {(Object.entries(submitResult.skipped) as [string, number][]).map(([k, v]) =>
            v > 0 ? (
              <span
                key={k}
                className="text-[11.5px] px-3 py-1.5 rounded-full border"
                style={{ fontFamily: MONO, color: PEACH, borderColor: `${PEACH}33` }}
              >
                {v} {k.replace(/([A-Z])/g, " $1").toLowerCase()}
              </span>
            ) : null,
          )}
        </div>
      )}

      {/* ── Live status table ───────────────────────────────────────────────── */}
      {showResults && batchStatus && (
        <div className="mt-6 flex flex-col gap-4">
          {/* Progress header */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className="text-[11.5px] px-3 py-1.5 rounded-full border inline-flex items-center gap-1.5"
                style={{ fontFamily: MONO, color: LIME, borderColor: `${LIME}44`, background: `${LIME}0D` }}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {batchStatus.completed} done
              </span>
              {batchStatus.running > 0 && (
                <span
                  className="text-[11.5px] px-3 py-1.5 rounded-full border inline-flex items-center gap-1.5"
                  style={{ fontFamily: MONO, color: INK, borderColor: BORDER, background: SURFACE_2 }}
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  1 processing
                </span>
              )}
              {batchStatus.queued > 0 && (
                <span
                  className="text-[11.5px] px-3 py-1.5 rounded-full border"
                  style={{ fontFamily: MONO, color: SUB, borderColor: BORDER }}
                >
                  {batchStatus.queued} waiting
                </span>
              )}
              {batchStatus.failed > 0 && (
                <span
                  className="text-[11.5px] px-3 py-1.5 rounded-full border inline-flex items-center gap-1.5"
                  style={{ fontFamily: MONO, color: PEACH, borderColor: `${PEACH}33` }}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  {batchStatus.failed} failed
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isDone ? (
                <span className="text-[11px]" style={{ fontFamily: MONO, color: LIME }}>
                  batch complete
                </span>
              ) : (
                <span className="text-[11px] inline-flex items-center gap-1.5" style={{ fontFamily: MONO, color: MUTED }}>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  polling every 5 s
                </span>
              )}
              {batchStatus?.batchId && (
                <button
                  type="button"
                  onClick={() => void pollStatus(batchStatus.batchId, true)}
                  disabled={isRefreshing}
                  className="h-8 rounded-md border px-2.5 text-[11px] inline-flex items-center gap-1.5 disabled:opacity-50"
                  style={{ borderColor: BORDER, color: SUB, fontFamily: MONO, background: SURFACE_2 }}
                >
                  <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
                  refresh
                </button>
              )}
            </div>
          </div>

          {/* Job rows */}
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: BORDER }}>
            <table className="w-full text-[11.5px]" style={{ fontFamily: MONO }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}`, background: SURFACE_2 }}>
                  <th className="text-left px-4 py-3 font-normal" style={{ color: MUTED }}>Site</th>
                  <th className="text-left px-4 py-3 font-normal w-28" style={{ color: MUTED }}>Status</th>
                  <th className="text-left px-4 py-3 font-normal" style={{ color: MUTED }}>Step / info</th>
                </tr>
              </thead>
              <tbody>
                {batchStatus.jobs.map((job, i) => {
                  const isRunning = job.status === "running";
                  const isFailed = job.status === "failed";
                  const isDoneJob = job.status === "completed";
                  const statusColor = isDoneJob ? LIME : isFailed ? PEACH : isRunning ? INK : MUTED;

                  return (
                    <tr
                      key={job.id}
                      style={{
                        borderBottom: i < batchStatus.jobs.length - 1 ? `1px solid ${BORDER}` : undefined,
                        background: isRunning ? SURFACE_2 : BG,
                      }}
                    >
                      <td className="px-4 py-2.5" style={{ color: isRunning ? INK : SUB }}>
                        {domainOf(job.url)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1.5" style={{ color: statusColor }}>
                          {isRunning ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : isDoneJob ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : isFailed ? (
                            <XCircle className="h-3 w-3" />
                          ) : (
                            <span className="h-1.5 w-1.5 rounded-full inline-block" style={{ background: MUTED }} />
                          )}
                          {job.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 max-w-xs truncate" style={{ color: MUTED }}>
                        {stepLabel(job)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
