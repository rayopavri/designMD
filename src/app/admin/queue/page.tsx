"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, ExternalLink, Loader2, RefreshCw, ShieldCheck, X } from "lucide-react";
import { SectionLabel } from "@/components/ui/Shell";
import { SectionCoverage } from "@/components/ui/SectionCoverage";
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

interface PendingRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  sourceDomain: string | null;
  sourceUrl: string | null;
  authorName: string | null;
  designStyle: string[];
  paletteColors: string[];
  coverageScore: number | null;
  submittedAt: string | null;
  createdAt: string;
}

interface BundleDetail {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: string;
  status: string;
  designMd: string | null;
  companionPrompt: string;
  coverageScore: number | null;
  coverageColors: number | null;
  coverageTypography: number | null;
  coverageLayout: number | null;
  coverageElevation: number | null;
  coverageShapes: number | null;
  coverageComponents: number | null;
  coverageDosDonts: number | null;
  designStyle: string[];
  compatibleTools: string[];
  paletteColors: string[];
  sourceDomain: string | null;
  sourceUrl: string | null;
  authorName: string | null;
  license: string | null;
  reviewNotes: string | null;
  submittedAt: string | null;
}

type LoadState = "loading" | "ready" | "forbidden" | "error";

type ActionState = "idle" | "publishing" | "rejecting" | "rerunning";

