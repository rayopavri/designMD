import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Shell } from '@/components/ui/Shell';

export const viewport: Viewport = {
  themeColor: '#8B7BFF',
};

// Google Search Console site verification. Set NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
// in Vercel to the token Search Console gives you for the "HTML tag" method; Next
// renders it as <meta name="google-site-verification" ...>. Read directly (not via
// the Zod-validated env module) so it stays optional and never blocks the build.
const googleSiteVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;

export const metadata: Metadata = {
  title: {
    default: 'UIUXskills — design systems for AI tools',
    template: '%s — UIUXskills',
  },
  description:
    'Curated design skills + calibrated Claude prompts. Make AI tools follow your design system.',
  metadataBase: new URL('https://uiuxskills.com'),
  openGraph: {
    siteName: 'UIUXskills',
    type: 'website',
    url: 'https://uiuxskills.com',
    images: [{ url: '/api/og?t=UIUXskills&i=U&b=8B7BFF', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
  },
  icons: {
    icon: '/icon.svg',
  },
  ...(googleSiteVerification
    ? { verification: { google: googleSiteVerification } }
    : {}),
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
