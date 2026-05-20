/**
 * POST /api/admin/bundles/[slug]/regenerate-companion
 *
 * Editor-only. Re-runs the companion-prompt worker for a bundle whose
 * companion is stuck on `pending`, `failed`, or that needs a refresh.
 *
 * Resets companionStatus to 'pending' and enqueues the worker via
 * QStash (production) or inline dispatch (local dev). The worker is
 * idempotent — safe to call multiple times.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { bundles } from '@/lib/db/schema';
import { requireEditor } from '@/lib/auth/session';
import { enqueueTask } from '@/lib/queue';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function POST(_req: NextRequest, ctx: RouteContext) {
  try {
    await requireEditor();
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }

  const { slug } = await ctx.params;

  const [existing] = await db
    .select({
      id: bundles.id,
      designMd: bundles.designMd,
      companionStatus: bundles.companionStatus,
    })
    .from(bundles)
    .where(eq(bundles.slug, slug))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!existing.designMd) {
    return NextResponse.json(
      { error: 'Bundle has no design.md yet — cannot generate companion' },
      { status: 409 },
    );
  }

  await db
    .update(bundles)
    .set({
      companionStatus: 'pending',
      updatedAt: new Date(),
    })
    .where(eq(bundles.id, existing.id));

  try {
    await enqueueTask('generate-companion', { bundleId: existing.id });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Failed to enqueue companion task',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, slug, bundleId: existing.id });
}
