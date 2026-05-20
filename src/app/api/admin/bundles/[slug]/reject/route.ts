/**
 * POST /api/admin/bundles/[slug]/reject
 *
 * Editor-only. Marks a pending_review bundle as rejected with a reason.
 *
 * Body: { reviewNotes: string }
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

const BodySchema = z.object({ reviewNotes: z.string().min(1).max(2000) });

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
    body = BodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', details: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }

  const [existing] = await db
    .select({ id: bundles.id, status: bundles.status })
    .from(bundles)
    .where(eq(bundles.slug, slug))
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (existing.status === 'rejected') {
    return NextResponse.json({ ok: true, alreadyRejected: true });
  }
  if (existing.status === 'published') {
    return NextResponse.json(
      { error: 'Cannot reject a published bundle; archive it instead' },
      { status: 409 },
    );
  }

  await db
    .update(bundles)
    .set({
      status: 'rejected',
      reviewedBy: editor.id,
      reviewedAt: new Date(),
      reviewNotes: body.reviewNotes,
      updatedAt: new Date(),
    })
    .where(eq(bundles.id, existing.id));

  return NextResponse.json({ ok: true, slug });
}
