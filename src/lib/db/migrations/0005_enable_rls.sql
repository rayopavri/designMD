-- ============================================================================
-- 0005_enable_rls — Row Level Security hardening
-- ============================================================================
-- Enables RLS on every public table (deny-by-default: NO policies are created,
-- so the Supabase Data API roles `anon` and `authenticated` can read and write
-- NOTHING through PostgREST or GraphQL). The application is unaffected: it
-- connects as the `postgres` owner role over the transaction pooler, and table
-- OWNERS bypass RLS — we deliberately do NOT use FORCE ROW LEVEL SECURITY.
-- Supabase Storage uploads and the backfill scripts authenticate with the
-- secret service_role key, which also bypasses RLS and is not revoked below.
-- ============================================================================
ALTER TABLE "abuse_signals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "banned_users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bundle_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bundle_votes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bundles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "collection_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "collections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "discovery_candidates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "discovery_source_state" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "domain_blocklist" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "generation_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "guardrail_rejections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_favorites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "verification_applications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Reconcile pre-existing schema drift: `preview_image_url` (the detail-page
-- hero screenshot URL) exists in schema.ts and in the live database but was
-- never captured in a migration. IF NOT EXISTS makes this a no-op where the
-- column already exists (production) while repairing any database built purely
-- from the migration history.
ALTER TABLE "bundles" ADD COLUMN IF NOT EXISTS "preview_image_url" text;--> statement-breakpoint
-- ── Defense in depth: strip the Supabase Data API role grants ───────────────
-- Supabase auto-grants `anon` + `authenticated` table privileges on objects
-- created by `postgres`, exposing them through PostgREST/GraphQL. RLS above
-- already denies these roles every row (no policies), but we also remove the
-- grants so the API surface stays closed even if a policy is ever added, and
-- set default privileges so FUTURE tables are covered too. Guarded by role
-- existence so this is a clean no-op on a plain (non-Supabase) Postgres used
-- for local development, where `anon`/`authenticated` do not exist.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM authenticated;
  END IF;
END $$;