export default function ReviewerQueuePage() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [detail, setDetail] = useState<BundleDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [approveNotes, setApproveNotes] = useState("");

  const loadList = useCallback(async () => {
    setLoadState("loading");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/admin/bundles/pending");
      if (res.status === 401 || res.status === 403) {
        setLoadState("forbidden");
        return;
      }
      if (!res.ok) {
        setErrorMsg(`Failed to load queue (${res.status})`);
        setLoadState("error");
        return;
      }
      const body = (await res.json()) as { data: PendingRow[] };
      setRows(body.data);
      setLoadState("ready");
      // If the previously-selected bundle is no longer pending, drop it.
      if (selectedSlug && !body.data.find((r) => r.slug === selectedSlug)) {
        setSelectedSlug(null);
        setDetail(null);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Network error");
      setLoadState("error");
    }
  }, [selectedSlug]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadDetail = useCallback(async (slug: string) => {
    setDetailLoading(true);
    setDetail(null);
    setActionError(null);
    setRejectNotes("");
    setApproveNotes("");
    try {
      const res = await fetch(`/api/admin/bundles/${encodeURIComponent(slug)}`);
      if (!res.ok) {
        setActionError(`Failed to load bundle (${res.status})`);
        return;
      }
      const body = (await res.json()) as { data: BundleDetail };
      setDetail(body.data);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Network error");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSlug) void loadDetail(selectedSlug);
  }, [selectedSlug, loadDetail]);

  const onSelect = (slug: string) => {
    setSelectedSlug(slug);
  };

  const onApprove = async () => {
    if (!detail) return;
    setActionState("publishing");
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/bundles/${encodeURIComponent(detail.slug)}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(approveNotes.trim() ? { reviewNotes: approveNotes.trim() } : {}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        setActionError(body.error || `Publish failed (${res.status})`);
        return;
      }
      // Refresh and clear selection.
      setSelectedSlug(null);
      setDetail(null);
      await loadList();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Network error");
    } finally {
      setActionState("idle");
    }
  };

  const onRerun = async () => {
    if (!detail) return;
    setActionState("rerunning");
    setActionError(null);
    try {
      const res = await fetch(
        `/api/admin/bundles/${encodeURIComponent(detail.slug)}/rerun-pipeline`,
        { method: "POST" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        setActionError(body.error || `Re-run failed (${res.status})`);
        return;
      }
      // Bundle stays pending_review while the new pipeline runs. Clear
      // selection so the reviewer moves on to other items in the queue.
      setSelectedSlug(null);
      setDetail(null);
      await loadList();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Network error");
    } finally {
      setActionState("idle");
    }
  };

  const onReject = async () => {
    if (!detail) return;
    const notes = rejectNotes.trim();
    if (!notes) {
      setActionError("Reject reason is required.");
      return;
    }
    setActionState("rejecting");
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/bundles/${encodeURIComponent(detail.slug)}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewNotes: notes }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        setActionError(body.error || `Reject failed (${res.status})`);
        return;
      }
      setSelectedSlug(null);
      setDetail(null);
      await loadList();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Network error");
    } finally {
      setActionState("idle");
    }
  };

  if (loadState === "loading") {
    return (
      <div className="mx-auto max-w-6xl px-6 lg:px-8 py-20 flex items-center gap-3" style={{ color: SUB }}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-[13px]" style={{ fontFamily: MONO }}>
          loading reviewer queue…
        </span>
      </div>
    );
  }

  if (loadState === "forbidden") {
    return (
      <div className="mx-auto max-w-2xl px-6 lg:px-8 py-20 text-center">
        <ShieldCheck className="h-8 w-8 mx-auto mb-4" style={{ color: PEACH }} />
        <h1 className="text-[28px] font-medium tracking-[-0.018em]">Editor access required</h1>
        <p className="mt-3 text-[14px] leading-[1.6]" style={{ color: SUB }}>
          This page is restricted to verified editors. Sign in with an editor account or ask an admin
          to grant you editor permission.
        </p>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="mx-auto max-w-2xl px-6 lg:px-8 py-20 text-center">
        <h1 className="text-[22px] font-medium">Couldn&apos;t load the queue</h1>
        <p className="mt-2 text-[13px]" style={{ color: SUB, fontFamily: MONO }}>
          {errorMsg ?? "Unknown error"}
        </p>
        <button
          type="button"
          onClick={() => void loadList()}
          className="mt-5 h-9 rounded-full px-4 text-[12.5px] inline-flex items-center gap-2"
          style={{ background: INK, color: INK_ON_LIGHT }}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <SectionLabel t="Reviewer queue" />
          <h1 className="mt-3 text-[32px] font-medium tracking-[-0.018em]">
            Pending bundles · {rows.length}
          </h1>
          <p className="mt-2 text-[13px]" style={{ color: SUB }}>
            Bundles awaiting editorial review. Approve to publish to the public library, or reject
            with a reason so the submitter knows what to fix.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadList()}
          className="h-9 rounded-full border px-3 text-[12px] inline-flex items-center gap-2"
          style={{ borderColor: BORDER, color: SUB, fontFamily: MONO }}
        >
          <RefreshCw className="h-3.5 w-3.5" /> refresh
        </button>
      </div>

      <div
        className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-px rounded-xl overflow-hidden"
        style={{ background: BORDER }}
      >
        {/* List pane */}
        <div className="p-2" style={{ background: BG, minHeight: 480 }}>
          {rows.length === 0 ? (
            <div
              className="h-full flex items-center justify-center text-[12px] py-20"
              style={{ color: MUTED, fontFamily: MONO }}
            >
              queue is empty · all caught up
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {rows.map((row) => {
                const isActive = row.slug === selectedSlug;
                const coverage = row.coverageScore;
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(row.slug)}
                      className="w-full text-left rounded-lg px-3 py-3 transition-colors"
                      style={{
                        background: isActive ? SURFACE_2 : "transparent",
                        border: `1px solid ${isActive ? BORDER : "transparent"}`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[13px] truncate"
                          style={{ color: INK, fontWeight: isActive ? 600 : 400 }}
                        >
                          {row.title}
                        </span>
                        {isActive ? (
                          <ChevronRight className="h-3.5 w-3.5 ml-auto" style={{ color: SUB }} />
                        ) : null}
                      </div>
                      <div
                        className="mt-1 text-[11px] truncate"
                        style={{ color: SUB, fontFamily: MONO }}
                      >
                        {row.sourceDomain ?? "—"}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        {coverage !== null ? (
                          <span
                            className="text-[10.5px] rounded px-1.5 py-0.5"
                            style={{
                              fontFamily: MONO,
                              color: coverage >= 70 ? LIME : coverage >= 40 ? PEACH : MUTED,
                              border: `1px solid ${(coverage >= 70 ? LIME : coverage >= 40 ? PEACH : MUTED)}55`,
                            }}
                          >
                            {coverage}/100
                          </span>
                        ) : null}
                        {row.paletteColors?.slice(0, 5).map((c, i) => (
                          <span
                            key={`${row.id}-${c}-${i}`}
                            className="h-3 w-3 rounded-sm"
                            style={{ background: c, border: `1px solid ${BORDER_SOFT}` }}
                          />
                        ))}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Detail pane */}
        <div className="p-8" style={{ background: BG, minHeight: 480 }}>
          {!selectedSlug ? (
            <div
              className="h-full flex items-center justify-center text-[12px]"
              style={{ color: MUTED, fontFamily: MONO }}
            >
              select a bundle from the queue to review
            </div>
          ) : detailLoading || !detail ? (
            <div className="flex items-center gap-2 text-[12px]" style={{ color: SUB, fontFamily: MONO }}>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              loading {selectedSlug}…
            </div>
          ) : (
            <DetailView
              detail={detail}
              actionState={actionState}
              actionError={actionError}
              rejectNotes={rejectNotes}
              setRejectNotes={setRejectNotes}
              approveNotes={approveNotes}
              setApproveNotes={setApproveNotes}
              onApprove={onApprove}
              onReject={onReject}
              onRerun={onRerun}
            />
          )}
        </div>
      </div>
    </div>
  );
}

interface DetailViewProps {
  detail: BundleDetail;
  actionState: ActionState;
  actionError: string | null;
  rejectNotes: string;
  setRejectNotes: (v: string) => void;
  approveNotes: string;
  setApproveNotes: (v: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onRerun: () => void;
}

function DetailView({
  detail,
  actionState,
  actionError,
  rejectNotes,
  setRejectNotes,
  approveNotes,
  setApproveNotes,
  onApprove,
  onReject,
  onRerun,
}: DetailViewProps) {
  const [tab, setTab] = useState<"design.md" | "companion">("design.md");

  const overall = detail.coverageScore;
  const overallColor = overall === null ? MUTED : overall >= 70 ? LIME : overall >= 40 ? PEACH : MUTED;

  const sectionCoverage = useMemo(() => {
    if (
      detail.coverageColors === null &&
      detail.coverageTypography === null &&
      detail.coverageLayout === null
    ) return null;
    return {
      colors: detail.coverageColors ?? 0,
      typography: detail.coverageTypography ?? 0,
      spacing: detail.coverageLayout ?? 0,
      elevation: detail.coverageElevation ?? 0,
      shapes: detail.coverageShapes ?? 0,
      components: detail.coverageComponents ?? 0,
      dosDonts: detail.coverageDosDonts ?? 0,
    };
  }, [detail]);

  const designLines = detail.designMd ? detail.designMd.split("\n").length : 0;
  const promptLines = detail.companionPrompt ? detail.companionPrompt.split("\n").length : 0;
  const promptTokensApprox = Math.max(1, Math.round((detail.companionPrompt?.length ?? 0) / 4));

  return (
    <div className="flex flex-col gap-8">

      {/* ── Hero: same 12-col grid as library detail page ─────── */}
      <div className="grid grid-cols-12 gap-8">

        {/* Left 7 cols */}
        <div className="col-span-12 lg:col-span-7">
          <div
            className="text-[10.5px] uppercase tracking-[0.22em]"
            style={{ color: MUTED, fontFamily: MONO }}
          >
            {detail.sourceDomain ?? "—"}
          </div>
          <h2
            className="mt-1 text-[42px] leading-[0.98] font-medium tracking-[-0.02em]"
            style={{ color: INK }}
          >
            {detail.title}
            <span style={{ color: SUB }}>.</span>
          </h2>
          <p className="mt-4 text-[14px] leading-[1.65] max-w-lg" style={{ color: SUB }}>
            {detail.description}
          </p>
          {detail.sourceUrl ? (
            <a
              href={detail.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-3 inline-flex items-center gap-1.5 text-[12px] underline underline-offset-4"
              style={{ color: SUB, fontFamily: MONO }}
            >
              {detail.sourceUrl}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
          {detail.designStyle?.length ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {detail.designStyle.map((t) => (
                <span
                  key={t}
                  className="text-[11px] px-2.5 py-1 rounded-full"
                  style={{
                    background: SURFACE_2,
                    border: `1px solid ${BORDER}`,
                    color: SUB,
                    fontFamily: MONO,
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          ) : null}
          <div
            className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px]"
            style={{ fontFamily: MONO, color: MUTED }}
          >
            <span>
              type{" "}
              <span style={{ color: INK }}>{detail.type}</span>
            </span>
            <span style={{ color: BORDER }}>·</span>
            <span>
              status{" "}
              <span style={{ color: PEACH }}>{detail.status}</span>
            </span>
            {detail.license ? (
              <>
                <span style={{ color: BORDER }}>·</span>
                <span>
                  license <span style={{ color: INK }}>{detail.license}</span>
                </span>
              </>
            ) : null}
            {detail.authorName ? (
              <>
                <span style={{ color: BORDER }}>·</span>
                <span>
                  by <span style={{ color: INK }}>{detail.authorName}</span>
                </span>
              </>
            ) : null}
          </div>
        </div>

        {/* Right aside: 5 cols — coverage card + artifact chips */}
        <aside className="col-span-12 lg:col-span-5">
          <div
            className="rounded-xl border p-6"
            style={{ borderColor: BORDER, background: SURFACE }}
          >
            <div className="flex items-baseline justify-between mb-5">
              <div>
                <div
                  className="text-[10.5px] uppercase tracking-[0.22em] mb-1.5"
                  style={{ fontFamily: MONO, color: MUTED }}
                >
                  overall coverage
                </div>
                <div className="text-[32px] leading-none font-medium" style={{ color: INK }}>
                  {overall ?? "—"}
                  {overall !== null && (
                    <span className="text-[18px]" style={{ color: SUB }}>
                      / 100
                    </span>
                  )}
                </div>
              </div>
              <span
                className="text-[11px] inline-flex items-center gap-1.5"
                style={{ fontFamily: MONO, color: MUTED }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: PEACH }} />
                pending review
              </span>
            </div>
            {sectionCoverage ? <SectionCoverage coverage={sectionCoverage} /> : null}
            {detail.paletteColors?.length ? (
              <div className="h-1.5 my-5 flex">
                {detail.paletteColors.map((c, i) => (
                  <span
                    key={`${c}-${i}`}
                    className="flex-1 first:rounded-l-sm last:rounded-r-sm"
                    style={{ background: c }}
                  />
                ))}
              </div>
            ) : null}
            <div
              className="flex items-center justify-between pt-4 border-t text-[11.5px]"
              style={{ borderColor: BORDER, fontFamily: MONO, color: MUTED }}
            >
              <span>{detail.paletteColors?.length ?? 0} palette colors</span>
              <span style={{ color: overallColor }}>
                {overall !== null ? `${overall} / 100` : "unscored"}
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
              What you&apos;ll review
            </div>
            <div className="grid grid-cols-1 gap-3">
              <ArtifactChip
                filename="design.md"
                hint="brand spec — tokens, component anatomy, forbidden rules"
                meta={`${designLines} lines`}
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
        </aside>
      </div>

      {/* ── Linter / WCAG notes ───────────────────────────────── */}
      {detail.reviewNotes ? (
        <details
          className="rounded-lg border p-4"
          style={{ borderColor: BORDER, background: SURFACE_2 }}
        >
          <summary
            className="cursor-pointer text-[11.5px] uppercase tracking-[0.22em]"
            style={{ color: SUB, fontFamily: MONO }}
          >
            ▸ linter / wcag notes
          </summary>
          <pre
            className="mt-3 text-[11px] whitespace-pre-wrap leading-[1.55]"
            style={{ color: SUB, fontFamily: MONO }}
          >
            {detail.reviewNotes}
          </pre>
        </details>
      ) : null}

      {/* ── Code viewer with tabs ─────────────────────────────── */}
      <div>
        <div
          className="flex items-center gap-1 border-b"
          style={{ borderColor: BORDER }}
        >
          {(["design.md", "companion"] as const).map((t) => {
            const isActive = tab === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className="relative px-4 py-3 text-[12.5px]"
                style={{
                  color: isActive ? INK : SUB,
                  fontFamily: t === "design.md" ? MONO : undefined,
                }}
              >
                {t === "design.md" ? "design.md" : "companion prompt"}
                {isActive ? (
                  <span
                    className="absolute left-0 right-0 -bottom-px h-px"
                    style={{ background: LIME }}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
        {tab === "design.md" ? (
          <CodePanel
            title={`${detail.slug} / design.md`}
            language="yaml"
            source={detail.designMd ?? ""}
            rightMeta={
              overall !== null ? (
                <span className="inline-flex items-center gap-1.5" style={{ color: INK }}>
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: overallColor }}
                  />
                  {overall} coverage
                </span>
              ) : undefined
            }
          />
        ) : (
          <CodePanel
            title={`${detail.slug} / companion.md`}
            language="md"
            source={detail.companionPrompt ?? ""}
            rightMeta={
              <span className="inline-flex items-center gap-1.5" style={{ color: INK }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: VIOLET }} />
                calibrated for Claude / GPT
              </span>
            }
          />
        )}
      </div>

      {/* ── Action bar ───────────────────────────────────────── */}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="approve-note-input"
              className="text-[10.5px] uppercase tracking-[0.22em]"
              style={{ color: MUTED, fontFamily: MONO }}
            >
              approve note (optional)
            </label>
            <input
              id="approve-note-input"
              type="text"
              value={approveNotes}
              onChange={(e) => setApproveNotes(e.target.value)}
              placeholder="optional note recorded with the publish"
              className="h-9 rounded-md border px-3 text-[12.5px] bg-transparent"
              style={{ borderColor: BORDER, color: INK, fontFamily: MONO }}
              disabled={actionState !== "idle"}
            />
            <button
              type="button"
              onClick={onApprove}
              disabled={actionState !== "idle"}
              className="h-9 rounded-full px-4 text-[12.5px] font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60"
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
                  <Check className="h-3.5 w-3.5" style={{ color: LIME }} />
                  Approve & publish
                </>
              )}
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <label
              htmlFor="reject-reason-input"
              className="text-[10.5px] uppercase tracking-[0.22em]"
              style={{ color: MUTED, fontFamily: MONO }}
            >
              reject reason (required)
            </label>
            <input
              id="reject-reason-input"
              type="text"
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="why this bundle isn't ready for the public library"
              className="h-9 rounded-md border px-3 text-[12.5px] bg-transparent"
              style={{ borderColor: BORDER, color: INK, fontFamily: MONO }}
              disabled={actionState !== "idle"}
            />
            <button
              type="button"
              onClick={onReject}
              disabled={actionState !== "idle" || !rejectNotes.trim()}
              className="h-9 rounded-full px-4 text-[12.5px] font-medium inline-flex items-center justify-center gap-2 disabled:opacity-40"
              style={{
                background: SURFACE_2,
                color: INK,
                border: `1px solid ${PEACH}66`,
              }}
            >
              {actionState === "rejecting" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Rejecting
                </>
              ) : (
                <>
                  <X className="h-3.5 w-3.5" style={{ color: PEACH }} />
                  Reject
                </>
              )}
            </button>
          </div>
        </div>

        {/* Re-run pipeline — for bundles that need another extraction pass
            before they're publish-ready. Sends coverage gap hints into the
            scraper so weak sections get extra attention this time around. */}
        <div className="flex items-center justify-between gap-3 mt-2 pt-4" style={{ borderTop: `1px solid ${BORDER_SOFT}` }}>
          <div className="text-[11.5px]" style={{ color: MUTED, fontFamily: MONO }}>
            not ready to publish but worth retrying? re-run the pipeline with coverage gap hints.
          </div>
          <button
            type="button"
            onClick={onRerun}
            disabled={actionState !== "idle"}
            className="h-8 rounded-full px-3.5 text-[11.5px] font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
            style={{
              background: SURFACE_2,
              color: INK,
              border: `1px solid ${VIOLET}55`,
              fontFamily: MONO,
            }}
          >
            {actionState === "rerunning" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Queueing
              </>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5" style={{ color: VIOLET }} />
                Re-run pipeline
              </>
            )}
          </button>
        </div>
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
