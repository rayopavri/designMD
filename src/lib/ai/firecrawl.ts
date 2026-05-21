/**
 * Firecrawl client — scrapes a URL into clean markdown + metadata.
 *
 * We use the v1 scrape API (single-page). For initial extraction we
 * only need the rendered page body in markdown and a screenshot URL
 * for the brand swatch / palette card.
 */
import FirecrawlApp from '@mendable/firecrawl-js';
import { env } from '@/lib/env';

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
  language: string | null;
  statusCode: number | null;
}

const MAX_MARKDOWN_CHARS = 80_000; // ~20k tokens; Gemini Flash handles plenty more, but we cap for cost/safety

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  // Heavy animated landing pages (Lando Norris, etc.) need:
  //  1. Time for web fonts + hero animations to settle (text invisible
  //     without fonts, looks "broken" in screenshots otherwise).
  //  2. A full scroll through the page to trigger IntersectionObserver
  //     lazy-loaded images and below-fold content. Without this the
  //     screenshot captures empty grey placeholder boxes.
  //  3. A scroll back to the top so the final full-page screenshot
  //     starts from the hero instead of mid-page.
  // blockAds: true also speeds first paint by skipping third-party trackers.
  // Aggregate budget for actions: ~6-7s. Have to stay tight because the
  // whole pipeline (scrape + Gemini + Sonnet + lint) runs in a single
  // 60s Vercel Hobby function. Two scroll-cycles is enough to fire
  // IntersectionObserver lazy-loads on most landing pages.
  const res = await client().scrapeUrl(url, {
    formats: ['markdown', 'html', 'screenshot@fullPage'],
    onlyMainContent: true,
    waitFor: 1500,
    timeout: 25_000,
    blockAds: true,
    actions: [
      { type: 'wait', milliseconds: 1200 },
      { type: 'scroll', direction: 'down' },
      { type: 'wait', milliseconds: 800 },
      { type: 'scroll', direction: 'down' },
      { type: 'wait', milliseconds: 800 },
      { type: 'scroll', direction: 'up' },
      { type: 'wait', milliseconds: 800 },
    ],
  });

  if (!res.success) {
    throw new Error(`Firecrawl scrape failed: ${res.error ?? 'unknown error'}`);
  }

  const markdown = (res.markdown ?? '').slice(0, MAX_MARKDOWN_CHARS);
  const html = res.html ?? null;
  const metadata = res.metadata ?? {};

  return {
    url,
    title: String(metadata.title ?? metadata.ogTitle ?? '').trim(),
    description: String(metadata.description ?? metadata.ogDescription ?? '').trim(),
    markdown,
    html,
    screenshotUrl: res.screenshot ?? null,
    ogImageUrl: typeof metadata.ogImage === 'string' ? metadata.ogImage : null,
    language: typeof metadata.language === 'string' ? metadata.language : null,
    statusCode: typeof metadata.statusCode === 'number' ? metadata.statusCode : null,
  };
}
