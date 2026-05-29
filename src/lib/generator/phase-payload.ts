/**
 * Transient pipeline inputs handed from Phase 1 (scrape + extract) to Phase 2
 * (author DESIGN.md) and Phase 3 (companion prompt).
 *
 * Persisted on `generation_jobs.phase_payload` (jsonb) so the later workers
 * receive only a thin `{ jobId }` message and hydrate the rest from the DB.
 * This keeps queue messages tiny (no 1MB cap risk) and — crucially — lets the
 * supervisor RESUME a stalled job by re-enqueuing its current phase: the inputs
 * are already durable, so a resume is never a re-scrape.
 *
 * Only fields NOT already on the generation_jobs row live here. Everything else
 * (url, batchId, autoPublish, targetBundleId) is read from the row directly.
 */
import { z } from 'zod';
import type { ExtractedBrand } from '@/lib/ai/gemini';

export interface AuthorPhasePayload {
  /** Draft bundle written by Phase 1 (new insert, or the re-run target). */
  bundleId: string;
  /** Structured brand tokens from Gemini extraction. */
  brand: ExtractedBrand;
  /** Page text, trimmed to PHASE_2_MARKDOWN_CAP, for the authoring prompt. */
  scrapedMarkdown: string;
  /** Design-style slugs (mirrors brand.designStyles) for the companion worker. */
  designStyles: string[];
  /** Editor feedback for a re-run; null for fresh jobs. Ephemeral to the run. */
  userFeedback: string | null;
}

// The payload is our own serialized object round-tripping through our own DB,
// so we validate only the envelope (presence + scalar shapes) and trust the
// nested brand object rather than re-deriving the full Gemini schema here.
const AuthorPhasePayloadSchema = z.object({
  bundleId: z.string().uuid(),
  brand: z.object({}).passthrough(),
  scrapedMarkdown: z.string(),
  designStyles: z.array(z.string()),
  userFeedback: z.string().nullable(),
});

/**
 * Validate + type a `phase_payload` value read back from the DB. Throws a clear
 * error when the payload is missing or malformed so a worker fails loudly
 * (and the supervisor can reap it) instead of dereferencing undefined.
 */
export function parseAuthorPhasePayload(value: unknown): AuthorPhasePayload {
  const parsed = AuthorPhasePayloadSchema.parse(value);
  return {
    bundleId: parsed.bundleId,
    // Double-cast through unknown: the schema validates only the envelope
    // (we trust the nested brand, see above), and TS won't narrow a loose
    // passthrough object straight to ExtractedBrand.
    brand: parsed.brand as unknown as ExtractedBrand,
    scrapedMarkdown: parsed.scrapedMarkdown,
    designStyles: parsed.designStyles,
    userFeedback: parsed.userFeedback,
  };
}
