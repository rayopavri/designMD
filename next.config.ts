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
  // dist folder that its linter reads at runtime. Next's serverless
  // tracing only bundles .js by default, which causes ENOENT in Vercel.
  // Explicitly include those files for any route that touches the linter.
  outputFileTracingIncludes: {
    '/api/internal/tasks/scrape-and-extract': [
      './node_modules/@google/design.md/dist/**/*.yaml',
      './node_modules/@google/design.md/dist/**/*.md',
    ],
    '/api/bundles/[slug]/export': [
      './node_modules/@google/design.md/dist/**/*.yaml',
      './node_modules/@google/design.md/dist/**/*.md',
    ],
  },
};

export default nextConfig;
