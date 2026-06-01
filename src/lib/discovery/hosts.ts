/**
 * Non-product host filter for discovery (pure — no DB, no env).
 *
 * Principle: filter hosts that wrap a project in a THIRD PARTY's chrome — code
 * repos, package registries, app-store / extension listings, and social /
 * aggregator feeds. The page you'd scrape there is the host's UI, not the
 * product's designed surface, so it's worthless to a DESIGN.md library.
 *
 * What is deliberately KEPT (let the classifier judge quality):
 *   - custom domains (linear.app, the maker's own site)
 *   - app-platform deploys that render the product's OWN UI (*.replit.app,
 *     *.vercel.app, *.netlify.app) and GitHub Pages (*.github.io)
 * Note this does NOT exclude dev-tool products — their designed site is a
 * custom domain, not their github.com repo.
 *
 * Split out from guardrail.ts so the host check stays free of the DB import
 * chain — unit-testable and runnable without DATABASE_URL.
 */
export const NON_PRODUCT_HOSTS = new Set([
  // Social / video / aggregators / the discovery feeds themselves
  'news.ycombinator.com',
  'reddit.com',
  'twitter.com',
  'x.com',
  'youtube.com',
  'youtu.be',
  'medium.com',
  'substack.com',
  'facebook.com',
  'linkedin.com',
  'tiktok.com',
  'instagram.com',
  // Code hosts — repo pages are the host's chrome, not the product's UI
  // (*.github.io Pages sites are NOT matched: those are the project's own site)
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  // Package registries
  'pypi.org',
  'npmjs.com',
  'crates.io',
  'rubygems.org',
  'pkg.go.dev',
  // App stores / extension marketplaces / distribution listings
  'apps.apple.com',
  'testflight.apple.com',
  'play.google.com',
  'marketplace.visualstudio.com',
  'chromewebstore.google.com',
  'itch.io',
]);

export function isNonProductHost(domain: string): boolean {
  if (NON_PRODUCT_HOSTS.has(domain)) return true;
  // Catch subdomains (m.youtube.com, old.reddit.com, ...).
  for (const host of NON_PRODUCT_HOSTS) {
    if (domain.endsWith(`.${host}`)) return true;
  }
  return false;
}
