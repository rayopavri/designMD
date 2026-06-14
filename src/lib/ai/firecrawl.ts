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
  type ActionOption,
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
 * 174s watchdog, and QStash's 1 retry then doubles that to ~350s of "stuck"
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
  // Total Firecrawl budget. The scrape-and-extract worker runs on Vercel Pro
  // (300s standard / 800s Fluid cap — see TECH-STACK.md) with maxDuration
  // pinned to 180s and a 174s watchdog; Phase 1 also runs Gemini brand
  // extraction (~8-25s), orphan resolution (~50ms), DB writes (~200ms), and
  // QStash enqueue (~500ms), so we keep Firecrawl under 120s. The pre-step
  // budget checks below assume the worst-case per-step wrapper budgets and
  // subtract them from this number — slow primaries cause enrichment to skip
  // rather than risk pushing the worker past the watchdog.
  const FIRECRAWL_BUDGET_MS = 120_000;
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
  // (i.e. elapsed < 104s) so we never push firecrawl past ~118s total.
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

// ─── Screenshot capture config ───────────────────────────────
//
// Capture at a 1440×900 desktop viewport (16:10). This is the breakpoint the
// site renders at AND it matches the aspect ratio of the 1200×750 storage card
// in src/lib/storage/screenshots.ts — so the sharp `cover` resize there becomes
// a clean proportional downscale instead of slicing the left/right edges.
// quality:90 keeps text crisp before our own webp re-encode.
const SCREENSHOT_FORMAT: FormatOption = {
  type: 'screenshot',
  viewport: { width: 1440, height: 900 },
  quality: 90,
};

// Generic, site-agnostic overlay cleanup. We scrape arbitrary user-submitted
// URLs, so per-site click selectors don't generalize (a missing selector makes
// the whole scrape fail). executeJavascript is the safe generic tool — it
// no-ops when nothing matches instead of erroring. We only remove fixed/sticky
// consent bars and fixed full-screen modal backdrops, leaving absolutely-
// positioned decorative hero overlays intact.
const DISMISS_OVERLAYS = `
try {
  for (const el of [document.documentElement, document.body]) {
    el.style.overflow = '';
    el.style.position = '';
  }
  const consent = '#onetrust-consent-sdk,#onetrust-banner-sdk,#CybotCookiebotDialog,.cky-consent-container,.cc-window,[id*="cookie" i],[class*="cookie" i],[id*="consent" i],[class*="consent" i],[class*="gdpr" i],[aria-label*="cookie" i]';
  document.querySelectorAll(consent).forEach((el) => {
    const s = getComputedStyle(el);
    if (s.position === 'fixed' || s.position === 'sticky' || el.getBoundingClientRect().height >= 60) el.remove();
  });
  const modal = '[role="dialog"],[aria-modal="true"],[class*="modal" i],[class*="popup" i],[class*="overlay" i],[class*="backdrop" i]';
  document.querySelectorAll(modal).forEach((el) => {
    const s = getComputedStyle(el);
    if (s.position === 'fixed' && el.getBoundingClientRect().height >= 120) el.remove();
  });
} catch (e) {}
`.trim();

// Run in the live browser before the screenshot fires: let the page settle,
// close generic modals (Escape closes focus-trapped dialogs without needing a
// selector), strip surviving consent/overlay layers, then settle once more.
// Ordering matters — many popups appear *after* initial load, so dismissal must
// come after the first wait, and the trailing wait lets layout reflow.
const PREP_ACTIONS: ActionOption[] = [
  { type: 'wait', milliseconds: 2000 },
  { type: 'press', key: 'Escape' },
  { type: 'executeJavascript', script: DISMISS_OVERLAYS },
  { type: 'wait', milliseconds: 600 },
];

// ─── Soft-block / anti-bot detection ─────────────────────────
//
// Cloudflare / Turnstile / DataDome challenge pages frequently return HTTP 200
// with challenge HTML or near-empty content rather than a 4xx, so the
// error-message checks in scrapeUrl()'s catch never see them. looksBlocked()
// catches those: a blocking status code, known challenge markers, or thin
// content with no renderer-extracted branding to fall back on.
const BLOCKED_STATUS = new Set([401, 403, 429, 503, 520, 522]);
const CHALLENGE_MARKERS =
  /just a moment|checking your browser|cf-browser-verification|challenge-platform|cf-turnstile|challenges\.cloudflare\.com|datadome|captcha-delivery|px-captcha|enable javascript and cookies|attention required/i;

