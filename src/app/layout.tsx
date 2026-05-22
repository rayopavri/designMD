import type { Metadata } from 'next';
import './globals.css';
import { Shell } from '@/components/ui/Shell';

export const metadata: Metadata = {
  title: 'UIUXskills — design systems for AI tools',
  description:
    'Curated design.md bundles + calibrated Claude prompts. Make AI tools follow your design system.',
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
