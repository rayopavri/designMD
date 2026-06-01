/**
 * Discovery pre-guardrail.
 *
 * Discovery ingests URLs from public feeds that nobody vouched for, unlike the
 * generator (a human pastes a URL). This cheap screen runs BEFORE any AI spend:
 *   1. valid http(s) URL
 *   2. not an obvious non-product host (social / aggregator / the feed itself)
 *   3. not on the domain_blocklist (nsfw / malware / spam / scrape_ban / manual)
 *   4. not already a candidate (fingerprint) or an active bundle (normalized URL)
 *
 * Returns a normalized result the caller uses to insert the candidate, or a
 * rejection the caller logs to guardrail_rejections (workflow='discovery').
 */
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { domainBlocklist } from '@/lib/db/schema';
import { extractDomain, normalizeUrl } from '@/lib/generator/url';
import { fingerprintUrl } from './fingerprint';
import { isNonProductHost } from './hosts';
import {
  activeBundleExistsByNormalizedUrl,
  candidateExistsByFingerprint,
} from '@/lib/db/queries/discovery';

export type GuardrailResult =
  | { ok: true; normalizedUrl: string; domain: string; fingerprint: string }
  | { ok: false; layer: string; reason: string; details?: Record<string, unknown> };

export async function screenCandidate(rawUrl: string): Promise<GuardrailResult> {
  // 1. structural
  let normalizedUrl: string;
  let domain: string;
  try {
    normalizedUrl = normalizeUrl(rawUrl);
    domain = extractDomain(rawUrl);
  } catch (err) {
    return {
      ok: false,
      layer: 'url',
      reason: 'invalid_url',
      details: { rawUrl, error: err instanceof Error ? err.message : String(err) },
    };
  }

  // 2. non-product host
  if (isNonProductHost(domain)) {
    return { ok: false, layer: 'host', reason: 'non_product_host', details: { domain } };
  }

  // 3. blocklist
  const blocked = await db
    .select({ category: domainBlocklist.category })
    .from(domainBlocklist)
    .where(eq(domainBlocklist.domain, domain))
    .limit(1);
  if (blocked.length > 0) {
    return {
      ok: false,
      layer: 'blocklist',
      reason: `blocklisted:${blocked[0].category}`,
      details: { domain },
    };
  }

  // 4. dedup (against existing candidates, then the live library)
  const fingerprint = fingerprintUrl(rawUrl);
  if (await candidateExistsByFingerprint(fingerprint)) {
    return { ok: false, layer: 'dedup', reason: 'duplicate_candidate', details: { fingerprint } };
  }
  if (await activeBundleExistsByNormalizedUrl(normalizedUrl)) {
    return { ok: false, layer: 'dedup', reason: 'duplicate_bundle', details: { normalizedUrl } };
  }

  return { ok: true, normalizedUrl, domain, fingerprint };
}
