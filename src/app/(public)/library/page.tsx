import type { Metadata } from 'next';
import LibraryClient from './LibraryClient';

export const metadata: Metadata = {
  title: 'Design Skills',
  description:
    'Curated design skills for Linear, Stripe, Vercel, Apple HIG, and more. Drop one into Claude, Cursor, or Lovable to ship on-brand UI instantly.',
  openGraph: {
    title: 'Design Skills',
    description:
      'Browse design skills across 40+ brands. One paste, on-brand AI output.',
    url: 'https://uiuxskills.com/library',
    images: [{ url: '/api/og?t=Design+System+Library&i=D&b=8B7BFF&cat=library', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/api/og?t=Design+System+Library&i=D&b=8B7BFF&cat=library'],
  },
  alternates: {
    canonical: 'https://uiuxskills.com/library',
  },
};

const collectionJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  '@id': 'https://uiuxskills.com/library',
  name: 'UIUXskills Design Library',
  description:
    'Curated design skills for Linear, Stripe, Vercel, Apple HIG, and more. Drop one into Claude, Cursor, or Lovable to ship on-brand UI instantly.',
  url: 'https://uiuxskills.com/library',
  publisher: {
    '@type': 'Organization',
    name: 'UIUXskills',
    url: 'https://uiuxskills.com',
  },
};

export default function LibraryPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <LibraryClient />
    </>
  );
}
