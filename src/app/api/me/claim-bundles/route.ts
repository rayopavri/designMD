/**
 * GET  /api/me/claim-bundles — preview unclaimed bundles for the current user's anon token.
 * POST /api/me/claim-bundles — claim them (set bundles.created_by = user.id).
 *
 * Both return { data: ClaimableBundle[] } on GET and { count: number } on POST.
 * Returns { data: [] } / { count: 0 } when there is no anon cookie or no matching bundles.
 */
import { NextResponse } from 'next/server';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { bundles, generationJobs } from '@/lib/db/schema';
import { requireAuth } from '@/lib/auth/session';
import { readAnonToken, clearAnonToken } from '@/lib/auth/anon-token';

export const runtime = 'nodejs';

interface ClaimableBundle {
  id: string;
  slug: string;
  title: string;
  brandLogoUrl: string | null;
}

async function getClaimableBundles(token: string): Promise<ClaimableBundle[]> {
  return db
    .select({
      id: bundles.id,
      slug: bundles.slug,
      title: bundles.title,
      brandLogoUrl: bundles.brandLogoUrl,
    })
    .from(bundles)
    .innerJoin(
      generationJobs,
      and(
        eq(generationJobs.resultBundleId, bundles.id),
        eq(generationJobs.anonToken, token),
        isNull(generationJobs.userId),
      ),
    )
    .where(isNull(bundles.createdBy))
    .limit(25);
}

export async function GET() {
  let user;
  try {
    user = await requireAuth();
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }

  const token = await readAnonToken();
  if (!token) return NextResponse.json({ data: [] });

  const data = await getClaimableBundles(token);
  void user; // user presence confirmed; not needed for the query
  return NextResponse.json({ data });
}

export async function POST() {
  let user;
  try {
    user = await requireAuth();
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }

  const token = await readAnonToken();
  if (!token) return NextResponse.json({ count: 0 });

  const claimable = await getClaimableBundles(token);
  if (claimable.length === 0) return NextResponse.json({ count: 0 });

  const ids = claimable.map((b) => b.id);

  await db.transaction(async (tx) => {
    await tx
      .update(bundles)
      .set({ createdBy: user.id, updatedAt: new Date() })
      .where(and(isNull(bundles.createdBy), inArray(bundles.id, ids)));

    // Null out token so the cookie can't be replayed for another account.
    await tx
      .update(generationJobs)
      .set({ anonToken: null })
      .where(eq(generationJobs.anonToken, token));
  });

  const res = NextResponse.json({ count: claimable.length });
  clearAnonToken(res);
  return res;
}
