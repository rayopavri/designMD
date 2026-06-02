import type { Metadata } from 'next';
import './globals.css';
import { Shell } from '@/components/ui/Shell';

export const metadata: Metadata = {
  title: {
    default: 'UIUXskills — design systems for AI tools',
    template: '%s — UIUXskills',
  },
  description:
    'Curated design.md bundles + calibrated Claude prompts. Make AI tools follow your design system.',
  metadataBase: new URL('https://uiuxskills.com'),
  openGraph: {
    siteName: 'UIUXskills',
    type: 'website',
    url: 'https://uiuxskills.com',
  },
  twitter: {
    card: 'summary',
  },
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
