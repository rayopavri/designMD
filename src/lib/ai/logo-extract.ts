/**
 * extractBrandLogoUrl — pick the best square brand logo URL from a page's HTML.
 *
 * Priority (highest → lowest):
 *   1. <link rel="apple-touch-icon" href="...">         (usually 180×180 PNG, clean mark)
 *   2. <link rel="icon" sizes="..." href="...">          (largest size wins)
 *   3. <meta property="og:image" content="...">          (large but often has chrome)
 *   4. /favicon.ico                                       (last resort)
 *
 * Relative URLs are resolved against `baseUrl`. Returns null if nothing usable
 * was found and the caller should fall back to favicons API.
 */

interface IconCandidate {
  href: string;
  /** Larger = preferred. apple-touch-icon defaults to ~180. */
  size: number;
}

const APPLE_TOUCH_DEFAULT_SIZE = 180;

function parseSizes(sizes: string | undefined): number {
  if (!sizes) return 0;
  // "32x32" or "any" or "16x16 32x32 48x48"
  const matches = sizes.matchAll(/(\d+)x(\d+)/g);
  let max = 0;
  for (const m of matches) {
    const w = parseInt(m[1] ?? '0', 10);
    if (w > max) max = w;
  }
  return max;
}

function attr(tag: string, name: string): string | undefined {
  const re = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const m = tag.match(re);
  if (!m) return undefined;
  return m[2] ?? m[3] ?? m[4];
}

function resolveUrl(href: string, baseUrl: string): string | null {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

export function extractBrandLogoUrl(html: string | null, baseUrl: string): string | null {
  if (!html) return null;

  // Restrict to <head> when possible to avoid matching social-share icons in <body>.
  const headMatch = html.match(/<head[\s\S]*?<\/head>/i);
  const scope = headMatch ? headMatch[0] : html;

  const appleTouch: IconCandidate[] = [];
  const icons: IconCandidate[] = [];
  let ogImage: string | null = null;

  const linkRegex = /<link\b[^>]*>/gi;
  for (const m of scope.matchAll(linkRegex)) {
    const tag = m[0];
    const rel = (attr(tag, 'rel') ?? '').toLowerCase();
    const href = attr(tag, 'href');
    if (!href) continue;
    const resolved = resolveUrl(href, baseUrl);
    if (!resolved) continue;
    const size = parseSizes(attr(tag, 'sizes'));
    if (rel.includes('apple-touch-icon')) {
      appleTouch.push({ href: resolved, size: size || APPLE_TOUCH_DEFAULT_SIZE });
    } else if (rel === 'icon' || rel === 'shortcut icon' || rel.endsWith(' icon')) {
      icons.push({ href: resolved, size });
    }
  }

  const metaRegex = /<meta\b[^>]*>/gi;
  for (const m of scope.matchAll(metaRegex)) {
    const tag = m[0];
    const prop = (attr(tag, 'property') ?? attr(tag, 'name') ?? '').toLowerCase();
    if (prop === 'og:image' || prop === 'twitter:image') {
      const content = attr(tag, 'content');
      if (content) {
        const resolved = resolveUrl(content, baseUrl);
        if (resolved && !ogImage) ogImage = resolved;
      }
    }
  }

  if (appleTouch.length > 0) {
    appleTouch.sort((a, b) => b.size - a.size);
    return appleTouch[0]?.href ?? null;
  }
  if (icons.length > 0) {
    icons.sort((a, b) => b.size - a.size);
    const best = icons[0];
    // Only use <link rel=icon> when it carries a meaningful size hint OR is the
    // only signal — tiny 16×16 .ico files look awful at 32px display size.
    if (best && best.size >= 32) return best.href;
  }
  if (ogImage) return ogImage;
  // Fall back to the conventional favicon path; many sites serve it even
  // without a <link rel=icon> tag.
  const fallback = resolveUrl('/favicon.ico', baseUrl);
  return fallback;
}
