import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Pin workspace root so Next.js doesn't get confused by lockfiles further up the tree
  outputFileTracingRoot: path.join(__dirname),
  eslint: {
    // The migrated Vite codebase has many cosmetic lint violations
    // (unescaped quotes, unused imports, occasional `any`) that don't
    // affect runtime. Surface them via `pnpm lint` instead of blocking
    // production builds on style issues.
    ignoreDuringBuilds: true,
  },
  // @google/design.md ships non-JS data files (.yaml, .md) inside its
  // dist folder that its linter reads at runtime. pnpm symlinks the
  // package from .pnpm/ which breaks Next's trace globbing. Mark it
  // external so Node resolves it normally at runtime and the adjacent
  // data files are reachable.
  serverExternalPackages: ['@google/design.md'],
  // Also include the pnpm-real path explicitly so Vercel ships the
  // assets next to the resolved module.
  outputFileTracingIncludes: {
    '/api/internal/tasks/scrape-and-extract': [
      './node_modules/.pnpm/@google+design.md@*/node_modules/@google/design.md/dist/**/*.yaml',
      './node_modules/.pnpm/@google+design.md@*/node_modules/@google/design.md/dist/**/*.md',
    ],
    '/api/bundles/[slug]/export': [
      './node_modules/.pnpm/@google+design.md@*/node_modules/@google/design.md/dist/**/*.yaml',
      './node_modules/.pnpm/@google+design.md@*/node_modules/@google/design.md/dist/**/*.md',
    ],
  },
};

export default nextConfig;
