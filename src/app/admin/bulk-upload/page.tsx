"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  RotateCw,
  ShieldCheck,
  Trash2,
  Unplug,
  Upload,
  XCircle,
} from "lucide-react";
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
  VIOLET,
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
  bundleSlug: string | null;
  bundleStatus: string | null;
  bundleTitle: string | null;
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

interface ActiveBatch {
  batchId: string;
  createdAt: string;
  total: number;
  completed: number;
  failed: number;
  running: number;
  queued: number;
  firstUrl: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function stepLabel(job: JobStatus): string {
  if (job.status === "queued") return "waiting";
  if (job.status === "failed") return job.errorMessage?.slice(0, 80) ?? "failed";
  if (job.status === "completed") {
    if (job.bundleStatus === "published") return "published";
    if (job.bundleStatus === "pending_review") return "held for review";
    return job.bundleStatus ?? "completed";
  }
  return job.currentStep ?? "processing";
}

const STEP_LABELS: Record<string, string> = {
  scraping: 'crawling',
  'parsing-computed': 'parsing styles',
  extracting: 'extracting brand',
  'resolving-orphans': 'wiring tokens',
  persisting: 'saving draft',
  'writing-design-md': 'writing design.md',
  linting: 'linting',
  scoring: 'scoring',
  'processing-image': 'processing image',
  'writing-companion': 'writing companion',
};

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function outcomeAccent(job: JobStatus): string {
  if (job.status === "failed") return PEACH;
  if (job.status === "completed") {
    if (job.bundleStatus === "published") return LIME;
    if (job.bundleStatus === "pending_review") return PEACH;
    return MUTED;
  }
  if (job.status === "running") return VIOLET;
  return "transparent";
}

// ── Component ────────────────────────────────────────────────────────────────

export default function BulkUploadPage() {
  return (
    <Suspense>
      <BulkUploadPageInner />
    </Suspense>
  );
}

function BulkUploadPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const batchIdFromUrl = searchParams?.get("batch") ?? null;

  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResponse | null>(null);
  const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null);
  const [activeBatches, setActiveBatches] = useState<ActiveBatch[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const confirmDeleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { urls, invalidCount, duplicateCount } = parseUrls(text);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(
    async (batchId: string, manual = false) => {
      if (manual) setIsRefreshing(true);
      try {
        const res = await fetch(`/api/admin/bulk-upload/status?batchId=${encodeURIComponent(batchId)}`);
        if (res.status === 401 || res.status === 403) {
          setForbidden(true);
          stopPolling();
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as BatchStatus;
        setBatchStatus(data);
        if (data.done) stopPolling();
      } catch {
        // Ignore transient poll errors
      } finally {
        if (manual) setIsRefreshing(false);
      }
    },
    [stopPolling],
  );

  const startPolling = useCallback(
    (batchId: string) => {
      stopPolling();
      void pollStatus(batchId);
      pollRef.current = setInterval(() => void pollStatus(batchId), 5000);
    },
    [pollStatus, stopPolling],
  );

  const loadActiveBatches = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/bulk-upload/batches");
      if (res.status === 401 || res.status === 403) {
        setForbidden(true);
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as { batches: ActiveBatch[] };
      setActiveBatches(data.batches);
    } catch {
      // Silent — non-critical
    }
  }, []);

  // On mount: fetch active batches; if URL has ?batch=<id>, resume polling
  useEffect(() => {
    void loadActiveBatches();
  }, [loadActiveBatches]);

  useEffect(() => {
    if (batchIdFromUrl) {
      startPolling(batchIdFromUrl);
    } else {
      stopPolling();
      setBatchStatus(null);
    }
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchIdFromUrl]);

  const onFileChange = useCallback((e: { target: HTMLInputElement & EventTarget }) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setText((ev.target?.result as string) ?? "");
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  const onSubmit = async () => {
    if (urls.length === 0 || submitting) return;
    setSubmitting(true);
    setErrorMsg(null);
    setSubmitResult(null);

    try {
      const res = await fetch("/api/admin/bulk-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });

      if (res.status === 401 || res.status === 403) {
        setForbidden(true);
        return;
      }

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setErrorMsg(body?.error ?? `Request failed (${res.status})`);
        return;
      }

      const result = body as SubmitResponse;
      setSubmitResult(result);

      if (result.batchId && result.enqueued > 0) {
        router.replace(`/admin/bulk-upload?batch=${result.batchId}`, { scroll: false });
        void loadActiveBatches();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const backToList = () => {
    router.replace("/admin/bulk-upload", { scroll: false });
    setBatchStatus(null);
    void loadActiveBatches();
  };

  const cancelBatch = async (batchId: string) => {
    setConfirmDelete(null);
    if (confirmDeleteTimerRef.current) clearTimeout(confirmDeleteTimerRef.current);
    await fetch(`/api/admin/bulk-upload/${batchId}/cancel`, { method: 'POST' });
    if (batchIdFromUrl === batchId) backToList();
    else await loadActiveBatches();
  };

  const requestConfirmDelete = (batchId: string) => {
    if (confirmDeleteTimerRef.current) clearTimeout(confirmDeleteTimerRef.current);
    setConfirmDelete(batchId);
    confirmDeleteTimerRef.current = setTimeout(() => setConfirmDelete(null), 3000);
  };

  if (forbidden) {
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

  // ── Detail view: viewing a specific batch ────────────────────────────────
  if (batchIdFromUrl && batchStatus) {
    return (
      <div className="mx-auto max-w-5xl px-6 lg:px-8 py-12">
        <button
          type="button"
          onClick={backToList}
          className="text-[12px] inline-flex items-center gap-1.5 mb-4"
          style={{ color: SUB, fontFamily: MONO }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          back to bulk upload
        </button>

        <div className="mb-6">
          <SectionLabel t="Batch status" />
          <h1 className="mt-3 text-[28px] font-medium tracking-[-0.018em]">
            {batchStatus.completed + batchStatus.failed}/{batchStatus.total} processed
          </h1>
          <p className="mt-1 text-[11.5px]" style={{ color: MUTED, fontFamily: MONO }}>
            batch {batchIdFromUrl.slice(0, 8)}…
          </p>
        </div>

        <BatchStatusView
          batchStatus={batchStatus}
          isRefreshing={isRefreshing}
          onRefresh={() => void pollStatus(batchIdFromUrl, true)}
          onCancel={() => cancelBatch(batchIdFromUrl)}
        />
      </div>
    );
  }

  // ── List view: input + active batches panel ──────────────────────────────
  return (
    <div className="mx-auto max-w-4xl px-6 lg:px-8 py-12">
      <div className="mb-8">
        <SectionLabel t="Admin" />
        <h1 className="mt-3 text-[32px] font-medium tracking-[-0.018em]">Bulk upload</h1>
        <p className="mt-2 text-[13px] leading-[1.65]" style={{ color: SUB }}>
          Paste a URL list or a markdown table. URLs run one at a time with a 10 s gap. Bundles
          scoring ≥ 50 publish automatically; lower scores land in the reviewer queue.
        </p>
      </div>

      {/* ── Active batches panel ──────────────────────────────────────────── */}
      {activeBatches.length > 0 && (
        <div className="mb-6">
          <div
            className="flex items-center justify-between mb-3"
          >
            <span
              className="text-[10.5px] uppercase tracking-[0.22em]"
              style={{ color: MUTED, fontFamily: MONO }}
            >
              Active batches · {activeBatches.length}
            </span>
            <button
              type="button"
              onClick={() => void loadActiveBatches()}
              className="text-[11px] inline-flex items-center gap-1.5"
              style={{ color: SUB, fontFamily: MONO }}
            >
              <RefreshCw className="h-3 w-3" /> refresh
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {activeBatches.map((b) => (
              <button
                key={b.batchId}
                type="button"
                onClick={() => router.replace(`/admin/bulk-upload?batch=${b.batchId}`, { scroll: false })}
                className="rounded-lg border px-4 py-3 text-left transition-colors hover:bg-[#15151A]"
                style={{ borderColor: BORDER, background: SURFACE }}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] truncate" style={{ color: INK }}>
                        {domainOf(b.firstUrl)}
                        {b.total > 1 ? (
                          <span style={{ color: MUTED, fontFamily: MONO }}> + {b.total - 1} more</span>
                        ) : null}
                      </span>
                    </div>
                    <span className="text-[10.5px]" style={{ color: MUTED, fontFamily: MONO }}>
                      started {relativeTime(b.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap" style={{ fontFamily: MONO }}>
                    <span
                      className="text-[10.5px] px-2 py-1 rounded-full border inline-flex items-center gap-1"
                      style={{ color: LIME, borderColor: `${LIME}44` }}
                    >
                      <CheckCircle2 className="h-3 w-3" /> {b.completed}
                    </span>
                    {b.running > 0 && (
                      <span
                        className="text-[10.5px] px-2 py-1 rounded-full border inline-flex items-center gap-1"
                        style={{ color: VIOLET, borderColor: `${VIOLET}44` }}
                      >
                        <Loader2 className="h-3 w-3 animate-spin" /> {b.running}
                      </span>
                    )}
                    {b.queued > 0 && (
                      <span
                        className="text-[10.5px] px-2 py-1 rounded-full border"
                        style={{ color: SUB, borderColor: BORDER }}
                      >
                        {b.queued} waiting
                      </span>
                    )}
                    {b.failed > 0 && (
                      <span
                        className="text-[10.5px] px-2 py-1 rounded-full border inline-flex items-center gap-1"
                        style={{ color: PEACH, borderColor: `${PEACH}44` }}
                      >
                        <XCircle className="h-3 w-3" /> {b.failed}
                      </span>
                    )}
                    <span className="text-[10.5px]" style={{ color: SUB }}>view →</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirmDelete === b.batchId) void cancelBatch(b.batchId);
                        else requestConfirmDelete(b.batchId);
                      }}
                      title="Cancel remaining jobs in this batch"
                      className="h-6 rounded px-1.5 text-[10.5px] inline-flex items-center gap-1 border transition-colors"
                      style={
                        confirmDelete === b.batchId
                          ? { color: PEACH, borderColor: `${PEACH}55`, background: `${PEACH}15`, fontFamily: MONO }
                          : { color: MUTED, borderColor: 'transparent', background: 'transparent', fontFamily: MONO }
                      }
                    >
                      <Trash2 className="h-3 w-3" />
                      {confirmDelete === b.batchId ? 'sure?' : ''}
                    </button>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Input card ──────────────────────────────────────────────────── */}
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
              disabled={submitting}
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
          disabled={submitting}
        />

        <div className="flex items-center justify-between gap-4">
          <p className="text-[11px]" style={{ color: MUTED, fontFamily: MONO }}>
            Jobs run one at a time with a 10 s gap.{" "}
            {urls.length > 0 ? `~${Math.ceil((urls.length * 180 + (urls.length - 1) * 10) / 60)} min total` : ""}
          </p>
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={urls.length === 0 || submitting}
            className="h-9 rounded-full px-5 text-[12.5px] font-medium inline-flex items-center gap-2 disabled:opacity-50"
            style={{ background: INK, color: INK_ON_LIGHT, fontFamily: SANS }}
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Starting…
              </>
            ) : (
              `Queue ${urls.length > 0 ? urls.length : ""} bundle${urls.length !== 1 ? "s" : ""}`
            )}
          </button>
        </div>

        {errorMsg && (
          <div
            className="rounded-md border px-3 py-2 text-[11.5px]"
            style={{ borderColor: PEACH, background: `${PEACH}10`, color: INK, fontFamily: MONO }}
          >
            {errorMsg}
          </div>
        )}
      </div>

      {/* Skip summary after submit (when we don't yet have batch status) */}
      {submitResult && !batchIdFromUrl && (
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
    </div>
  );
}

// ── Batch status detail view ─────────────────────────────────────────────────

function BatchStatusView({
  batchStatus,
  isRefreshing,
  onRefresh,
  onCancel,
}: {
  batchStatus: BatchStatus;
  isRefreshing: boolean;
  onRefresh: () => void;
  onCancel?: () => Promise<void>;
}) {
  const isDone = batchStatus.done;
  const [rerunningIds, setRerunningIds] = useState<Set<string>>(new Set());
  const [isUnsticking, setIsUnsticking] = useState(false);
  const [isRetryingFailed, setIsRetryingFailed] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const confirmCancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const jobStartedAt = useRef<Map<string, number>>(new Map());
  const [, setTick] = useState(0);

  // Track client-side start time for each running job (for the live timer).
  // Falls back to Date.now() on first observation so the timer starts
  // counting from when we first see the job as running, not from creation.
  useEffect(() => {
    batchStatus.jobs.forEach((job) => {
      if (job.status === 'running' && !jobStartedAt.current.has(job.id)) {
        jobStartedAt.current.set(job.id, Date.now());
      } else if (job.status !== 'running') {
        jobStartedAt.current.delete(job.id);
      }
    });
  }, [batchStatus.jobs]);

  // 250ms tick to keep the elapsed timer smooth while a job is running.
  useEffect(() => {
    if (batchStatus.running === 0) return;
    const t = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [batchStatus.running]);

  // Show "unstick" affordance only when at least one running job has gone
  // stale (>12min since last update). Workers now have a 290s watchdog on
  // Vercel Pro, so anything under 12 min could still be a healthy run.
  const STALE_THRESHOLD_MS = 12 * 60 * 1000;
  const now = Date.now();
  const hasStuckRunning = batchStatus.jobs.some(
    (j) =>
      j.status === 'running' &&
      now - new Date(j.updatedAt).getTime() > STALE_THRESHOLD_MS,
  );

  async function handleRerun(job: JobStatus) {
    if (!job.bundleSlug) return;
    setRerunningIds((prev) => new Set(prev).add(job.id));
    try {
      await fetch(`/api/admin/bundles/${job.bundleSlug}/rerun-pipeline`, { method: 'POST' });
      onRefresh();
    } finally {
      setRerunningIds((prev) => { const s = new Set(prev); s.delete(job.id); return s; });
    }
  }

  async function handleUnstick() {
    setIsUnsticking(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/admin/bulk-upload/${batchStatus.batchId}/unstick`, {
        method: 'POST',
      });
      const data = (await res.json()) as { unstuck: number; advanced: boolean };
      if (data.unstuck === 0) {
        setActionMessage('No stuck jobs found.');
      } else {
        setActionMessage(
          `Unstuck ${data.unstuck} job${data.unstuck === 1 ? '' : 's'}${data.advanced ? ' · next URL kicked' : ''}.`,
        );
      }
      onRefresh();
    } catch (err) {
      setActionMessage(`Unstick failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsUnsticking(false);
    }
  }

  async function handleRetryFailed() {
    setIsRetryingFailed(true);
    setActionMessage(null);
    try {
      const res = await fetch(
        `/api/admin/bulk-upload/${batchStatus.batchId}/retry-failed`,
        { method: 'POST' },
      );
      const data = (await res.json()) as {
        retried: number;
        enqueuedFirst: string | null;
        inFlight: boolean;
      };
      if (data.retried === 0) {
        setActionMessage('No failed jobs to retry.');
      } else {
        setActionMessage(
          `Re-queued ${data.retried} job${data.retried === 1 ? '' : 's'}${data.enqueuedFirst ? ' · first one kicked' : data.inFlight ? ' · waiting for in-flight job to finish' : ''}.`,
        );
      }
      onRefresh();
    } catch (err) {
      setActionMessage(`Retry failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsRetryingFailed(false);
    }
  }

  function requestConfirmCancel() {
    if (confirmCancelTimerRef.current) clearTimeout(confirmCancelTimerRef.current);
    setConfirmCancel(true);
    confirmCancelTimerRef.current = setTimeout(() => setConfirmCancel(false), 3000);
  }

  async function handleCancel() {
    if (!onCancel) return;
    setIsCancelling(true);
    setConfirmCancel(false);
    if (confirmCancelTimerRef.current) clearTimeout(confirmCancelTimerRef.current);
    try {
      await onCancel();
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Progress header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
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
        <div className="flex items-center gap-2 flex-wrap">
          {isDone ? (
            <span className="text-[11px]" style={{ fontFamily: MONO, color: LIME }}>
              batch complete
            </span>
          ) : null}
          {hasStuckRunning && (
            <button
              type="button"
              onClick={() => void handleUnstick()}
              disabled={isUnsticking}
              title="Force-fail running jobs stale >5min and kick the next URL"
              className="h-8 rounded-md border px-2.5 text-[11px] inline-flex items-center gap-1.5 disabled:opacity-50"
              style={{ borderColor: `${PEACH}55`, color: PEACH, fontFamily: MONO, background: `${PEACH}0D` }}
            >
              {isUnsticking ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Unplug className="h-3 w-3" />
              )}
              unstick
            </button>
          )}
          {batchStatus.failed > 0 && (
            <button
              type="button"
              onClick={() => void handleRetryFailed()}
              disabled={isRetryingFailed}
              title="Re-queue all failed jobs and resume processing"
              className="h-8 rounded-md border px-2.5 text-[11px] inline-flex items-center gap-1.5 disabled:opacity-50"
              style={{ borderColor: BORDER, color: SUB, fontFamily: MONO, background: SURFACE_2 }}
            >
              {isRetryingFailed ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RotateCw className="h-3 w-3" />
              )}
              retry failed
            </button>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-8 rounded-md border px-2.5 text-[11px] inline-flex items-center gap-1.5 disabled:opacity-50"
            style={{ borderColor: BORDER, color: SUB, fontFamily: MONO, background: SURFACE_2 }}
          >
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
            refresh
          </button>
          {!isDone && onCancel && (
            <button
              type="button"
              onClick={() => {
                if (confirmCancel) void handleCancel();
                else requestConfirmCancel();
              }}
              disabled={isCancelling}
              title="Cancel all remaining queued/running jobs"
              className="h-8 rounded-md border px-2.5 text-[11px] inline-flex items-center gap-1.5 disabled:opacity-50"
              style={
                confirmCancel
                  ? { borderColor: `${PEACH}55`, color: PEACH, fontFamily: MONO, background: `${PEACH}0D` }
                  : { borderColor: BORDER, color: MUTED, fontFamily: MONO, background: SURFACE_2 }
              }
            >
              {isCancelling ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
              {confirmCancel ? 'sure? cancel' : 'cancel batch'}
            </button>
          )}
        </div>
      </div>

      {actionMessage && (
        <div
          className="text-[11px] px-3 py-2 rounded-md border"
          style={{ fontFamily: MONO, color: SUB, borderColor: BORDER, background: SURFACE_2 }}
        >
          {actionMessage}
        </div>
      )}

      {/* Job rows */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: BORDER }}>
        <table className="w-full text-[11.5px]" style={{ fontFamily: MONO }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}`, background: SURFACE_2 }}>
              <th className="text-left px-4 py-3 font-normal" style={{ color: MUTED }}>Site</th>
              <th className="text-left px-4 py-3 font-normal w-32" style={{ color: MUTED }}>Status</th>
              <th className="text-left px-4 py-3 font-normal" style={{ color: MUTED }}>Outcome / step</th>
              <th className="text-left px-4 py-3 font-normal w-24" style={{ color: MUTED }}></th>
            </tr>
          </thead>
          <tbody>
            {batchStatus.jobs.map((job, i) => {
              const isRunning = job.status === "running";
              const isFailed = job.status === "failed";
              const isCompleted = job.status === "completed";
              const accent = outcomeAccent(job);
              const isPublished = isCompleted && job.bundleStatus === "published";
              const isHeld = isCompleted && job.bundleStatus === "pending_review";

              return (
                <tr
                  key={job.id}
                  style={{
                    borderBottom: i < batchStatus.jobs.length - 1 ? `1px solid ${BORDER}` : undefined,
                    background: isRunning ? SURFACE_2 : BG,
                    borderLeft: `3px solid ${accent}`,
                  }}
                >
                  <td className="px-4 py-2.5 truncate max-w-[260px]" style={{ color: isRunning ? INK : SUB }}>
                    {domainOf(job.url)}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge job={job} />
                  </td>
                  <td className="px-4 py-2.5 max-w-md truncate">
                    {isRunning ? (
                      <span className="inline-flex items-center gap-1">
                        <span style={{ color: VIOLET }}>
                          {STEP_LABELS[job.currentStep ?? ''] ?? job.currentStep ?? 'processing'}
                        </span>
                        <span style={{ color: MUTED }}>
                          {' · '}
                          {formatElapsed(Date.now() - (jobStartedAt.current.get(job.id) ?? Date.now()))}
                        </span>
                      </span>
                    ) : (
                      <span style={{ color: MUTED }}>{stepLabel(job)}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {isPublished && job.bundleSlug ? (
                      <Link
                        href={`/b/${job.bundleSlug}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-[11px]"
                        style={{ color: LIME }}
                      >
                        view <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : isHeld ? (
                      <div className="inline-flex items-center gap-2.5">
                        <Link
                          href="/admin/queue"
                          className="inline-flex items-center gap-1 text-[11px]"
                          style={{ color: PEACH }}
                        >
                          review <ExternalLink className="h-3 w-3" />
                        </Link>
                        {job.bundleSlug && (
                          <button
                            type="button"
                            onClick={() => void handleRerun(job)}
                            disabled={rerunningIds.has(job.id)}
                            className="inline-flex items-center gap-1 text-[11px] disabled:opacity-50"
                            style={{ color: VIOLET }}
                          >
                            {rerunningIds.has(job.id)
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <RefreshCw className="h-3 w-3" />}
                            re-run
                          </button>
                        )}
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ job }: { job: JobStatus }) {
  if (job.status === "running") {
    return (
      <span className="inline-flex items-center gap-1.5" style={{ color: INK }}>
        <Loader2 className="h-3 w-3 animate-spin" />
        running
      </span>
    );
  }
  if (job.status === "failed") {
    return (
      <span className="inline-flex items-center gap-1.5" style={{ color: PEACH }}>
        <XCircle className="h-3 w-3" />
        failed
      </span>
    );
  }
  if (job.status === "completed") {
    if (job.bundleStatus === "published") {
      return (
        <span className="inline-flex items-center gap-1.5" style={{ color: LIME }}>
          <CheckCircle2 className="h-3 w-3" />
          published
        </span>
      );
    }
    if (job.bundleStatus === "pending_review") {
      return (
        <span className="inline-flex items-center gap-1.5" style={{ color: PEACH }}>
          <CheckCircle2 className="h-3 w-3" />
          held
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5" style={{ color: MUTED }}>
        <CheckCircle2 className="h-3 w-3" />
        {job.bundleStatus ?? "done"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5" style={{ color: MUTED }}>
      <span className="h-1.5 w-1.5 rounded-full inline-block" style={{ background: MUTED }} />
      queued
    </span>
  );
}
