import type { Metadata } from 'next';
import './globals.css';
import { Shell } from '@/components/ui/Shell';
import { SpeedInsights } from '@vercel/speed-insights/next';

export const metadata: Metadata = {
  title: 'designmd — design systems for AI tools',
  description:
    'Curated design.md bundles + calibrated Claude prompts. Make AI tools follow your design system.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <Shell>{children}</Shell>
        <SpeedInsights />
      </body>
    </html>
  );
}
