/**
 * Internal worker: backfill ONE existing bundle's screenshot.
 *
 * Enqueued (staggered) by POST /api/admin/backfill-screenshots for published
 * bundles that have a source URL but no stored screenshot yet. Uses the
 * screenshot-only Firecrawl scrape (lighter/faster than the full scrape, and
 * avoids the branding extractor stalling on JS-heavy sites), stores the image,
 * and sets bundles.preview_image_url so the detail hero shows it.
 *
 * Firecrawl rate limits aggressively, so a throttled job RE-ENQUEUES itself
 * with a jittered backoff (up to MAX_ATTEMPTS) instead of giving up — the
 * batch then drains steadily under the limit. Idempotent + failure-tolerant:
 * skips bundles already done / without a real source, and ACKs (200) on every
 * handled miss so QStash doesn't retry on top of our own re-enqueue.
 *
 * Auth: assertTaskAuth (QStash signature in prod, internal token in dev).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { and, eq, isNull } from 'drizzle-orm';
import { assertTaskAuth, enqueueTask } from '@/lib/queue';
import { db } from '@/lib/db/client';
import { bundles } from '@/lib/db/schema';
import { scrapeScreenshot } from '@/lib/ai/firecrawl';
import { captureAndStoreScreenshot } from '@/lib/storage/screenshots';

export const runtime = 'nodejs';
export const maxDuration = 180;

// Re-enqueue a rate-limited job up to this many times before giving up.
const MAX_ATTEMPTS = 10;

const PayloadSchema = z.object({
  bundleId: z.string().uuid(),
  attempt: z.number().int().min(1).optional(),
});

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
  const attempt = parsed.attempt ?? 1;

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

  let screenshotUrl: string;
  try {
    screenshotUrl = await scrapeScreenshot(bundle.sourceUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const rateLimited = /rate limit/i.test(msg) || msg.includes('429');
    if (rateLimited && attempt < MAX_ATTEMPTS) {
      // Jittered backoff (60-180s) so the whole batch doesn't all retry in the
      // same minute and immediately re-trip the limit.
      const delaySeconds = 60 + Math.floor(Math.random() * 120);
      try {
        await enqueueTask(
          'backfill-screenshot',
          { bundleId: bundle.id, attempt: attempt + 1 },
          { delaySeconds },
        );
      } catch (e) {
        console.error('[backfill-screenshot] requeue failed:', e instanceof Error ? e.message : e);
      }
      return NextResponse.json({ ok: true, stored: false, reason: 'rate-limited-requeued', attempt });
    }
    console.error(`[backfill-screenshot] scrape failed (attempt ${attempt}):`, msg);
    return NextResponse.json({ ok: true, stored: false, reason: 'scrape-failed' });
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
