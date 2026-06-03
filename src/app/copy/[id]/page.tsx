import type { Metadata } from 'next';
import CopyPage from './CopyPage';

export const metadata: Metadata = {
  title: 'Draft Ready',
  description:
    'Your generated design skill draft is ready. Paste it into Claude, Cursor, or Lovable to ship on-brand UI.',
  robots: { index: false },
};

export default CopyPage;
