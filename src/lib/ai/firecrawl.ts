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
}

const MAX_MARKDOWN_CHARS = 80_000; // ~20k tokens; Gemini Flash handles plenty more, but we cap for cost/safety

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
  const res = await client().scrapeUrl(url, {
    // 'branding' requests Firecrawl's CSS-parsed design tokens (colorScheme,
    // primary/secondary colors, font families, font sizes, border radius,
    // logo/favicon URLs). This is extracted from the live browser renderer
    // and is higher fidelity than our regex-based extractComputedStyles().
    //
    // Note: @mendable/firecrawl-js v1's types don't include 'branding' yet
    // (the runtime API supports it; the official branding cookbook also
    // casts around this). Drop the cast once SDK types catch up.
    formats: ['markdown', 'html', 'screenshot', 'branding'] as never,
    onlyMainContent: true,
    waitFor: 1000,
    timeout: 30_000,
    blockAds: true,
  });

  if (!res.success) {
    throw new Error(`Firecrawl scrape failed: ${res.error ?? 'unknown error'}`);
  }

  const markdown = (res.markdown ?? '').slice(0, MAX_MARKDOWN_CHARS);
  const html = res.html ?? null;
  const metadata = res.metadata ?? {};

  // Firecrawl's branding format is not yet typed in @mendable/firecrawl-js v1;
  // access it via a safe cast. Returns null if the format wasn't supported.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const branding = ((res as any).branding as FirecrawlBranding | undefined) ?? null;

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
  };
}
