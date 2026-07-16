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
  //
  // @mendable/firecrawl-js does `await import('undici')` inside a
  // try/catch for optional WebSocket support — we use plain HTTP so the
  // import always fails harmlessly at runtime, but Webpack can't see
  // the try/catch and emits "Module not found: 'undici'" at build time.
  // Marking the SDK external lets Node handle the dynamic import so the
  // try/catch actually catches.
  serverExternalPackages: ['@google/design.md', '@mendable/firecrawl-js'],
  // Also include the pnpm-real path explicitly so Vercel ships the
  // assets next to the resolved module.
  async rewrites() {
    return [
      {
        source: '/__/auth/:path*',
        destination: 'https://designmd-2ff95.firebaseapp.com/__/auth/:path*',
      },
    ];
  },
  async headers() {
    // Content-Security-Policy ships in REPORT-ONLY mode first: violations are
    // logged to the browser console (and any report endpoint) but nothing is
    // blocked, so we can watch for breakage — the Firebase auth iframe
    // (/__/auth/ rewrite → firebaseapp.com), Google Fonts, and Supabase image
    // hosts are the likely trip-wires — before flipping to an enforced
    // `Content-Security-Policy`. Origins below reflect what the app actually
    // talks to; tune against real reports, then rename the header to enforce.
    const csp = [
      "default-src 'self'",
      // Next.js injects inline bootstrap scripts; Firebase auth loads apis.google.com.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.googletagmanager.com https://www.google-analytics.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com wss://*.firebaseio.com https://www.google-analytics.com https://*.supabase.co",
      "frame-src 'self' https://*.firebaseapp.com https://apis.google.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy-Report-Only', value: csp },
        ],
      },
    ];
  },
  outputFileTracingIncludes: {
    // Lint moved here in the Phase 1/Phase 2 split — the spec yaml files
    // must be traced for this function or runtime fails with ENOENT.
    '/api/internal/tasks/author-design-md': [
      './node_modules/.pnpm/@google+design.md@*/node_modules/@google/design.md/dist/**/*.yaml',
      './node_modules/.pnpm/@google+design.md@*/node_modules/@google/design.md/dist/**/*.md',
    ],
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
