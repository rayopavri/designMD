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

function isEmailUniqueViolation(err: unknown): boolean {
  return (
    !!err &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code?: unknown }).code === '23505' &&
    'constraint_name' in err &&
    (err as { constraint_name?: unknown }).constraint_name === 'users_email_unique'
  );
}

export async function upsertUserFromFirebase(input: FirebaseUserInput): Promise<User> {
  const displayName = input.displayName ?? nameFromEmail(input.email);

  try {
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
  } catch (err) {
    // The Firebase UID is new (first sign-in with this provider) but the
    // email is already registered under a *different* UID — e.g. the user
    // signed up via magic link earlier, then hit "Continue with Google"
    // with the same address. Firebase treats these as separate identities
    // unless account linking is forced, so the `onConflictDoUpdate` above
    // (keyed on firebaseUid) can't catch it and the insert trips the
    // `email` unique constraint instead. Link the new provider to the
    // existing row rather than leaving the account permanently unable to
    // sign in with the other provider.
    if (!isEmailUniqueViolation(err)) throw err;

    const [existing] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
    if (!existing) throw err;

    const [row] = await db
      .update(users)
      .set({
        firebaseUid: input.firebaseUid,
        emailVerified: input.emailVerified || existing.emailVerified,
        lastSeenAt: sql`now()`,
      })
      .where(eq(users.id, existing.id))
      .returning();

    if (!row) throw new Error('Failed to link user');
    return row;
  }
}

export async function getUserByFirebaseUid(firebaseUid: string): Promise<User | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.firebaseUid, firebaseUid))
    .limit(1);
  return row ?? null;
}
