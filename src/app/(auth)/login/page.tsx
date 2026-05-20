"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/ui/AuthCard";
import { postAuthDestination, useAuth } from "@/lib/ui-data/mockAuth";
import { BG, BORDER_SOFT, INK, MONO, MUTED, SUB, SURFACE, VIOLET, LIME, PEACH, CYAN } from "@/lib/ui-data/tokens";

function Login() {
  const _router = useRouter();
  const navigate = (path: string) => _router.push(path);
  const search = useSearchParams().toString();
  const returnTo = useMemo(() => new URLSearchParams(search).get("returnTo") ?? "/", [search]);
  const { user } = useAuth();

  // If already signed in, bounce straight to the destination.
  useEffect(() => {
    if (user) navigate(postAuthDestination(returnTo));
  }, [user, navigate, returnTo]);

  const paletteSwatches = [VIOLET, LIME, PEACH, CYAN, "#E89B9F"];

  return (
    <section className="flex-1 min-h-[calc(100vh-3.5rem-1.75rem)]" style={{ background: BG }}>
      <div className="mx-auto max-w-6xl px-6 lg:px-8 py-16 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-12 items-center">
        {/* Left — visual anchor (palette-strip motif) */}
        <div className="hidden lg:block">
          <div
            className="text-[10.5px] uppercase tracking-[0.22em] mb-5"
            style={{ fontFamily: MONO, color: MUTED }}
          >
            UIUXofAi · the catalog for designers shipping with AI
          </div>
          <h1
            className="text-[56px] leading-[1.02] font-medium tracking-[-0.022em] mb-8"
            style={{ color: INK }}
          >
            Stop fighting <br />
            <span style={{ color: SUB }}>the model's defaults.</span>
          </h1>

          {/* Palette strip — the bundle-card signature, scaled up */}
          <div
            className="rounded-lg overflow-hidden border mb-5"
            style={{ borderColor: BORDER_SOFT }}
          >
            <div className="flex h-3" aria-hidden="true">
              {paletteSwatches.map((c) => (
                <div key={c} className="flex-1" style={{ background: c }} />
              ))}
            </div>
            <div className="p-5" style={{ background: SURFACE }}>
              <div className="text-[12.5px]" style={{ color: SUB, fontFamily: MONO }}>
                ~/.claude/skills/linear · design.md · 94% coverage
              </div>
              <div className="mt-2 text-[14px]" style={{ color: INK }}>
                Linear, Vercel, Stripe, Apple HIG — drop one in and your AI starts shipping
                on-brand.
              </div>
            </div>
          </div>

          <ul className="space-y-2.5 text-[13.5px]" style={{ color: SUB }}>
            <li>
              <span style={{ color: INK }}>Browse the library</span> — no account required.
            </li>
            <li>
              <span style={{ color: INK }}>Generate from a URL</span> — sign-in required so we can
              save your drafts.
            </li>
            <li>
              <span style={{ color: INK }}>Submit for review</span> — your bundle, your byline.
            </li>
          </ul>
        </div>

        {/* Right — auth card */}
        <div
          className="w-full max-w-[420px] mx-auto rounded-xl border p-7"
          style={{ background: SURFACE, borderColor: BORDER_SOFT, color: INK }}
        >
          <AuthCard
            variant="full"
            onSuccess={() => navigate(postAuthDestination(returnTo))}
          />
        </div>
      </div>
    </section>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <Login />
    </Suspense>
  );
}
