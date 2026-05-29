/**
 * POST /api/admin/bulk-upload
 *
 * Editor-only. Accepts a list of URLs, creates all generation jobs sharing
 * a batchId, and enqueues ONLY the first one. Each job chains to the next
 * (via advanceBatch) after it completes or fails, with a 10s gap.
 *
 * Skips:
 *  - Invalid URLs
 *  - Duplicates within the submitted list (first occurrence wins)
 *  - URLs whose normalized form already has a published/pending_review bundle
 *  - URLs whose discovered brand name already matches a published/pending_review
 *    bundle title (case-insensitive) — catches the same brand reached via a
 *    different URL
 *  - URLs that already have a queued/running job
 *
 * Body:  { urls: string[] }  (max 150)
 * Response (202): { batchId, enqueued, skipped, outcomes, etaSeconds }
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { requireEditor } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { bundles, generationJobs } from '@/lib/db/schema';
import { enqueueTask } from '@/lib/queue';
import { normalizeUrl } from '@/lib/generator/url';
import { prefetchBrandNames } from '@/lib/generator/prefetch-names';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_BATCH = 150;

const BodySchema = z.object({
  urls: z.array(z.string().min(1).max(2048)).min(1).max(MAX_BATCH),
});

type SkipReason = 'invalid' | 'duplicate' | 'alreadyExists' | 'nameExists' | 'alreadyInFlight';
type Outcome =
  | { url: string; status: 'enqueued'; jobId: string }
  | { url: string; status: 'skipped'; reason: SkipReason };

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
    return NextResponse.json(
      { batchId: null, enqueued: 0, skipped: buildSkipCounts(outcomes), outcomes, etaSeconds: 0 },
      { status: 202 },
    );
  }

  // ── 2. Check for existing bundles (published or pending_review only) ─────────
  // Match single-generate's behaviour: personal and archived bundles can be
  // re-generated. Blocking on ANY status was the root cause of URLs that
  // succeeded via single generate being permanently rejected here.
  const normalizedList = candidates.map((c) => c.normalized);

  // Kick off best-effort brand-name discovery in parallel with the DB lookups
  // below. Resolves to a Map<normalizedUrl, name|null>; null = name unresolved,
  // so that URL falls back to URL-only checking.
  const namesPromise = prefetchBrandNames(normalizedList);

  const existingBundles = await db
    .select({ sourceUrlNormalized: bundles.sourceUrlNormalized })
    .from(bundles)
    .where(
      and(
        inArray(bundles.sourceUrlNormalized, normalizedList),
        inArray(bundles.status, ['published', 'pending_review']),
      ),
    );
  const existingNormalized = new Set(
    existingBundles.map((b) => b.sourceUrlNormalized).filter(Boolean) as string[],
  );

  // ── 3. Check for in-flight jobs ───────────────────────────────────────────
  // Scoped to the editor's own jobs (mirrors single-generate). A global check
  // meant that a URL sitting queued in another batch — or from another user's
  // single-generate — would block re-submission here even though it has no
  // relation to this batch.
  // Exclude stuck jobs (updatedAt unchanged >10 min) so a SIGKILL-stranded
  // row doesn't permanently block the same URL from re-submission.
  const STALE_JOB_MS = 10 * 60 * 1000;
  const staleCutoff = new Date(Date.now() - STALE_JOB_MS);
  const inFlightJobs = await db
    .select({ normalizedUrl: generationJobs.normalizedUrl, updatedAt: generationJobs.updatedAt })
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.userId, editor.id),
        inArray(generationJobs.normalizedUrl, normalizedList),
        inArray(generationJobs.status, ['queued', 'running']),
      ),
    );
  const inFlightNormalized = new Set(
    inFlightJobs
      .filter((j) => j.updatedAt == null || j.updatedAt >= staleCutoff)
      .map((j) => j.normalizedUrl)
      .filter(Boolean) as string[],
  );

  // ── 3b. Check for existing bundles by discovered brand name ──────────────
  // Catches the same brand reached via a different URL (e.g. stripe.com vs
  // stripe.com/payments) that the URL check above misses. Best-effort: any URL
  // whose name couldn't be resolved (null) simply isn't name-checked.
  // Compares lower(trim(name)) against lower(trim(bundles.title)).
  const names = await namesPromise;
  const lowerNames = [
    ...new Set(
      [...names.values()]
        .filter((n): n is string => !!n)
        .map((n) => n.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  const existingNameSet = new Set<string>();
  if (lowerNames.length > 0) {
    const titleExpr = sql<string>`lower(trim(${bundles.title}))`;
    const existingByName = await db
      .select({ lname: titleExpr })
      .from(bundles)
      .where(
        and(
          inArray(titleExpr, lowerNames),
          inArray(bundles.status, ['published', 'pending_review']),
        ),
      );
    for (const row of existingByName) {
      if (row.lname) existingNameSet.add(row.lname);
    }
  }

  // ── 4. Partition into skip / enqueue ─────────────────────────────────────
  // Order: URL match wins → name match → in-flight job.
  const toEnqueue: Candidate[] = [];
  for (const c of candidates) {
    if (existingNormalized.has(c.normalized)) {
      outcomes.push({ url: c.raw, status: 'skipped', reason: 'alreadyExists' });
      continue;
    }
    const discoveredName = names.get(c.normalized);
    if (discoveredName && existingNameSet.has(discoveredName.trim().toLowerCase())) {
      outcomes.push({ url: c.raw, status: 'skipped', reason: 'nameExists' });
      continue;
    }
    if (inFlightNormalized.has(c.normalized)) {
      outcomes.push({ url: c.raw, status: 'skipped', reason: 'alreadyInFlight' });
      continue;
    }
    toEnqueue.push(c);
  }

  if (toEnqueue.length === 0) {
    return NextResponse.json(
      { batchId: null, enqueued: 0, skipped: buildSkipCounts(outcomes), outcomes, etaSeconds: 0 },
      { status: 202 },
    );
  }

  // ── 5. Insert all jobs sharing one batchId, enqueue only the first ────────
  const batchId = crypto.randomUUID();

  const insertedJobs = await db
    .insert(generationJobs)
    .values(
      toEnqueue.map((c) => ({
        url: c.raw,
        normalizedUrl: c.normalized,
        sourceType: 'url' as const,
        status: 'queued' as const,
        currentStep: 'queued',
        userId: editor.id,
        autoPublish: true,
        batchId,
      })),
    )
    .returning({ id: generationJobs.id, normalizedUrl: generationJobs.normalizedUrl });

  // Build outcome entries for all inserted jobs
  const urlToJobId = new Map(insertedJobs.map((j) => [j.normalizedUrl, j.id]));
  for (const c of toEnqueue) {
    const jobId = urlToJobId.get(c.normalized);
    if (jobId) {
      outcomes.push({ url: c.raw, status: 'enqueued', jobId });
    }
  }

  // Enqueue only the first job — it chains to the rest on completion/failure
  const firstJob = insertedJobs[0];
  if (firstJob) {
    try {
      await enqueueTask('scrape-and-extract', { jobId: firstJob.id });
    } catch (err) {
      console.error('[bulk-upload] failed to enqueue first job:', err);
      return NextResponse.json(
        { error: 'Failed to start pipeline', details: err instanceof Error ? err.message : String(err) },
        { status: 500 },
      );
    }
  }

  const enqueuedCount = toEnqueue.length;
  // ETA: first job starts now, each subsequent adds ~3 min processing + 10s gap
  const etaSeconds = enqueuedCount > 0 ? enqueuedCount * 180 + (enqueuedCount - 1) * 10 : 0;

  return NextResponse.json(
    { batchId, enqueued: enqueuedCount, skipped: buildSkipCounts(outcomes), outcomes, etaSeconds },
    { status: 202 },
  );
}

function buildSkipCounts(outcomes: Outcome[]) {
  return {
    duplicate: outcomes.filter((o) => o.status === 'skipped' && o.reason === 'duplicate').length,
    alreadyExists: outcomes.filter((o) => o.status === 'skipped' && o.reason === 'alreadyExists').length,
    nameExists: outcomes.filter((o) => o.status === 'skipped' && o.reason === 'nameExists').length,
    alreadyInFlight: outcomes.filter((o) => o.status === 'skipped' && o.reason === 'alreadyInFlight').length,
    invalid: outcomes.filter((o) => o.status === 'skipped' && o.reason === 'invalid').length,
  };
}
