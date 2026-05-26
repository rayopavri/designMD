/**
 * Server-side session helpers.
 *
 * Reads the `__session` httpOnly cookie, verifies it via the Firebase Admin
 * SDK, and resolves the matching DB user. Application-layer auth enforcement.
 */
import 'server-only';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { users, type User } from '@/lib/db/schema';
import { adminAuth } from './firebase-admin';

export const SESSION_COOKIE = '__session';
// 5 days — within Firebase's 1–14 day allowed range.
export const SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000;

export type SessionUser = User;

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const sessionCookie = store.get(SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await adminAuth().verifySessionCookie(sessionCookie, true);
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.firebaseUid, decoded.uid))
      .limit(1);
    return row ?? null;
  } catch {
    // Invalid / expired cookie — treat as logged out.
    return null;
  }
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Response('Unauthorized', { status: 401 });
  }
  return user;
}

export async function requireEditor(): Promise<SessionUser> {
  const user = await requireAuth();
  if (!user.isEditor) {
    throw new Response('Forbidden', { status: 403 });
  }
  return user;
}
