/**
 * GET  /api/me — returns the current session user, or null when logged out.
 * PATCH /api/me — updates displayName, handle, and/or preferredTools.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { getCurrentUser, requireAuth } from '@/lib/auth/session';

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user });
}

const VALID_TOOLS = ['claude', 'cursor', 'lovable', 'figma-make', 'replit', 'v0'] as const;

const PatchSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  handle: z.string().regex(/^[a-z0-9-]{3,30}$/).nullable().optional(),
  preferredTools: z.array(z.enum(VALID_TOOLS)).max(6).optional(),
});

export async function PATCH(req: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_error', details: parsed.error.flatten() }, { status: 400 });
  }

  const patch = parsed.data;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'empty_patch' }, { status: 400 });
  }

  try {
    const [updated] = await db
      .update(users)
      .set({
        ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
        ...(patch.handle !== undefined ? { handle: patch.handle } : {}),
        ...(patch.preferredTools !== undefined ? { preferredTools: patch.preferredTools } : {}),
      })
      .where(eq(users.id, user.id))
      .returning({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        handle: users.handle,
        preferredTools: users.preferredTools,
        authProvider: users.authProvider,
        createdAt: users.createdAt,
      });

    return NextResponse.json({ user: updated });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
      return NextResponse.json({ error: 'handle_taken' }, { status: 409 });
    }
    throw err;
  }
}