function looksBlocked(
  result: Pick<ScrapeResult, 'statusCode' | 'markdown' | 'html' | 'branding'>,
): boolean {
  if (result.statusCode != null && BLOCKED_STATUS.has(result.statusCode)) return true;
  if (CHALLENGE_MARKERS.test(`${result.markdown ?? ''}\n${result.html ?? ''}`)) return true;
  // Thin content is only a block signal when the renderer also extracted no
  // branding — a visual landing page can be text-thin yet still scrape fine.
  if ((result.markdown ?? '').trim().length < 200 && !result.branding) return true;
  return false;
}

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  // blockAds skips third-party trackers and speeds first paint. waitFor +
  // PREP_ACTIONS let web fonts/hero animations settle and dismiss cookie
  // banners and modal popups so the screenshot captures clean, styled content
  // instead of a blank frame or an overlay. No scroll actions — Firecrawl's
  // branding extractor runs on the full render tree regardless of scroll
  // position, so scrolling only added latency. screenshot uses a viewport
  // capture (not @fullPage): the hero area is the primary brand signal for
  // Gemini; full-page mode forces capture of every pixel of a very tall page.
  //
  // Retry cascade off the rich (actions + 1440×900 viewport) capture:
  //   • bot-block (403/429/challenge) → one stealth-proxy retry
  //   • timeout (JS-heavy site)       → fast markdown-only pass
  //   • anything else (e.g. a plan that gates executeJavascript) → retry once
  //     without actions, so we never regress below a plain screenshot.
  //
  // v2 JSON-format syntax: when extract is enabled we pass a JsonFormat
  // object `{ type: 'json', prompt }` inside the formats array. The
  // response surfaces the result on `doc.json`. (v1 used a sibling
  // `extract: { prompt }` top-level option — that path is gone.)
  const primaryFormats: FormatOption[] = EXTRACT_ENABLED
    ? ['markdown', 'html', SCREENSHOT_FORMAT, 'branding', { type: 'json', prompt: EXTRACT_PROMPT }]
    : ['markdown', 'html', SCREENSHOT_FORMAT, 'branding'];

  // Rich capture: dismiss-overlay actions + a real desktop viewport. waitFor is
  // the pre-action settle; PREP_ACTIONS add ~2.6s more of wait/dismiss. timeout
  // bumped 25s→30s to cover the extra action time — still far under the 120s
  // FIRECRAWL_BUDGET_MS in scrapeUrlSmart and the 174s worker watchdog.
  const richOpts = {
    formats: primaryFormats,
    waitFor: 1_000,
    timeout: 30_000,
    actions: PREP_ACTIONS,
  };

  let result: ScrapeResult;
  let escalated = false;
  try {
    result = await scrapeUrlOnce(url, richOpts);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    // Hard bot-block (4xx/429/challenge surfaced as an error). Retry once on the
    // enhanced proxy — Firecrawl's strongest anti-bot path, better than stealth
    // on Cloudflare/DataDome. If it also fails, surface the original error.
    if (/\b40[13]\b|\b429\b|forbidden|blocked|denied|captcha|challenge/i.test(msg)) {
      console.warn(`[firecrawl] ${url} looks bot-blocked; retrying with enhanced proxy.`);
      try {
        result = await scrapeUrlOnce(url, { ...richOpts, timeout: 35_000, proxy: 'enhanced' });
        escalated = true;
      } catch (enhancedErr) {
        console.warn(
          `[firecrawl] enhanced retry failed for ${url}: ${enhancedErr instanceof Error ? enhancedErr.message : enhancedErr}`,
        );
        throw err;
      }
    } else if (/408|timed out|timeout/i.test(msg)) {
      // Timed out (often JS-heavy sites): drop screenshot/branding/actions and
      // grab text fast so Gemini still has something to work with.
      console.warn(`[firecrawl] Primary scrape timed out for ${url}; retrying markdown-only.`);
      return await scrapeUrlOnce(url, { formats: ['markdown', 'html'], waitFor: 0, timeout: 10_000 });
    } else {
      // Any other failure (e.g. a Firecrawl plan that gates executeJavascript) —
      // retry once WITHOUT actions so we never regress below a plain screenshot.
      console.warn(
        `[firecrawl] scrape with actions failed for ${url} (${msg.slice(0, 80)}); retrying without actions.`,
      );
      return await scrapeUrlOnce(url, { formats: primaryFormats, waitFor: 1_500, timeout: 25_000 });
    }
  }

  // Soft-block detection: challenge pages return HTTP 200 with challenge HTML /
  // thin content, so the catch above never sees them. Escalate once to the
  // enhanced proxy; if it's STILL blocked (or we already escalated), fail with a
  // SITE_BLOCKED tag so the worker can tell the user to upload a screenshot
  // instead of burning the extraction budget on a challenge page.
  if (looksBlocked(result)) {
    if (!escalated) {
      console.warn(
        `[firecrawl] ${url} returned a soft-block/challenge page; retrying with enhanced proxy.`,
      );
      try {
        result = await scrapeUrlOnce(url, { ...richOpts, timeout: 35_000, proxy: 'enhanced' });
      } catch (enhancedErr) {
        throw new Error(
          `SITE_BLOCKED: ${url} blocks automated access (anti-bot challenge; enhanced-proxy retry failed: ${enhancedErr instanceof Error ? enhancedErr.message : String(enhancedErr)})`,
        );
      }
    }
    if (looksBlocked(result)) {
      throw new Error(
        `SITE_BLOCKED: ${url} blocks automated access (anti-bot challenge detected after enhanced-proxy retry)`,
      );
    }
  }

  return result;
}

/**
 * Minimal screenshot-only scrape. Used by the admin recapture action where
 * markdown/branding/html are not needed — skipping them cuts latency by ~50%
 * and avoids the branding extractor stalling on sites that block headless JS.
 * Returns the short-lived Firecrawl screenshot URL, or throws on failure.
 */
export async function scrapeScreenshot(url: string): Promise<string> {
  const doc = await withClientTimeout(
    () =>
      client().scrape(url, {
        formats: [SCREENSHOT_FORMAT],
        actions: PREP_ACTIONS,
        waitFor: 1_000,
        timeout: 30_000,
        blockAds: true,
      }),
    38_000,
    `firecrawl screenshot(${url})`,
  );
  const shot = doc.screenshot;
  if (!shot) throw new Error('Firecrawl returned no screenshot URL');
  return shot;
}

async function scrapeUrlOnce(
  url: string,
  opts: {
    formats: FormatOption[];
    waitFor: number;
    timeout: number;
    actions?: ActionOption[];
    proxy?: ScrapeOptions['proxy'];
  },
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
    // actions (overlay dismissal) run before formats are captured, so the
    // screenshot/branding reflect the cleaned, settled DOM.
    ...(opts.actions ? { actions: opts.actions } : {}),
    ...(opts.proxy ? { proxy: opts.proxy } : {}),
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
