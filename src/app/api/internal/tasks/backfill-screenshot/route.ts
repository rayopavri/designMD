/**
 * Internal worker: backfill ONE existing bundle's screenshot.
 *
 * Enqueued (staggered) by POST /api/admin/backfill-screenshots for published
 * bundles that have a source URL but no stored screenshot yet — or, with
 * `recapture: true`, an auto-captured one to refresh (admin uploads/recaptures
 * are spared). Uses the
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
import { and, eq, isNull, or } from 'drizzle-orm';
import { assertTaskAuth, enqueueTask } from '@/lib/queue';
import { db } from '@/lib/db/client';
import { bundles } from '@/lib/db/schema';
import { isAutoCapturedScreenshot } from '@/lib/db/queries/bundles';
import { scrapeScreenshot } from '@/lib/ai/firecrawl';
import { captureAndStoreScreenshot } from '@/lib/storage/screenshots';

export const runtime = 'nodejs';
export const maxDuration = 180;

// Re-enqueue a rate-limited job up to this many times before giving up.
const MAX_ATTEMPTS = 10;

const PayloadSchema = z.object({
  bundleId: z.string().uuid(),
  attempt: z.number().int().min(1).optional(),
  // true = recapture mode: refresh an existing auto-captured screenshot too
  // (not just missing ones), while never touching an admin upload/recapture.
  recapture: z.boolean().optional(),
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

  const recapture = parsed.recapture === true;

  // Gone or nothing scrapeable — always skip.
  if (!bundle || !bundle.sourceUrl || bundle.sourceUrl.startsWith('upload://')) {
    return NextResponse.json({ ok: true, stored: false, reason: 'skip' });
  }

  // A screenshot stored at the unversioned `{id}.webp` path is auto-captured; a
  // versioned `{id}-{ts}.webp` path means an admin uploaded or recaptured it.
  const existing = bundle.previewImageUrl;
  const isAutoCaptured = !!existing && existing.endsWith(`/${bundle.id}.webp`);
  if (existing && (!recapture || !isAutoCaptured)) {
    // fill-missing mode never touches an existing screenshot; recapture mode
    // refreshes auto-captured ones but spares every admin-touched image.
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
          { bundleId: bundle.id, attempt: attempt + 1, recapture },
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

  // Recapture writes a versioned key so the new image lands at a fresh URL —
  // overwriting the cached-immutable `{id}.webp` wouldn't bust browser/CDN
  // caches. Fill-missing keeps the stable `{id}.webp` (nothing to invalidate).
  const key = recapture ? `${bundle.id}-${Date.now()}` : bundle.id;
  const url = await captureAndStoreScreenshot({ screenshotUrl, key });
  if (!url) {
    return NextResponse.json({ ok: true, stored: false, reason: 'store-failed' });
  }

  try {
    // Guard against a race with a concurrent write. Fill-missing only sets a
    // still-empty row (a re-run/generation wins cleanly). Recapture overwrites,
    // but still bails if an admin upload/recapture (versioned) landed meanwhile.
    const guard = recapture
      ? or(isNull(bundles.previewImageUrl), isAutoCapturedScreenshot)
      : isNull(bundles.previewImageUrl);
    await db
      .update(bundles)
      .set({ previewImageUrl: url })
      .where(and(eq(bundles.id, bundle.id), guard));
  } catch (err) {
    console.error('[backfill-screenshot] update failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: true, stored: false, reason: 'update-failed' });
  }

  return NextResponse.json({ ok: true, stored: true, url });
}
