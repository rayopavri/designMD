"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Command } from "lucide-react";
import { BG_SOFT_HEADER } from "@/lib/ui-data/constants";
import {
  BG,
  BORDER,
  BORDER_SOFT,
  INK,
  INK_ON_LIGHT,
  LIME,
  MONO,
  MUTED,
  SANS,
  SUB,
  SURFACE,
  VIOLET,
} from "@/lib/ui-data/tokens";
import { openAuthModal, useAuth, useAuthStorageSync } from "@/lib/ui-data/mockAuth";
import { PHASE_2_SHELVES_ENABLED } from "@/lib/ui-data/featureFlags";
import { AuthModal } from "./AuthModal";
import { UserMenu } from "./UserMenu";
import { ClaimBundlesBanner } from "./ClaimBundlesBanner";

type NavItem = { label: string; href: string; matches: (path: string) => boolean };

function basePath(p: string): string {
  return p.split("?")[0].split("#")[0];
}

const NAV: NavItem[] = [
  { label: "Library", href: "/library", matches: (p) => basePath(p).startsWith("/library") },
  { label: "Generate", href: "/generate", matches: (p) => basePath(p).startsWith("/generate") },
  ...(PHASE_2_SHELVES_ENABLED
    ? [{ label: "CLI", href: "/docs/cli", matches: (p: string) => basePath(p).startsWith("/docs/cli") }]
    : []),
];

export function Header() {
  const location = usePathname();
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        router.push('/library');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  return (
    <header
      className="sticky top-0 z-50 w-full border-b backdrop-blur-md"
      style={{ background: BG_SOFT_HEADER, borderColor: BORDER }}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6 lg:px-8">
        <div className="flex items-center gap-9">
          <Link href="/" className="flex items-center gap-2.5" aria-label="UIUXskills">
            <span
              className="leading-none select-none"
              style={{
                fontFamily: "'Arial Black', 'Impact', 'Inter', system-ui, sans-serif",
                fontWeight: 900,
                fontSize: '21px',
                letterSpacing: '-0.03em',
                color: 'transparent',
                WebkitTextStroke: `1.8px ${INK}`,
                textShadow: `2px 2px 0 rgba(255,255,255,0.12), 3.5px 3.5px 0 rgba(255,255,255,0.05)`,
              }}
            >
              U⚡X
            </span>
            <span className="text-[10px]" style={{ fontFamily: MONO, color: MUTED }}>/ 042</span>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-[12.5px]" style={{ fontFamily: SANS, color: SUB }}>
            {NAV.map((n) => {
              const isActive = n.matches(location);
              return (
                <Link
                  key={n.label}
                  href={n.href}
                  className="relative inline-flex items-center gap-1.5"
                  style={{ color: isActive ? INK : SUB }}
                >
                  {isActive ? <span className="h-1 w-1 rounded-full" style={{ background: VIOLET }} /> : null}
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3" style={{ fontFamily: SANS }}>
          <Link
            href="/library"
            aria-label="Search the library (Cmd/Ctrl+K)"
            className="hidden lg:flex h-7 items-center gap-2 rounded-md border px-2 text-[11.5px]"
            style={{ borderColor: BORDER, color: MUTED, background: SURFACE }}
          >
            <Command className="h-3 w-3" aria-hidden="true" />
            <span style={{ color: SUB }}>K</span>
            <span className="ml-1">Search the library</span>
          </Link>
          {user ? (
            <>
              <Link
                href="/generate"
                className="text-[12.5px] hidden sm:inline"
                style={{ color: SUB }}
                title="Submit a URL — we'll generate a draft and route it to the curation desk"
              >
                Submit a URL
              </Link>
              <UserMenu />
            </>
          ) : (
            <button
              type="button"
              onClick={() => openAuthModal(null)}
              title="Sign in to track URLs you've generated and save favorites"
              className="h-8 rounded-full px-4 text-[12.5px] font-medium inline-flex items-center gap-1.5"
              style={{ background: INK, color: INK_ON_LIGHT }}
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t" style={{ borderColor: BORDER, background: BG }}>
      <div
        className="mx-auto max-w-6xl px-6 lg:px-8 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-[12px]"
        style={{ color: MUTED, fontFamily: MONO }}
      >
        <div className="flex items-center gap-4 flex-wrap">
          <span
            style={{
              fontFamily: "'Arial Black', 'Impact', 'Inter', system-ui, sans-serif",
              fontWeight: 900,
              fontSize: '15px',
              letterSpacing: '-0.03em',
              color: 'transparent',
              WebkitTextStroke: `1.4px ${INK}`,
            }}
          >
            U⚡X
          </span>
          <span>v0.42 · 2026 · uiuxskills.com</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: LIME }} />
            <span style={{ color: SUB }}>all systems operational</span>
          </span>
        </div>
        <div className="flex items-center gap-5 flex-wrap">
          <Link href="/library">library</Link>
          <Link href="/generate">generate</Link>
          {PHASE_2_SHELVES_ENABLED ? <Link href="/docs/cli">cli</Link> : null}
          <Link href="/legal/terms">terms</Link>
          <Link href="/legal/privacy">privacy</Link>
          <Link href="/legal/attribution">attribution</Link>
        </div>
      </div>
    </footer>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  useAuthStorageSync();
  return (
    <div className="min-h-screen flex flex-col" style={{ background: BG, color: INK, fontFamily: SANS }}>
      <Header />
      <ClaimBundlesBanner />
      <main className="flex-1">{children}</main>
      <Footer />
      <AuthModal />
    </div>
  );
}

export function SectionLabel({ n: _n, t }: { n?: string; t: string }) {
  return (
    <div
      className="inline-flex items-center gap-2.5 text-[10.5px] uppercase tracking-[0.22em]"
      style={{ fontFamily: MONO, color: MUTED }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: VIOLET }} />
      <span style={{ color: SUB }}>{t}</span>
    </div>
  );
}
