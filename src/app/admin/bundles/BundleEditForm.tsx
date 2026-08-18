"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, RotateCw, Save, Upload, X } from "lucide-react";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { compressImageForUpload } from "@/lib/image/compress";
import {
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
import { StatusPill } from "./StatusPill";
import type { ActionState, Category, DetailRow, EditFormState } from "./types";

export interface BundleEditFormProps {
  detail: DetailRow;
  form: EditFormState;
  categories: Category[];
  isDirty: boolean;
  actionState: ActionState;
  actionError: string | null;
  onFormChange: (form: EditFormState) => void;
  onSave: () => void | Promise<void>;
  onCancelEdit: () => void;
  onScreenshotUpdate: (url: string | null) => void;
  onCategoryCreated: (cat: Category) => void;
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="text-[10px] uppercase tracking-[0.22em]"
        style={{ color: MUTED, fontFamily: MONO }}
      >
        {label}
      </label>
      {children}
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

export function BundleEditForm({
  detail,
  form,
  categories,
  isDirty,
  actionState,
  actionError,
  onFormChange,
  onSave,
  onCancelEdit,
  onScreenshotUpdate,
  onCategoryCreated,
}: BundleEditFormProps) {
  const status = detail.status;
  const busy = actionState !== "idle";

  const [newCatName, setNewCatName] = useState("");
  const [newCatState, setNewCatState] = useState<"idle" | "saving" | "error">("idle");
  const [newCatError, setNewCatError] = useState<string | null>(null);
  const [showNewCat, setShowNewCat] = useState(false);
  const newCatInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setShowNewCat(false);
    setNewCatName("");
    setNewCatState("idle");
    setNewCatError(null);
  }, [detail.slug]);

  useEffect(() => {
    if (showNewCat) {
      newCatInputRef.current?.focus();
    }
  }, [showNewCat]);

  async function createCategory() {
    const name = newCatName.trim();
    if (!name) return;
    setNewCatState("saving");
    setNewCatError(null);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = (await res.json()) as { data?: Category; error?: string };
      if (!res.ok) {
        setNewCatError(body.error ?? `Error ${res.status}`);
        setNewCatState("error");
        return;
      }
      if (body.data) {
        onCategoryCreated(body.data);
        onFormChange({ ...form, primaryCategoryId: body.data.id });
      }
      setNewCatName("");
      setShowNewCat(false);
      setNewCatState("idle");
    } catch (err) {
      setNewCatError(err instanceof Error ? err.message : "Network error");
      setNewCatState("error");
    }
  }

  const [screenshotBusy, setScreenshotBusy] = useState<"recapture" | "upload" | null>(null);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [screenshotSaved, setScreenshotSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function markScreenshotSaved() {
    setScreenshotSaved(true);
    setTimeout(() => setScreenshotSaved(false), 3000);
  }

  async function handleRecapture() {
    setScreenshotBusy("recapture");
    setScreenshotError(null);
    try {
      const res = await fetch(`/api/admin/bundles/${detail.slug}/screenshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "recapture" }),
      });
      const body = (await res
        .json()
        .catch(() => ({ error: res.statusText }))) as {
        previewImageUrl?: string;
        error?: string;
      };
      if (!res.ok) {
        setScreenshotError(body.error ?? `Error ${res.status}`);
      } else {
        // Append a cache-bust so the <img> always fetches the newly stored file.
        // The DB stores the clean URL; the bust is only for this session's display.
        const url = body.previewImageUrl;
        onScreenshotUpdate(url ? `${url}?v=${Date.now()}` : null);
        markScreenshotSaved();
      }
    } catch (err) {
      setScreenshotError(err instanceof Error ? err.message : "Network error");
    } finally {
      setScreenshotBusy(null);
    }
  }

  async function handleUpload(file: File) {
    setScreenshotBusy("upload");
    setScreenshotError(null);
    try {
      // Compress before upload to stay under Vercel's ~4.5 MB request-body cap.
      // Screenshots are often 10-20 MB PNGs; compress.ts brings them to ~1 MB WebP.
      const { file: compressed } = await compressImageForUpload(file);
      const fd = new FormData();
      fd.append("file", compressed);
      const res = await fetch(`/api/admin/bundles/${detail.slug}/screenshot`, {
        method: "POST",
        body: fd,
      });
      const body = (await res
        .json()
        .catch(() => ({ error: res.statusText }))) as {
        previewImageUrl?: string;
        error?: string;
      };
      if (!res.ok) {
        setScreenshotError(body.error ?? `Error ${res.status}`);
      } else {
        // Cache-bust so the browser re-fetches the replaced image immediately.
        const url = body.previewImageUrl;
        onScreenshotUpdate(url ? `${url}?v=${Date.now()}` : null);
        markScreenshotSaved();
      }
    } catch (err) {
      setScreenshotError(err instanceof Error ? err.message : "Network error");
    } finally {
      setScreenshotBusy(null);
    }
  }

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
          <div className="mt-3 flex flex-col gap-3">
            <FieldGroup label="title">
              <input
                type="text"
                value={form.title}
                maxLength={200}
                onChange={(e) => onFormChange({ ...form, title: e.target.value })}
                className="w-full rounded-md border px-2.5 py-2 text-[14px] outline-none"
                style={{ color: INK, background: SURFACE_2, borderColor: BORDER }}
              />
            </FieldGroup>
            <FieldGroup label="description">
              <textarea
                value={form.description}
                rows={3}
                maxLength={2000}
                onChange={(e) => onFormChange({ ...form, description: e.target.value })}
                className="w-full resize-y rounded-md border px-2.5 py-2 text-[13px] outline-none"
                style={{ color: INK, background: SURFACE_2, borderColor: BORDER }}
              />
            </FieldGroup>
            <FieldGroup label="source url">
              <input
                type="url"
                value={form.sourceUrl}
                maxLength={2000}
                placeholder="https://example.com"
                onChange={(e) => onFormChange({ ...form, sourceUrl: e.target.value })}
                className="w-full rounded-md border px-2.5 py-2 text-[12px] outline-none"
                style={{
                  color: INK,
                  background: SURFACE_2,
                  borderColor: BORDER,
                  fontFamily: MONO,
                }}
              />
            </FieldGroup>
            <FieldGroup label="brand logo url">
              <div className="flex items-center gap-2.5">
                <BrandLogo
                  src={form.brandLogoUrl || null}
                  fallbackDomain={detail.sourceDomain}
                  size={32}
                />
                <input
                  type="url"
                  value={form.brandLogoUrl}
                  maxLength={2000}
                  placeholder="https://example.com/icon.png"
                  onChange={(e) => onFormChange({ ...form, brandLogoUrl: e.target.value })}
                  className="w-full rounded-md border px-2.5 py-2 text-[12px] outline-none"
                  style={{
                    color: INK,
                    background: SURFACE_2,
                    borderColor: BORDER,
                    fontFamily: MONO,
                  }}
                />
              </div>
            </FieldGroup>
            <FieldGroup label="category">
              <select
                value={form.primaryCategoryId ?? ""}
                onChange={(e) =>
                  onFormChange({ ...form, primaryCategoryId: e.target.value || null })
                }
                className="w-full rounded-md border px-2.5 py-2 text-[13px] outline-none"
                style={{ color: INK, background: SURFACE_2, borderColor: BORDER }}
              >
                <option value="">(none)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {!showNewCat ? (
                <button
                  type="button"
                  onClick={() => setShowNewCat(true)}
                  className="self-start text-[11px] underline underline-offset-2"
                  style={{ color: VIOLET, fontFamily: MONO }}
                >
                  + new category
                </button>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      ref={newCatInputRef}
                      type="text"
                      value={newCatName}
                      maxLength={100}
                      placeholder="Category name"
                      onChange={(e) => setNewCatName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void createCategory();
                        if (e.key === "Escape") {
                          setShowNewCat(false);
                          setNewCatName("");
                        }
                      }}
                      className="flex-1 rounded-md border px-2.5 py-1.5 text-[12px] outline-none"
                      style={{ color: INK, background: SURFACE_2, borderColor: BORDER }}
                    />
                    <button
                      type="button"
                      onClick={() => void createCategory()}
                      disabled={newCatState === "saving" || !newCatName.trim()}
                      className="h-7 rounded-md border px-3 text-[11px] disabled:opacity-40"
                      style={{ borderColor: `${VIOLET}66`, color: VIOLET, fontFamily: MONO }}
                    >
                      {newCatState === "saving" ? "saving…" : "create"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewCat(false);
                        setNewCatName("");
                        setNewCatError(null);
                      }}
                      className="h-7 w-7 flex items-center justify-center rounded-md opacity-50 hover:opacity-100"
                      style={{ color: MUTED }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {newCatError && (
                    <p className="text-[11px]" style={{ color: PEACH, fontFamily: MONO }}>
                      {newCatError}
                    </p>
                  )}
                </div>
              )}
            </FieldGroup>
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
        <div
          className="flex items-center gap-2 px-3 py-2 border-t"
          style={{ borderColor: BORDER }}
        >
          {detail.sourceUrl && !detail.sourceUrl.startsWith("upload://") && (
            <button
              type="button"
              disabled={!!screenshotBusy}
              onClick={() => void handleRecapture()}
              className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[11px] border disabled:opacity-40"
              style={{ color: INK, background: SURFACE_2, borderColor: BORDER, fontFamily: MONO }}
            >
              {screenshotBusy === "recapture" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RotateCw className="h-3 w-3" />
              )}
              Re-capture
            </button>
          )}
          <button
            type="button"
            disabled={!!screenshotBusy}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[11px] border disabled:opacity-40"
            style={{ color: INK, background: SURFACE_2, borderColor: BORDER, fontFamily: MONO }}
          >
            {screenshotBusy === "upload" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Upload className="h-3 w-3" />
            )}
            Upload
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(file);
              e.target.value = "";
            }}
          />
          {screenshotSaved && (
            <span className="text-[11px] ml-1" style={{ color: LIME, fontFamily: MONO }}>
              screenshot saved
            </span>
          )}
          {screenshotError && (
            <span className="text-[11px] ml-1" style={{ color: PEACH, fontFamily: MONO }}>
              {screenshotError}
            </span>
          )}
        </div>
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

      {/* design.md / companion — editable */}
      <details
        className="rounded-lg border"
        style={{ borderColor: BORDER, background: SURFACE }}
        open
      >
        <summary
          className="cursor-pointer p-3 text-[11.5px] uppercase tracking-[0.22em]"
          style={{ color: SUB, fontFamily: MONO }}
        >
          design.md (editing — re-lints on save)
        </summary>
        <textarea
          value={form.designMd}
          rows={24}
          maxLength={200_000}
          onChange={(e) => onFormChange({ ...form, designMd: e.target.value })}
          className="w-full resize-y px-4 py-3 text-[11px] leading-[1.55] outline-none border-t"
          style={{ color: INK, fontFamily: MONO, background: SURFACE_2, borderColor: BORDER_SOFT }}
        />
      </details>
      <details
        className="rounded-lg border"
        style={{ borderColor: BORDER, background: SURFACE }}
        open
      >
        <summary
          className="cursor-pointer p-3 text-[11.5px] uppercase tracking-[0.22em]"
          style={{ color: SUB, fontFamily: MONO }}
        >
          companion prompt (editing — bumps version) · {detail.companionStatus}
        </summary>
        <textarea
          value={form.companionPrompt}
          rows={20}
          maxLength={200_000}
          onChange={(e) => onFormChange({ ...form, companionPrompt: e.target.value })}
          className="w-full resize-y px-4 py-3 text-[11px] leading-[1.55] outline-none border-t"
          style={{ color: INK, fontFamily: MONO, background: SURFACE_2, borderColor: BORDER_SOFT }}
        />
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
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={!isDirty || busy || form.companionPrompt.trim() === ""}
            title={
              form.companionPrompt.trim() === ""
                ? "Companion prompt can't be empty"
                : !isDirty
                  ? "No changes to save"
                  : "Save your manual edits"
            }
            className="h-9 rounded-full px-4 text-[12.5px] font-medium inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: INK,
              color: INK_ON_LIGHT,
              boxShadow: `0 0 0 1px ${LIME}55, 0 10px 28px -12px ${LIME}66`,
            }}
          >
            {actionState === "saving" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" style={{ color: INK_ON_LIGHT }} />
                Save
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => onCancelEdit()}
            disabled={busy}
            className="h-9 rounded-full px-4 text-[12.5px] inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: SURFACE_2, color: SUB, border: `1px solid ${BORDER}` }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
