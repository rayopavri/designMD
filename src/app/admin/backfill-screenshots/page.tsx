"use client";

import { useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { SectionLabel } from "@/components/ui/Shell";
import {
  BORDER,
  INK,
  INK_ON_LIGHT,
  MONO,
  MUTED,
  PEACH,
  SUB,
  SURFACE,
  VIOLET,
} from "@/lib/ui-data/tokens";

type Storage = { configured: boolean; ok: boolean; status?: number; error?: string };
type Result = {
  ok: boolean;
  enqueued: number;
  remaining: number;
  etaSeconds: number;
  storage?: Storage;
};

function storageHint(s: Storage): string {
  if (!s.configured) {
    return "The app doesn't have your Supabase credentials. In Vercel → Settings → Environment Variables, add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (exact names, no NEXT_PUBLIC_ prefix), enabled for Production.";
  }
  if (s.status === 401 || s.status === 403) {
    return "The Supabase service-role key looks wrong. Copy the service_role key (not the anon key) from Supabase → Settings → API into SUPABASE_SERVICE_ROLE_KEY.";
  }
  if (s.status === 404 || s.status === 400) {
    return "The app reached Supabase but couldn't write to the bucket. Make sure a Public bucket named exactly bundle-screenshots exists.";
  }
  return `Storage write test failed${s.error ? `: ${s.error}` : ""}.`;
}

export default function BackfillScreenshotsPage() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/backfill-screenshots", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || `Request failed (${res.status})`);
        return;
      }
      setResult(body as Result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setRunning(false);
    }
  }

  const mins = result ? Math.max(1, Math.ceil(result.etaSeconds / 60)) : 0;

  return (
    <div className="mx-auto max-w-2xl px-6 lg:px-8 py-16">
      <SectionLabel n="◆" t="Admin · Screenshots" />
      <h1 className="mt-4 text-[32px] font-medium tracking-[-0.02em]">Backfill screenshots</h1>
      <p className="mt-3 text-[14px] leading-[1.6]" style={{ color: SUB }}>
        Captures a real website screenshot for every published bundle that doesn&apos;t have one
        yet and shows it as the detail-page hero. Each source is re-scraped in the background
        (staggered so we stay gentle on Firecrawl), so screenshots fill in over a few minutes.
        Safe to run more than once — it skips bundles that already have one.
      </p>

      <button
        onClick={() => void run()}
        disabled={running}
        className="mt-7 h-11 rounded-full px-6 text-[13px] font-medium inline-flex items-center gap-2"
        style={{
          background: INK,
          color: INK_ON_LIGHT,
          opacity: running ? 0.6 : 1,
          cursor: running ? "not-allowed" : "pointer",
          boxShadow: `0 0 0 1px ${VIOLET}55, 0 10px 36px -10px ${VIOLET}88`,
        }}
      >
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        {running ? "Enqueuing…" : "Backfill screenshots"}
      </button>

      {error ? (
        <div
          className="mt-6 rounded-lg border p-4 text-[13px]"
          style={{ borderColor: BORDER, background: SURFACE, color: SUB }}
        >
          <span style={{ color: PEACH }}>Error: </span>
          {error}
          <div className="mt-1 text-[12px]" style={{ color: MUTED }}>
            You must be signed in as an editor/admin to run this.
          </div>
        </div>
      ) : null}

      {result && result.storage && !result.storage.ok ? (
        <div className="mt-6 rounded-lg border p-5" style={{ borderColor: PEACH, background: SURFACE }}>
          <div
            className="text-[10.5px] uppercase tracking-[0.22em] mb-2"
            style={{ fontFamily: MONO, color: PEACH }}
          >
            storage not ready — no jobs enqueued
          </div>
          <div className="text-[13.5px] leading-[1.6]" style={{ color: INK }}>
            {storageHint(result.storage)}
          </div>
          <div className="mt-2 text-[11.5px] leading-[1.5]" style={{ fontFamily: MONO, color: MUTED }}>
            After fixing it in Vercel, <strong>redeploy</strong> (env changes don&apos;t apply to the
            running build), then click the button again.
            {result.storage.status ? ` · storage test returned HTTP ${result.storage.status}` : ""}
          </div>
        </div>
      ) : result ? (
        <div className="mt-6 rounded-lg border p-5" style={{ borderColor: BORDER, background: SURFACE }}>
          <div
            className="text-[10.5px] uppercase tracking-[0.22em] mb-2"
            style={{ fontFamily: MONO, color: MUTED }}
          >
            result
          </div>
          {result.enqueued > 0 ? (
            <>
              <div className="text-[14px]" style={{ color: INK }}>
                Enqueued <strong>{result.enqueued}</strong> screenshot job
                {result.enqueued === 1 ? "" : "s"}.
              </div>
              <div className="mt-1 text-[13px]" style={{ color: SUB }}>
                They&apos;ll finish over roughly {mins} minute{mins === 1 ? "" : "s"}. Refresh a
                bundle&apos;s page after that to see its screenshot.
              </div>
            </>
          ) : (
            <div className="text-[14px]" style={{ color: INK }}>
              Nothing to do — every published bundle already has a screenshot. 🎉
            </div>
          )}
          {result.remaining > 0 ? (
            <div className="mt-2 text-[12.5px]" style={{ fontFamily: MONO, color: MUTED }}>
              {result.remaining} more remain — click again once these finish.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
