import type { Metadata } from 'next';
import { HomeHero } from "./HomeHero";
import { HomeFeaturedBundles } from "./HomeFeaturedBundles";
import { HomeSignIn } from "./HomeSignIn";

export const metadata: Metadata = {
  title: 'Design Systems for AI Tools',
  description:
    'Browse curated DESIGN.md bundles for Linear, Stripe, Vercel, and 40+ more brands — or generate one from any URL in seconds.',
  alternates: {
    canonical: 'https://uiuxskills.com',
  },
  openGraph: {
    title: 'Design Systems for AI Tools',
    description:
      'Browse curated DESIGN.md bundles for Linear, Stripe, Vercel, and 40+ more brands — or generate one from any URL in seconds.',
    url: 'https://uiuxskills.com',
    type: 'website',
  },
};

function Home() {
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
      <HomeFeaturedBundles />
      <HomeSignIn />
    </>
  );
}

export default Home;
