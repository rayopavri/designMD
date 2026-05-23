/**
 * GET /api/admin/bulk-upload/batches
 *
 * Editor-only. Returns batches the current editor started in the last 7 days
 * that still have queued or running jobs. Used by /admin/bulk-upload to
 * surface in-flight work when the editor returns to the page.
 */
import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { requireEditor } from '@/lib/auth/session';
import { db } from '@/lib/db/client';

export const runtime = 'nodejs';

type BatchRow = {
  batch_id: string;
  created_at: string;
  total: number;
  completed: number;
  failed: number;
  running: number;
  queued: number;
  first_url: string;
} & Record<string, unknown>;

export async function GET() {
  let editor;
  try {
    editor = await requireEditor();
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }

  const rows = await db.execute<BatchRow>(sql`
    SELECT
      g.batch_id,
      MIN(g.created_at) AS created_at,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE g.status = 'completed')::int AS completed,
      COUNT(*) FILTER (WHERE g.status = 'failed')::int AS failed,
      COUNT(*) FILTER (WHERE g.status = 'running')::int AS running,
      COUNT(*) FILTER (WHERE g.status = 'queued')::int AS queued,
      (
        SELECT url FROM generation_jobs g2
        WHERE g2.batch_id = g.batch_id
        ORDER BY g2.created_at ASC
        LIMIT 1
      ) AS first_url
    FROM generation_jobs g
    WHERE g.user_id = ${editor.id}
      AND g.batch_id IS NOT NULL
      AND g.created_at > NOW() - INTERVAL '7 days'
    GROUP BY g.batch_id
    HAVING COUNT(*) FILTER (WHERE g.status IN ('queued', 'running')) > 0
    ORDER BY MIN(g.created_at) DESC
    LIMIT 20
  `);

  const batches = rows.map((r) => ({
    batchId: r.batch_id,
    createdAt: r.created_at,
    total: r.total,
    completed: r.completed,
    failed: r.failed,
    running: r.running,
    queued: r.queued,
    firstUrl: r.first_url,
  }));

  return NextResponse.json({ batches });
}
