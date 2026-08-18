"use client";

import { useEffect, useState } from "react";
import {
  Check,
  ExternalLink,
  Loader2,
  Pencil,
  RotateCw,
  Trash2,
  X,
} from "lucide-react";
import { BrandLogo } from "@/components/ui/BrandLogo";
import {
  BORDER,
  BORDER_SOFT,
  CYAN,
  INK,
  INK_ON_LIGHT,
  LIME,
  MONO,
  MUTED,
  PEACH,
  SUB,
  SURFACE,
  SURFACE_2,
} from "@/lib/ui-data/tokens";
import { RERUN_PHASES, rerunPhaseIndex } from "./constants";
import { StatusPill } from "./StatusPill";
import type { ActionState, DetailRow, LatestJob } from "./types";

export interface BundleDetailPanelProps {
  modelLabel: string;
  detail: DetailRow;
  actionState: ActionState;
  actionError: string | null;
  rerunStep: string | null;
  rerunStatus: "queued" | "running" | "completed" | "failed" | null;
  latestJob: LatestJob | null;
  onEnterEdit: () => void;
  onPublish: () => void | Promise<void>;
  onReject: (reason: string) => Promise<boolean>;
  onRestore: (target: "published" | "pending_review") => void | Promise<void>;
  onRerunPipeline: (feedback?: string) => Promise<boolean>;
  onDelete: () => void | Promise<void>;
}

function fmtElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
}

