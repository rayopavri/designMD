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
  const res = await client().scrapeUrl(url, {
    // `screenshot@fullPage` captures the entire scroll height — required
    // by the home gallery's Framer-style hover-scroll animation.
    formats: ['markdown', 'html', 'screenshot@fullPage'],
    onlyMainContent: true,
    waitFor: 1500,
    timeout: 30_000,
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
