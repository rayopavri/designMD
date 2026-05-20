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
};

export default nextConfig;
