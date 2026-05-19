import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Command, GitCommit } from "lucide-react";
import { BG_SOFT_HEADER } from "../lib/constants";
import { ITEMS } from "../lib/items";
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
} from "../lib/tokens";
import { openAuthModal, useAuth, useAuthStorageSync } from "../lib/auth";
import { AuthModal } from "./AuthModal";
import { UserMenu } from "./UserMenu";

function useUtcClock() {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mm = String(now.getUTCMinutes()).padStart(2, "0");
  const month = now.toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toLowerCase();
  const day = now.getUTCDate();
  return `${month} ${day} · ${hh}:${mm} UTC`;
}

export function StatusBar() {
  const clock = useUtcClock();
  return (
    <div
      className="w-full text-[11px]"
      style={{ background: "#070708", borderBottom: `1px solid ${BORDER_SOFT}`, color: MUTED, fontFamily: MONO }}
    >
      <div className="mx-auto flex h-7 max-w-6xl items-center justify-between px-6 lg:px-8">
        <div className="flex items-center gap-5">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: LIME, boxShadow: `0 0 6px ${LIME}88` }} />
            <span style={{ color: INK }}>operational</span>
          </span>
          <span className="hidden sm:inline" title="Items currently catalogued across all shelves">
            {ITEMS.length} systems · {ITEMS.reduce((n, it) => n + (it.type === "bundle" ? it.bundle.tokens : 0), 0).toLocaleString()} tokens
          </span>
          <span className="hidden lg:inline">edge · iad1 / fra1 / sin1</span>
        </div>
        <div className="flex items-center gap-5">
          <span className="inline-flex items-center gap-1.5">
            <GitCommit className="h-3 w-3" />
            <span>build 8a9b2c · v0.42.1</span>
          </span>
          <span className="hidden md:inline">{clock}</span>
        </div>
      </div>
    </div>
  );
}

type NavItem = { label: string; href: string; matches: (path: string) => boolean };

function basePath(p: string): string {
  return p.split("?")[0].split("#")[0];
}

const NAV: NavItem[] = [
  { label: "Library", href: "/library", matches: (p) => basePath(p).startsWith("/library") },
  { label: "Generate", href: "/generate", matches: (p) => basePath(p).startsWith("/generate") },
  { label: "CLI", href: "/docs/cli", matches: (p) => basePath(p).startsWith("/docs/cli") },
];

export function Header() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();

  function handleGenerateClick(e: React.MouseEvent) {
    if (user) return; // let the Link navigate
    e.preventDefault();
    if (location !== "/generate") {
      // Update URL silently so returnTo is correct after sign-in
      navigate("/generate");
    }
    openAuthModal("/generate");
  }

  return (
    <header
      className="sticky top-0 z-50 w-full border-b backdrop-blur-md"
      style={{ background: BG_SOFT_HEADER, borderColor: BORDER }}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6 lg:px-8">
        <div className="flex items-center gap-9">
          <Link href="/" className="flex items-baseline gap-2 text-[14px] font-medium tracking-tight" style={{ color: INK }}>
            UIUXofAi
            <span className="text-[10px]" style={{ fontFamily: MONO, color: MUTED }}>/ 042</span>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-[12.5px]" style={{ fontFamily: SANS, color: SUB }}>
            {NAV.map((n) => {
              const isActive = n.matches(location);
              const isGenerate = n.href === "/generate";
              return (
                <Link
                  key={n.label}
                  href={n.href}
                  onClick={isGenerate ? handleGenerateClick : undefined}
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
              onClick={() => openAuthModal("/generate")}
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
          <span style={{ color: INK, fontFamily: SANS }}>UIUXofAi</span>
          <span>v0.42 · 2026 · uiuxskills.com</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: LIME }} />
            <span style={{ color: SUB }}>all systems operational</span>
          </span>
        </div>
        <div className="flex items-center gap-5 flex-wrap">
          <Link href="/library">library</Link>
          <Link href="/generate">generate</Link>
          <Link href="/docs/cli">cli</Link>
        </div>
      </div>
    </footer>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  useAuthStorageSync();
  return (
    <div className="min-h-screen flex flex-col" style={{ background: BG, color: INK, fontFamily: SANS }}>
      <StatusBar />
      <Header />
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
