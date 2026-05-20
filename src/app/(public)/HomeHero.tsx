"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Globe } from "lucide-react";
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
  VIOLET,
} from "@/lib/ui-data/tokens";
import { openAuthModal, useAuth } from "@/lib/ui-data/mockAuth";

/**
 * Split hero for the public landing page.
 *
 * Left column: storytelling (label + headline + palette bar + sample
 * design.md card + three quick links).
 * Right column: action card with a paste-URL input that navigates
 * to /generate?url=... where the live pipeline runs. Sign-in is the
 * subdued footer line — not the primary CTA, since the product now
 * supports anonymous generation.
 */
export function HomeHero() {
  const router = useRouter();
  const { user } = useAuth();
  const signedIn = Boolean(user);
  const [urlInput, setUrlInput] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = urlInput.trim();
    if (!v) {
      router.push("/generate");
      return;
    }
    router.push(`/generate?url=${encodeURIComponent(v)}`);
  }

  return (
    <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
      <div className="mx-auto max-w-6xl px-6 lg:px-8 pt-20 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-12 lg:gap-16 items-start">
          {/* Left: storytelling */}
          <div>
            <div
              className="inline-flex items-center gap-2 text-[10.5px] uppercase tracking-[0.22em] mb-7"
              style={{ fontFamily: MONO, color: MUTED }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: LIME, boxShadow: `0 0 8px ${LIME}88` }}
                aria-hidden
              />
              <span style={{ color: SUB }}>UIUXofAi</span>
              <span className="h-px w-5" style={{ background: "#26262A" }} aria-hidden />
              <span>The catalog for designers shipping with AI</span>
            </div>

            <h1
              className="text-[44px] sm:text-[60px] lg:text-[72px] leading-[1.02] font-medium tracking-[-0.022em]"
              style={{ color: INK }}
            >
              Stop fighting{" "}
              <br />
              <span style={{ color: SUB }}>the model's defaults.</span>
            </h1>

            {/* Palette bar — five hero accent colors */}
            <div className="mt-8 h-1.5 w-full max-w-md rounded overflow-hidden flex" aria-hidden>
              <span className="flex-1" style={{ background: VIOLET }} />
              <span className="flex-1" style={{ background: LIME }} />
              <span className="flex-1" style={{ background: PEACH }} />
              <span className="flex-1" style={{ background: CYAN }} />
              <span className="flex-1" style={{ background: "#EB5757" }} />
            </div>

            {/* Sample design.md card */}
            <div
              className="mt-6 rounded-lg border p-5 max-w-xl"
              style={{ borderColor: BORDER, background: SURFACE }}
            >
              <div
                className="text-[11.5px] mb-2"
                style={{ fontFamily: MONO, color: SUB }}
              >
                <span style={{ color: INK }}>~/.claude/skills/linear</span>
                <span className="mx-2" style={{ color: MUTED }}>·</span>
                design.md
                <span className="mx-2" style={{ color: MUTED }}>·</span>
                <span style={{ color: LIME }}>94% coverage</span>
              </div>
              <p className="text-[13.5px] leading-[1.6]" style={{ color: SUB }}>
                Linear, Vercel, Stripe, Apple HIG — drop one in and your AI
                starts shipping on-brand.
              </p>
            </div>

            {/* Three quick links */}
            <ul className="mt-6 space-y-2 text-[13.5px]">
              <li>
                <Link
                  href="/library"
                  className="inline-flex items-center gap-1.5 hover:underline underline-offset-4"
                  style={{ color: INK }}
                >
                  Browse the library
                </Link>
                <span style={{ color: SUB }}>
                  {" "}— no account required.
                </span>
              </li>
              <li>
                <Link
                  href="/generate"
                  className="inline-flex items-center gap-1.5 hover:underline underline-offset-4"
                  style={{ color: INK }}
                >
                  Generate from a URL
                </Link>
                <span style={{ color: SUB }}>
                  {" "}— sign-in optional, sign in to save your drafts.
                </span>
              </li>
              <li>
                <Link
                  href="/docs/cli"
                  className="inline-flex items-center gap-1.5 hover:underline underline-offset-4"
                  style={{ color: INK }}
                >
                  Install via CLI
                </Link>
                <span style={{ color: SUB }}>
                  {" "}— npx uiuxofai add &lt;id&gt;.
                </span>
              </li>
            </ul>
          </div>

          {/* Right: action card */}
          <aside
            className="rounded-xl border p-6 flex flex-col gap-4"
            style={{
              borderColor: BORDER,
              background: SURFACE,
              boxShadow: `0 0 0 1px ${VIOLET}11, 0 24px 48px -24px ${VIOLET}22`,
            }}
          >
            <div
              className="text-[10.5px] uppercase tracking-[0.22em]"
              style={{ fontFamily: MONO, color: MUTED }}
            >
              Generate from URL
            </div>

            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              <div
                className="h-11 rounded-full border flex items-center gap-2 px-3"
                style={{ borderColor: BORDER, background: SURFACE_2 }}
              >
                <Globe className="h-3.5 w-3.5" style={{ color: MUTED }} />
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://linear.app"
                  className="flex-1 bg-transparent text-[13px] outline-none"
                  style={{ color: INK, fontFamily: MONO }}
                />
              </div>

              <button
                type="submit"
                className="h-11 rounded-full px-5 text-[13px] font-medium inline-flex items-center justify-center gap-2"
                style={{ background: INK, color: INK_ON_LIGHT }}
              >
                Generate
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </form>

            <Link
              href="/generate?mode=upload"
              className="text-[11.5px] text-center underline underline-offset-4"
              style={{ color: SUB, fontFamily: MONO }}
            >
              or upload a screenshot →
            </Link>

            <div className="h-px" style={{ background: BORDER_SOFT }} aria-hidden />

            {signedIn ? (
              <Link
                href="/library"
                className="text-[12px] text-center"
                style={{ color: SUB }}
              >
                Welcome back · view your library →
              </Link>
            ) : (
              <p className="text-[11.5px] leading-[1.55] text-center" style={{ color: SUB }}>
                <button
                  type="button"
                  onClick={() => openAuthModal(null)}
                  className="underline underline-offset-4"
                  style={{ color: INK }}
                >
                  Sign in
                </button>{" "}
                to save your generations and pin favorites — both coming soon.
              </p>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}
