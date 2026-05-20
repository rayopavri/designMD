/**
 * GET /api/admin/bundles/pending
 *
 * Editor-only. Lists bundles awaiting review, newest first. Used by the
 * reviewer UI (Phase 1D).
 */
import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { bundles } from '@/lib/db/schema';
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
    .select({
      id: bundles.id,
      slug: bundles.slug,
      title: bundles.title,
      description: bundles.description,
      sourceDomain: bundles.sourceDomain,
      sourceUrl: bundles.sourceUrl,
      authorName: bundles.authorName,
      designStyle: bundles.designStyle,
      paletteColors: bundles.paletteColors,
      coverageScore: bundles.coverageScore,
      submittedAt: bundles.submittedAt,
      createdAt: bundles.createdAt,
    })
    .from(bundles)
    .where(eq(bundles.status, 'pending_review'))
    .orderBy(desc(bundles.submittedAt))
    .limit(100);

  return NextResponse.json({ data: rows });
}
