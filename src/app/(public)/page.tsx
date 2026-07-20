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
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: 'https://uiuxskills.com/library?q={search_term_string}',
          },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'FAQPage',
        '@id': 'https://uiuxskills.com/#faq',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'What is a design skill (DESIGN.md)?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'A design skill is a structured DESIGN.md spec of a brand’s design system — color palette, typography, spacing, components, and dos and don’ts — paired with a companion system prompt. Together they give an AI tool the context it needs to generate on-brand UI.',
            },
          },
          {
            '@type': 'Question',
            name: 'Which AI tools do design skills work with?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Claude, Cursor, Lovable, and Figma Make. Copy the DESIGN.md and companion prompt into any of them before you ask for UI.',
            },
          },
          {
            '@type': 'Question',
            name: 'How do I use a design skill?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Open any skill in the library, copy the DESIGN.md and companion prompt (or download the bundle), and drop them into your AI coding tool. The tool then ships UI that matches that brand’s design system.',
            },
          },
          {
            '@type': 'Question',
            name: 'Can I create a design skill for any brand?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes. Paste any URL on the Generate page and an AI pipeline scrapes the site, extracts the brand’s design tokens, and writes a validated DESIGN.md plus a companion prompt for you.',
            },
          },
        ],
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
