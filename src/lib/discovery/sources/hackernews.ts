/**
 * Hacker News "Show HN" source adapter.
 *
 * Uses the keyless Algolia HN Search API (no token, generous rate limits):
 *   https://hn.algolia.com/api/v1/search_by_date?tags=show_hn&hitsPerPage=N
 *
 * Show HN posts almost always link a real, designed product whose maker is
 * inviting traffic — the cleanest discovery signal and attribution story. We
 * keep only hits that carry an external `url` (Ask-HN / text posts have none).
 * Parsing is split from fetching so the mapper stays pure and testable.
 */

export interface RawCandidate {
  sourceId: string;
  sourceUrl: string;
  rawContent: string;
  authorHandle: string | null;
  authorUrl: string | null;
}

interface AlgoliaHit {
  objectID?: string;
  url?: string | null;
  title?: string | null;
  author?: string | null;
  points?: number | null;
  num_comments?: number | null;
  created_at?: string | null;
}

interface AlgoliaResponse {
  hits?: AlgoliaHit[];
}

const ALGOLIA_ENDPOINT = 'https://hn.algolia.com/api/v1/search_by_date';
const HN_USER_BASE = 'https://news.ycombinator.com/user?id=';
const FETCH_TIMEOUT_MS = 15_000;

/** Map a raw Algolia response into candidates. Pure — no network. */
export function parseAlgoliaHits(data: AlgoliaResponse): RawCandidate[] {
  if (!data || !Array.isArray(data.hits)) return [];
  const out: RawCandidate[] = [];
  for (const hit of data.hits) {
    // Skip Ask-HN / text-only posts (no external URL) and malformed hits.
    if (!hit.url || !hit.objectID) continue;
    out.push({
      sourceId: hit.objectID,
      sourceUrl: hit.url,
      rawContent: JSON.stringify({
        title: hit.title ?? null,
        points: hit.points ?? null,
        numComments: hit.num_comments ?? null,
        createdAt: hit.created_at ?? null,
      }),
      authorHandle: hit.author ?? null,
      authorUrl: hit.author ? `${HN_USER_BASE}${encodeURIComponent(hit.author)}` : null,
    });
  }
  return out;
}

export async function fetchShowHN(limit = 30): Promise<RawCandidate[]> {
  const hitsPerPage = Math.min(Math.max(limit, 1), 100);
  const url = `${ALGOLIA_ENDPOINT}?tags=show_hn&hitsPerPage=${hitsPerPage}`;
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
    // HN Algolia is fast; cap so a hang can't wedge the 60s worker.
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`HN Algolia fetch failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as AlgoliaResponse;
  return parseAlgoliaHits(data);
}
