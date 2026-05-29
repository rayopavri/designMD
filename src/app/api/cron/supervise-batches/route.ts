/**
 * Bulk-upload supervisor cron.
 *
 * Triggered every 5 minutes by the supervise-batches GitHub Actions workflow
 * (the Hobby plan caps Vercel crons at once/day; the vercel.json entry is a
 * once-daily backstop and becomes an every-minute tick on Pro). It reconciles
 * batch state from the DB, which is the single source of truth:
 *   1. reapStale()     — resume or fail jobs that stopped making progress.
 *   2. dispatchReady() — start queued jobs up to the global concurrency cap.
 *
 * This is the backstop that makes the pipeline self-healing: any job orphaned
 * by a dropped queue message or a killed function is picked back up here,
 * without depending on workers chaining to one another. The happy path still
 * dispatches inline (each worker refills a slot on completion), so a 5-min
 * cadence is enough — it only has to catch what slipped through.
 *
 * Auth: requires `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set
 * (the production path — GitHub Actions sends it). In local dev (no CRON_SECRET)
 * we fall back to the internal task token so the tick can be triggered by hand.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { dispatchReady, reapStale } from '@/lib/generator/batch';

// Enqueues + DB writes only — no pipeline work runs here, so it stays well
// under the timeout. Node runtime for Postgres access.
export const runtime = 'nodejs';
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const header = req.headers.get('authorization');

  if (env.CRON_SECRET) {
    return header === `Bearer ${env.CRON_SECRET}`;
  }

  // Dev fallback: no CRON_SECRET configured — accept the internal task token
  // so the supervisor can be invoked manually without Vercel Cron.
  if (env.INTERNAL_TASK_TOKEN) {
    return req.headers.get('x-internal-task-token') === env.INTERNAL_TASK_TOKEN;
  }

  return false;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Reap first so freed slots are available to the dispatcher in the same tick.
    const reaped = await reapStale();
    const dispatched = await dispatchReady();
    return NextResponse.json({ ok: true, reaped, dispatched });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[cron:supervise-batches] failed:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
