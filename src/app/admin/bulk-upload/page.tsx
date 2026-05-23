"use client";

import { useCallback, useRef, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, Upload, XCircle } from "lucide-react";
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

    // Markdown table row: extract the last https?:// match
    let candidate: string;
    if (trimmed.includes("|")) {
      const match = trimmed.match(/https?:\/\/[^\s|)>\]"]+/g);
      if (!match) continue;
      candidate = match[match.length - 1].replace(/\/$/, "");
    } else {
      candidate = trimmed;
    }

    // Validate
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

    // Deduplicate by href without trailing slash
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

type SubmitState = "idle" | "submitting" | "done" | "forbidden" | "error";

interface Outcome {
  url: string;
  status: "enqueued" | "skipped";
  jobId?: string;
  reason?: string;
  delaySeconds?: number;
}

interface ApiResponse {
  enqueued: number;
  skipped: {
    duplicate: number;
    alreadyExists: number;
    alreadyInFlight: number;
    invalid: number;
  };
  outcomes: Outcome[];
  etaSeconds: number;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function BulkUploadPage() {
  const [text, setText] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { urls, invalidCount, duplicateCount } = parseUrls(text);

  const onFileChange = useCallback((e: { target: HTMLInputElement & EventTarget }) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setText((ev.target?.result as string) ?? "");
    };
    reader.readAsText(file);
    // Reset so the same file can be re-uploaded
    e.target.value = "";
  }, []);

  const onSubmit = async () => {
    if (urls.length === 0 || submitState === "submitting") return;
    setSubmitState("submitting");
    setErrorMsg(null);
    setResult(null);

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

      setResult(body as ApiResponse);
      setSubmitState("done");
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

  const etaMin = result ? Math.ceil(result.etaSeconds / 60) : null;

  return (
    <div className="mx-auto max-w-4xl px-6 lg:px-8 py-12">
      <div className="mb-8">
        <SectionLabel t="Admin" />
        <h1 className="mt-3 text-[32px] font-medium tracking-[-0.018em]">Bulk upload</h1>
        <p className="mt-2 text-[13px] leading-[1.65]" style={{ color: SUB }}>
          Paste a URL list or a markdown table (one row per site). Each URL is scraped, turned into
          a DESIGN.md bundle, and published automatically — no editorial review step.
        </p>
      </div>

      {/* ── Input card ─────────────────────────────────────────────────────── */}
      <div
        className="rounded-xl border p-6 flex flex-col gap-4"
        style={{ borderColor: BORDER, background: SURFACE }}
      >
        <div className="flex items-center justify-between gap-4">
          <span className="text-[11px] uppercase tracking-[0.22em]" style={{ fontFamily: MONO, color: MUTED }}>
            URL list
          </span>
          <div className="flex items-center gap-3">
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
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-8 rounded-md border px-3 text-[11.5px] inline-flex items-center gap-1.5"
              style={{ borderColor: BORDER, color: SUB, fontFamily: MONO, background: SURFACE_2 }}
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
          rows={14}
          placeholder={`Plain list:\nhttps://www.stripe.com\nhttps://linear.app\n\nOR paste a markdown table:\n| 1 | Stripe | https://stripe.com |\n| 2 | Linear | https://linear.app |`}
          className="w-full rounded-lg border px-3 py-3 text-[12px] leading-[1.7] resize-y bg-transparent focus:outline-none"
          style={{
            borderColor: BORDER,
            color: INK,
            fontFamily: MONO,
            minHeight: 220,
          }}
          disabled={submitState === "submitting"}
        />

        <div className="flex items-center justify-between gap-4">
          <p className="text-[11px]" style={{ color: MUTED, fontFamily: MONO }}>
            Bundles publish automatically after ~3 min per site.{" "}
            {urls.length > 0
              ? `ETA for ${urls.length} sites: ~${Math.ceil(((urls.length - 1) * 30 + 60) / 60)} min`
              : ""}
          </p>
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={urls.length === 0 || submitState === "submitting"}
            className="h-9 rounded-full px-5 text-[12.5px] font-medium inline-flex items-center gap-2 disabled:opacity-50"
            style={{ background: INK, color: INK_ON_LIGHT, fontFamily: SANS }}
          >
            {submitState === "submitting" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Queueing…
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

      {/* ── Results ────────────────────────────────────────────────────────── */}
      {result && (
        <div className="mt-8 flex flex-col gap-4">
          {/* Summary chips */}
          <div className="flex flex-wrap items-center gap-3">
            <span
              className="text-[11.5px] px-3 py-1.5 rounded-full border inline-flex items-center gap-1.5"
              style={{ fontFamily: MONO, color: LIME, borderColor: `${LIME}44`, background: `${LIME}0D` }}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {result.enqueued} enqueued
            </span>
            {(Object.entries(result.skipped) as [string, number][]).map(([k, v]) =>
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
            {etaMin !== null && result.enqueued > 0 && (
              <span
                className="text-[11.5px] px-3 py-1.5 rounded-full border"
                style={{ fontFamily: MONO, color: SUB, borderColor: BORDER }}
              >
                ~{etaMin} min to complete
              </span>
            )}
          </div>

          {/* Outcomes table */}
          <div
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: BORDER }}
          >
            <table className="w-full text-[11.5px]" style={{ fontFamily: MONO }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}`, background: SURFACE_2 }}>
                  <th className="text-left px-4 py-3 font-normal" style={{ color: MUTED }}>URL</th>
                  <th className="text-left px-4 py-3 font-normal w-28" style={{ color: MUTED }}>Status</th>
                  <th className="text-left px-4 py-3 font-normal w-36" style={{ color: MUTED }}>Reason / job</th>
                </tr>
              </thead>
              <tbody>
                {result.outcomes.map((o, i) => (
                  <tr
                    key={`${o.url}-${i}`}
                    style={{
                      borderBottom: i < result.outcomes.length - 1 ? `1px solid ${BORDER}` : undefined,
                      background: BG,
                    }}
                  >
                    <td className="px-4 py-2.5 truncate max-w-xs" style={{ color: SUB }}>
                      {o.url}
                    </td>
                    <td className="px-4 py-2.5">
                      {o.status === "enqueued" ? (
                        <span className="inline-flex items-center gap-1" style={{ color: LIME }}>
                          <CheckCircle2 className="h-3 w-3" />
                          enqueued
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1" style={{ color: PEACH }}>
                          <XCircle className="h-3 w-3" />
                          skipped
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: MUTED }}>
                      {o.status === "enqueued"
                        ? o.delaySeconds
                          ? `+${o.delaySeconds}s`
                          : "immediate"
                        : o.reason ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
