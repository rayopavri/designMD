/**
 * Best-effort brand-name discovery for bulk-upload dedup.
 *
 * The pipeline only learns a site's real `brand.name` AFTER scraping, which is
 * far too slow to run for 150 URLs inside the endpoint's 60s budget. So before
 * enqueuing, we probe each URL's `<head>` metadata (cheap, bounded, never a
 * full Firecrawl scrape) and run one batched Gemini call to turn that metadata
 * into canonical brand names. The result feeds a name-based duplicate check.
 *
 * Hard guarantees (so name-discovery latency can never fail the request):
 *   - Per-fetch timeout AND a shared overall deadline; once exceeded, remaining
 *     URLs resolve to `null`.
 *   - Bounded concurrency.
 *   - SSRF guard: loopback / private / link-local / CGNAT hosts are never
 *     fetched, and every redirect hop is re-validated.
 *   - Any failure degrades to `null` → caller falls back to URL-only checking.
 *
 * `null` for a URL means "couldn't resolve a name → skip the name check".
 */
import net from 'node:net';
import { promises as dns } from 'node:dns';
import { extractBrandNamesQuick, type QuickNameItem } from '@/lib/ai/gemini';

const FETCH_TIMEOUT_MS = 4_000;
const OVERALL_DEADLINE_MS = 38_000;
const CONCURRENCY = 20;
const MAX_HTML_BYTES = 64 * 1024;
const MAX_REDIRECTS = 4;
const GEMINI_TIMEOUT_MS = 12_000;
const USER_AGENT =
  'Mozilla/5.0 (compatible; uiuxskills-bot/1.0; +https://uiuxskills.com)';

interface HeadMetadata {
  title?: string;
  ogSiteName?: string;
  ogTitle?: string;
}

/**
 * Resolve a canonical brand name for each (already-normalized) URL.
 * Keyed by the input URL string. `null` = name unresolved.
 */
export async function prefetchBrandNames(
  urls: string[],
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  for (const u of urls) result.set(u, null);
  if (urls.length === 0) return result;

  const deadline = Date.now() + OVERALL_DEADLINE_MS;
  const metaByUrl = new Map<string, HeadMetadata>();

  let cursor = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const i = cursor++;
      if (i >= urls.length) return;
      if (Date.now() >= deadline) return;
      const url = urls[i];
      try {
        const html = await safeFetchHtml(url, deadline);
        if (html == null) continue;
        const meta = parseHeadMetadata(html);
        if (meta.title || meta.ogSiteName || meta.ogTitle) {
          metaByUrl.set(url, meta);
        }
      } catch {
        // Best-effort: leave this URL unresolved (null).
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker),
  );

  // Metadata-only fallback (used if Gemini is skipped or fails).
  const fallbackByUrl = new Map<string, string>();
  for (const [url, meta] of metaByUrl) {
    const fallback =
      meta.ogSiteName?.trim() || firstSegment(meta.ogTitle) || firstSegment(meta.title);
    if (fallback) fallbackByUrl.set(url, fallback);
  }

  // One batched Gemini call to canonicalize names — only if there's budget left.
  const aiBudget = deadline - Date.now();
  const aiNameByUrl = new Map<string, string>();
  if (metaByUrl.size > 0 && aiBudget > 1_000) {
    const items: QuickNameItem[] = [...metaByUrl.entries()].map(([url, m]) => ({
      url,
      title: m.title,
      ogSiteName: m.ogSiteName,
      ogTitle: m.ogTitle,
    }));
    try {
      const named = await extractBrandNamesQuick(
        items,
        Math.min(GEMINI_TIMEOUT_MS, aiBudget),
      );
      for (const { url, name } of named) {
        const trimmed = name.trim();
        if (trimmed) aiNameByUrl.set(url, trimmed);
      }
    } catch (err) {
      console.warn('[prefetch-names] Gemini name extraction failed; using metadata fallback:', err);
    }
  }

  for (const url of metaByUrl.keys()) {
    const name = aiNameByUrl.get(url) ?? fallbackByUrl.get(url) ?? null;
    result.set(url, name);
  }
  return result;
}

