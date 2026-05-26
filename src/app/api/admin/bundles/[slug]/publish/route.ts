/**
 * POST /api/admin/bundles/[slug]/publish
 *
 * Editor-only. Promotes a pending_review bundle to published. Records
 * who reviewed it and when.
 *
 * Body: { reviewNotes?: string }
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

const BodySchema = z.object({ reviewNotes: z.string().max(2000).optional() });

export async function POST(req: NextRequest, ctx: RouteContext) {
  let editor;
  try {
    editor = await requireEditor();
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }

  const { slug } = await ctx.params;
  const body = BodySchema.parse(await req.json().catch(() => ({})));

  const [existing] = await db
    .select({
      id: bundles.id,
      status: bundles.status,
      submittedAt: bundles.submittedAt,
    })
    .from(bundles)
    .where(eq(bundles.slug, slug))
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (existing.status === 'published') {
    return NextResponse.json({ ok: true, alreadyPublished: true });
  }
  if (existing.status !== 'pending_review' && existing.status !== 'personal') {
    return NextResponse.json(
      { error: `Cannot publish from status ${existing.status}` },
      { status: 409 },
    );
  }

  const now = new Date();
  // Only overwrite reviewNotes when the editor explicitly provided one in
  // the request body — otherwise preserve the Phase 2 lint summary that
  // runAuthorDesignMd stored there. The admin Publish button POSTs an
  // empty body, so without this guard every publish click wipes the
  // linter audit trail.
  //
  // submittedAt defaults to null for personal bundles (the Phase 2
  // promotion paths only set it for autoPublish / pending_review /
  // shouldPromote). When publishing directly from personal, seed it to
  // now() so the trending sort (desc(submittedAt) with default NULLS
  // FIRST) doesn't pin null-submittedAt rows to the top of the list.
  await db
    .update(bundles)
    .set({
      status: 'published',
      publishedAt: now,
      reviewedBy: editor.id,
      reviewedAt: now,
      submittedAt: existing.submittedAt ?? now,
      ...(body.reviewNotes !== undefined ? { reviewNotes: body.reviewNotes } : {}),
      updatedAt: now,
    })
    .where(eq(bundles.id, existing.id));

  invalidateSearchIndex();
  return NextResponse.json({ ok: true, slug });
}
