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
    .select({ id: bundles.id, status: bundles.status })
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

  await db
    .update(bundles)
    .set({
      status: 'published',
      publishedAt: new Date(),
      reviewedBy: editor.id,
      reviewedAt: new Date(),
      reviewNotes: body.reviewNotes ?? null,
      updatedAt: new Date(),
    })
    .where(eq(bundles.id, existing.id));

  return NextResponse.json({ ok: true, slug });
}
