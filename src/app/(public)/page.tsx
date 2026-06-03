import type { Metadata } from 'next';
import { HomeHero } from "./HomeHero";
import { HomeLibrary } from "./HomeLibrary";

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
  return (
    <>
      <HomeHero />
      <HomeLibrary />
    </>
  );
}

export default Home;