// Compact 4-phase progress strip rendered inside the sticky action bar
// while a Re-run pipeline job is in flight. Mirrors /generate's phase
// model so editors and end-users see the same machine.
function RerunProgress({
  step,
  status,
  createdAt,
  firecrawlDoneAt,
  geminiExtractDoneAt,
  designMdDoneAt,
  lintDoneAt,
  companionStartedAt,
  companionDoneAt,
  modelLabel,
}: {
  step: string | null;
  status: "queued" | "running" | "completed" | "failed" | null;
  createdAt: string | null;
  firecrawlDoneAt: string | null;
  geminiExtractDoneAt: string | null;
  designMdDoneAt: string | null;
  lintDoneAt: string | null;
  companionStartedAt: string | null;
  companionDoneAt: string | null;
  modelLabel: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (status !== "queued" && status !== "running") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [status]);

  const phaseIdx = rerunPhaseIndex(step);
  const failed = status === "failed";

  // Boundaries: jobStart, firecrawlDone, geminiDone, designMdDone, lintDone
  const boundaries: (number | null)[] = [
    createdAt ? new Date(createdAt).getTime() : null,
    firecrawlDoneAt ? new Date(firecrawlDoneAt).getTime() : null,
    geminiExtractDoneAt ? new Date(geminiExtractDoneAt).getTime() : null,
    designMdDoneAt ? new Date(designMdDoneAt).getTime() : null,
    lintDoneAt ? new Date(lintDoneAt).getTime() : null,
  ];

  const compStartMs = companionStartedAt ? new Date(companionStartedAt).getTime() : null;
  const compDoneMs = companionDoneAt ? new Date(companionDoneAt).getTime() : null;

  const phaseState: Array<"done" | "active" | "pending" | "failed"> = RERUN_PHASES.map(
    (_, i) => {
      if (i < 4) {
        return failed && i === phaseIdx
          ? "failed"
          : i < phaseIdx
            ? "done"
            : i === phaseIdx
              ? "active"
              : "pending";
      }
      return compDoneMs !== null
        ? "done"
        : failed && compStartMs !== null
          ? "failed"
          : compStartMs !== null
            ? "active"
            : "pending";
    }
  );

  const phaseElapsed = RERUN_PHASES.map((_, i) => {
    if (i < 4) {
      const start = boundaries[i];
      const end = boundaries[i + 1];
      if (start === null) return null;
      if (end !== null) return fmtElapsed(end - start);
      if (i === phaseIdx) return fmtElapsed(now - start) + " ↑";
      return null;
    }
    if (compStartMs === null) return null;
    if (compDoneMs !== null) return fmtElapsed(compDoneMs - compStartMs);
    if (phaseState[4] === "active") return fmtElapsed(now - compStartMs) + " ↑";
    return null;
  });

  const totalElapsed = boundaries[0] !== null ? fmtElapsed(now - boundaries[0]) : null;

  return (
    <div
      className="rounded-md border px-3 py-2.5"
      style={{ borderColor: BORDER, background: SURFACE_2 }}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-[10.5px] uppercase tracking-[0.22em]"
          style={{ color: MUTED, fontFamily: MONO }}
        >
          {failed
            ? "pipeline failed"
            : status === "completed"
              ? "pipeline complete"
              : "re-running pipeline"}
        </span>
        <span className="text-[10.5px]" style={{ color: SUB, fontFamily: MONO }}>
          {totalElapsed ?? step ?? "queued"}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {RERUN_PHASES.map((phase, i) => {
          const state = phaseState[i];
          const fill =
            state === "done"
              ? LIME
              : state === "active"
                ? CYAN
                : state === "failed"
                  ? PEACH
                  : BORDER;
          return (
            <div key={phase.id} className="flex flex-col gap-1">
              <div className="h-1 rounded-full overflow-hidden" style={{ background: BORDER_SOFT }}>
                <div
                  className={state === "active" ? "h-full animate-pulse" : "h-full"}
                  style={{
                    background: fill,
                    width: state === "done" ? "100%" : state === "active" ? "55%" : "0%",
                    transition: "width 400ms ease, background 200ms ease",
                  }}
                />
              </div>
              <div
                className="text-[10.5px] leading-tight truncate"
                style={{
                  color: state === "pending" ? MUTED : INK,
                  fontFamily: state === "pending" ? MONO : undefined,
                }}
              >
                {phase.label}
              </div>
              <div
                className="text-[9.5px] uppercase tracking-[0.16em] truncate"
                style={{ color: MUTED, fontFamily: MONO }}
              >
                {phase.id === "extract" || phase.id === "author" ? modelLabel : phase.tool}
              </div>
              {phaseElapsed[i] ? (
                <div
                  className="text-[9.5px] tabular-nums"
                  style={{ color: state === "active" ? CYAN : MUTED, fontFamily: MONO }}
                >
                  {phaseElapsed[i]}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetaRow({ k, v }: { k: string; v: string }) {
  return (
    <div
      className="flex items-baseline justify-between gap-3 text-[11.5px]"
      style={{ fontFamily: MONO }}
    >
      <span style={{ color: MUTED }}>{k}</span>
      <span className="truncate" style={{ color: INK }} title={v}>
        {v}
      </span>
    </div>
  );
}

export function BundleDetailPanel({
  modelLabel,
  detail,
  actionState,
  actionError,
  rerunStep,
  rerunStatus,
  latestJob,
  onEnterEdit,
  onPublish,
  onReject,
  onRestore,
  onRerunPipeline,
  onDelete,
}: BundleDetailPanelProps) {
  const status = detail.status;
  const busy = actionState !== "idle";

  // Effective progress source: click-driven state takes priority while a
  // re-run is actively initiated this session; otherwise fall back to the
  // server-truth latestJob so the indicator survives page reloads.
  const effectiveStatus = rerunStatus ?? latestJob?.status ?? null;
  const effectiveStep = rerunStep ?? latestJob?.currentStep ?? null;
  const showProgress = effectiveStatus === "queued" || effectiveStatus === "running";
  const showFailureBanner =
    !showProgress && latestJob?.status === "failed" && rerunStatus !== "completed";
  const isStuck =
    latestJob?.status === "running" &&
    Date.now() - new Date(latestJob.updatedAt).getTime() > 12 * 60 * 1000;

  const [showRerunPanel, setShowRerunPanel] = useState(false);
  const [rerunFeedback, setRerunFeedback] = useState("");
  const [showRejectPanel, setShowRejectPanel] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Reset the panels when the editor switches to a different bundle so text
  // typed for one bundle can't leak into another. This panel isn't keyed by
  // slug, so its local state otherwise persists across row selections.
  useEffect(() => {
    setShowRerunPanel(false);
    setRerunFeedback("");
    setShowRejectPanel(false);
    setRejectReason("");
  }, [detail.slug]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusPill status={status} />
            <span className="text-[10.5px]" style={{ color: MUTED, fontFamily: MONO }}>
              slug: {detail.slug}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2.5">
            <BrandLogo
              src={detail.brandLogoUrl}
              fallbackDomain={detail.sourceDomain}
              size={36}
            />
            <h1
              className="text-[24px] font-medium tracking-[-0.014em]"
              style={{ color: INK }}
            >
              {detail.title}
            </h1>
          </div>
          <p className="mt-2 text-[13px] leading-[1.55]" style={{ color: SUB }}>
            {detail.description}
          </p>
          {detail.sourceUrl ? (
            <a
              href={detail.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-3 inline-flex items-center gap-1.5 text-[11px] underline underline-offset-4"
              style={{ color: SUB, fontFamily: MONO }}
            >
              {detail.sourceUrl}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
          <div className="mt-3 flex items-center gap-1.5">
            <span
              className="text-[10px] uppercase tracking-[0.22em]"
              style={{ color: MUTED, fontFamily: MONO }}
            >
              category
            </span>
            <span
              className="rounded-full border px-2 py-0.5 text-[11px]"
              style={{
                borderColor: BORDER,
                color: detail.primaryCategoryName ? INK : MUTED,
                fontFamily: MONO,
              }}
            >
              {detail.primaryCategoryName ?? "uncategorised"}
            </span>
          </div>
        </div>
        {detail.coverageScore !== null ? (
          <div
            className="rounded-lg border px-3 py-2.5 shrink-0"
            style={{ borderColor: BORDER, background: SURFACE_2, minWidth: 196 }}
          >
            {/* Overall score */}
            <div className="flex items-center justify-between gap-3 mb-2.5">
              <div
                className="text-[9.5px] uppercase tracking-[0.22em]"
                style={{ color: MUTED, fontFamily: MONO }}
              >
                coverage
              </div>
              <div
                className="text-[18px] font-medium leading-none"
                style={{
                  color:
                    detail.coverageScore >= 70
                      ? LIME
                      : detail.coverageScore >= 40
                        ? PEACH
                        : MUTED,
                  fontFamily: MONO,
                }}
              >
                {detail.coverageScore}
                <span className="text-[10px]" style={{ color: MUTED }}>
                  {" "}
                  / 100
                </span>
              </div>
            </div>
            {/* Section breakdown */}
            <div
              className="flex flex-col gap-1.5 pt-2 border-t"
              style={{ borderColor: BORDER_SOFT }}
            >
              {(
                [
                  { label: "colors", score: detail.coverageColors },
                  { label: "typography", score: detail.coverageTypography },
                  { label: "layout", score: detail.coverageLayout },
                  { label: "elevation", score: detail.coverageElevation },
                  { label: "shapes", score: detail.coverageShapes },
                  { label: "components", score: detail.coverageComponents },
                  { label: "dos/don'ts", score: detail.coverageDosDonts },
                ] as { label: string; score: number | null }[]
              ).map(({ label, score }) => {
                const c =
                  score === null
                    ? MUTED
                    : score >= 70
                      ? LIME
                      : score >= 40
                        ? PEACH
                        : "#ff7070";
                return (
                  <div key={label} className="flex items-center gap-2">
                    <span
                      className="text-[9.5px] shrink-0"
                      style={{ color: MUTED, fontFamily: MONO, width: 68 }}
                    >
                      {label}
                    </span>
                    <div
                      className="flex-1 h-1 rounded-full overflow-hidden"
                      style={{ background: BORDER_SOFT }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${score ?? 0}%`, background: c }}
                      />
                    </div>
                    <span
                      className="text-[9.5px] tabular-nums shrink-0"
                      style={{ color: c, fontFamily: MONO, width: 20, textAlign: "right" }}
                    >
                      {score ?? "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {/* Screenshot */}
      <div
        className="rounded-lg border overflow-hidden"
        style={{ borderColor: BORDER, background: SURFACE }}
      >
        <div
          className="flex items-center gap-2 h-8 px-3 border-b"
          style={{ borderColor: BORDER, background: SURFACE_2 }}
        >
          <span className="flex gap-1" aria-hidden>
            {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
              <span key={c} className="h-2 w-2 rounded-full" style={{ background: c, opacity: 0.7 }} />
            ))}
          </span>
          <span
            className="ml-2 flex-1 truncate text-[10.5px]"
            style={{ fontFamily: MONO, color: MUTED }}
          >
            {detail.sourceDomain ?? "screenshot"}
          </span>
          <span
            className="text-[9.5px] uppercase tracking-[0.18em]"
            style={{ color: MUTED, fontFamily: MONO }}
          >
            screenshot · system-managed
          </span>
        </div>
        {detail.previewImageUrl ? (
          <a
            href={detail.previewImageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block relative"
            style={{ aspectRatio: "16 / 10" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={detail.previewImageUrl}
              alt="bundle screenshot"
              className="absolute inset-0 h-full w-full object-cover object-top"
            />
          </a>
        ) : (
          <div
            className="flex items-center justify-center text-[11px]"
            style={{
              aspectRatio: "16 / 10",
              color: MUTED,
              fontFamily: MONO,
              background: SURFACE_2,
            }}
          >
            no screenshot
          </div>
        )}
      </div>

      {/* Palette + source meta */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-4">
        <div
          className="rounded-lg border p-4"
          style={{ borderColor: BORDER, background: SURFACE }}
        >
          <div
            className="text-[10px] uppercase tracking-[0.22em] mb-3"
            style={{ color: MUTED, fontFamily: MONO }}
          >
            palette · system-managed
          </div>
          {detail.paletteColors?.length ? (
            <div className="flex h-7 rounded overflow-hidden">
              {detail.paletteColors.map((c, i) => (
                <span key={`${c}-${i}`} className="flex-1" style={{ background: c }} title={c} />
              ))}
            </div>
          ) : (
            <div className="text-[11px]" style={{ color: MUTED, fontFamily: MONO }}>
              no palette
            </div>
          )}
        </div>
        <div
          className="rounded-lg border p-4 flex flex-col gap-1.5"
          style={{ borderColor: BORDER, background: SURFACE }}
        >
          <div
            className="text-[10px] uppercase tracking-[0.22em]"
            style={{ color: MUTED, fontFamily: MONO }}
          >
            meta
          </div>
          <MetaRow
            k="creator"
            v={detail.createdBy ? (detail.creatorName ?? "—") : "anonymous"}
          />
          {detail.createdBy && detail.creatorEmail ? (
            <MetaRow k="email" v={detail.creatorEmail} />
          ) : null}
          <MetaRow k="author" v={detail.authorName ?? "—"} />
          <MetaRow k="votes" v={`${detail.voteCount} (${detail.positiveVoteRate}%)`} />
          <MetaRow k="companion" v={detail.companionStatus} />
        </div>
      </div>

      {/* design.md / companion — read-only */}
      <details
        className="rounded-lg border"
        style={{ borderColor: BORDER, background: SURFACE }}
      >
        <summary
          className="cursor-pointer p-3 text-[11.5px] uppercase tracking-[0.22em]"
          style={{ color: SUB, fontFamily: MONO }}
        >
          design.md (read-only)
        </summary>
        <pre
          className="px-4 py-3 text-[11px] leading-[1.55] whitespace-pre-wrap overflow-x-auto max-h-[360px] border-t"
          style={{ color: INK, fontFamily: MONO, borderColor: BORDER_SOFT }}
        >
          {detail.designMd ?? "(empty)"}
        </pre>
      </details>
      <details
        className="rounded-lg border"
        style={{ borderColor: BORDER, background: SURFACE }}
      >
        <summary
          className="cursor-pointer p-3 text-[11.5px] uppercase tracking-[0.22em]"
          style={{ color: SUB, fontFamily: MONO }}
        >
          companion prompt (read-only) · {detail.companionStatus}
        </summary>
        <pre
          className="px-4 py-3 text-[11px] leading-[1.55] whitespace-pre-wrap overflow-x-auto max-h-[360px] border-t"
          style={{ color: INK, fontFamily: MONO, borderColor: BORDER_SOFT }}
        >
          {detail.companionPrompt || "(empty)"}
        </pre>
      </details>
      {detail.reviewNotes ? (
        <details className="rounded-lg border" style={{ borderColor: BORDER, background: SURFACE_2 }}>
          <summary
            className="cursor-pointer p-3 text-[11.5px] uppercase tracking-[0.22em]"
            style={{ color: SUB, fontFamily: MONO }}
          >
            linter / review notes
          </summary>
          <pre
            className="px-4 py-3 text-[11px] leading-[1.55] whitespace-pre-wrap"
            style={{ color: SUB, fontFamily: MONO }}
          >
            {detail.reviewNotes}
          </pre>
        </details>
      ) : null}

      {/* Sticky action bar */}
      <div
        className="sticky bottom-4 rounded-xl border p-4 flex flex-col gap-3"
        style={{
          borderColor: BORDER,
          background: SURFACE,
          boxShadow: "0 12px 36px -12px rgba(0,0,0,0.6)",
        }}
      >
        {actionError ? (
          <div
            className="rounded-md border px-3 py-2 text-[11.5px]"
            style={{
              borderColor: PEACH,
              background: `${PEACH}10`,
              color: INK,
              fontFamily: MONO,
            }}
          >
            {actionError}
          </div>
        ) : null}
        {showProgress ? (
          <RerunProgress
            step={effectiveStep}
            status={effectiveStatus}
            createdAt={latestJob?.createdAt ?? null}
            firecrawlDoneAt={latestJob?.firecrawlDoneAt ?? null}
            geminiExtractDoneAt={latestJob?.geminiExtractDoneAt ?? null}
            designMdDoneAt={latestJob?.designMdDoneAt ?? null}
            lintDoneAt={latestJob?.lintDoneAt ?? null}
            companionStartedAt={latestJob?.companionStartedAt ?? null}
            companionDoneAt={latestJob?.companionDoneAt ?? null}
            modelLabel={modelLabel}
          />
        ) : null}
        {isStuck ? (
          <div
            className="rounded-md border px-3 py-2 text-[11.5px]"
            style={{
              borderColor: PEACH,
              background: `${PEACH}10`,
              color: INK,
              fontFamily: MONO,
            }}
          >
            Job appears stuck — no update in over 4 min. You can re-run again to replace it.
          </div>
        ) : null}
        {showFailureBanner && latestJob ? (
          <div
            className="rounded-md border px-3 py-2.5 text-[12px]"
            style={{
              borderColor: PEACH,
              background: `${PEACH}10`,
              color: INK,
              fontFamily: MONO,
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <span
                className="text-[10.5px] uppercase tracking-[0.22em]"
                style={{ color: PEACH }}
              >
                last re-run failed
              </span>
              <span className="text-[10.5px]" style={{ color: SUB }}>
                {new Date(latestJob.updatedAt).toLocaleString()}
              </span>
            </div>
            <div className="mb-0.5">
              <span style={{ color: SUB }}>step:</span>{" "}
              <span style={{ color: INK }}>{latestJob.errorStep ?? "unknown"}</span>
            </div>
            {latestJob.errorMessage ? (
              <div className="truncate" style={{ color: SUB }} title={latestJob.errorMessage}>
                {latestJob.errorMessage}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {(status === "personal" || status === "pending_review") ? (() => {
            // Pre-publish guards. Each blocks the click with a tooltip
            // explaining why, instead of letting the editor publish a
            // broken bundle that needs immediate revert.
            const missingDesignMd = !detail.designMd;
            const companionNotReady = detail.companionStatus !== "ready";
            const blocker = missingDesignMd
              ? "design.md isn't generated yet — re-run the pipeline first"
              : companionNotReady
                ? `Companion prompt is ${detail.companionStatus} — wait for it to finish (or re-run) before publishing`
                : null;
            const disabled = busy || showProgress || blocker !== null;
            return (
              <button
                type="button"
                onClick={() => void onPublish()}
                disabled={disabled}
                title={
                  blocker ??
                  (status === "personal"
                    ? "Publish directly — overrides the lint gate that kept this out of the reviewer queue"
                    : "Approve and publish this bundle to the public library")
                }
                className="h-9 rounded-full px-4 text-[12.5px] font-medium inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: INK,
                  color: INK_ON_LIGHT,
                  boxShadow: `0 0 0 1px ${LIME}55, 0 10px 28px -12px ${LIME}66`,
                }}
              >
                {actionState === "publishing" ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Publishing
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" style={{ color: INK_ON_LIGHT }} />
                    {status === "personal" ? "Publish" : "Approve & publish"}
                  </>
                )}
              </button>
            );
          })() : null}

          {(status === "pending_review" || status === "personal" || status === "flagged") ? (
            <button
              type="button"
              onClick={() => setShowRejectPanel((v) => !v)}
              disabled={busy || showProgress}
              title="Reject this submission — it leaves the public library but stays in the creator's account"
              className="h-9 rounded-full px-4 text-[12.5px] inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: SURFACE_2, color: INK, border: `1px solid ${PEACH}66` }}
            >
              {actionState === "rejecting" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <X className="h-3.5 w-3.5" style={{ color: PEACH }} />
              )}
              Reject
            </button>
          ) : null}

          {(status === "rejected" || status === "archived") ? (
            <button
              type="button"
              onClick={() => void onRestore("published")}
              disabled={busy || showProgress}
              title="Restore this bundle and publish it to the public library"
              className="h-9 rounded-full px-4 text-[12.5px] inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: SURFACE_2, color: INK, border: `1px solid ${LIME}66` }}
            >
              {actionState === "restoring" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCw className="h-3.5 w-3.5" style={{ color: LIME }} />
              )}
              Restore
            </button>
          ) : null}

          {detail.sourceUrl && !detail.sourceUrl.startsWith("upload://") ? (
            <button
              type="button"
              onClick={() => setShowRerunPanel((v) => !v)}
              disabled={busy || (showProgress && !isStuck)}
              title={
                isStuck
                  ? "Job is stuck — open the panel to replace it with a fresh re-run"
                  : showProgress
                    ? "A re-run is already in flight for this bundle"
                    : "Re-run the full extraction pipeline (scrape + brand + design.md + companion)"
              }
              className="h-9 rounded-full px-4 text-[12.5px] inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: SURFACE_2,
                color: INK,
                border: `1px solid ${isStuck ? PEACH : CYAN}66`,
              }}
            >
              {actionState === "rerunning-pipeline" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isStuck ? (
                <RotateCw className="h-3.5 w-3.5" style={{ color: PEACH }} />
              ) : showProgress ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCw className="h-3.5 w-3.5" style={{ color: CYAN }} />
              )}
              {isStuck ? "Re-run (replace stuck)" : showProgress ? "Re-run in progress…" : "Re-run pipeline"}
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => onEnterEdit()}
            disabled={busy || showProgress}
            title={
              showProgress
                ? "A re-run is in flight — wait for it to finish before editing"
                : "Manually edit title, URL, description, design.md, and companion prompt"
            }
            className="h-9 rounded-full px-4 text-[12.5px] inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: SURFACE_2, color: INK, border: `1px solid ${BORDER}` }}
          >
            <Pencil className="h-3.5 w-3.5" style={{ color: SUB }} />
            Edit
          </button>

          <button
            type="button"
            onClick={() => void onDelete()}
            disabled={busy}
            title="Permanently delete this bundle (use Archive to soft-delete)"
            className="h-9 rounded-full px-4 text-[12.5px] inline-flex items-center gap-2"
            style={{ background: SURFACE_2, color: INK, border: `1px solid #ff5a5a66` }}
          >
            {actionState === "deleting" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" style={{ color: "#ff7070" }} />
            )}
            Delete
          </button>

          {status !== "archived" ? (
            <a
              href={`/library/${detail.slug}`}
              target="_blank"
              rel="noreferrer noopener"
              className="h-9 rounded-full px-4 text-[12.5px] inline-flex items-center gap-2 ml-auto"
              style={{ background: SURFACE_2, color: INK, border: `1px solid ${BORDER}` }}
            >
              Open in library
              <ExternalLink className="h-3.5 w-3.5" style={{ color: SUB }} />
            </a>
          ) : null}
        </div>

        {showRejectPanel ? (
          <div
            className="rounded-lg border p-3 flex flex-col gap-2.5"
            style={{ borderColor: `${PEACH}55`, background: SURFACE_2 }}
          >
            <div className="flex items-center gap-2">
              <X className="h-3.5 w-3.5" style={{ color: PEACH }} />
              <span
                className="text-[10.5px] uppercase tracking-[0.22em]"
                style={{ color: PEACH, fontFamily: MONO }}
              >
                reject submission
              </span>
            </div>
            <p className="text-[11.5px] leading-[1.55]" style={{ color: SUB }}>
              The bundle leaves the public library and search but stays in the
              creator&apos;s account. Give a reason the creator can act on.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="e.g. The palette doesn't match the source site — re-run with the correct brand colors, or the design.md is too sparse to publish."
              className="w-full resize-y rounded-md border px-2.5 py-2 text-[12px] outline-none"
              style={{ color: INK, background: SURFACE, borderColor: BORDER, fontFamily: MONO }}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy || rejectReason.trim() === ""}
                onClick={async () => {
                  const ok = await onReject(rejectReason.trim());
                  if (ok) {
                    setShowRejectPanel(false);
                    setRejectReason("");
                  }
                }}
                title={
                  rejectReason.trim() === ""
                    ? "Enter a rejection reason"
                    : "Reject this submission"
                }
                className="h-8 rounded-full px-3.5 text-[12px] font-medium inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: INK,
                  color: INK_ON_LIGHT,
                  boxShadow: `0 0 0 1px ${PEACH}55, 0 10px 28px -12px ${PEACH}66`,
                }}
              >
                {actionState === "rejecting" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <X className="h-3.5 w-3.5" />
                )}
                Confirm rejection
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setShowRejectPanel(false);
                  setRejectReason("");
                }}
                className="h-8 rounded-full px-3.5 text-[12px] inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: SURFACE_2, color: SUB, border: `1px solid ${BORDER}` }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {showRerunPanel && detail.sourceUrl && !detail.sourceUrl.startsWith("upload://") ? (
          <div
            className="rounded-lg border p-3 flex flex-col gap-2.5"
            style={{ borderColor: `${CYAN}55`, background: SURFACE_2 }}
          >
            <div className="flex items-center gap-2">
              <RotateCw className="h-3.5 w-3.5" style={{ color: CYAN }} />
              <span
                className="text-[10.5px] uppercase tracking-[0.22em]"
                style={{ color: CYAN, fontFamily: MONO }}
              >
                re-run pipeline
              </span>
            </div>
            <p className="text-[11.5px] leading-[1.55]" style={{ color: SUB }}>
              Editor metadata (title, description, license, attribution, featured, curated) is
              preserved. design.md, companion prompt, palette, accessibility notes, and coverage
              scores are overwritten with fresh extraction output.
            </p>
            <textarea
              value={rerunFeedback}
              onChange={(e) => setRerunFeedback(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="What was rendered incorrectly? e.g. 'The primary color is wrong — it should be the orange accent, not the off-white.' Leave blank for a standard re-run."
              className="w-full resize-y rounded-md border px-2.5 py-2 text-[12px] outline-none"
              style={{ color: INK, background: SURFACE, borderColor: BORDER, fontFamily: MONO }}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  const ok = await onRerunPipeline(rerunFeedback);
                  if (ok) {
                    setShowRerunPanel(false);
                    setRerunFeedback("");
                  }
                }}
                title={
                  isStuck
                    ? "Replace the stuck job with a fresh re-run"
                    : "Start the re-run with this feedback (leave blank for a standard re-run)"
                }
                className="h-8 rounded-full px-3.5 text-[12px] font-medium inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: INK,
                  color: INK_ON_LIGHT,
                  boxShadow: `0 0 0 1px ${CYAN}55, 0 10px 28px -12px ${CYAN}66`,
                }}
              >
                {actionState === "rerunning-pipeline" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCw className="h-3.5 w-3.5" />
                )}
                {isStuck ? "Start re-run (replace stuck)" : "Start re-run"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setShowRerunPanel(false);
                  setRerunFeedback("");
                }}
                className="h-8 rounded-full px-3.5 text-[12px] inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: SURFACE_2, color: SUB, border: `1px solid ${BORDER}` }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
