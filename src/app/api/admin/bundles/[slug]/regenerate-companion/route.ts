/**
 * POST /api/admin/bundles/[slug]/regenerate-companion
 *
 * Editor-only. Regenerates the companion prompt for an EXISTING bundle from its
 * finished design.md — the only surviving source of truth, since the original
 * Phase-1 brand extraction is gone once the generation job completes (its
 * phase_payload is nulled on terminal state). The design.md carries every token
 * by name, so it's a complete substitute for the brand JSON.
 *
 * Runs the single Sonnet call INLINE and writes the result before responding —
 * no queue/worker indirection, because a standalone regenerate has no
 * generation_job to hand a thin { jobId } to. The admin UI reloads the bundle
 * on success, so a synchronous write means it shows the finished companion
 * immediately rather than a transient 'pending'.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { bundles } from '@/lib/db/schema';
import { requireEditor } from '@/lib/auth/session';
import { generateCompanionPromptFromSpec } from '@/lib/ai/generate-companion-prompt';

export const runtime = 'nodejs';
// One Sonnet call (45s in-SDK timeout); 60s function budget gives it headroom.
export const maxDuration = 60;

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function POST(_req: NextRequest, ctx: RouteContext) {
  try {
    await requireEditor();
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }

  const { slug } = await ctx.params;

  const [existing] = await db
    .select({
      id: bundles.id,
      title: bundles.title,
      designMd: bundles.designMd,
      designStyle: bundles.designStyle,
      companionPromptVersion: bundles.companionPromptVersion,
    })
    .from(bundles)
    .where(eq(bundles.slug, slug))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!existing.designMd) {
    return NextResponse.json(
      { error: 'Bundle has no design.md yet — cannot generate companion' },
      { status: 409 },
    );
  }

  try {
    const companion = await generateCompanionPromptFromSpec({
      brandName: existing.title,
      designMd: existing.designMd,
      designStyles: existing.designStyle,
    });
    await db
      .update(bundles)
      .set({
        companionPrompt: companion,
        companionPromptVersion: existing.companionPromptVersion + 1,
        companionPromptUpdatedAt: new Date(),
        companionStatus: 'ready',
        updatedAt: new Date(),
      })
      .where(eq(bundles.id, existing.id));
  } catch (err) {
    await db
      .update(bundles)
      .set({ companionStatus: 'failed', updatedAt: new Date() })
      .where(eq(bundles.id, existing.id));
    return NextResponse.json(
      {
        error: 'Companion generation failed',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, slug, bundleId: existing.id });
}
