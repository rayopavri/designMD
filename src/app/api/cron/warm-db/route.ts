/**
 * Cron endpoint — two jobs per tick:
 *   1. SELECT 1 to keep Neon out of its 5-min idle autosuspend.
 *   2. Expire stuck SINGLE-GENERATE jobs (batchId IS NULL) that died without
 *      cleanup — either `running` past the budget (worker SIGKILL'd before its
 *      catch ran) or `queued` with a lost QStash dispatch. Terminal failures,
 *      no resume.
 *
 * Batch jobs (batchId NOT NULL) are deliberately untouched here: the
 * supervise-batches cron owns their full lifecycle — reapStale resumes stuck
 * running rows on a 7-min lease, dispatchReady fills slots from the queue.
 * Letting this 5-min sweep fail batch rows would race that resume logic and
 * destroy jobs that are merely waiting for a concurrency slot.
 *
 * Triggered by GitHub Actions (Vercel Hobby crons are once-per-day now).
 * Auth: optional Bearer via CRON_SECRET env var.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { and, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { generationJobs } from '@/lib/db/schema';

export const runtime = 'nodejs';
export const maxDuration = 15;

// Workers now have in-process timeouts (90s on Gemini, 150s on the design.md
// author, 70s on Anthropic) that throw inside the try/catch so failJob runs
// and the row flips to `failed` within seconds. The watchdog is the
// last-resort fallback for the case where the worker dies before its catch
// runs (Vercel SIGKILL on the 180s maxDuration, OOM, etc.). Cron runs every 5
// min and a single worker can now run up to 180s, so 5 min stale is the
// tightest cutoff that's safe — anything shorter risks reaping a live job.
const STUCK_JOB_AGE_MS = 5 * 60_000;

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

    // 2. Expire stuck SINGLE-GENERATE jobs (batchId IS NULL). Two cases:
    //
    //    a) 'running' past STUCK_JOB_AGE_MS — a /generate worker died
    //       mid-pipeline (Vercel SIGKILL on maxDuration, OOM, etc.) so failJob
    //       never ran.
    //    b) 'queued' past STUCK_JOB_AGE_MS — a /generate job whose QStash
    //       dispatch was lost.
    //
    // Batch rows (batchId NOT NULL) are excluded in BOTH states — see the file
    // header. supervise-batches reaps/resumes running batch rows and dispatches
    // queued ones; touching them here would race that logic.
    const cutoff = new Date(Date.now() - STUCK_JOB_AGE_MS);
    const expired = await db
      .update(generationJobs)
      .set({
        status: 'failed',
        errorStep: 'watchdog',
        errorMessage: `Worker exceeded ${Math.round(STUCK_JOB_AGE_MS / 60_000)}min budget without status update`,
        phasePayload: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          lt(generationJobs.updatedAt, cutoff),
          isNull(generationJobs.batchId),
          or(eq(generationJobs.status, 'running'), eq(generationJobs.status, 'queued')),
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
