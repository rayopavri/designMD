import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Pin workspace root so Next.js doesn't get confused by lockfiles further up the tree
  outputFileTracingRoot: path.join(__dirname),
  // @google/design.md ships non-JS data files (.yaml, .md) inside its
  // dist folder that its linter reads at runtime. pnpm symlinks the
  // package from .pnpm/ which breaks Next's trace globbing. Mark it
  // external so Node resolves it normally at runtime and the adjacent
  // data files are reachable.
  //
  // @mendable/firecrawl-js loads undici dynamically for optional WebSocket
  // support. Keep the SDK external so Node resolves that runtime import (the
  // app also depends on undici directly for pinned SSRF-safe connections)
  // rather than asking the Next bundler to rewrite the SDK's dynamic path.
  serverExternalPackages: ['@google/design.md', '@mendable/firecrawl-js'],
  // Also include the pnpm-real path explicitly so Vercel ships the
  // assets next to the resolved module.
  async rewrites() {
    return [
      {
        source: '/__/auth/:path*',
        destination: 'https://designmd-2ff95.firebaseapp.com/__/auth/:path*',
      },
      // The auth handler page above fetches this reserved Firebase Hosting
      // path itself (relative to whatever origin loaded it) to bootstrap its
      // own firebase.initializeApp() call. With NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
      // set to the custom domain, that resolves against our origin — without
      // this rewrite it 404s here instead of proxying to Firebase Hosting,
      // which silently strands signInWithRedirect: the browser lands back on
      // the app with no error and no session, because the handler page never
      // got the config it needed to relay the OAuth result.
      {
        source: '/__/firebase/:path*',
        destination: 'https://designmd-2ff95.firebaseapp.com/__/firebase/:path*',
      },
    ];
  },
  async headers() {
    // Firebase auth uses the auth rewrite, apis.google.com, and same-origin
    // relay frames. Remote bundle screenshots and logos are user-provided, so
    // image loading must permit HTTPS origins.
    const csp = [
      "default-src 'self'",
      // Next.js injects inline bootstrap scripts; Firebase auth loads apis.google.com.
      "script-src 'self' 'unsafe-inline' https://apis.google.com https://www.googletagmanager.com https://www.google-analytics.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com wss://*.firebaseio.com https://www.google-analytics.com https://*.supabase.co",
      "frame-src 'self' https://*.firebaseapp.com https://apis.google.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      // 'self' rather than 'none': Firebase's redirect sign-in loads Google's
      // gapi.iframes library (apis.google.com/js/api.js), which opens
      // same-origin relay iframes as part of its cross-window messaging
      // setup. A blanket 'none' blocked that self-framing outright, which
      // left Google redirect sign-in unable to complete. Still blocks every
      // cross-origin (clickjacking) framing attempt — the actual threat this
      // header defends against.
      "frame-ancestors 'self'",
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
          // SAMEORIGIN rather than DENY — see the frame-ancestors comment above.
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
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
