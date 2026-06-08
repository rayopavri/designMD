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

type Storage = { configured: boolean; ok: boolean; status?: number; error?: string; host?: string };
type Result = {
  ok: boolean;
  enqueued: number;
  remaining: number;
  etaSeconds: number;
  storage?: Storage;
  recaptureAll?: boolean;
};
type RunMode = "fill" | "recapture";

function storageHint(s: Storage): string {
  if (!s.configured) {
    return "The app doesn't have your Supabase credentials. In Vercel → Settings → Environment Variables, add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (exact names, no NEXT_PUBLIC_ prefix), enabled for Production.";
  }
  if (s.status === 401 || s.status === 403) {
    return "The Supabase service-role key looks wrong. Copy the service_role key (not the anon key) from Supabase → Settings → API into SUPABASE_SERVICE_ROLE_KEY.";
  }
  if (s.status === 404 || s.status === 400) {
    return "The app reached Supabase but the bundle-screenshots bucket isn't in the project it's connected to. Point SUPABASE_URL at the project where you created the bucket (and make sure the bucket is named exactly bundle-screenshots and is Public).";
  }
  return `Storage write test failed${s.error ? `: ${s.error}` : ""}.`;
}

export default function BackfillScreenshotsPage() {
  const [running, setRunning] = useState<RunMode | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(mode: RunMode) {
    if (mode === "recapture") {
      const ok = window.confirm(
        "Re-shoot every auto-captured screenshot in the library? Each source is re-scraped through Firecrawl (uses credits). Manual uploads and past Re-captures are skipped.",
      );
      if (!ok) return;
    }
    setRunning(mode);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/backfill-screenshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recaptureAll: mode === "recapture" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || `Request failed (${res.status})`);
        return;
      }
      setResult(body as Result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setRunning(null);
    }
  }

  const mins = result ? Math.max(1, Math.ceil(result.etaSeconds / 60)) : 0;

  return (
    <div className="mx-auto max-w-2xl px-6 lg:px-8 py-16">
      <SectionLabel n="◆" t="Admin · Screenshots" />
      <h1 className="mt-4 text-[32px] font-medium tracking-[-0.02em]">Backfill screenshots</h1>
      <p className="mt-3 text-[14px] leading-[1.6]" style={{ color: SUB }}>
        Captures a real website screenshot and shows it as the detail-page hero. Each source is
        re-scraped in the background (staggered so we stay gentle on Firecrawl), so screenshots
        fill in over a few minutes.
      </p>
      <ul className="mt-3 space-y-1.5 text-[13.5px] leading-[1.55]" style={{ color: SUB }}>
        <li>
          <strong style={{ color: INK }}>Fill missing</strong> — only bundles with no screenshot
          yet. Safe to run repeatedly; skips ones that already have one.
        </li>
        <li>
          <strong style={{ color: INK }}>Re-capture all</strong> — also re-shoots existing
          auto-captured screenshots with the latest capture settings.{" "}
          <span style={{ color: MUTED }}>
            Manual uploads and past Re-captures are left untouched.
          </span>
        </li>
      </ul>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <button
          onClick={() => void run("fill")}
          disabled={running !== null}
          className="h-11 rounded-full px-6 text-[13px] font-medium inline-flex items-center gap-2"
          style={{
            background: INK,
            color: INK_ON_LIGHT,
            opacity: running !== null ? 0.6 : 1,
            cursor: running !== null ? "not-allowed" : "pointer",
            boxShadow: `0 0 0 1px ${VIOLET}55, 0 10px 36px -10px ${VIOLET}88`,
          }}
        >
          {running === "fill" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
          {running === "fill" ? "Enqueuing…" : "Fill missing"}
        </button>

        <button
          onClick={() => void run("recapture")}
          disabled={running !== null}
          className="h-11 rounded-full px-6 text-[13px] font-medium inline-flex items-center gap-2 border"
          style={{
            background: SURFACE,
            color: INK,
            borderColor: BORDER,
            opacity: running !== null ? 0.6 : 1,
            cursor: running !== null ? "not-allowed" : "pointer",
          }}
        >
          {running === "recapture" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
          {running === "recapture" ? "Enqueuing…" : "Re-capture all"}
        </button>
      </div>

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
          {result.storage.host ? (
            <div className="mt-2 text-[11.5px]" style={{ fontFamily: MONO, color: SUB }}>
              app is connected to: <strong>{result.storage.host}</strong>
            </div>
          ) : null}
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
              {result.recaptureAll
                ? "Nothing to do — every eligible bundle already has a fresh screenshot. 🎉"
                : "Nothing to do — every published bundle already has a screenshot. 🎉"}
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
