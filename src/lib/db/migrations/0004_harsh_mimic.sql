-- Backfill: collapse any pre-existing duplicate ACTIVE bundles that share a
-- normalized source URL down to a single survivor, so the unique index below
-- can be created without violating it.
--
-- Survivor policy (highest priority first):
--   1. published bundles win over non-published
--   2. higher coverage_score wins
--   3. more recently updated, then created, wins
-- Losers are ARCHIVED (status = 'archived') — non-destructive: the rows are
-- kept and simply drop out of the active set. Restore via the admin UI if a
-- survivor was picked wrongly. Adjust the ORDER BY if you want a different
-- keep policy.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY source_url_normalized
      ORDER BY
        (status = 'published') DESC,
        coverage_score DESC NULLS LAST,
        updated_at DESC,
        created_at DESC,
        id DESC
    ) AS rn
  FROM bundles
  WHERE source_url_normalized IS NOT NULL
    AND status IN ('personal', 'pending_review', 'published', 'flagged')
)
UPDATE bundles b
SET status = 'archived', updated_at = now()
FROM ranked r
WHERE b.id = r.id
  AND r.rn > 1;
--> statement-breakpoint
-- Race-proof dedup guard: at most one ACTIVE bundle per normalized source URL.
-- Excludes 'rejected'/'archived' (dead — URL should be re-submittable) and
-- NULL urls (uploads have no source). This is the backstop the /api/generate
-- published-only pre-check cannot provide under concurrent submissions.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_bundles_source_active" ON "bundles" USING btree ("source_url_normalized") WHERE "bundles"."source_url_normalized" IS NOT NULL AND "bundles"."status" IN ('personal', 'pending_review', 'published', 'flagged');
