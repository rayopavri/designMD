import type { Metadata } from 'next';
import { getVisibleBundleBySlug } from '@/lib/db/queries/bundles';
import BundleDetailClient from './BundleDetailClient';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const bundle = await getVisibleBundleBySlug(slug);
  if (!bundle) return { title: 'Bundle not found' };

  const coverage = bundle.coverageScore != null ? `${bundle.coverageScore}% coverage` : null;
  const topTools = bundle.compatibleTools.slice(0, 3).join(', ');
  const category = bundle.primaryCategoryName ? ` · ${bundle.primaryCategoryName}` : '';

  const title = `${bundle.title} Design System`;
  const description = [
    `${bundle.title} DESIGN.md bundle${category}.`,
    coverage,
    topTools ? `Works with ${topTools}.` : null,
    'Drop into Claude, Cursor, or Lovable to ship on-brand UI.',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://uiuxskills.com/library/${slug}`,
    },
    twitter: {
      card: 'summary',
      title,
      description,
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
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Library',
            item: 'https://uiuxskills.com/library',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: bundle.title,
            item: `https://uiuxskills.com/library/${slug}`,
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
