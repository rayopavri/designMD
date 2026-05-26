/**
 * Firecrawl client — scrapes a URL into clean markdown + metadata.
 *
 * We use the v1 scrape API (single-page). For initial extraction we
 * only need the rendered page body in markdown and a screenshot URL
 * for the brand swatch / palette card.
 */
import FirecrawlApp from '@mendable/firecrawl-js';
import { env } from '@/lib/env';

import { extractBrandLogoUrl } from './logo-extract';

/**
 * Structured design tokens returned by Firecrawl's LLM `extract` format.
 * More comprehensive than `branding` (covers full scales, not just primaries)
 * but text-based — no visual inference from screenshots.
 * Gated by FIRECRAWL_EXTRACT_ENABLED=true env flag.
 */
export interface FirecrawlDesignExtract {
  colors?: Array<{ name: string; hex: string; role?: string }>;
  typography?: Array<{ level: string; fontFamily?: string; fontSize?: string; fontWeight?: number }>;
  spacing?: Array<{ name: string; value: string }>;
  rounded?: Array<{ name: string; value: string }>;
}

/**
 * Structured branding data returned by Firecrawl's `branding` format.
 * Extracted from the live browser render — highest-confidence source for
 * color scheme, primary colors, typography families, and border radius.
 */
export interface FirecrawlBranding {
  colorScheme?: 'dark' | 'light';
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    textPrimary?: string;
    textSecondary?: string;
    [key: string]: string | undefined;
  };
  typography?: {
    fontFamilies?: {
      primary?: string;
      heading?: string;
      code?: string;
    };
    fontSizes?: {
      h1?: string;
      h2?: string;
      body?: string;
      [key: string]: string | undefined;
    };
    fontWeights?: {
      regular?: number;
      medium?: number;
      bold?: number;
    };
  };
  spacing?: {
    baseUnit?: number;
    borderRadius?: string;
  };
  images?: {
    logo?: string;
    favicon?: string;
    ogImage?: string;
  };
}

let _client: FirecrawlApp | null = null;

function client(): FirecrawlApp {
  if (_client) return _client;
  if (!env.FIRECRAWL_API_KEY) {
    throw new Error('FIRECRAWL_API_KEY is not configured');
  }
  _client = new FirecrawlApp({ apiKey: env.FIRECRAWL_API_KEY });
  return _client;
}

/**
 * Hard client-side timeout for Firecrawl SDK calls. The SDK's own `timeout`
 * option is server-side — Firecrawl honors it for the headless render but
 * the underlying fetch can still hang indefinitely if the server keeps the
 * connection open (observed on JS-heavy marketing sites like framer.com).
 * Without this, the only thing that catches a hang is the worker-level
 * 110s watchdog, and QStash's 1 retry then doubles that to ~220s of "stuck"
 * UI before the row gets marked failed.
 *
 * The underlying SDK promise is intentionally left unresolved — Node will
 * GC it once the worker returns. Worst case we pay one extra Firecrawl
 * credit; the alternative (hung worker) is much worse.
 */
