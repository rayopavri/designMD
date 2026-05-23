/**
 * POST /api/admin/bulk-upload
 *
 * Editor-only. Accepts a list of URLs, creates a generation job for each,
 * and enqueues them staggered through QStash. Jobs are created with
 * autoPublish=true so the pipeline skips the quality gate and publishes
 * directly (no pending_review step).
 *
 * Skips:
 *  - URLs that are invalid / not parseable
 *  - Duplicates within the submitted list (first occurrence wins)
 *  - URLs that already have a bundle in any status
 *  - URLs that already have a queued/running job
 *
 * Body:  { urls: string[] }  (max 150)
 * Response (202):
 *  { enqueued, skipped: { duplicate, alreadyExists, alreadyInFlight, invalid }, outcomes, etaSeconds }
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { requireEditor } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { bundles, generationJobs } from '@/lib/db/schema';
import { enqueueTask } from '@/lib/queue';
import { normalizeUrl } from '@/lib/generator/url';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_BATCH = 150;
const STAGGER_SECONDS = 30;
const ENQUEUE_CONCURRENCY = 4;

const BodySchema = z.object({
  urls: z.array(z.string().min(1).max(2048)).min(1).max(MAX_BATCH),
});

type SkipReason = 'invalid' | 'duplicate' | 'alreadyExists' | 'alreadyInFlight';
type Outcome =
  | { url: string; status: 'enqueued'; jobId: string; delaySeconds: number }
  | { url: string; status: 'skipped'; reason: SkipReason };

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

  const rawUrls = parsed.data.urls;
  const outcomes: Outcome[] = [];

  // ── 1. Parse, validate, deduplicate ──────────────────────────────────────
  type Candidate = { raw: string; normalized: string };
  const seen = new Set<string>();
  const candidates: Candidate[] = [];

  for (const raw of rawUrls) {
    let normalized: string;
    try {
      normalized = normalizeUrl(raw);
      // Sanity-check that it's a real http/https URL after normalization.
      const u = new URL(normalized);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('not http(s)');
    } catch {
      outcomes.push({ url: raw, status: 'skipped', reason: 'invalid' });
      continue;
    }

    if (seen.has(normalized)) {
      outcomes.push({ url: raw, status: 'skipped', reason: 'duplicate' });
      continue;
    }
    seen.add(normalized);
    candidates.push({ raw, normalized });
  }

  if (candidates.length === 0) {
    const skipped = buildSkipCounts(outcomes);
    return NextResponse.json({ enqueued: 0, skipped, outcomes, etaSeconds: 0 }, { status: 202 });
  }

  // ── 2. Check for existing bundles (any status) ────────────────────────────
  const normalizedList = candidates.map((c) => c.normalized);
  const existingBundles = await db
    .select({ sourceUrlNormalized: bundles.sourceUrlNormalized })
    .from(bundles)
    .where(inArray(bundles.sourceUrlNormalized, normalizedList));
  const existingNormalized = new Set(
    existingBundles.map((b) => b.sourceUrlNormalized).filter(Boolean) as string[],
  );

  // ── 3. Check for in-flight jobs ───────────────────────────────────────────
  const inFlightJobs = await db
    .select({ normalizedUrl: generationJobs.normalizedUrl })
    .from(generationJobs)
    .where(
      and(
        inArray(generationJobs.normalizedUrl, normalizedList),
        inArray(generationJobs.status, ['queued', 'running']),
      ),
    );
  const inFlightNormalized = new Set(
    inFlightJobs.map((j) => j.normalizedUrl).filter(Boolean) as string[],
  );

  // ── 4. Partition into skip / enqueue ────────────────────────────────────
  const toEnqueue: Candidate[] = [];
  for (const c of candidates) {
    if (existingNormalized.has(c.normalized)) {
      outcomes.push({ url: c.raw, status: 'skipped', reason: 'alreadyExists' });
      continue;
    }
    if (inFlightNormalized.has(c.normalized)) {
      outcomes.push({ url: c.raw, status: 'skipped', reason: 'alreadyInFlight' });
      continue;
    }
    toEnqueue.push(c);
  }

  // ── 5. Enqueue with concurrency=4 ────────────────────────────────────────
  const enqueued = await runWithConcurrency(
    toEnqueue,
    ENQUEUE_CONCURRENCY,
    async (candidate, idx) => {
      const delaySeconds = idx * STAGGER_SECONDS;

      const [job] = await db
        .insert(generationJobs)
        .values({
          url: candidate.raw,
          normalizedUrl: candidate.normalized,
          sourceType: 'url',
          status: 'queued',
          currentStep: 'queued',
          userId: editor.id,
          autoPublish: true,
        })
        .returning({ id: generationJobs.id });

      if (!job) {
        return { url: candidate.raw, status: 'skipped' as const, reason: 'invalid' as SkipReason };
      }

      try {
        await enqueueTask('scrape-and-extract', { jobId: job.id }, { delaySeconds });
      } catch (err) {
        await db
          .update(generationJobs)
          .set({
            status: 'failed',
            errorStep: 'enqueue',
            errorMessage: (err instanceof Error ? err.message : String(err)).slice(0, 1000),
            updatedAt: new Date(),
          })
          .where(eq(generationJobs.id, job.id));
        return { url: candidate.raw, status: 'skipped' as const, reason: 'invalid' as SkipReason };
      }

      return { url: candidate.raw, status: 'enqueued' as const, jobId: job.id, delaySeconds };
    },
  );

  for (const o of enqueued) outcomes.push(o);

  const enqueuedCount = outcomes.filter((o) => o.status === 'enqueued').length;
  const etaSeconds = enqueuedCount > 0 ? (enqueuedCount - 1) * STAGGER_SECONDS + 60 : 0;

  return NextResponse.json(
    { enqueued: enqueuedCount, skipped: buildSkipCounts(outcomes), outcomes, etaSeconds },
    { status: 202 },
  );
}

function buildSkipCounts(outcomes: Outcome[]) {
  return {
    duplicate: outcomes.filter((o) => o.status === 'skipped' && o.reason === 'duplicate').length,
    alreadyExists: outcomes.filter((o) => o.status === 'skipped' && o.reason === 'alreadyExists').length,
    alreadyInFlight: outcomes.filter((o) => o.status === 'skipped' && o.reason === 'alreadyInFlight').length,
    invalid: outcomes.filter((o) => o.status === 'skipped' && o.reason === 'invalid').length,
  };
}
