/**
 * POST /api/admin/bundles/bulk-rerun
 *
 * Editor-only. Triggers the generation pipeline for up to 50 bundles per call,
 * staggered through QStash's per-message `delay` so we don't burst upstream
 * APIs (Firecrawl, Gemini, Anthropic) or hit Vercel concurrent-function limits.
 *
 * Body (JSON):
 *   {
 *     slugs?: string[];                                     // explicit list, OR
 *     all?: boolean;                                        // every bundle with a source URL
 *     status?: ('published'|'pending_review'|'flagged'|'rejected')[];
 *   }
 *
 * Behavior mirrors the single-bundle endpoint at
 * /api/admin/bundles/[slug]/rerun-pipeline — same skip rules
 * (no source URL / upload-only / already in flight) so this is safe
 * to call repeatedly until `remaining === 0`.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { and, eq, inArray, isNotNull, sql, notLike } from 'drizzle-orm';
import { requireEditor } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { bundles, generationJobs } from '@/lib/db/schema';
import { enqueueTask } from '@/lib/queue';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_BATCH = 50;
const STAGGER_SECONDS = 15;
const ENQUEUE_CONCURRENCY = 8;

const ALLOWED_STATUSES = ['published', 'pending_review', 'flagged', 'rejected'] as const;

const BodySchema = z
  .object({
    slugs: z.array(z.string().min(1).max(120)).max(MAX_BATCH).optional(),
    all: z.boolean().optional(),
    status: z.array(z.enum(ALLOWED_STATUSES)).optional(),
  })
  .refine((v) => Boolean(v.slugs?.length) || v.all === true, {
    message: 'Provide either `slugs` (non-empty) or `all: true`.',
  });

type SkipReason = 'noSourceUrl' | 'uploadSource' | 'alreadyInFlight' | 'notFound';
type Outcome =
  | { slug: string; status: 'enqueued'; jobId: string; bundleId: string; delaySeconds: number }
  | { slug: string; status: 'skipped'; reason: SkipReason };

interface Candidate {
  id: string;
  slug: string;
  sourceUrl: string | null;
  sourceUrlNormalized: string | null;
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      const item = items[idx];
      if (item === undefined) return;
      results[idx] = await fn(item, idx);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function POST(req: NextRequest) {
  let editor;
  try {
    editor = await requireEditor();
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { slugs, all, status } = parsed.data;

  // Resolve candidate bundles. Always restrict to rows with a real source URL
  // (non-null, not an upload://). We still re-check per-bundle in the loop to
  // produce a precise `skipped` breakdown.
  const baseWhere = and(
    isNotNull(bundles.sourceUrl),
    notLike(bundles.sourceUrl, 'upload://%'),
    status?.length ? inArray(bundles.status, status) : undefined,
    slugs?.length ? inArray(bundles.slug, slugs) : undefined,
  );

  const rows = await db
    .select({
      id: bundles.id,
      slug: bundles.slug,
      sourceUrl: bundles.sourceUrl,
      sourceUrlNormalized: bundles.sourceUrlNormalized,
    })
    .from(bundles)
    .where(baseWhere)
    .limit(MAX_BATCH);

  // When the caller passed explicit slugs, surface which weren't found.
  const found = new Set(rows.map((r) => r.slug));
  const notFound: string[] = slugs?.length
    ? slugs.filter((s) => !found.has(s))
    : [];

  if (rows.length === 0 && notFound.length === 0) {
    return NextResponse.json({
      ok: true,
      enqueued: 0,
      skipped: { noSourceUrl: 0, uploadSource: 0, alreadyInFlight: 0, notFound: 0 },
      jobIds: [],
      remaining: 0,
      etaSeconds: 0,
    });
  }

  // Find which of the candidates already have an in-flight job. Single query.
  const candidateIds = rows.map((r) => r.id);
  const inFlight = candidateIds.length
    ? await db
        .select({ targetBundleId: generationJobs.targetBundleId })
        .from(generationJobs)
        .where(
          and(
            inArray(generationJobs.targetBundleId, candidateIds),
            inArray(generationJobs.status, ['queued', 'running']),
          ),
        )
    : [];
  const inFlightSet = new Set(inFlight.map((r) => r.targetBundleId).filter(Boolean) as string[]);

  // Filter into the actual enqueue list, preserving stable order so the
  // staggered delays line up with response order.
  const toEnqueue: Candidate[] = [];
  const outcomes: Outcome[] = [];
  for (const r of rows) {
    if (inFlightSet.has(r.id)) {
      outcomes.push({ slug: r.slug, status: 'skipped', reason: 'alreadyInFlight' });
      continue;
    }
    toEnqueue.push(r);
  }
  for (const s of notFound) {
    outcomes.push({ slug: s, status: 'skipped', reason: 'notFound' });
  }

  // Enqueue with concurrency=4 (each enqueue is a network call to QStash;
  // sequential would still fit in 60s but parallel keeps the endpoint snappy).
  const enqueued = await runWithConcurrency(toEnqueue, ENQUEUE_CONCURRENCY, async (bundle, idx) => {
    const delaySeconds = idx * STAGGER_SECONDS;
    const [job] = await db
      .insert(generationJobs)
      .values({
        url: bundle.sourceUrl!,
        normalizedUrl: bundle.sourceUrlNormalized,
        sourceType: 'url',
        status: 'queued',
        userId: editor.id,
        targetBundleId: bundle.id,
        autoPublish: false,
      })
      .returning({ id: generationJobs.id });

    if (!job) {
      return { slug: bundle.slug, status: 'skipped' as const, reason: 'notFound' as SkipReason };
    }

    try {
      await enqueueTask('scrape-and-extract', { jobId: job.id }, { delaySeconds });
    } catch (err) {
      // Mark the job failed immediately so the watchdog doesn't have to.
      await db
        .update(generationJobs)
        .set({
          status: 'failed',
          errorStep: 'enqueue',
          errorMessage:
            (err instanceof Error ? err.message : String(err)).slice(0, 1000) ||
            'QStash enqueue failed',
          updatedAt: new Date(),
        })
        .where(eq(generationJobs.id, job.id));
      return { slug: bundle.slug, status: 'skipped' as const, reason: 'notFound' as SkipReason };
    }

    return {
      slug: bundle.slug,
      status: 'enqueued' as const,
      jobId: job.id,
      bundleId: bundle.id,
      delaySeconds,
    };
  });

  for (const o of enqueued) outcomes.push(o);

  const enqueuedCount = outcomes.filter((o) => o.status === 'enqueued').length;
  const jobIds = outcomes
    .filter((o): o is Extract<Outcome, { status: 'enqueued' }> => o.status === 'enqueued')
    .map((o) => o.jobId);

  const skipped = {
    noSourceUrl: 0, // pre-filtered by SQL; will always be 0 here but kept for API stability
    uploadSource: 0,
    alreadyInFlight: outcomes.filter(
      (o) => o.status === 'skipped' && o.reason === 'alreadyInFlight',
    ).length,
    notFound: outcomes.filter((o) => o.status === 'skipped' && o.reason === 'notFound').length,
  };

  // Estimate how many bundles still need a re-run after this call (only meaningful
  // when caller used `all: true`). Counts bundles with a real source URL that
  // do NOT already have a queued/running job.
  let remaining = 0;
  if (all && !slugs?.length) {
    const statusFilterSql = status?.length
      ? sql`AND b.status = ANY(${status})`
      : sql``;
    const [row] = await db.execute<{ remaining: number }>(sql`
      SELECT COUNT(*)::int AS remaining
      FROM bundles b
      WHERE b.source_url IS NOT NULL
        AND b.source_url NOT LIKE 'upload://%'
        ${statusFilterSql}
        AND NOT EXISTS (
          SELECT 1 FROM generation_jobs g
          WHERE g.target_bundle_id = b.id
            AND g.status IN ('queued','running')
        )
    `);
    // After this endpoint commits, the bundles we just enqueued now have
    // queued jobs, so they're excluded by the NOT EXISTS — no extra subtraction.
    remaining = row?.remaining ?? 0;
  }

  const etaSeconds = enqueuedCount > 0 ? (enqueuedCount - 1) * STAGGER_SECONDS + 60 : 0;

  return NextResponse.json({
    ok: true,
    enqueued: enqueuedCount,
    skipped,
    jobIds,
    remaining,
    etaSeconds,
    outcomes,
  });
}
