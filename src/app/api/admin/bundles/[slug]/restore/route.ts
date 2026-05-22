/**
 * POST /api/admin/bundles/[slug]/restore
 *
 * Editor-only. Restores an archived/rejected/personal bundle by moving
 * it back to a chosen target status. Defaults to 'published'.
 *
 * Body: {
 *   targetStatus?: 'published' | 'pending_review',
 *   reviewNotes?: string,
 * }
 *
 * Note: promoting from 'personal' is also done by the existing /publish
 * endpoint. This route exists so the admin UI can use one verb (restore)
 * for "bring this back to life" across multiple starting statuses.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { bundles } from '@/lib/db/schema';
import { requireEditor } from '@/lib/auth/session';
import { invalidateSearchIndex } from '@/lib/search';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const BodySchema = z.object({
  targetStatus: z.enum(['published', 'pending_review']).optional(),
  reviewNotes: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest, ctx: RouteContext) {
  let editor;
  try {
    editor = await requireEditor();
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }

  const { slug } = await ctx.params;
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json().catch(() => ({})));
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', details: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
  const target = body.targetStatus ?? 'published';

  const [existing] = await db
    .select({ id: bundles.id, status: bundles.status, publishedAt: bundles.publishedAt })
    .from(bundles)
    .where(eq(bundles.slug, slug))
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Disallow no-op transitions to keep the audit log clean.
  if (existing.status === target) {
    return NextResponse.json(
      { error: `Bundle is already ${target}` },
      { status: 409 },
    );
  }

  const now = new Date();
  await db
    .update(bundles)
    .set({
      status: target,
      // First-time publish sets publishedAt; subsequent restores leave it.
      publishedAt: target === 'published' && !existing.publishedAt ? now : existing.publishedAt,
      reviewedBy: editor.id,
      reviewedAt: now,
      reviewNotes: body.reviewNotes ?? null,
      updatedAt: now,
    })
    .where(eq(bundles.id, existing.id));

  invalidateSearchIndex();
  return NextResponse.json({ ok: true, slug, status: target });
}
