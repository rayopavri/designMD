/**
 * Session cookie endpoint.
 *
 * POST { idToken } → verifies the Firebase ID token, upserts the user row,
 *                    sets a session cookie, and returns the user.
 * DELETE → clears the session cookie.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { adminAuth } from '@/lib/auth/firebase-admin';
import { SESSION_COOKIE, SESSION_DURATION_MS } from '@/lib/auth/session';
import { upsertUserFromFirebase } from '@/lib/db/queries/users';

const BodySchema = z.object({
  idToken: z.string().min(10),
});

function deriveProvider(firebaseProvider: string | undefined): 'google' | 'email' {
  if (firebaseProvider === 'google.com') return 'google';
  // password, emailLink, custom etc. all map to "email"
  return 'email';
}

export async function POST(req: NextRequest) {
  let parsed: z.infer<typeof BodySchema>;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const auth = adminAuth();

  // 1. Verify the ID token (rejects expired/forged tokens).
  let decoded;
  try {
    decoded = await auth.verifyIdToken(parsed.idToken, true);
  } catch {
    return NextResponse.json({ error: 'Invalid ID token' }, { status: 401 });
  }

  // 2. Mint a session cookie from the verified ID token.
  let sessionCookie: string;
  try {
    sessionCookie = await auth.createSessionCookie(parsed.idToken, {
      expiresIn: SESSION_DURATION_MS,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }

  // 3. Upsert the DB row so we have a local user record.
  const firebaseUser = await auth.getUser(decoded.uid);
  const providerId = firebaseUser.providerData[0]?.providerId;
  const user = await upsertUserFromFirebase({
    firebaseUid: decoded.uid,
    email: firebaseUser.email ?? decoded.email ?? '',
    emailVerified: firebaseUser.emailVerified,
    displayName: firebaseUser.displayName ?? null,
    avatarUrl: firebaseUser.photoURL ?? null,
    authProvider: deriveProvider(providerId),
  });

  // 4. Set the session cookie.
  const res = NextResponse.json({ user });
  res.cookies.set({
    name: SESSION_COOKIE,
    value: sessionCookie,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(SESSION_DURATION_MS / 1000),
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
