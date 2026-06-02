/**
 * Firecrawl client — scrapes a URL into clean markdown + design tokens.
 *
 * Uses the v2 SDK (`Firecrawl` class, `scrape()` / `map()` / `batchScrape()`)
 * which is the canonical API for the `branding` format. The v2 endpoint
 * returns a `BrandingProfile` with renderer-extracted color scheme,
 * primary/secondary/accent/semantic colors, typography families/sizes,
 * spacing, component-level tokens, and brand assets — the highest-fidelity
 * design-token source we have access to.
 */
import Firecrawl, {
  type Document,
  type BrandingProfile,
  type FormatOption,
  type ScrapeOptions,
} from '@mendable/firecrawl-js';
import { env } from '@/lib/env';

import { extractBrandLogoUrl } from './logo-extract';
import { perf } from '@/lib/generator/perf-log';

/**
 * Re-export the SDK's BrandingProfile under the legacy name so downstream
 * consumers (gemini.ts, scrape-and-extract.ts) keep working without churn.
 * BrandingProfile is the v2 superset of what we used to declare locally —
 * adds `success`/`warning`/`error` semantic colors, `components.*` button
 * and input styling, `personality`, `animations`, `layout`, etc.
 */
export type FirecrawlBranding = BrandingProfile;

/**
 * Shape we ask the JSON-extract format to return when
 * FIRECRAWL_EXTRACT_ENABLED is on. This is OUR contract with Gemini — the
 * v2 SDK doesn't constrain JSON-format payloads beyond `unknown`, so we
 * narrow it here for the consumers.
 */
export interface FirecrawlDesignExtract {
  colors?: Array<{ name: string; hex: string; role?: string }>;
  typography?: Array<{ level: string; fontFamily?: string; fontSize?: string; fontWeight?: number }>;
  spacing?: Array<{ name: string; value: string }>;
  rounded?: Array<{ name: string; value: string }>;
  shadows?: Array<{ name: string; value: string; elevation?: number }>;
  animations?: Array<{ name: string; value: string }>;
}

let _client: Firecrawl | null = null;

