"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Command, Loader2 } from "lucide-react";
import { useActiveGenJob } from "@/hooks/useActiveGenJob";
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
  PEACH,
  SANS,
  SUB,
  SURFACE,
  VIOLET,
} from "@/lib/ui-data/tokens";
import { openAuthModal, useAuth, useAuthStorageSync } from "@/lib/ui-data/mockAuth";
import { AdminNav } from "./AdminNav";
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
];

const STEP_LABELS: Record<string, string> = {
  "scraping": "crawling",
  "parsing-computed": "parsing styles",
  "extracting": "extracting brand",
  "resolving-orphans": "wiring tokens",
  "persisting": "saving draft",
  "writing-design-md": "writing design.md",
  "linting": "linting",
  "scoring": "scoring",
  "processing-image": "processing image",
};

function GenPill() {
  const job = useActiveGenJob();
  const location = usePathname();
  // Generate page shows its own full progress UI — no need to duplicate.
  if (!job || location.startsWith("/generate")) return null;

  if (job.status === "completed") {
    return (
      <Link
        href={job.resultBundleSlug ? `/library/${job.resultBundleSlug}` : "/library"}
        className="hidden sm:flex h-7 items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium"
        style={{ borderColor: LIME, color: LIME, background: SURFACE }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: LIME }} />
        Done · View bundle
      </Link>
    );
  }

  if (job.status === "failed") {
    return (
      <Link
        href="/generate"
        className="hidden sm:flex h-7 items-center gap-1.5 rounded-full border px-3 text-[11px]"
        style={{ borderColor: PEACH, color: PEACH, background: SURFACE }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: PEACH }} />
        Generation failed
      </Link>
    );
  }

  const stepLabel = job.currentStep ? (STEP_LABELS[job.currentStep] ?? job.currentStep) : "starting";

  return (
    <Link
      href="/generate"
      className="hidden sm:flex h-7 items-center gap-1.5 rounded-full border px-3 text-[11px]"
      style={{ borderColor: BORDER, color: SUB, background: SURFACE }}
      title="Generation in progress — click to view"
    >
      <Loader2 className="h-3 w-3 animate-spin" style={{ color: VIOLET }} aria-hidden="true" />
      <span style={{ color: INK }}>Generating</span>
      <span>·</span>
      <span>{stepLabel}</span>
    </Link>
  );
}

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
            <Image
              src="/logo.png"
              alt="UIUXskills"
              height={38}
              width={57}
              priority
              style={{ height: '38px', width: 'auto', filter: 'invert(1)' }}
            />
            <span className="text-[15px] font-medium tracking-tight" style={{ color: INK }}>UIUXskills</span>
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
          <GenPill />
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
            <>
              <Link
                href="/library"
                className="text-[12.5px] md:hidden"
                style={{ color: SUB }}
              >
                Library
              </Link>
              <Link
                href="/generate"
                className="text-[12.5px] md:hidden"
                style={{ color: SUB }}
              >
                Generate
              </Link>
              <button
                type="button"
                onClick={() => openAuthModal(null)}
                title="Sign in to track URLs you've generated and save favorites"
                className="h-8 rounded-full px-4 text-[12.5px] font-medium inline-flex items-center gap-1.5"
                style={{ background: INK, color: INK_ON_LIGHT }}
              >
                Sign in
              </button>
            </>
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
          <Image
            src="/logo.png"
            alt="UIUXskills"
            height={25}
            width={38}
            style={{ height: '25px', width: 'auto', filter: 'invert(1)', opacity: 0.75 }}
          />
          <span>v0.42 · 2026 · uiuxskills.com</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: LIME }} />
            <span style={{ color: SUB }}>all systems operational</span>
          </span>
        </div>
        <div className="flex items-center gap-5 flex-wrap">
          <Link href="/library">library</Link>
          <Link href="/generate">generate</Link>
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
      <AdminNav />
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
