/**
 * Vercel Cron — Neon warmer.
 *
 * Runs every 4 minutes. Issues a trivial SELECT 1 against the
 * database so Neon's 5-minute autosuspend never trips. Without this,
 * the first visitor in each idle window pays a ~500ms-2s cold-start.
 *
 * Auth: when CRON_SECRET env var is set, Vercel sends it as
 * `Authorization: Bearer <secret>` for cron invocations. We accept
 * either that or an unauthenticated request (Vercel's cron edge
 * routes through their infra; public abuse is mitigated by cheap
 * cost). For belt-and-suspenders, set CRON_SECRET in Vercel env.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';

export const runtime = 'nodejs';
export const maxDuration = 10;

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
    const [row] = (await db.execute(sql`SELECT 1 AS ping`)) as Array<{ ping: number }>;
    const elapsedMs = Date.now() - startedAt;
    return NextResponse.json({ ok: true, ping: row?.ping ?? null, elapsedMs });
  } catch (err) {
    console.error('[cron:warm-db] failed:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
