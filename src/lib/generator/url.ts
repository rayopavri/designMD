/**
 * URL normalization for duplicate detection.
 *
 * Two visually different URLs should normalize to the same string when
 * they point to the "same brand surface". This is the field we index on
 * to detect re-submissions.
 *
 * Rules:
 *   - lowercase host
 *   - strip leading "www."
 *   - strip trailing slash
 *   - strip fragment
 *   - drop tracking query params (utm_*, gclid, fbclid, ref, ref_src)
 *   - sort remaining query params alphabetically
 *   - keep the path verbatim (case-sensitive, since /docs/ vs /Docs/ may matter)
 */

const TRACKING_PARAM_PREFIXES = ['utm_'];
const TRACKING_PARAMS = new Set(['gclid', 'fbclid', 'ref', 'ref_src', 'mc_cid', 'mc_eid']);

export function normalizeUrl(input: string): string {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error(`Invalid URL: ${input}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`URL must be http or https, got ${parsed.protocol}`);
  }

  // Lowercase host, strip www.
  let host = parsed.hostname.toLowerCase();
  if (host.startsWith('www.')) host = host.slice(4);

  // Build query without tracking params, sorted.
  const params = Array.from(parsed.searchParams.entries())
    .filter(([k]) => {
      const key = k.toLowerCase();
      if (TRACKING_PARAMS.has(key)) return false;
      if (TRACKING_PARAM_PREFIXES.some((p) => key.startsWith(p))) return false;
      return true;
    })
    .sort(([a], [b]) => a.localeCompare(b));
  const query = params.length > 0 ? `?${new URLSearchParams(params).toString()}` : '';

  // Strip trailing slash from path (but keep "/" for root).
  let path = parsed.pathname;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);

  return `${parsed.protocol}//${host}${path}${query}`;
}

export function extractDomain(input: string): string {
  const parsed = new URL(input);
  let host = parsed.hostname.toLowerCase();
  if (host.startsWith('www.')) host = host.slice(4);
  return host;
}
