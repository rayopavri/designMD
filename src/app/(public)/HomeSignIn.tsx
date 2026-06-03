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
  MONO,
  MUTED,
  SUB,
  SURFACE,
  VIOLET,
} from "@/lib/ui-data/tokens";
import { useAuth } from "@/lib/ui-data/mockAuth";

export function HomeSignIn() {
  const router = useRouter();
  const { user } = useAuth();

  if (user) {
    return (
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-6xl px-6 lg:px-8 py-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div>
            <p
              className="text-[18px] font-medium tracking-[-0.012em] mb-1"
              style={{ color: INK }}
            >
              Pick up where you left off.
            </p>
            <p className="text-[13px]" style={{ color: MUTED }}>
              10 generations/hour · saved to your account · byline on every design skill you publish
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/library"
              className="h-10 rounded-full px-5 text-[13px] font-medium inline-flex items-center gap-2"
              style={{ background: INK, color: INK_ON_LIGHT }}
            >
              Design skills
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/generate"
              className="h-10 rounded-full border px-5 text-[13px] font-medium inline-flex items-center"
              style={{ borderColor: BORDER, color: INK }}
            >
              Generate
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
      <div className="mx-auto max-w-6xl px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-16 items-center">

          {/* Left: copy */}
          <div>
            <div
              className="text-[10.5px] uppercase tracking-[0.22em] mb-6"
              style={{ fontFamily: MONO, color: MUTED }}
            >
              Join the community
            </div>
            <h2
              className="text-[40px] sm:text-[52px] leading-[1.05] font-medium tracking-[-0.022em] mb-6"
              style={{ color: INK }}
            >
              Ship on-brand.
              <br />
              <span style={{ color: SUB }}>Get credited.</span>
            </h2>
            <p className="text-[16px] leading-[1.65]" style={{ color: SUB }}>
              Submit a design skill under your name. Build a public profile. 10 generations per hour instead of 3 — your work
              persists and is saved to your account.
            </p>
          </div>

          {/* Right: auth card with violet glow */}
          <div
            className="rounded-xl border p-7"
            style={{
              borderColor: BORDER,
              background: SURFACE,
              boxShadow: `0 0 0 1px ${VIOLET}11, 0 32px 64px -32px ${VIOLET}33`,
            }}
          >
            <AuthCard
              variant="compact"
              title="Sign in to UIUXskills"
              onSuccess={() => router.refresh()}
            />
          </div>

        </div>
      </div>
    </section>
  );
}