async function withClientTimeout<T>(
  op: () => Promise<T>,
  budgetMs: number,
  label: string,
): Promise<T> {
  return Promise.race([
    op(),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${budgetMs}ms (client-side)`)),
        budgetMs,
      ).unref(),
    ),
  ]);
}

export interface ScrapeResult {
  url: string;
  title: string;
  description: string;
  markdown: string;
  html: string | null;
  screenshotUrl: string | null;
  ogImageUrl: string | null;
  brandLogoUrl: string | null;
  language: string | null;
  statusCode: number | null;
  /** Firecrawl CSS-parsed branding data — highest-confidence design tokens. */
  branding: FirecrawlBranding | null;
  /** Firecrawl LLM-extracted design tokens (requires FIRECRAWL_EXTRACT_ENABLED=true). */
  designExtract: FirecrawlDesignExtract | null;
}

const MAX_MARKDOWN_CHARS = 80_000; // ~20k tokens; Gemini Flash handles plenty more, but we cap for cost/safety

// ─── URL relevance scoring ───────────────────────────────────

const DESIGN_SCORE: Array<[RegExp, number]> = [
  [/brand(?:ing)?|design-(?:system|language)|visual-identity/i, 10],
  [/style-?guide|guidelines|design(?!-)/i, 8],
  [/typograph|colou?rs|palette|icons?|fonts?|a11y|accessibility/i, 8],
  [/\bui\b|\bux\b|interface/i, 6],
  [/about(?:-us)?/i, 4],
  [/blog|news|press|articles?|posts?/i, -10],
  [/jobs|careers?|team|hiring/i, -10],
  [/legal|terms|privacy|cookie/i, -10],
  [/login|sign-?up|auth|register|\bapi\b/i, -10],
];

/**
 * Score and filter a list of discovered URLs for design relevance.
 * Returns same-domain URLs with positive scores, sorted best-first.
 */
export function rankDesignUrls(urls: string[], baseUrl: string): string[] {
  let baseHost: string;
  try {
    baseHost = new URL(baseUrl).hostname;
  } catch {
    return [];
  }

  const scored: Array<{ url: string; score: number }> = [];
  for (const raw of urls) {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      continue;
    }
    // Same domain only, no file extensions, not the homepage itself.
    if (parsed.hostname !== baseHost) continue;
    if (/\.[a-z]{2,4}$/i.test(parsed.pathname) && !/\.html?$/i.test(parsed.pathname)) continue;
    const normalized = parsed.origin + parsed.pathname.replace(/\/$/, '');
    const base = new URL(baseUrl).origin + new URL(baseUrl).pathname.replace(/\/$/, '');
    if (normalized === base) continue;

    const path = parsed.pathname + parsed.search;
    let score = 0;
    for (const [pattern, delta] of DESIGN_SCORE) {
      if (pattern.test(path)) score += delta;
    }
    if (score > 0) scored.push({ url: raw, score });
  }

  return scored.sort((a, b) => b.score - a.score).map((s) => s.url);
}

// ─── Smart multi-page scrape ─────────────────────────────────

/**
 * Smart scrape: always starts with a full single-page scrape, then
 * discovers design-relevant subpages via mapUrl and batch-scrapes the
 * top 3. Subpage markdown is merged into the primary result so Gemini
 * receives richer context for token extraction.
 *
 * Both the discovery and batch steps are best-effort — any failure
 * returns the primary result unchanged so the job never fails because
 * of the enrichment path.
 */
export async function scrapeUrlSmart(
  url: string,
  opts?: { searchQuery?: string },
): Promise<ScrapeResult> {
  // Vercel Hobby caps functions at 60s. Phase 1 also runs Gemini (~10s),
  // orphan resolution, DB writes, and QStash enqueue. Keep the total
  // Firecrawl budget to 45s so those steps always have headroom. Primary
  // scrape alone can take 22s on JS-heavy sites (binance, apple); leave
  // ~20s for mapUrl + batch enrichment.
  const FIRECRAWL_BUDGET_MS = 45_000;
  const start = Date.now();

  // Step 1: Full primary scrape (screenshot + html + branding — unchanged).
  const primary = await scrapeUrl(url);

  // Budget check — a slow primary (complex JS-heavy site) eats most of
  // the window; skip enrichment rather than risk a function timeout.
  if (Date.now() - start > FIRECRAWL_BUDGET_MS - 6_000) return primary;

  // Step 2: Discover subpages. Fast (~2-3s), best-effort.
  let rankedUrls: string[] = [];
  try {
    const mapped = await withClientTimeout(
      () =>
        client().mapUrl(url, {
          limit: 20,
          timeout: 3000,
          ...(opts?.searchQuery ? { search: opts.searchQuery } : {}),
        }),
      5_000,
      `firecrawl mapUrl(${url})`,
    );
    if (mapped.success && mapped.links?.length) {
      rankedUrls = rankDesignUrls(mapped.links, url);
    }
  } catch {
    return primary;
  }

  if (rankedUrls.length === 0) return primary;

  // Budget check before the batch scrape.
  if (Date.now() - start > FIRECRAWL_BUDGET_MS - 9_000) return primary;

  // Step 3: Batch-scrape top 3 subpages in parallel (markdown only).
  // Firecrawl Hobby supports 5 concurrent scrapes, so 3 in parallel
  // leaves headroom. Tighter timeout (8s each) stays well within budget.
  let extraMarkdown = '';
  try {
    const batch = await withClientTimeout(
      () =>
        client().batchScrapeUrls(
          rankedUrls.slice(0, 3),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { formats: ['markdown'] as any, onlyMainContent: true, timeout: 8_000 },
          1000, // pollInterval ms
        ),
      14_000,
      `firecrawl batchScrapeUrls(${rankedUrls.length})`,
    );
    if (batch.success && (batch as { data?: unknown[] }).data?.length) {
      const docs = (batch as { data: Array<{ url?: string; markdown?: string; metadata?: { title?: string } }> }).data;
      extraMarkdown = docs
        .filter((d) => d.markdown?.trim())
        .map((d) => `\n\n---\n\n**${d.metadata?.title ?? d.url ?? ''}** (${d.url ?? ''}):\n\n${d.markdown}`)
        .join('');
    }
  } catch {
    return primary;
  }

  if (!extraMarkdown) return primary;

  // Step 4: Merge and cap.
  const merged = (primary.markdown + extraMarkdown).slice(0, MAX_MARKDOWN_CHARS);
  return { ...primary, markdown: merged };
}

// Opt-in feature flag: run Firecrawl's LLM extract pass for richer design token
// pre-extraction. Adds ~4 Firecrawl credits per generation. Disabled by default.
// Enable via FIRECRAWL_EXTRACT_ENABLED=true in Vercel environment variables.
const EXTRACT_ENABLED = env.FIRECRAWL_EXTRACT_ENABLED;

const EXTRACT_PROMPT =
  'Extract design system tokens from this page: ' +
  '(1) colors — all brand colors with hex codes (#RRGGBB) and their semantic role (primary, secondary, surface, on-surface, outline, error, etc.); ' +
  '(2) typography — each visible type level with font family, font size in px or rem, and font weight; ' +
  '(3) spacing — spacing scale values with names (xs/sm/md/lg/xl or specific roles like gutter, container-padding); ' +
  '(4) rounded — border-radius values with scale names (sm/md/lg/full). ' +
  'Prioritize values observable in CSS variables and computed styles over visual guesses.';

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  // blockAds skips third-party trackers and speeds first paint.
  // waitFor gives web fonts and hero animations time to settle so the
  // viewport screenshot captures styled content. No scroll actions —
  // the scroll dance saved lazy-loads below the fold but added ~3.6s of
  // hard waits; Firecrawl's branding extractor runs on the full render
  // tree regardless of scroll position, so the only cost was latency.
  // screenshot (viewport) replaces screenshot@fullPage: the hero area
  // is the primary brand signal for Gemini; full-page mode forces
  // Firecrawl to capture every pixel of a potentially very tall page.
  //
  // Two-pass strategy: try with full features (screenshot + branding +
  // html) at 22s. If Firecrawl times out on a JS-heavy site, retry
  // once with markdown only and a tighter timeout — slower sites still
  // produce usable data for Gemini text extraction even without screenshot.
  const primaryFormats = EXTRACT_ENABLED
    ? (['markdown', 'html', 'screenshot', 'branding', 'extract'] as never)
    : (['markdown', 'html', 'screenshot', 'branding'] as never);

  try {
    return await scrapeUrlOnce(url, {
      formats: primaryFormats,
      waitFor: 800,
      timeout: 22_000,
      extractPrompt: EXTRACT_ENABLED ? EXTRACT_PROMPT : undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/408|timed out|timeout/i.test(msg)) throw err;
    console.warn(`[firecrawl] Primary scrape timed out for ${url}; retrying markdown-only.`);
    // Fallback never requests extract — keep the retry path fast.
    return await scrapeUrlOnce(url, {
      formats: ['markdown', 'html'] as never,
      waitFor: 0,
      timeout: 10_000,
    });
  }
}

async function scrapeUrlOnce(
  url: string,
  opts: { formats: never; waitFor: number; timeout: number; extractPrompt?: string },
): Promise<ScrapeResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scrapeOpts: any = {
    // 'branding' requests Firecrawl's CSS-parsed design tokens (colorScheme,
    // primary/secondary colors, font families, font sizes, border radius,
    // logo/favicon URLs). This is extracted from the live browser renderer
    // and is higher fidelity than our regex-based extractComputedStyles().
    //
    // Note: @mendable/firecrawl-js v1's types don't include 'branding' or
    // 'extract' yet (the runtime API supports both). Drop casts once SDK types
    // catch up.
    formats: opts.formats,
    onlyMainContent: true,
    waitFor: opts.waitFor,
    timeout: opts.timeout,
    blockAds: true,
  };
  if (opts.extractPrompt) {
    scrapeOpts.extract = { prompt: opts.extractPrompt };
  }

  // Cap the local promise at server timeout + 8s grace. If Firecrawl's
  // server hangs past its own timeout, we reject with a "timed out" message
  // so the primary→fallback path in scrapeUrl() picks it up.
  const res = await withClientTimeout(
    () => client().scrapeUrl(url, scrapeOpts),
    opts.timeout + 8_000,
    `firecrawl scrapeUrl(${url})`,
  );

  if (!res.success) {
    throw new Error(`Firecrawl scrape failed: ${res.error ?? 'unknown error'}`);
  }

  const markdown = (res.markdown ?? '').slice(0, MAX_MARKDOWN_CHARS);
  const html = res.html ?? null;
  const metadata = res.metadata ?? {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resAny = res as any;
  const branding = (resAny.branding as FirecrawlBranding | undefined) ?? null;
  const designExtract = opts.extractPrompt
    ? ((resAny.extract as FirecrawlDesignExtract | undefined) ?? null)
    : null;

  const ogImageUrl = typeof metadata.ogImage === 'string' ? metadata.ogImage : null;
  const extractedLogo = extractBrandLogoUrl(html, url);

  // Logo priority: Firecrawl's renderer-extracted logo > our HTML head parsing > og:image.
  const brandLogoUrl = branding?.images?.logo ?? extractedLogo ?? ogImageUrl;

  return {
    url,
    title: String(metadata.title ?? metadata.ogTitle ?? '').trim(),
    description: String(metadata.description ?? metadata.ogDescription ?? '').trim(),
    markdown,
    html,
    screenshotUrl: res.screenshot ?? null,
    ogImageUrl,
    brandLogoUrl,
    language: typeof metadata.language === 'string' ? metadata.language : null,
    statusCode: typeof metadata.statusCode === 'number' ? metadata.statusCode : null,
    branding,
    designExtract,
  };
}
