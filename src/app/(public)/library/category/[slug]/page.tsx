import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  listAllPublishedBundles,
  listCategoriesWithPublishedCounts,
} from '@/lib/db/queries/bundles';
import { apiToBundleItem, serializeListItem } from '@/lib/ui-data/bundleListAdapter';
import { TOOL_LANDINGS } from '@/lib/ui-data/landing';
import { LandingView, type CrossLink } from '@/components/ui/LandingView';

// ISR: server-render for crawlers, refresh periodically.
export const revalidate = 300;

interface Props {
  params: Promise<{ slug: string }>;
}

const BASE = 'https://uiuxskills.com';

async function findCategory(slug: string) {
  const categories = await listCategoriesWithPublishedCounts();
  return categories.find((c) => c.slug === slug) ?? null;
}

function describe(name: string, count: number): string {
  const noun = count === 1 ? 'design skill' : 'design skills';
  return `${count} ${name} ${noun} — DESIGN.md specs paired with companion prompts for Claude, Cursor, Lovable, and Figma Make. Drop one into your AI tool to ship on-brand UI.`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await findCategory(slug);
  if (!category) return { title: 'Category not found' };

  const title = `${category.name} Design Systems`;
  const description = describe(category.name, category.count);
  return {
    title,
    description,
    alternates: { canonical: `${BASE}/library/category/${slug}` },
    openGraph: {
      title,
      description,
      url: `${BASE}/library/category/${slug}`,
    },
  };
}

export default async function CategoryLandingPage({ params }: Props) {
  const { slug } = await params;
  const [category, categories] = await Promise.all([
    findCategory(slug),
    listCategoriesWithPublishedCounts(),
  ]);
  if (!category) notFound();

  const items = (await listAllPublishedBundles({ category: slug })).map((b) =>
    apiToBundleItem(serializeListItem(b)),
  );

  const crossLinks: CrossLink[] = [
    ...categories
      .filter((c) => c.slug !== slug)
      .map((c) => ({ href: `/library/category/${c.slug}`, label: c.name })),
    ...TOOL_LANDINGS.map((t) => ({ href: `/for/${t.slug}`, label: `for ${t.name}` })),
  ];

  const description = describe(category.name, category.count);
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
            name: category.name,
            item: `${BASE}/library/category/${slug}`,
          },
        ],
      },
      {
        '@type': 'CollectionPage',
        '@id': `${BASE}/library/category/${slug}`,
        name: `${category.name} Design Systems`,
        description,
        url: `${BASE}/library/category/${slug}`,
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
        kicker={category.name}
        heading={`${category.name} design systems.`}
        headingAccent="Drop one in. Ship on-brand."
        intro={description}
        items={items}
        crossLinksLabel="Browse by category & tool"
        crossLinks={crossLinks}
      />
    </>
  );
}
