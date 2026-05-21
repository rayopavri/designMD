/**
 * POST /api/admin/backfill-logos
 *
 * One-time backfill: walks every bundle where brand_logo_url IS NULL but
 * source_url IS NOT NULL, fetches the page's HTML, extracts the best logo
 * URL via the same `extractBrandLogoUrl` used by the scrape pipeline, and
 * writes it back to the row.
 *
 * Safe to re-run — only operates on rows with a NULL logo.
 *
 * Query params:
 *   limit  - max bundles to process this call (default 25, cap 50). Keeps
 *            us under the 60s Vercel Hobby function ceiling.
 *
 * Auth: editor-only.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { eq, isNull, and, isNotNull, sql } from 'drizzle-orm';
import { requireEditor } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { bundles } from '@/lib/db/schema';
import { extractBrandLogoUrl } from '@/lib/ai/logo-extract';

export const runtime = 'nodejs';
export const maxDuration = 60;

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;
const FETCH_TIMEOUT_MS = 8_000;
const CONCURRENCY = 4;

type Result = {
  slug: string;
  status: 'updated' | 'no-logo-found' | 'fetch-failed';
  logoUrl?: string;
  error?: string;
};

async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; uiuxskills-logo-backfill/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('html')) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function processRow(row: { id: string; slug: string; sourceUrl: string }): Promise<Result> {
  const html = await fetchHtml(row.sourceUrl);
  if (!html) {
    return { slug: row.slug, status: 'fetch-failed', error: `fetch ${row.sourceUrl} returned null` };
  }
  const logoUrl = extractBrandLogoUrl(html, row.sourceUrl);
  if (!logoUrl) {
    return { slug: row.slug, status: 'no-logo-found' };
  }
  await db
    .update(bundles)
    .set({ brandLogoUrl: logoUrl, updatedAt: new Date() })
    .where(eq(bundles.id, row.id));
  return { slug: row.slug, status: 'updated', logoUrl };
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      const item = items[idx];
      if (item === undefined) return;
      results[idx] = await fn(item);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function POST(req: NextRequest) {
  try {
    await requireEditor();
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Auth check failed' }, { status: 500 });
  }

  const limitParam = req.nextUrl.searchParams.get('limit');
  const parsedLimit = limitParam ? Math.min(parseInt(limitParam, 10) || DEFAULT_LIMIT, MAX_LIMIT) : DEFAULT_LIMIT;

  const rows = await db
    .select({ id: bundles.id, slug: bundles.slug, sourceUrl: bundles.sourceUrl })
    .from(bundles)
    .where(and(isNull(bundles.brandLogoUrl), isNotNull(bundles.sourceUrl)))
    .limit(parsedLimit);

  // sourceUrl is non-null thanks to the WHERE clause but TS doesn't know that.
  const candidates = rows.filter(
    (r): r is { id: string; slug: string; sourceUrl: string } => r.sourceUrl !== null,
  );

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, remaining: 0, results: [] });
  }

  const results = await runWithConcurrency(candidates, CONCURRENCY, processRow);

  // Count rows still needing backfill after this call.
  const [countRow] = await db
    .select({ remaining: sql<number>`count(*)::int` })
    .from(bundles)
    .where(and(isNull(bundles.brandLogoUrl), isNotNull(bundles.sourceUrl)));

  return NextResponse.json({
    ok: true,
    processed: results.length,
    updated: results.filter((r) => r.status === 'updated').length,
    fetchFailed: results.filter((r) => r.status === 'fetch-failed').length,
    noLogo: results.filter((r) => r.status === 'no-logo-found').length,
    remaining: countRow?.remaining ?? 0,
    results,
  });
}
