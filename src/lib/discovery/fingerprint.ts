/**
 * Content fingerprint for discovery dedup.
 *
 * v1 fingerprints the *normalized URL* (see generator/url.ts): two HN/Reddit
 * posts linking the same product surface collapse to one fingerprint, so we
 * never classify or generate the same site twice. When the classifier later
 * reads linked-page content we can fold that into the hash — the column is an
 * opaque string to everything downstream.
 */
import { createHash } from 'node:crypto';
import { normalizeUrl } from '@/lib/generator/url';

export function fingerprintUrl(url: string): string {
  const normalized = normalizeUrl(url);
  return createHash('sha256').update(normalized).digest('hex');
}
