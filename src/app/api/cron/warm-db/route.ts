/**
 * Cron endpoint — does two cheap jobs on each tick:
 *   1. SELECT 1 to keep Neon out of its 5-min idle autosuspend.
 *   2. Mark generation jobs that have been `running` for > 5 minutes as
 *      `failed`. The Vercel Hobby plan caps function runtime at 60s, so
 *      any job stuck in `running` for far longer means the worker was
 *      killed mid-pipeline and there's nobody left to update the row.
 *      Without this sweep the /generate UI polls forever.
 *
 * Triggered by GitHub Actions (Vercel Hobby crons are once-per-day now).
 * Auth: optional Bearer via CRON_SECRET env var.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { and, eq, lt, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { generationJobs } from '@/lib/db/schema';

export const runtime = 'nodejs';
export const maxDuration = 15;

// Workers now have in-process timeouts (90s on Gemini, similar on Anthropic)
// that throw inside the try/catch so failJob runs and the row flips to
// `failed` within seconds. The watchdog is the last-resort fallback for
// the case where the worker dies before its catch runs (Vercel SIGKILL on
// maxDuration, OOM, etc.). Cron runs every 5 min so 2 min stale is the
// tightest cutoff that's safe — anything shorter races the cron interval.
const STUCK_JOB_AGE_MS = 2 * 60_000;

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const startedAt = Date.now();
  try {
    // 1. Warm Neon.
    const [row] = (await db.execute(sql`SELECT 1 AS ping`)) as Array<{ ping: number }>;

    // 2. Expire stuck jobs. Anything still 'queued' or 'running' past
    //    STUCK_JOB_AGE_MS lost its worker (Vercel killed the function
    //    or QStash never reached it). Mark them failed so the UI stops
    //    polling forever.
    const cutoff = new Date(Date.now() - STUCK_JOB_AGE_MS);
    const expired = await db
      .update(generationJobs)
      .set({
        status: 'failed',
        errorStep: 'watchdog',
        errorMessage: `Worker exceeded ${Math.round(STUCK_JOB_AGE_MS / 60_000)}min budget without status update`,
        updatedAt: new Date(),
      })
      .where(
        and(
          sql`${generationJobs.status} IN ('queued', 'running')`,
          lt(generationJobs.updatedAt, cutoff),
        ),
      )
      .returning({ id: generationJobs.id });

    const elapsedMs = Date.now() - startedAt;
    return NextResponse.json({
      ok: true,
      ping: row?.ping ?? null,
      expiredJobs: expired.length,
      elapsedMs,
    });
  } catch (err) {
    console.error('[cron:warm-db] failed:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
