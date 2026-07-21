import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  listAllPublishedBundles,
  listCategoriesWithPublishedCounts,
} from '@/lib/db/queries/bundles';
import { apiToBundleItem, serializeListItem } from '@/lib/ui-data/bundleListAdapter';
import { TOOL_LANDINGS, getToolLanding } from '@/lib/ui-data/landing';
import { LandingView, type CrossLink } from '@/components/ui/LandingView';

// ISR: statically generate the 4 known tool pages (generateStaticParams) and
// refresh periodically so newly published bundles appear without a redeploy.
export const revalidate = 300;

interface Props {
  params: Promise<{ tool: string }>;
}

const BASE = 'https://uiuxskills.com';

export function generateStaticParams() {
  return TOOL_LANDINGS.map((t) => ({ tool: t.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tool } = await params;
  const landing = getToolLanding(tool);
  if (!landing) return { title: 'Tool not found' };

  const title = `Design Systems for ${landing.name}`;
  return {
    title,
    description: landing.blurb,
    alternates: { canonical: `${BASE}/for/${landing.slug}` },
    openGraph: {
      title,
      description: landing.blurb,
      url: `${BASE}/for/${landing.slug}`,
    },
  };
}

export default async function ToolLandingPage({ params }: Props) {
  const { tool } = await params;
  const landing = getToolLanding(tool);
  if (!landing) notFound();

  const [bundles, categories] = await Promise.all([
    listAllPublishedBundles({ tools: [landing.slug] }),
    listCategoriesWithPublishedCounts(),
  ]);
  const items = bundles.map((b) => apiToBundleItem(serializeListItem(b)));

  const crossLinks: CrossLink[] = [
    ...TOOL_LANDINGS.filter((t) => t.slug !== landing.slug).map((t) => ({
      href: `/for/${t.slug}`,
      label: `for ${t.name}`,
    })),
    ...categories.map((c) => ({ href: `/library/category/${c.slug}`, label: c.name })),
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Design Skills', item: `${BASE}/library` },
          {
            '@type': 'ListItem',
            position: 2,
            name: `For ${landing.name}`,
            item: `${BASE}/for/${landing.slug}`,
          },
        ],
      },
      {
        '@type': 'CollectionPage',
        '@id': `${BASE}/for/${landing.slug}`,
        name: `Design Systems for ${landing.name}`,
        description: landing.blurb,
        url: `${BASE}/for/${landing.slug}`,
        isPartOf: { '@type': 'WebSite', '@id': `${BASE}/#website` },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: items.length,
          itemListElement: items.map((it, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: `${BASE}/library/${it.id}`,
            name: it.name,
          })),
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
      <LandingView
        kicker={`For ${landing.name}`}
        heading={`Design systems for ${landing.name}.`}
        headingAccent="Drop one in. Ship on-brand."
        intro={landing.blurb}
        items={items}
        crossLinksLabel="Browse by tool & category"
        crossLinks={crossLinks}
      />
    </>
  );
}
