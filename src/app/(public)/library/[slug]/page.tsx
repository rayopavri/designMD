import type { Metadata } from 'next';
import { getVisibleBundleBySlug } from '@/lib/db/queries/bundles';
import BundleDetailClient from './BundleDetailClient';

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
    },
  };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const bundle = await getVisibleBundleBySlug(slug);

  const jsonLd = bundle
    ? {
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
            '@type': 'Dataset',
            name: `${bundle.title} Design System`,
            description: `Design skill for ${bundle.title}. Brand tokens, color palette, typography, and component specs for Claude, Cursor, and Lovable.`,
            url: `https://uiuxskills.com/library/${slug}`,
            creator: {
              '@type': 'Organization',
              name: 'UIUXskills',
              url: 'https://uiuxskills.com',
            },
          },
        ],
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <BundleDetailClient />
    </>
  );
}
