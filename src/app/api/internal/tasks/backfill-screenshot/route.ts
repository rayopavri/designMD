/**
 * Internal worker: backfill ONE existing bundle's screenshot.
 *
 * Enqueued (staggered) by POST /api/admin/backfill-screenshots for published
 * bundles that have a source URL but no stored screenshot yet. Re-scrapes the
 * source for a fresh Firecrawl screenshot, normalizes + stores it, and sets
 * bundles.preview_image_url so the detail hero shows it.
 *
 * Idempotent + failure-tolerant: skips bundles already done / without a real
 * source, and ACKs (200) on every handled miss so QStash doesn't retry a
 * non-critical job. Unlike the capture-screenshot worker it scrapes first, so
 * it carries the larger maxDuration.
 *
 * Auth: assertTaskAuth (QStash signature in prod, internal token in dev).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { and, eq, isNull } from 'drizzle-orm';
import { assertTaskAuth } from '@/lib/queue';
import { db } from '@/lib/db/client';
import { bundles } from '@/lib/db/schema';
import { scrapeUrl } from '@/lib/ai/firecrawl';
import { captureAndStoreScreenshot } from '@/lib/storage/screenshots';

export const runtime = 'nodejs';
export const maxDuration = 180;

const PayloadSchema = z.object({ bundleId: z.string().uuid() });

export async function POST(req: NextRequest) {
  let rawPayload: unknown;
  try {
    rawPayload = await assertTaskAuth(req);
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }

  let parsed: z.infer<typeof PayloadSchema>;
  try {
    parsed = PayloadSchema.parse(rawPayload);
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid payload', details: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }

  const [bundle] = await db
    .select({
      id: bundles.id,
      sourceUrl: bundles.sourceUrl,
      previewImageUrl: bundles.previewImageUrl,
    })
    .from(bundles)
    .where(eq(bundles.id, parsed.bundleId))
    .limit(1);

  // Already done, gone, or nothing to scrape — nothing to do.
  if (
    !bundle ||
    bundle.previewImageUrl ||
    !bundle.sourceUrl ||
    bundle.sourceUrl.startsWith('upload://')
  ) {
    return NextResponse.json({ ok: true, stored: false, reason: 'skip' });
  }

  let screenshotUrl: string | null = null;
  try {
    const scrape = await scrapeUrl(bundle.sourceUrl);
    screenshotUrl = scrape.screenshotUrl;
  } catch (err) {
    console.error('[backfill-screenshot] scrape failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: true, stored: false, reason: 'scrape-failed' });
  }
  if (!screenshotUrl) {
    return NextResponse.json({ ok: true, stored: false, reason: 'no-screenshot' });
  }

  const url = await captureAndStoreScreenshot({ screenshotUrl, key: bundle.id });
  if (!url) {
    return NextResponse.json({ ok: true, stored: false, reason: 'store-failed' });
  }

  try {
    // IS NULL guard so a concurrent capture (e.g. a re-run) wins cleanly and we
    // never bump updated_at on an already-set row.
    await db
      .update(bundles)
      .set({ previewImageUrl: url })
      .where(and(eq(bundles.id, bundle.id), isNull(bundles.previewImageUrl)));
  } catch (err) {
    console.error('[backfill-screenshot] update failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: true, stored: false, reason: 'update-failed' });
  }

  return NextResponse.json({ ok: true, stored: true, url });
}
