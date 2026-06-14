import type { Metadata } from 'next';
import GeneratePage from './GeneratePage';
import { activeModelLabel } from '@/lib/ai/active-model';

export const metadata: Metadata = {
  title: 'Generate a Design Skill',
  description:
    'Paste any URL or upload a screenshot. The AI pipeline extracts brand tokens, writes a canonical DESIGN.md, and pairs it with a calibrated Claude prompt.',
  alternates: {
    canonical: 'https://uiuxskills.com/generate',
  },
  openGraph: {
    title: 'Generate a Design Skill',
    description:
      'Paste any URL or upload a screenshot. The AI pipeline extracts brand tokens, writes a canonical DESIGN.md, and pairs it with a calibrated Claude prompt.',
    url: 'https://uiuxskills.com/generate',
  },
};

export default function Page() {
  return <GeneratePage modelLabel={activeModelLabel()} />;
}
