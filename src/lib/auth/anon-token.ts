/**
 * Anonymous-session cookie helpers.
 *
 * On first anonymous generation we assign a random __anon_id cookie so the
 * bundles created in that session can be claimed once the user signs in.
 * The cookie is httpOnly and single-use (nulled out on claim).
 */
import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';

export const ANON_COOKIE = '__anon_id';
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

/** Returns the current anon token from the incoming cookie, or null. */
export async function readAnonToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(ANON_COOKIE)?.value ?? null;
}

/**
 * Returns the existing token, or creates a new one.
 * When `userId` is set the user is signed in — return null (no tracking needed).
 * Call `attachAnonToken(res, token)` to write the cookie when the token is new.
 */
export async function getOrCreateAnonToken(
  userId: string | null,
): Promise<{ token: string | null; isNew: boolean }> {
  if (userId) return { token: null, isNew: false };
  const existing = await readAnonToken();
  if (existing) return { token: existing, isNew: false };
  return { token: randomUUID(), isNew: true };
}

/** Attaches the anon cookie to an outgoing NextResponse. */
export function attachAnonToken(res: NextResponse, token: string): void {
  res.cookies.set(ANON_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE_SECONDS,
    path: '/',
  });
}

/** Clears the anon cookie (call after a successful claim). */
export function clearAnonToken(res: NextResponse): void {
  res.cookies.set(ANON_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  });
}
