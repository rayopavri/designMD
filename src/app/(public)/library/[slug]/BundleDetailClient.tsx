"use client";

import Link from "next/link";
import { useSearchParams, useParams } from "next/navigation";

import { Suspense, useEffect, useState } from "react";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { SectionLabel } from "@/components/ui/Shell";
import { LegalDisclaimer } from "@/components/ui/LegalDisclaimer";
import { BORDER_SOFT, INK, MONO, MUTED, SUB, VIOLET } from "@/lib/ui-data/tokens";
import { type BundleItem } from "@/lib/ui-data/items";
import { useToolPref } from "@/lib/ui-data/useToolPref";
import { downloadBundleZip } from "@/lib/ui-data/bundleZip";
import { useBundleDetail } from "@/hooks/useBundleDetail";
import { openAuthModal, useAuth } from "@/lib/ui-data/mockAuth";
import { HeroScreenshot } from "./_sections/HeroScreenshot";
import { ActionsCard } from "./_sections/ActionsCard";
import { CompanionSection, type CompanionTab } from "./_sections/CompanionSection";
import { InstallSection } from "./_sections/InstallSection";
import { OverviewSection } from "./_sections/OverviewSection";
import { RelatedSkills } from "./_sections/RelatedSkills";

function BundleDetail() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const { item: dbBundle, loading, notFound, error } = useBundleDetail(slug);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-6 lg:px-8 py-32 text-center">
        <SectionLabel n="·" t="Loading" />
        <h1 className="mt-4 text-[28px] font-medium" style={{ color: SUB }}>
          Fetching design skill…
        </h1>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-6 lg:px-8 py-32 text-center">
        <SectionLabel n="!" t="Error" />
        <h1 className="mt-4 text-[28px] font-medium">Something went wrong.</h1>
        <p className="mt-3 text-[13.5px]" style={{ color: SUB }}>
          {error.message}
        </p>
        <Link
          href="/library"
          className="mt-6 inline-flex items-center gap-1.5 text-[13px]"
          style={{ color: VIOLET }}
        >
          Back to design skills
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  if (notFound || !dbBundle) {
    return (
      <div className="mx-auto max-w-3xl px-6 lg:px-8 py-32 text-center">
        <SectionLabel n="404" t="Not found" />
        <h1 className="mt-4 text-[28px] font-medium">No item with that slug.</h1>
        <Link
          href="/library"
          className="mt-6 inline-flex items-center gap-1.5 text-[13px]"
          style={{ color: VIOLET }}
        >
          Back to design skills
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  return <BundleView item={dbBundle} />;
}

// ─────────────────────────────────────────────────────────────
// BUNDLE
// ─────────────────────────────────────────────────────────────

function BundleView({ item }: { item: BundleItem }) {
  const bundle = item.bundle;
  const routeParams = useParams<{ slug: string }>();
  const slug = routeParams?.slug ?? "";
  const [tab, setTab] = useState<CompanionTab>("preview");
  const [tool, setTool] = useToolPref();
  const search = useSearchParams().toString();
  const [showInstall, setShowInstall] = useState<boolean>(() => {
    const params = new URLSearchParams(search);
    return params.get("install") === "1";
  });
  const [copiedSpec, setCopiedSpec] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [zipping, setZipping] = useState(false);
  const { user } = useAuth();
  const [isSaved, setIsSaved] = useState(false);
  const [savePending, setSavePending] = useState(false);

  useEffect(() => {
    if (showInstall && typeof window !== "undefined") {
      requestAnimationFrame(() => {
        document.getElementById("install-steps")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [showInstall]);

  // Hydrate saved state when the user is signed in
  useEffect(() => {
    if (!user || !slug) return;
    let cancelled = false;
    fetch(`/api/bundles/${slug}/favorite/check`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: { saved: boolean } | null) => {
        if (!cancelled && data) setIsSaved(data.saved);
      })
      .catch(() => {/* best-effort */});
    return () => { cancelled = true; };
  }, [user, slug]);

  async function toggleFavorite() {
    if (!user) {
      openAuthModal(typeof window !== "undefined" ? window.location.pathname : null);
      return;
    }
    const next = !isSaved;
    setIsSaved(next);
    setSavePending(true);
    try {
      const res = await fetch(`/api/bundles/${slug}/favorite`, {
        method: next ? "POST" : "DELETE",
      });
      if (!res.ok) throw new Error("Request failed");
    } catch {
      setIsSaved(!next); // rollback
    } finally {
      setSavePending(false);
    }
  }

  async function copyText(text: string, kind: "spec" | "prompt") {
    try {
      await navigator.clipboard.writeText(text);
      if (kind === "spec") {
        setCopiedSpec(true);
        setTimeout(() => setCopiedSpec(false), 2000);
      } else if (kind === "prompt") {
        setCopiedPrompt(true);
        setTimeout(() => setCopiedPrompt(false), 2000);
      }
    } catch {
      // ignore
    }
  }

  async function onZip() {
    setZipping(true);
    try {
      await downloadBundleZip({
        slug: bundle.id,
        name: bundle.name,
        version: bundle.version,
        designMd: bundle.designMd,
        companionMd: bundle.companionPrompt,
        tool,
      });
    } finally {
      setZipping(false);
    }
  }

  // Section numbering adapts to whether the (gated) install section is shown.
  const pad = (x: number) => String(x).padStart(2, "0");
  let counter = 0;
  const companionN = pad(++counter);
  const installN = showInstall ? pad(++counter) : null;
  const overviewN = pad(++counter);
  const relatedN = pad(++counter);

  return (
    <>
      <Breadcrumb item={item} />

      {/* Hero: visual left, actions card right */}
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-6xl px-6 lg:px-8 pt-6 pb-12 flex flex-col lg:flex-row gap-8 lg:items-stretch">
          <div className="w-full lg:flex-1 min-w-0">
            <HeroScreenshot bundle={bundle} />
          </div>
          <ActionsCard
            item={item}
            slug={slug}
            tool={tool}
            setTool={setTool}
            onUse={() => setShowInstall(true)}
            onZip={onZip}
            zipping={zipping}
            isSaved={isSaved}
            savePending={savePending}
            toggleFavorite={toggleFavorite}
            signedIn={!!user}
          />
        </div>
      </section>

      <CompanionSection bundle={bundle} tab={tab} setTab={setTab} n={companionN} />

      {showInstall ? (
        <InstallSection
          bundle={bundle}
          tool={tool}
          onHide={() => setShowInstall(false)}
          copyText={copyText}
          copiedSpec={copiedSpec}
          copiedPrompt={copiedPrompt}
          n={installN!}
        />
      ) : null}

      <OverviewSection bundle={bundle} n={overviewN} />

      <RelatedSkills slug={slug} n={relatedN} />

      <LegalDisclaimer name={bundle.name} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Shared
// ─────────────────────────────────────────────────────────────

function Breadcrumb({ item }: { item: BundleItem }) {
  return (
    <div className="mx-auto max-w-6xl px-6 lg:px-8 pt-6 pb-2">
      <div
        className="flex items-center gap-2 text-[12px]"
        style={{ fontFamily: MONO, color: MUTED }}
      >
        <Link href="/library" style={{ color: SUB }}>
          design skills
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span style={{ color: INK }}>
          {item.name.toLowerCase()} · № {item.num}
        </span>
      </div>
    </div>
  );
}

export default function BundleDetailClient() {
  return (
    <Suspense fallback={null}>
      <BundleDetail />
    </Suspense>
  );
}
