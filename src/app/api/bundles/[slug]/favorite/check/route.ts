/**
 * GET /api/bundles/[slug]/favorite/check
 *
 * Lightweight endpoint to check if the current user has favorited this bundle.
 * Returns { saved: boolean }. Returns { saved: false } when unauthenticated
 * (no 401 — the UI handles the signed-out state separately).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { getVisibleBundleBySlug } from '@/lib/db/queries/bundles';
import { isBundleFavorited } from '@/lib/db/queries/favorites';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ saved: false });

  const { slug } = await ctx.params;
  const bundle = await getVisibleBundleBySlug(slug);
  if (!bundle) return NextResponse.json({ saved: false });

  const saved = await isBundleFavorited(user.id, bundle.id);
  return NextResponse.json({ saved });
}
