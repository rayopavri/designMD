/**
 * GET    /api/bundles/[slug]/vote  — current user's vote + bundle stats
 * POST   /api/bundles/[slug]/vote  — cast or update vote (upsert)
 * DELETE /api/bundles/[slug]/vote  — remove vote
 *
 * Downvotes (worked=false) require at least one reasonTag. Valid tags:
 *   colors_off | typography_ignored | spacing_wrong | too_generic | components_missing
 */
import { NextResponse, type NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { bundles, bundleVotes } from '@/lib/db/schema';
import { requireAuth } from '@/lib/auth/session';

export const runtime = 'nodejs';

const VALID_TAGS = [
  'colors_off',
  'typography_ignored',
  'spacing_wrong',
  'too_generic',
  'components_missing',
] as const;

const VoteSchema = z.object({
  worked: z.boolean(),
  reasonTags: z.array(z.enum(VALID_TAGS)).default([]),
}).refine(
  (v) => v.worked || v.reasonTags.length > 0,
  { message: 'At least one reason tag is required for a downvote' },
);

interface RouteContext {
  params: Promise<{ slug: string }>;
}

async function getAuthAndBundle(ctx: RouteContext) {
  let user;
  try {
    user = await requireAuth();
  } catch (res) {
    if (res instanceof Response) return { error: res };
    throw res;
  }
  const { slug } = await ctx.params;
  const [bundle] = await db
    .select({ id: bundles.id, voteCount: bundles.voteCount, positiveVoteRate: bundles.positiveVoteRate })
    .from(bundles)
    .where(and(eq(bundles.slug, slug), eq(bundles.status, 'published')))
    .limit(1);
  if (!bundle) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }
  return { user, bundle };
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const result = await getAuthAndBundle(ctx);
  if ('error' in result) return result.error;
  const { user, bundle } = result;

  const [existing] = await db
    .select({ worked: bundleVotes.worked, reasonTags: bundleVotes.reasonTags })
    .from(bundleVotes)
    .where(and(eq(bundleVotes.bundleId, bundle.id), eq(bundleVotes.userId, user.id)))
    .limit(1);

  return NextResponse.json({
    vote: existing ?? null,
    voteCount: bundle.voteCount,
    positiveVoteRate: bundle.positiveVoteRate,
  });
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const result = await getAuthAndBundle(ctx);
  if ('error' in result) return result.error;
  const { user, bundle } = result;

  let body: z.infer<typeof VoteSchema>;
  try {
    body = VoteSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid body' },
      { status: 400 },
    );
  }

  await db
    .insert(bundleVotes)
    .values({
      bundleId: bundle.id,
      userId: user.id,
      worked: body.worked,
      reasonTags: body.reasonTags,
    })
    .onConflictDoUpdate({
      target: [bundleVotes.bundleId, bundleVotes.userId],
      set: { worked: body.worked, reasonTags: body.reasonTags },
    });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const result = await getAuthAndBundle(ctx);
  if ('error' in result) return result.error;
  const { user, bundle } = result;

  await db
    .delete(bundleVotes)
    .where(and(eq(bundleVotes.bundleId, bundle.id), eq(bundleVotes.userId, user.id)));

  return NextResponse.json({ ok: true });
}
