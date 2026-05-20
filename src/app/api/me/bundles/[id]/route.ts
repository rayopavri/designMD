/**
 * GET /api/me/bundles/[id]
 *
 * Owner-only bundle fetch. Returns the bundle in any status (personal,
 * pending_review, rejected, published) as long as it belongs to the
 * authenticated user. Used by /generate to preview a just-generated draft
 * before it's been promoted to published.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { getOwnerBundleById } from '@/lib/db/queries/bundles';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  let user;
  try {
    user = await requireAuth();
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }

  const { id } = await ctx.params;
  const bundle = await getOwnerBundleById(id, user.id);
  if (!bundle) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ data: bundle });
}
