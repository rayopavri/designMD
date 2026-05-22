/**
 * GET /api/me/favorites
 *
 * Returns every bundle the authenticated user has saved as a favorite,
 * ordered by most-recently-saved first. Used by /account/favorites.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { listUserFavorites } from '@/lib/db/queries/favorites';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }

  const items = await listUserFavorites(user.id);
  return NextResponse.json({ data: items });
}
