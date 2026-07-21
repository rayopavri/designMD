import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getVisibleBundleBySlug } from '@/lib/db/queries/bundles';
import type { BundleDetail } from '@/lib/db/queries/bundles';
import { detailToBundleItem, serializeDetail } from '@/lib/ui-data/bundleDetailAdapter';
import BundleDetailClient from './BundleDetailClient';

// ISR: cache the server-rendered spec, refresh periodically. A freshly
// generated bundle's companion/screenshot still upgrade client-side via polling.
export const revalidate = 300;

function buildKeywords(bundle: Pick<BundleDetail, 'primaryCategoryName' | 'compatibleTools'>): string {
  return [bundle.primaryCategoryName, ...bundle.compatibleTools, 'design system', 'DESIGN.md']
    .filter(Boolean)
    .join(', ');
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const bundle = await getVisibleBundleBySlug(slug);
  if (!bundle) return { title: 'Design skill not found' };

  const coverage = bundle.coverageScore != null ? `${bundle.coverageScore}% coverage` : null;
  const topTools = bundle.compatibleTools.slice(0, 3).join(', ');
  const category = bundle.primaryCategoryName ? ` · ${bundle.primaryCategoryName}` : '';

  const title = `${bundle.title} Design System`;
  const description = [
    `${bundle.title} design skill${category}.`,
    coverage,
    topTools ? `Works with ${topTools}.` : null,
    'Drop into Claude, Cursor, or Lovable to ship on-brand UI.',
  ]
    .filter(Boolean)
    .join(' ');

  const paletteParam = bundle.paletteColors
    .slice(0, 6)
    .map(c => c.replace('#', ''))
    .join(',');
  const brandHexParam = (bundle.brandColor ?? '8B7BFF').replace('#', '');
  const initialParam = bundle.brandInitial ?? bundle.title.charAt(0).toUpperCase();
  const categoryParam = bundle.primaryCategoryName ?? '';
  const ogImageUrl =
    `https://uiuxskills.com/api/og` +
    `?t=${encodeURIComponent(bundle.title)}` +
    `&c=${paletteParam}` +
    `&i=${encodeURIComponent(initialParam)}` +
    `&b=${brandHexParam}` +
    `&cat=${encodeURIComponent(categoryParam)}`;

  return {
    title,
    description,
    keywords: buildKeywords(bundle),
    openGraph: {
      title,
      description,
      url: `https://uiuxskills.com/library/${slug}`,
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
    alternates: {
      canonical: `https://uiuxskills.com/library/${slug}`,
      // Point AI crawlers / agents at the clean-markdown representation of this
      // spec (see /library/[slug]/raw). llms.txt links to the same endpoints.
      types: {
        'text/markdown': `https://uiuxskills.com/library/${slug}/raw`,
      },
    },
    // Drafts / non-published bundles are reachable (owners preview them) and now
    // server-rendered, so explicitly keep them out of the index. Only published
    // bundles should be crawled and ranked.
    robots: bundle.status === 'published' ? undefined : { index: false, follow: true },
  };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const bundle = await getVisibleBundleBySlug(slug);
  // Real 404 for unknown/archived slugs instead of a 200 soft-404: the server
  // component previously rendered the client shell regardless, so bad URLs
  // returned 200 and could be indexed. `notFound()` renders not-found.tsx with
  // a proper 404 status.
  if (!bundle) notFound();

  // Pre-convert the bundle to the UI shape on the server and hand it to the
  // client component so the DESIGN.md, companion prompt, palette, and coverage
  // are in the first HTML payload — the content Google indexes and non-JS AI
  // crawlers (GPTBot, ClaudeBot, PerplexityBot, …) actually see.
  const initialItem = detailToBundleItem(serializeDetail(bundle));

  // Genuine user-vote ratings → star rich-results in Google. positiveVoteRate
  // is a 0–100 percentage; map it onto a 0–5 scale. Only emit when there are
  // real votes so we never claim an unrated bundle has a rating.
  const rate = Number(bundle.positiveVoteRate);
  const aggregateRating =
    bundle.voteCount > 0 && !Number.isNaN(rate)
      ? {
          '@type': 'AggregateRating',
          ratingValue: Math.round((rate / 20) * 10) / 10,
          bestRating: 5,
          worstRating: 0,
          ratingCount: bundle.voteCount,
        }
      : undefined;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Design Skills',
            item: 'https://uiuxskills.com/library',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: bundle.title,
            item: `https://uiuxskills.com/library/${slug}`,
          },
        ],
      },
      {
        '@type': 'CreativeWork',
        '@id': `https://uiuxskills.com/library/${slug}`,
        name: `${bundle.title} Design System`,
        description: `Design skill for ${bundle.title}. Brand tokens, color palette, typography, and component specs for Claude, Cursor, and Lovable.`,
        url: `https://uiuxskills.com/library/${slug}`,
        encodingFormat: 'text/markdown',
        keywords: buildKeywords(bundle),
        datePublished: bundle.publishedAt?.toISOString(),
        dateModified: bundle.updatedAt.toISOString(),
        sameAs: bundle.sourceUrl ?? undefined,
        aggregateRating,
        creator: {
          '@type': 'Organization',
          name: 'UIUXskills',
          url: 'https://uiuxskills.com',
        },
        isPartOf: {
          '@type': 'CollectionPage',
          '@id': 'https://uiuxskills.com/library',
          name: 'UIUXskills Design Library',
          url: 'https://uiuxskills.com/library',
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BundleDetailClient initialItem={initialItem} />
    </>
  );
}
