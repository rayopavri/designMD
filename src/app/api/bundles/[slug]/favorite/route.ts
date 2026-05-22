/**
 * POST   /api/bundles/[slug]/favorite  — add to favorites (idempotent)
 * DELETE /api/bundles/[slug]/favorite  — remove from favorites (idempotent)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { getVisibleBundleBySlug } from '@/lib/db/queries/bundles';
import { addFavorite, removeFavorite } from '@/lib/db/queries/favorites';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

async function getAuthAndBundle(ctx: RouteContext) {
  let user;
  try {
    user = await requireAuth();
  } catch (res) {
    if (res instanceof Response) return { error: res };
    throw res;
  }
  const { slug } = await ctx.params;
  const bundle = await getVisibleBundleBySlug(slug);
  if (!bundle) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }
  return { user, bundle };
}

export async function POST(_req: NextRequest, ctx: RouteContext) {
  const result = await getAuthAndBundle(ctx);
  if ('error' in result) return result.error;
  await addFavorite(result.user.id, result.bundle.id);
  return NextResponse.json({ saved: true });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const result = await getAuthAndBundle(ctx);
  if ('error' in result) return result.error;
  await removeFavorite(result.user.id, result.bundle.id);
  return NextResponse.json({ saved: false });
}
