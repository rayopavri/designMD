"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { AuthCard } from "@/components/ui/AuthCard";
import {
  BORDER,
  BORDER_SOFT,
  INK,
  INK_ON_LIGHT,
  LIME,
  MONO,
  MUTED,
  SUB,
  VIOLET,
} from "@/lib/ui-data/tokens";
import { useAuth } from "@/lib/ui-data/mockAuth";

const BRANDS = [
  { name: "Linear",  dot: "#5E6AD2" },
  { name: "Stripe",  dot: "#635BFF" },
  { name: "Vercel",  dot: "#F2F1EE" },
  { name: "Apple",   dot: "#A2AAAD" },
  { name: "Notion",  dot: "#FFFFFF" },
  { name: "Arc",     dot: "#FF7C5C" },
  { name: "Raycast", dot: "#FF6363" },
  { name: "Figma",   dot: "#F24E1E" },
];


export function HomeHero() {
  const router = useRouter();
  const { user } = useAuth();
  const signedIn = Boolean(user);

  return (
    <>
      {/* ── Above-the-fold hero ── */}
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-6xl px-6 lg:px-8 pt-20 pb-16 text-center">

          {/* Eyebrow */}
          <div
            className="inline-flex items-center gap-2 text-[10.5px] uppercase tracking-[0.22em] mb-9"
            style={{ fontFamily: MONO, color: MUTED }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: LIME, boxShadow: `0 0 8px ${LIME}88` }}
              aria-hidden
            />
            For designers who actually ship
          </div>

          {/* Headline — each phrase is its own line; lg:whitespace-nowrap locks
              each to a single line on desktop, smaller viewports wrap freely */}
          <h1
            className="text-[46px] sm:text-[62px] lg:text-[76px] leading-[1.02] font-medium tracking-[-0.025em] mb-7"
            style={{ color: INK }}
          >
            <span className="block lg:whitespace-nowrap">What does Stripe tell AI</span>
            <span className="block lg:whitespace-nowrap" style={{ color: SUB }}>about how to design?</span>
          </h1>

          {/* Subheadline */}
          <p
            className="mx-auto max-w-[520px] text-[17px] leading-[1.65] mb-10"
            style={{ color: SUB }}
          >
            We reverse-engineered the design systems behind the interfaces
            designers aspire to — distilled into DESIGN.md bundles your AI
            can act on. Paste one in. Watch the diff.
          </p>

          {/* CTAs — primary fills, secondary ghost */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-14">
            <Link
              href="/library"
              className="h-12 rounded-full px-7 text-[13.5px] font-medium inline-flex items-center gap-2 transition-opacity hover:opacity-90"
              style={{ background: VIOLET, color: INK_ON_LIGHT }}
            >
              Open the library
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/generate"
              className="h-12 rounded-full border px-7 text-[13.5px] font-medium inline-flex items-center gap-2 transition-opacity hover:opacity-70"
              style={{ borderColor: BORDER, color: SUB }}
            >
              Generate from your URL
            </Link>
          </div>

          {/* Brand strip — authority transfer before the fold */}
          <div
            className="flex items-center justify-center gap-x-6 gap-y-3 flex-wrap"
          >
            {BRANDS.map(({ name, dot }) => (
              <span
                key={name}
                className="inline-flex items-center gap-1.5 text-[11px]"
                style={{ fontFamily: MONO, color: MUTED }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ background: dot }}
                  aria-hidden
                />
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sign-in / welcome-back ── */}
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-6xl px-6 lg:px-8 py-16">
          {signedIn ? (
            <WelcomeBack />
          ) : (
            <div className="max-w-md">
              <AuthCard
                variant="compact"
                title="Designers who contribute get credited."
                intent="Submit a bundle under your name. Build a public profile in the library. 10 generations per hour instead of 3 — your work persists and is saved to your account."
                onSuccess={() => router.refresh()}
              />
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function WelcomeBack() {
  return (
    <div className="flex flex-col gap-5 max-w-sm">
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
        Your generations run at 10/hour and are saved to your account. Submit
        bundles to the public library under your byline.
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
    </div>
  );
}
