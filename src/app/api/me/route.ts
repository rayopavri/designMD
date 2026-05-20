/**
 * GET /api/me — returns the current session user, or null when logged out.
 * The client uses this on mount to hydrate auth state.
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user });
}