/**
 * First brand-like segment of a page title: splits on the common separators
 * sites use to append taglines (pipe, en/em dash, middot, spaced hyphen).
 */
export function firstSegment(title?: string): string | null {
  if (!title) return null;
  const first = title.split(/\s*[|–—·]\s*|\s+-\s+/)[0]?.trim();
  return first || null;
}

// ── Fetch with SSRF-safe redirect handling ──────────────────────────────────

async function safeFetchHtml(
  initialUrl: string,
  deadline: number,
): Promise<string | null> {
  let current = initialUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      return null;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (!(await isSafeHost(parsed.hostname))) return null;

    const remaining = deadline - Date.now();
    if (remaining <= 0) return null;

    let res: Response;
    try {
      res = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(Math.min(FETCH_TIMEOUT_MS, remaining)),
        headers: {
          'user-agent': USER_AGENT,
          accept: 'text/html,application/xhtml+xml',
        },
      });
    } catch {
      return null;
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) return null;
      try {
        current = new URL(location, current).toString();
      } catch {
        return null;
      }
      continue; // re-validate the new host on the next loop iteration
    }

    if (!res.ok) return null;

    const contentType = res.headers.get('content-type')?.toLowerCase() ?? '';
    if (contentType && !contentType.includes('html') && !contentType.includes('text')) {
      return null;
    }
    return readCapped(res, MAX_HTML_BYTES);
  }
  return null; // too many redirects
}

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.length;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(
    merged.subarray(0, maxBytes),
  );
}

// ── SSRF guard ───────────────────────────────────────────────────────────────

async function isSafeHost(hostname: string): Promise<boolean> {
  const host = hostname.toLowerCase();
  if (!host) return false;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    return false;
  }

  if (net.isIP(host)) return !isBlockedIp(host);

  let addresses: { address: string }[];
  try {
    addresses = await dns.lookup(host, { all: true });
  } catch {
    return false; // can't verify → treat as unsafe
  }
  if (addresses.length === 0) return false;
  return addresses.every((a) => !isBlockedIp(a.address));
}

function isBlockedIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return isPrivateIpv4(ip);
  if (family === 6) return isPrivateIpv6(ip);
  return true; // not a recognizable IP → unsafe
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const addr = ip.toLowerCase();
  if (addr === '::1' || addr === '::') return true; // loopback / unspecified
  // IPv4-mapped (::ffff:a.b.c.d) — validate the embedded v4 address.
  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIpv4(mapped[1]);
  const head = addr.split(':')[0];
  if (head.startsWith('fe8') || head.startsWith('fe9') || head.startsWith('fea') || head.startsWith('feb')) {
    return true; // fe80::/10 link-local
  }
  if (head.startsWith('fc') || head.startsWith('fd')) return true; // fc00::/7 ULA
  return false;
}

// ── HTML <head> metadata extraction (regex, no DOM parser) ───────────────────

function parseHeadMetadata(html: string): HeadMetadata {
  return {
    title: matchTitle(html),
    ogSiteName: matchMeta(html, 'og:site_name'),
    ogTitle: matchMeta(html, 'og:title'),
  };
}

function matchTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return undefined;
  const value = decodeEntities(m[1]).replace(/\s+/g, ' ').trim();
  return value || undefined;
}

function matchMeta(html: string, property: string): string | undefined {
  const prop = escapeRegExp(property);
  // content after the property/name attribute
  const after = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*\\bcontent=["']([^"']*)["']`,
    'i',
  );
  // content before the property/name attribute
  const before = new RegExp(
    `<meta[^>]+\\bcontent=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`,
    'i',
  );
  const m = html.match(after) ?? html.match(before);
  if (!m) return undefined;
  const value = decodeEntities(m[1]).trim();
  return value || undefined;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
