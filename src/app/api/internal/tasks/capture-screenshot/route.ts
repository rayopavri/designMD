/**
 * Internal worker endpoint for the deferred screenshot-capture step.
 *
 * Enqueued by scrape-and-extract (Phase 1) for URL jobs that produced a
 * Firecrawl screenshot. Off the generation_jobs critical path: there is no
 * failJob / dispatchReady here. A captured screenshot is a nice-to-have for
 * the detail hero, never a generation blocker — so we ACK (200) on every
 * handled outcome (including "couldn't store") and only 500 on unexpected
 * errors, to avoid burning QStash's retry on expected misses.
 *
 * Auth: assertTaskAuth handles both QStash signature (production) and
 * x-internal-task-token (local dev).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { assertTaskAuth } from '@/lib/queue';
import { db } from '@/lib/db/client';
import { bundles } from '@/lib/db/schema';
import { captureAndStoreScreenshot } from '@/lib/storage/screenshots';

export const runtime = 'nodejs';
// Lightweight: one image fetch + sharp transform + upload + one UPDATE.
// Well under the Pro budget; the fetch/upload AbortSignals bound it.
export const maxDuration = 60;

const PayloadSchema = z.object({
  bundleId: z.string().uuid(),
  screenshotUrl: z.string().url(),
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

  const url = await captureAndStoreScreenshot({
    screenshotUrl: parsed.screenshotUrl,
    key: parsed.bundleId,
  });
  if (!url) {
    // Expected miss (storage env unset, dead URL, upload error) — already
    // logged inside the helper. ACK so QStash doesn't retry.
    return NextResponse.json({ ok: true, stored: false });
  }

  try {
    await db
      .update(bundles)
      .set({ previewImageUrl: url })
      .where(eq(bundles.id, parsed.bundleId));
  } catch (err) {
    // The column may not exist yet (migration not applied). Don't 500 — that
    // would trigger a QStash retry storm for a non-critical step. ACK and log.
    console.error(
      '[capture-screenshot] preview_image_url update failed:',
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ ok: true, stored: false });
  }

  return NextResponse.json({ ok: true, stored: true });
}
