import type { Metadata } from 'next';
import LibraryClient from './LibraryClient';

export const metadata: Metadata = {
  title: 'Design System Library',
  description:
    'Curated DESIGN.md bundles for Linear, Stripe, Vercel, Apple HIG, and more. Drop one into Claude, Cursor, or Lovable to ship on-brand UI instantly.',
  openGraph: {
    title: 'Design System Library',
    description:
      'Browse validated DESIGN.md bundles across 40+ brands. One paste, on-brand AI output.',
    url: 'https://uiuxskills.com/library',
  },
  alternates: {
    canonical: 'https://uiuxskills.com/library',
  },
};

export default function LibraryPage() {
  return <LibraryClient />;
}
