/**
 * POST /api/admin/backfill-screenshots
 *
 * Editor-only. Enqueues a staggered `backfill-screenshot` job for every
 * published bundle that has a source URL but no stored screenshot yet, so the
 * detail hero shows a real screenshot instead of the live-preview fallback.
 *
 * Staggered through QStash's per-message `delay` so we don't burst Firecrawl.
 * Safe + re-runnable until `remaining === 0` (the worker skips bundles already
 * done). Returns immediately after enqueuing; the jobs run in the background.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { and, eq, isNull, isNotNull, notLike, or, sql } from 'drizzle-orm';
import { requireEditor } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { bundles } from '@/lib/db/schema';
import { enqueueTask } from '@/lib/queue';
import { probeScreenshotStorage } from '@/lib/storage/screenshots';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Enough to enqueue the whole library in one click; the QStash delay throttles
// the actual scraping, not this enqueue loop.
const MAX_BATCH = 250;
// Each backfill job scrapes (Firecrawl, ~10-40s). 15s spacing keeps only a
// few scrapes in flight at once — gentle on Firecrawl's concurrency.
const STAGGER_SECONDS = 15;
const ENQUEUE_CONCURRENCY = 6;

// A screenshot stored at the unversioned `{id}.webp` path was produced by an
// auto-capture path (new generation or a prior backfill). Admin uploads AND
// admin Re-captures both write a versioned `{id}-{timestamp}.webp` path — so
// matching the unversioned path lets a recapture refresh auto-captures while
// leaving every admin-touched image (manual uploads + past recaptures) alone.
const isAutoCaptured = sql`${bundles.previewImageUrl} LIKE '%/' || ${bundles.id}::text || '.webp'`;

// recaptureAll=false → only bundles missing a screenshot (the original behavior).
// recaptureAll=true  → missing OR auto-captured; never an admin-touched upload.
function needsCapture(recaptureAll: boolean) {
  return and(
    eq(bundles.status, 'published'),
    isNotNull(bundles.sourceUrl),
    notLike(bundles.sourceUrl, 'upload://%'),
    recaptureAll
      ? or(isNull(bundles.previewImageUrl), isAutoCaptured)
      : isNull(bundles.previewImageUrl),
  );
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      const item = items[idx];
      if (item === undefined) return;
      results[idx] = await fn(item, idx);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function POST(req: NextRequest) {
  try {
    await requireEditor();
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }

  // Optional body. recaptureAll=true re-shoots existing auto-captured screenshots
  // too (not just missing ones), sparing admin uploads/recaptures. Default false
  // keeps the original "fill the gaps" behavior for callers that send no body.
  let recaptureAll = false;
  try {
    const body = (await req.json()) as { recaptureAll?: unknown };
    recaptureAll = body?.recaptureAll === true;
  } catch {
    // No/!JSON body → fill-missing mode.
  }

  // Self-test storage first: if the app can't write to the bucket (missing env
  // vars, wrong service key, bucket issue), report that instead of enqueuing
  // 100+ jobs that would all silently no-op.
  const storage = await probeScreenshotStorage();
  if (!storage.ok) {
    return NextResponse.json({ ok: false, recaptureAll, storage, enqueued: 0, remaining: 0, etaSeconds: 0 });
  }

  const rows = await db
    .select({ id: bundles.id })
    .from(bundles)
    .where(needsCapture(recaptureAll))
    .limit(MAX_BATCH);

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, recaptureAll, storage, enqueued: 0, remaining: 0, etaSeconds: 0 });
  }

  const outcomes = await runWithConcurrency(rows, ENQUEUE_CONCURRENCY, async (row, idx) => {
    try {
      await enqueueTask(
        'backfill-screenshot',
        { bundleId: row.id, recapture: recaptureAll },
        { delaySeconds: idx * STAGGER_SECONDS },
      );
      return true;
    } catch (err) {
      console.error('[backfill-screenshots] enqueue failed:', err instanceof Error ? err.message : err);
      return false;
    }
  });

  const enqueued = outcomes.filter(Boolean).length;

  // Count rows still eligible (these jobs haven't run yet, so this includes the
  // ones we just enqueued — subtract them for the "run again" hint).
  const [countRow] = await db
    .select({ remaining: sql<number>`count(*)::int` })
    .from(bundles)
    .where(needsCapture(recaptureAll));
  const remaining = Math.max(0, (countRow?.remaining ?? 0) - enqueued);
  const etaSeconds = enqueued > 0 ? (enqueued - 1) * STAGGER_SECONDS + 180 : 0;

  return NextResponse.json({ ok: true, recaptureAll, storage, enqueued, remaining, etaSeconds });
}