function client(): Firecrawl {
  if (_client) return _client;
  if (!env.FIRECRAWL_API_KEY) {
    throw new Error('FIRECRAWL_API_KEY is not configured');
  }
  _client = new Firecrawl({ apiKey: env.FIRECRAWL_API_KEY });
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
  /** Firecrawl renderer-extracted branding data — highest-confidence design tokens. */
  branding: BrandingProfile | null;
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
 * discovers design-relevant subpages via map() and batch-scrapes the
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
  // Total Firecrawl budget. Vercel function maxDuration is 120s for this
  // worker; Phase 1 also runs Gemini brand extraction (~10-15s), orphan
  // resolution (~50ms), DB writes (~200ms), and QStash enqueue (~500ms),
  // so we keep Firecrawl under 40s. The pre-step budget checks below
  // assume the worst-case per-step wrapper budgets and subtract them
  // from this number — slow primaries cause enrichment to skip rather
  // than risk pushing the worker past the watchdog.
  const FIRECRAWL_BUDGET_MS = 45_000;
  const start = Date.now();

  // Step 1: Full primary scrape (screenshot + html + branding).
  let primary: ScrapeResult;
  try {
    primary = await scrapeUrl(url);
  } catch (err) {
    perf('scrape.primary', 'err', Date.now() - start, {
      error: err instanceof Error ? err.message.slice(0, 80) : String(err).slice(0, 80),
    });
    throw err;
  }
  const afterPrimary = Date.now() - start;
  perf('scrape.primary', 'ok', afterPrimary);

  // Skip map() if the primary ate enough of our budget that adding
  // map (8s) + batch (14s) would overrun. -12s = map wrapper +
  // small headroom; if a successful map() pushes us past the batch
  // threshold we'll skip batch on the next check.
  if (afterPrimary > FIRECRAWL_BUDGET_MS - 12_000) {
    console.warn(
      `[firecrawl] skipping enrichment for ${url} — primary used ${afterPrimary}ms of ${FIRECRAWL_BUDGET_MS}ms budget`,
    );
    return primary;
  }

  // Step 2: Discover subpages. Wrapper budget bumped to 8s so legitimate
  // slow-but-successful maps (cold Vercel + remote latency + Firecrawl's
  // own 3s server timeout) don't get cut off as if they hung. Warn-log
  // when we DO trip the wrapper so a regression in this path is visible.
  let rankedUrls: string[] = [];
  const mapStart = Date.now();
  try {
    const mapped = await withClientTimeout(
      () =>
        client().map(url, {
          limit: 30,
          timeout: 3000,
          ...(opts?.searchQuery ? { search: opts.searchQuery } : {}),
        }),
      8_000,
      `firecrawl map(${url})`,
    );
    if (mapped.links?.length) {
      // v2 map returns SearchResultWeb[] (objects with url/title/description);
      // we only need URL strings for ranking.
      rankedUrls = rankDesignUrls(
        mapped.links.map((l) => l.url),
        url,
      );
    }
    perf('scrape.map', 'ok', Date.now() - mapStart, {
      links: mapped.links?.length ?? 0,
      ranked: rankedUrls.length,
    });
  } catch (err) {
    perf('scrape.map', 'err', Date.now() - mapStart, {
      error: err instanceof Error ? err.message.slice(0, 80) : String(err).slice(0, 80),
    });
    console.warn(
      `[firecrawl] map enrichment skipped for ${url}: ${err instanceof Error ? err.message : err}`,
    );
    return primary;
  }

  if (rankedUrls.length === 0) return primary;

  // Skip batch if too much budget has been spent already. Batch wrapper
  // is 14s; -16_000 means we only enter batch when ≥16s of budget remain
  // (i.e. elapsed < 24s) so we never push firecrawl past 38s total.
  const afterMap = Date.now() - start;
  if (afterMap > FIRECRAWL_BUDGET_MS - 16_000) {
    console.warn(
      `[firecrawl] skipping batch enrichment for ${url} — ${afterMap}ms elapsed before batch could start`,
    );
    return primary;
  }

  // Step 3: Batch-scrape top 3 subpages in parallel (markdown only).
  // Firecrawl Hobby supports 5 concurrent scrapes, so 3 in parallel
  // leaves headroom. Per-page server timeout is 8s; the 14s wrapper
  // covers polling + transport overhead.
  let extraMarkdown = '';
  const batchStart = Date.now();
  try {
    const batch = await withClientTimeout(
      () =>
        client().batchScrape(rankedUrls.slice(0, 3), {
          options: {
            formats: ['markdown'],
            onlyMainContent: true,
            timeout: 8_000,
          },
          pollInterval: 750,
        }),
      15_000,
      `firecrawl batchScrape(${rankedUrls.length})`,
    );
    if (batch.data?.length) {
      extraMarkdown = batch.data
        .filter((d) => d.markdown?.trim())
        .map(
          (d) =>
            `\n\n---\n\n**${d.metadata?.title ?? d.metadata?.sourceURL ?? ''}** (${d.metadata?.sourceURL ?? ''}):\n\n${d.markdown}`,
        )
        .join('');
    }
    perf('scrape.batch', 'ok', Date.now() - batchStart, { pages: batch.data?.length ?? 0 });
  } catch (err) {
    perf('scrape.batch', 'err', Date.now() - batchStart, {
      error: err instanceof Error ? err.message.slice(0, 80) : String(err).slice(0, 80),
    });
    console.warn(
      `[firecrawl] batchScrape enrichment skipped for ${url}: ${err instanceof Error ? err.message : err}`,
    );
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
  '(4) rounded — border-radius values with scale names (sm/md/lg/full); ' +
  '(5) shadows — box-shadow values with semantic names (sm/md/lg/xl or card/dialog/tooltip/overlay) and the full CSS box-shadow string for each; ' +
  '(6) animations — CSS transition and animation values: duration values in ms and easing functions (cubic-bezier or keyword), each with a name (duration-short, duration-medium, easing-standard, etc.). ' +
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
  //
  // v2 JSON-format syntax: when extract is enabled we pass a JsonFormat
  // object `{ type: 'json', prompt }` inside the formats array. The
  // response surfaces the result on `doc.json`. (v1 used a sibling
  // `extract: { prompt }` top-level option — that path is gone.)
  const primaryFormats: FormatOption[] = EXTRACT_ENABLED
    ? ['markdown', 'html', 'screenshot', 'branding', { type: 'json', prompt: EXTRACT_PROMPT }]
    : ['markdown', 'html', 'screenshot', 'branding'];

  try {
    return await scrapeUrlOnce(url, {
      formats: primaryFormats,
      waitFor: 800,
      timeout: 25_000,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/408|timed out|timeout/i.test(msg)) throw err;
    console.warn(`[firecrawl] Primary scrape timed out for ${url}; retrying markdown-only.`);
    // Fallback never requests json/branding — keep the retry path fast.
    return await scrapeUrlOnce(url, {
      formats: ['markdown', 'html'],
      waitFor: 0,
      timeout: 10_000,
    });
  }
}

async function scrapeUrlOnce(
  url: string,
  opts: { formats: FormatOption[]; waitFor: number; timeout: number },
): Promise<ScrapeResult> {
  const scrapeOpts: ScrapeOptions = {
    // 'branding' requests Firecrawl's renderer-extracted design tokens
    // (colorScheme, primary/secondary/accent colors, semantic state colors,
    // font families/sizes/weights, spacing, component-level styling,
    // logo/favicon URLs, personality). Extracted from the live browser
    // renderer — higher fidelity than regex-based HTML parsing.
    formats: opts.formats,
    onlyMainContent: true,
    waitFor: opts.waitFor,
    timeout: opts.timeout,
    blockAds: true,
  };

  // Cap the local promise at server timeout + 8s grace. If Firecrawl's
  // server hangs past its own timeout, we reject with a "timed out" message
  // so the primary→fallback path in scrapeUrl() picks it up.
  //
  // v2: scrape() returns Document directly. Errors throw — there's no
  // `{ success: false }` envelope to inspect.
  const doc: Document = await withClientTimeout(
    () => client().scrape(url, scrapeOpts),
    opts.timeout + 8_000,
    `firecrawl scrape(${url})`,
  );

  const markdown = (doc.markdown ?? '').slice(0, MAX_MARKDOWN_CHARS);
  const html = doc.html ?? null;
  const metadata = doc.metadata ?? {};
  const branding = doc.branding ?? null;
  const designExtract =
    doc.json != null ? (doc.json as FirecrawlDesignExtract) : null;

  const ogImageUrl = typeof metadata.ogImage === 'string' ? metadata.ogImage : null;
  const extractedLogo = extractBrandLogoUrl(html, url);

  // Logo priority: Firecrawl's renderer-extracted logo > our HTML head parsing > og:image.
  // BrandingProfile.images.logo is `string | null | undefined`; coerce null to undefined
  // so the ?? chain picks the next fallback instead of locking in null.
  const brandLogoUrl = branding?.images?.logo ?? extractedLogo ?? ogImageUrl;

  return {
    url,
    title: String(metadata.title ?? metadata.ogTitle ?? '').trim(),
    description: String(metadata.description ?? metadata.ogDescription ?? '').trim(),
    markdown,
    html,
    screenshotUrl: doc.screenshot ?? null,
    ogImageUrl,
    brandLogoUrl,
    language: typeof metadata.language === 'string' ? metadata.language : null,
    statusCode: typeof metadata.statusCode === 'number' ? metadata.statusCode : null,
    branding,
    designExtract,
  };
}
