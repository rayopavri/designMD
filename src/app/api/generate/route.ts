/**
 * POST /api/generate
 *
 * Kick off a new generator job for a URL. Requires an authenticated user.
 *
 * Body: { url: string }
 * Response: 202 { jobId, status: 'queued' }
 *
 * Behaviour:
 *   - Normalises the URL.
 *   - If a published bundle already exists for that URL, returns 409
 *     with the existing slug so the UI can deep-link instead of re-running.
 *   - If the same user already has a running job for that URL, returns
 *     that job rather than spawning a duplicate.
 *   - Otherwise creates a generation_jobs row and enqueues the worker.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { bundles, generationJobs } from '@/lib/db/schema';
import { requireAuth } from '@/lib/auth/session';
import { normalizeUrl } from '@/lib/generator/url';
import { enqueueTask } from '@/lib/queue';

export const runtime = 'nodejs';

const BodySchema = z.object({
  url: z.string().url(),
});

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', details: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }

  let normalized: string;
  try {
    normalized = normalizeUrl(body.url);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid URL' },
      { status: 400 },
    );
  }

  // 1. Existing published bundle?
  const [existing] = await db
    .select({ id: bundles.id, slug: bundles.slug, status: bundles.status })
    .from(bundles)
    .where(and(eq(bundles.sourceUrlNormalized, normalized), eq(bundles.status, 'published')))
    .limit(1);
  if (existing) {
    return NextResponse.json(
      { error: 'Already exists', existingBundleSlug: existing.slug },
      { status: 409 },
    );
  }

  // 2. Existing in-flight job for this user/url?
  const [inflight] = await db
    .select()
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.userId, user.id),
        eq(generationJobs.normalizedUrl, normalized),
        inArray(generationJobs.status, ['queued', 'running']),
      ),
    )
    .limit(1);
  if (inflight) {
    return NextResponse.json(
      { jobId: inflight.id, status: inflight.status, currentStep: inflight.currentStep ?? null },
      { status: 202 },
    );
  }

  // 3. New job.
  const [job] = await db
    .insert(generationJobs)
    .values({
      url: body.url,
      normalizedUrl: normalized,
      status: 'queued',
      currentStep: 'queued',
      userId: user.id,
    })
    .returning({ id: generationJobs.id });

  if (!job) {
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500 });
  }

  await enqueueTask('scrape-and-extract', { jobId: job.id });

  return NextResponse.json(
    { jobId: job.id, status: 'queued', currentStep: 'queued' },
    { status: 202 },
  );
}
