"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { AuthCard } from "@/components/ui/AuthCard";
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
  VIOLET,
} from "@/lib/ui-data/tokens";
import { useAuth } from "@/lib/ui-data/mockAuth";

/**
 * Split hero for the public landing page.
 *
 * Left column: storytelling (label + headline + palette bar + sample
 * design.md card + three quick links).
 * Right column: sign-in card with persuasive copy. Sign-in is OPTIONAL —
 * the left column has direct links to browse the library and generate
 * without signing in. The right rail is the upsell surface for the
 * value-added features (history, favorites, higher rate limit, byline).
 *
 * When signed in, the right rail flips to a "welcome back" aside with
 * shortcuts into the library and the generator.
 */
export function HomeHero() {
  const router = useRouter();
  const { user } = useAuth();
  const signedIn = Boolean(user);

  return (
    <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
      <div className="mx-auto max-w-6xl px-6 lg:px-8 pt-16 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-12 lg:gap-16 items-start">
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
              <span style={{ color: SUB }}>UIUXskills</span>
              <span className="h-px w-5" style={{ background: "#26262A" }} aria-hidden />
              <span>The catalog for designers shipping with AI</span>
            </div>

            <h1
              className="text-[44px] sm:text-[60px] lg:text-[72px] leading-[1.02] font-medium tracking-[-0.022em]"
              style={{ color: INK }}
            >
              Stop fighting{" "}
              <br />
              <span style={{ color: SUB }}>the model&apos;s defaults.</span>
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
              <div className="text-[11.5px] mb-2" style={{ fontFamily: MONO, color: SUB }}>
                <span style={{ color: INK }}>design.md</span>
                <span className="mx-2" style={{ color: MUTED }}>·</span>
                linear
                <span className="mx-2" style={{ color: MUTED }}>·</span>
                <span style={{ color: LIME }}>94% coverage</span>
              </div>
              <p className="text-[13.5px] leading-[1.6]" style={{ color: SUB }}>
                Linear, Vercel, Stripe, Apple HIG — drop one in and your AI starts
                shipping on-brand.
              </p>
            </div>

            {/* Three quick links — all work without sign-in */}
            <ul className="mt-6 space-y-2 text-[13.5px]">
              <li>
                <Link
                  href="/library"
                  className="inline-flex items-center gap-1.5 hover:underline underline-offset-4"
                  style={{ color: INK }}
                >
                  Browse the library
                </Link>
                <span style={{ color: SUB }}>{" "}— no account required.</span>
              </li>
              <li>
                <Link
                  href="/generate"
                  className="inline-flex items-center gap-1.5 hover:underline underline-offset-4"
                  style={{ color: INK }}
                >
                  Generate from a URL or screenshot
                </Link>
                <span style={{ color: SUB }}>{" "}— anonymous works, sign in for higher limits.</span>
              </li>
            </ul>
          </div>

          {/* Right: sign-in card or welcome-back aside */}
          {signedIn ? (
            <WelcomeBack />
          ) : (
            <aside
              className="rounded-xl border p-7"
              style={{
                borderColor: BORDER,
                background: SURFACE,
                boxShadow: `0 0 0 1px ${VIOLET}11, 0 24px 48px -24px ${VIOLET}22`,
              }}
            >
              <AuthCard
                variant="compact"
                title="Sign in to UIUXskills"
                intent="Save your generations. Pin favorites. Submit bundles under your byline. And get 10 generations per hour instead of 3. You can keep using the generator without signing in."
                onSuccess={() => {
                  // Stay on the homepage; the aside re-renders into the
                  // welcome-back state on the next render cycle.
                  router.refresh();
                }}
              />
            </aside>
          )}
        </div>
      </div>
    </section>
  );
}

function WelcomeBack() {
  return (
    <aside
      className="rounded-xl border p-7 flex flex-col gap-5"
      style={{
        borderColor: BORDER,
        background: SURFACE,
        boxShadow: `0 0 0 1px ${LIME}11, 0 24px 48px -24px ${LIME}22`,
      }}
    >
      <div
        className="text-[10.5px] uppercase tracking-[0.22em]"
        style={{ fontFamily: MONO, color: MUTED }}
      >
        Welcome back
      </div>
      <h3
        className="text-[22px] leading-[1.1] font-medium tracking-[-0.014em]"
        style={{ color: INK }}
      >
        Pick up where you left off.
      </h3>
      <p className="text-[13.5px] leading-[1.55]" style={{ color: SUB }}>
        Your generations are higher-priority and rate-limited at 10/hour. Save bundles, pin
        favorites (soon), and submit to the public library under your byline.
      </p>
      <div className="flex flex-col gap-2.5">
        <Link
          href="/library"
          className="h-11 rounded-full px-5 text-[13px] font-medium inline-flex items-center justify-center gap-2"
          style={{ background: INK, color: INK_ON_LIGHT }}
        >
          View the library
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <Link
          href="/generate"
          className="h-11 rounded-full border px-5 text-[13px] font-medium inline-flex items-center justify-center gap-2"
          style={{ borderColor: BORDER, color: INK }}
        >
          Generate something new
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </aside>
  );
}
