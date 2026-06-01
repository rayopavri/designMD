/**
 * Discovery fetch orchestrator (P2-1).
 *
 * One run pulls candidates from a single source, screens each through the
 * pre-guardrail, and inserts survivors as `unclassified`. It records the run in
 * discovery_source_state and returns a summary. Classification (P2-2) is a
 * separate phase — this only does HTTP fetches + DB writes, so it stays well
 * under the 60s function cap.
 */
import {
  insertCandidate,
  logGuardrailRejection,
  recordSourceRun,
} from '@/lib/db/queries/discovery';
import { screenCandidate } from './guardrail';
import { fetchShowHN, type RawCandidate } from './sources/hackernews';

export const DISCOVERY_SOURCES = ['hackernews'] as const;
export type DiscoverySource = (typeof DISCOVERY_SOURCES)[number];

const DEFAULT_LIMIT = 30;

export interface DiscoverFetchInput {
  source: DiscoverySource;
  limit?: number;
}

export interface DiscoverFetchSummary {
  source: DiscoverySource;
  fetched: number;
  inserted: number;
  rejected: number;
  duplicates: number;
  rejections: { url: string; reason: string }[];
}

async function fetchRaw(source: DiscoverySource, limit: number): Promise<RawCandidate[]> {
  switch (source) {
    case 'hackernews':
      return fetchShowHN(limit);
    default:
      throw new Error(`Unknown discovery source: ${source as string}`);
  }
}

export async function runDiscoverFetch(input: DiscoverFetchInput): Promise<DiscoverFetchSummary> {
  const limit = input.limit ?? DEFAULT_LIMIT;
  const summary: DiscoverFetchSummary = {
    source: input.source,
    fetched: 0,
    inserted: 0,
    rejected: 0,
    duplicates: 0,
    rejections: [],
  };

  try {
    const raw = await fetchRaw(input.source, limit);
    summary.fetched = raw.length;

    for (const item of raw) {
      const screen = await screenCandidate(item.sourceUrl);
      if (!screen.ok) {
        if (screen.reason.startsWith('duplicate')) summary.duplicates += 1;
        else summary.rejected += 1;
        summary.rejections.push({ url: item.sourceUrl, reason: screen.reason });
        await logGuardrailRejection({
          layer: screen.layer,
          url: item.sourceUrl,
          reason: screen.reason,
          details: screen.details,
        });
        continue;
      }

      const id = await insertCandidate({
        source: input.source,
        sourceId: item.sourceId,
        sourceUrl: item.sourceUrl,
        rawContent: item.rawContent,
        contentFingerprint: screen.fingerprint,
        authorHandle: item.authorHandle,
        authorUrl: item.authorUrl,
      });
      // Null means a (source, source_id) row already existed — a duplicate the
      // fingerprint screen didn't catch (e.g. same post, different linked URL).
      if (id) summary.inserted += 1;
      else summary.duplicates += 1;
    }

    await recordSourceRun(input.source, {
      lastRunStatus: 'ok',
      itemsFound: summary.fetched,
      lastCursor: raw[0]?.sourceId ?? null,
    });
    return summary;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordSourceRun(input.source, {
      lastRunStatus: 'error',
      itemsFound: summary.fetched,
      errors: message.slice(0, 1000),
    }).catch(() => {
      /* best-effort: the original error is what matters */
    });
    throw err;
  }
}
