/**
 * LandingView — server-rendered presentation for the category (/library/
 * category/[slug]) and tool (/for/[tool]) landing pages.
 *
 * No 'use client': the whole thing (including the ItemCard grid) renders to
 * HTML on the server so crawlers see the full set of bundle links + intro copy.
 */
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { ItemCard } from '@/components/ui/ItemCard';
import type { BundleItem } from '@/lib/ui-data/items';
import { BG, BORDER, BORDER_SOFT, INK, MONO, MUTED, SUB, VIOLET } from '@/lib/ui-data/tokens';

export interface CrossLink {
  href: string;
  label: string;
}

interface LandingViewProps {
  kicker: string;
  heading: string;
  headingAccent?: string;
  intro: string;
  items: BundleItem[];
  crossLinksLabel?: string;
  crossLinks?: CrossLink[];
}

export function LandingView({
  kicker,
  heading,
  headingAccent,
  intro,
  items,
  crossLinksLabel,
  crossLinks,
}: LandingViewProps) {
  return (
    <>
      {/* Intro */}
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-7xl px-6 lg:px-8 pt-12 pb-14">
          <nav
            className="flex items-center gap-2 text-[12px] mb-6"
            style={{ fontFamily: MONO, color: MUTED }}
            aria-label="Breadcrumb"
          >
            <Link href="/library" style={{ color: SUB }}>
              design skills
            </Link>
            <span>/</span>
            <span style={{ color: INK }}>{kicker.toLowerCase()}</span>
          </nav>
          <div
            className="text-[10.5px] uppercase tracking-[0.22em] mb-3"
            style={{ fontFamily: MONO, color: MUTED }}
          >
            {kicker}
          </div>
          <h1 className="text-[40px] sm:text-[50px] leading-[1.04] font-medium tracking-[-0.022em]">
            {heading}
            {headingAccent ? (
              <>
                {' '}
                <span style={{ color: SUB }}>{headingAccent}</span>
              </>
            ) : null}
          </h1>
          <p className="mt-5 max-w-[42rem] text-[14.5px] leading-[1.6]" style={{ color: SUB }}>
            {intro}
          </p>
        </div>
      </section>

      {/* Grid */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-12">
        <div
          className="text-[10.5px] uppercase tracking-[0.22em] mb-6"
          style={{ fontFamily: MONO, color: MUTED }}
        >
          {items.length} {items.length === 1 ? 'design skill' : 'design skills'}
        </div>

        {items.length === 0 ? (
          <div
            className="rounded-lg border p-12 text-center"
            style={{ borderColor: BORDER, background: BG }}
          >
            <p className="text-[14px]" style={{ color: INK }}>
              Nothing here yet.
            </p>
            <Link
              href="/generate"
              className="mt-4 inline-flex items-center gap-1.5 text-[12.5px]"
              style={{ color: VIOLET }}
            >
              Generate one from a URL
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        ) : (
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px rounded-lg overflow-hidden"
            style={{ background: BG }}
          >
            {items.map((it) => (
              <ItemCard key={it.id} item={it} />
            ))}
          </div>
        )}

        {/* Internal cross-links for discovery + crawlability */}
        {crossLinks && crossLinks.length > 0 ? (
          <div className="mt-12 pt-8 border-t" style={{ borderColor: BORDER_SOFT }}>
            {crossLinksLabel ? (
              <div
                className="text-[10.5px] uppercase tracking-[0.22em] mb-4"
                style={{ fontFamily: MONO, color: MUTED }}
              >
                {crossLinksLabel}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px]">
              {crossLinks.map((l) => (
                <Link key={l.href} href={l.href} style={{ color: SUB }}>
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
