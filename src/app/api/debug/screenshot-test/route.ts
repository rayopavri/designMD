/**
 * TEMPORARY public diagnostic: runs ONE backfill attempt against a published
 * bundle that still lacks a screenshot, and reports where it succeeds or fails
 * (Firecrawl scrape error, no screenshot returned, or storage). Reveals why the
 * bulk backfill is mostly failing without needing the Vercel logs. No secrets.
 * Remove once screenshots are confirmed working.
 */
import { NextResponse } from 'next/server';
import { and, eq, isNull, isNotNull, notLike } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { bundles } from '@/lib/db/schema';
import { scrapeUrl } from '@/lib/ai/firecrawl';
import { captureAndStoreScreenshot } from '@/lib/storage/screenshots';

export const runtime = 'nodejs';
export const maxDuration = 180;
export const dynamic = 'force-dynamic';

export async function GET() {
  const [b] = await db
    .select({ id: bundles.id, slug: bundles.slug, sourceUrl: bundles.sourceUrl })
    .from(bundles)
    .where(
      and(
        eq(bundles.status, 'published'),
        isNull(bundles.previewImageUrl),
        isNotNull(bundles.sourceUrl),
        notLike(bundles.sourceUrl, 'upload://%'),
      ),
    )
    .limit(1);

  if (!b || !b.sourceUrl) {
    return NextResponse.json({ note: 'no published bundle without a screenshot found' });
  }

  const t0 = Date.now();
  let scrapeMs = 0;
  let hasScreenshot = false;
  let scrapeError: string | undefined;
  let stored = false;

  try {
    const s = await scrapeUrl(b.sourceUrl);
    scrapeMs = Date.now() - t0;
    hasScreenshot = !!s.screenshotUrl;
    if (s.screenshotUrl) {
      const url = await captureAndStoreScreenshot({ screenshotUrl: s.screenshotUrl, key: b.id });
      stored = !!url;
      if (url) {
        await db.update(bundles).set({ previewImageUrl: url }).where(eq(bundles.id, b.id));
      }
    }
  } catch (err) {
    scrapeMs = Date.now() - t0;
    scrapeError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json(
    { slug: b.slug, sourceUrl: b.sourceUrl, scrapeMs, hasScreenshot, stored, scrapeError },
    { headers: { 'cache-control': 'no-store' } },
  );
}
