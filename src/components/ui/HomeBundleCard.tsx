'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import {
  BORDER,
  INK,
  MONO,
  MUTED,
  SUB,
  SURFACE,
  SURFACE_2,
} from '@/lib/ui-data/tokens';
import type { BundleSummary } from '@/hooks/useBundles';

interface HomeBundleCardProps {
  bundle: BundleSummary;
  priority?: boolean;
}

const HOVER_DURATION_PX_PER_SEC = 280;
const MIN_HOVER_DURATION = 2.5;
const MAX_HOVER_DURATION = 9;

export function HomeBundleCard({ bundle, priority = false }: HomeBundleCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollPx, setScrollPx] = useState(0);
  const [hovered, setHovered] = useState(false);

  const category = shortCategory(bundle.primaryCategoryName ?? 'Uncategorized');
  const palette = bundle.paletteColors.length > 0 ? bundle.paletteColors : null;

  function onImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    const container = containerRef.current;
    if (!container || img.naturalWidth === 0) return;
    const renderedHeight = (img.naturalHeight / img.naturalWidth) * container.clientWidth;
    const distance = Math.max(0, renderedHeight - container.clientHeight);
    setScrollPx(distance);
  }

  const duration = Math.min(
    MAX_HOVER_DURATION,
    Math.max(MIN_HOVER_DURATION, scrollPx / HOVER_DURATION_PX_PER_SEC),
  );

  return (
    <Link
      href={`/library/${bundle.slug}`}
      className="group block"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-xl"
        style={{
          aspectRatio: '16 / 11',
          background: SURFACE,
          border: `1px solid ${BORDER}`,
        }}
      >
        {bundle.screenshotUrl ? (
          <img
            src={bundle.screenshotUrl}
            alt={`${bundle.title} screenshot`}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            onLoad={onImgLoad}
            className="absolute top-0 left-0 w-full block"
            style={{
              transform: hovered ? `translateY(${-scrollPx}px)` : 'translateY(0)',
              transition: hovered
                ? `transform ${duration}s linear`
                : 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
              willChange: 'transform',
            }}
          />
        ) : (
          <FallbackThumbnail bundle={bundle} palette={palette} />
        )}
      </div>

      <div className="flex items-start justify-between gap-3 px-1 pt-3">
        <div className="text-[14.5px] font-medium leading-snug truncate" style={{ color: INK }}>
          {bundle.title}
        </div>
        <div
          className="text-[10.5px] uppercase tracking-[0.16em] whitespace-nowrap pt-0.5"
          style={{ fontFamily: MONO, color: MUTED }}
        >
          {category}
        </div>
      </div>
    </Link>
  );
}

function FallbackThumbnail({
  bundle,
  palette,
}: {
  bundle: BundleSummary;
  palette: string[] | null;
}) {
  const initial = bundle.brandInitial ?? bundle.title.charAt(0).toUpperCase();
  const accent = bundle.brandColor ?? palette?.[0] ?? '#8B7BFF';
  return (
    <div
      className="absolute inset-0 flex flex-col"
      style={{ background: `linear-gradient(135deg, ${accent}22, ${SURFACE_2})` }}
    >
      <div className="flex-1 flex items-center justify-center">
        <span
          className="text-[72px] font-medium leading-none"
          style={{ color: accent, opacity: 0.85 }}
          aria-hidden
        >
          {initial}
        </span>
      </div>
      {palette ? (
        <div className="flex h-1.5">
          {palette.slice(0, 6).map((c, i) => (
            <span key={i} className="flex-1" style={{ background: c }} />
          ))}
        </div>
      ) : (
        <div className="h-1.5" style={{ background: BORDER }} />
      )}
      <span
        className="absolute top-3 left-3 text-[10px] uppercase tracking-[0.2em]"
        style={{ fontFamily: MONO, color: SUB }}
      >
        no preview
      </span>
    </div>
  );
}

function shortCategory(name: string): string {
  return name
    .replace('AI & LLM Platforms', 'AI & ML')
    .replace('Developer Tools & IDEs', 'Developer Tools')
    .replace('Database & DevOps', 'Backend & DevOps')
    .replace('Design & Creative Tools', 'Design & Creative')
    .replace('Fintech & Crypto', 'Fintech')
    .replace('E-commerce & Retail', 'E-commerce')
    .replace('Media & Consumer Tech', 'Media & Consumer');
}
