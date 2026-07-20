import type { Metadata } from 'next';
import { listAllPublishedBundles } from '@/lib/db/queries/bundles';
import { apiToBundleItem, serializeListItem } from '@/lib/ui-data/bundleListAdapter';
import { HomeHero } from "./HomeHero";
import { HomeFeaturedBundles } from "./HomeFeaturedBundles";
import { HomeSignIn } from "./HomeSignIn";

export const metadata: Metadata = {
  title: 'Design Systems for AI Tools',
  description:
    'Browse curated design skills for Linear, Stripe, Vercel, and 40+ more brands — or generate one from any URL in seconds.',
  alternates: {
    canonical: 'https://uiuxskills.com',
  },
  openGraph: {
    title: 'Design Systems for AI Tools',
    description:
      'Browse curated design skills for Linear, Stripe, Vercel, and 40+ more brands — or generate one from any URL in seconds.',
    url: 'https://uiuxskills.com',
    type: 'website',
  },
};

async function Home() {
  // Server-render the featured grid so the bundle links are in the first HTML
  // payload — crawlable by Google + non-JS AI crawlers, and no client fetch
  // waterfall for the LCP content.
  const initialItems = (await listAllPublishedBundles()).map((b) =>
    apiToBundleItem(serializeListItem(b)),
  );

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://uiuxskills.com/#organization',
        name: 'UIUXskills',
        url: 'https://uiuxskills.com',
        logo: 'https://uiuxskills.com/icon.svg',
      },
      {
        '@type': 'WebSite',
        '@id': 'https://uiuxskills.com/#website',
        url: 'https://uiuxskills.com',
        name: 'UIUXskills',
        publisher: { '@id': 'https://uiuxskills.com/#organization' },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomeHero />
      <HomeFeaturedBundles initialItems={initialItems} />
      <HomeSignIn />
    </>
  );
}

export default Home;
