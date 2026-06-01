/**
 * Discovery candidate queries.
 *
 * Centralises reads/writes for the Phase 2 discovery pipeline so the fetch
 * worker, the (future) classifier, and the /admin/discovery surface share one
 * access layer — mirrors queries/bundles.ts. All discovery writes go here.
 */
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  bundleStatus,
  bundles,
  candidateStatus,
  discoveryCandidates,
  discoverySourceState,
  guardrailRejections,
} from '@/lib/db/schema';

type DiscoveryCandidate = typeof discoveryCandidates.$inferSelect;
type CandidateStatus = (typeof candidateStatus.enumValues)[number];

// Active bundle statuses that should block re-discovery of the same source URL.
// Mirrors the partial unique index guarding active bundles per source URL.
const ACTIVE_BUNDLE_STATUSES: (typeof bundleStatus.enumValues)[number][] = [
  'personal',
  'pending_review',
  'published',
  'flagged',
];

export interface NewCandidate {
  source: string;
  sourceId: string;
  sourceUrl: string;
  rawContent?: string | null;
  contentFingerprint?: string | null;
  authorName?: string | null;
  authorHandle?: string | null;
  authorUrl?: string | null;
  authorEmail?: string | null;
  license?: string | null;
}

/**
 * Insert a candidate, ignoring re-discoveries of the same (source, source_id)
 * via uq_candidates_source. Returns the new row id, or null when the row
 * already existed (conflict → nothing returned).
 */
export async function insertCandidate(input: NewCandidate): Promise<string | null> {
  const rows = await db
    .insert(discoveryCandidates)
    .values({
      source: input.source,
      sourceId: input.sourceId,
      sourceUrl: input.sourceUrl,
      rawContent: input.rawContent ?? null,
      contentFingerprint: input.contentFingerprint ?? null,
      authorName: input.authorName ?? null,
      authorHandle: input.authorHandle ?? null,
      authorUrl: input.authorUrl ?? null,
      authorEmail: input.authorEmail ?? null,
      license: input.license ?? null,
    })
    .onConflictDoNothing({
      target: [discoveryCandidates.source, discoveryCandidates.sourceId],
    })
    .returning({ id: discoveryCandidates.id });
  return rows[0]?.id ?? null;
}

/** Cross-source dedup: has any candidate already been recorded for this fingerprint? */
export async function candidateExistsByFingerprint(fingerprint: string): Promise<boolean> {
  const rows = await db
    .select({ id: discoveryCandidates.id })
    .from(discoveryCandidates)
    .where(eq(discoveryCandidates.contentFingerprint, fingerprint))
    .limit(1);
  return rows.length > 0;
}

/** Dedup vs the live library: is this normalized URL already an active bundle? */
export async function activeBundleExistsByNormalizedUrl(normalizedUrl: string): Promise<boolean> {
  const rows = await db
    .select({ id: bundles.id })
    .from(bundles)
    .where(
      and(
        eq(bundles.sourceUrlNormalized, normalizedUrl),
        inArray(bundles.status, ACTIVE_BUNDLE_STATUSES),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function listCandidatesByStatus(
  status: CandidateStatus,
  limit = 50,
): Promise<DiscoveryCandidate[]> {
  return db
    .select()
    .from(discoveryCandidates)
    .where(eq(discoveryCandidates.status, status))
    .orderBy(desc(discoveryCandidates.discoveredAt))
    .limit(limit);
}

export interface GuardrailRejectionInput {
  layer: string;
  url: string;
  reason: string;
  details?: Record<string, unknown>;
}

/** Log a discovery-workflow guardrail rejection (workflow is fixed to 'discovery'). */
export async function logGuardrailRejection(input: GuardrailRejectionInput): Promise<void> {
  await db.insert(guardrailRejections).values({
    workflow: 'discovery',
    layer: input.layer,
    url: input.url,
    reason: input.reason,
    details: input.details ?? null,
  });
}

export interface SourceRunResult {
  lastCursor?: string | null;
  lastRunStatus: string;
  itemsFound: number;
  errors?: string | null;
}

/** Upsert per-source run state (cursor + counts) keyed on source. */
export async function recordSourceRun(source: string, result: SourceRunResult): Promise<void> {
  const fields = {
    lastRunAt: new Date(),
    lastCursor: result.lastCursor ?? null,
    lastRunStatus: result.lastRunStatus,
    itemsFound: result.itemsFound,
    errors: result.errors ?? null,
  };
  await db
    .insert(discoverySourceState)
    .values({ source, ...fields })
    .onConflictDoUpdate({ target: discoverySourceState.source, set: fields });
}
