/**
 * User queries.
 *
 * `upsertUserFromFirebase` is invoked from the session-cookie route after
 * verifying a fresh Firebase ID token. First sign-in creates the row;
 * subsequent sign-ins refresh profile fields and `lastSeenAt`.
 */
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { users, type User } from '@/lib/db/schema';

export interface FirebaseUserInput {
  firebaseUid: string;
  email: string;
  emailVerified: boolean;
  displayName: string | null;
  avatarUrl: string | null;
  authProvider: 'google' | 'email';
}

function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? 'designer';
  const cleaned = local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return cleaned.slice(0, 32) || 'Designer';
}

export async function upsertUserFromFirebase(input: FirebaseUserInput): Promise<User> {
  const displayName = input.displayName ?? nameFromEmail(input.email);

  const [row] = await db
    .insert(users)
    .values({
      firebaseUid: input.firebaseUid,
      email: input.email,
      emailVerified: input.emailVerified,
      authProvider: input.authProvider,
      displayName,
      avatarUrl: input.avatarUrl,
    })
    .onConflictDoUpdate({
      target: users.firebaseUid,
      set: {
        email: input.email,
        emailVerified: input.emailVerified,
        displayName: sql`coalesce(${users.displayName}, ${displayName})`,
        avatarUrl: sql`coalesce(${users.avatarUrl}, ${input.avatarUrl})`,
        lastSeenAt: sql`now()`,
      },
    })
    .returning();

  if (!row) throw new Error('Failed to upsert user');
  return row;
}

export async function getUserByFirebaseUid(firebaseUid: string): Promise<User | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.firebaseUid, firebaseUid))
    .limit(1);
  return row ?? null;
}
