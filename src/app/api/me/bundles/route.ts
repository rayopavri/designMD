/**
 * GET /api/me/bundles
 *
 * Returns every bundle owned by the authenticated user, regardless of
 * status (personal, pending_review, published, flagged, rejected, archived).
 * Used by /account/bundles to render the user's history.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { listUserBundles } from '@/lib/db/queries/bundles';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }

  const items = await listUserBundles(user.id);
  return NextResponse.json({ data: items });
}
