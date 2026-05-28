/**
 * GET /api/admin/bundles/active-jobs
 *
 * Editor-only. Returns the slugs of every bundle that currently has a
 * queued or running generation_jobs row (i.e. a pipeline actively in
 * flight). Used by the admin list view to show a per-row "active" dot
 * without adding join overhead to the main list query.
 *
 * Response: { slugs: string[] }
 */
import { NextResponse } from 'next/server';
import { inArray, eq, isNotNull } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { bundles, generationJobs } from '@/lib/db/schema';
import { requireEditor } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function GET() {
  try {
    await requireEditor();
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }

  const rows = await db
    .selectDistinct({ slug: bundles.slug })
    .from(generationJobs)
    .innerJoin(bundles, eq(generationJobs.targetBundleId, bundles.id))
    .where(
      inArray(generationJobs.status, ['queued', 'running']),
    );

  // Also include any non-rerun (new) jobs that are in flight (no targetBundleId)
  // by joining on resultBundleId when it's already been set.
  const newJobRows = await db
    .selectDistinct({ slug: bundles.slug })
    .from(generationJobs)
    .innerJoin(bundles, eq(generationJobs.resultBundleId, bundles.id))
    .where(
      inArray(generationJobs.status, ['queued', 'running']),
    );

  const slugSet = new Set([
    ...rows.map((r) => r.slug),
    ...newJobRows.map((r) => r.slug),
  ]);

  return NextResponse.json({ slugs: Array.from(slugSet) });
}
