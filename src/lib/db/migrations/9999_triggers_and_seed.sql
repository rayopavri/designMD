-- ============================================================
-- designmd — triggers and seed data (post-Drizzle)
--
-- This file runs AFTER the Drizzle-generated migrations create
-- all the tables. It adds:
--   1. Vote aggregation trigger (incremental, O(1))
--   2. Auto-flag trigger for bundles with sustained low vote rate
--   3. companion_prompt version increment trigger
--   4. updated_at maintenance triggers
--   5. Category seed data
--
-- Idempotent: safe to run multiple times.
-- ============================================================

-- ─── 1. Vote aggregation trigger ───────────────────────────
CREATE OR REPLACE FUNCTION fn_update_bundle_vote_stats()
RETURNS TRIGGER AS $$
DECLARE
    v_bundle_id      UUID;
    v_count_delta    INTEGER := 0;
    v_positive_delta INTEGER := 0;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_bundle_id      := NEW.bundle_id;
        v_count_delta    := 1;
        v_positive_delta := CASE WHEN NEW.worked THEN 1 ELSE 0 END;
    ELSIF TG_OP = 'UPDATE' THEN
        v_bundle_id      := NEW.bundle_id;
        v_positive_delta := (CASE WHEN NEW.worked THEN 1 ELSE 0 END)
                          - (CASE WHEN OLD.worked THEN 1 ELSE 0 END);
    ELSIF TG_OP = 'DELETE' THEN
        v_bundle_id      := OLD.bundle_id;
        v_count_delta    := -1;
        v_positive_delta := CASE WHEN OLD.worked THEN -1 ELSE 0 END;
    END IF;

    UPDATE bundles SET
        vote_count = vote_count + v_count_delta,
        positive_vote_count = positive_vote_count + v_positive_delta,
        positive_vote_rate = CASE
            WHEN (vote_count + v_count_delta) = 0 THEN 0.00
            ELSE ROUND((positive_vote_count + v_positive_delta) * 100.0
                       / (vote_count + v_count_delta), 2)
        END,
        updated_at = NOW()
    WHERE id = v_bundle_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vote_stats ON bundle_votes;
CREATE TRIGGER trg_vote_stats
    AFTER INSERT OR UPDATE OR DELETE ON bundle_votes
    FOR EACH ROW EXECUTE FUNCTION fn_update_bundle_vote_stats();

-- ─── 2. Auto-flag low-rated bundles ────────────────────────
CREATE OR REPLACE FUNCTION fn_auto_flag_low_vote_bundles()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.vote_count >= 5
       AND NEW.positive_vote_rate < 60.00
       AND NEW.status = 'published'
    THEN
        UPDATE bundles
        SET status = 'flagged'
        WHERE id = NEW.id AND status = 'published';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_flag ON bundles;
CREATE TRIGGER trg_auto_flag
    AFTER UPDATE OF positive_vote_rate ON bundles
    FOR EACH ROW EXECUTE FUNCTION fn_auto_flag_low_vote_bundles();

-- ─── 3. companion_prompt version increment ─────────────────
CREATE OR REPLACE FUNCTION fn_increment_prompt_version()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.companion_prompt IS DISTINCT FROM NEW.companion_prompt THEN
        NEW.companion_prompt_version := OLD.companion_prompt_version + 1;
        NEW.companion_prompt_updated_at := NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prompt_version ON bundles;
CREATE TRIGGER trg_prompt_version
    BEFORE UPDATE OF companion_prompt ON bundles
    FOR EACH ROW EXECUTE FUNCTION fn_increment_prompt_version();

-- ─── 4. updated_at maintenance ─────────────────────────────
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bundles_updated_at ON bundles;
CREATE TRIGGER trg_bundles_updated_at BEFORE UPDATE ON bundles
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_collections_updated_at ON collections;
CREATE TRIGGER trg_collections_updated_at BEFORE UPDATE ON collections
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_requests_updated_at ON bundle_requests;
CREATE TRIGGER trg_requests_updated_at BEFORE UPDATE ON bundle_requests
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_jobs_updated_at ON generation_jobs;
CREATE TRIGGER trg_jobs_updated_at BEFORE UPDATE ON generation_jobs
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ─── 5. Category seed data ─────────────────────────────────
INSERT INTO categories (slug, name, level, color, sort_order) VALUES
    ('mobile-apps',     'Mobile apps',     1, '#5E6AD2', 1),
    ('saas-web-apps',   'SaaS / Web apps', 1, '#0F62FE', 2),
    ('ecommerce',       'E-commerce',      1, '#3DBB6C', 3),
    ('dashboards',      'Dashboards',      1, '#9747FF', 4),
    ('marketing-sites', 'Marketing sites', 1, '#F26207', 5),
    ('design-systems',  'Design systems',  1, '#E24B4A', 6)
ON CONFLICT (slug) DO NOTHING;

-- Phase 2 discovery source seeds
INSERT INTO discovery_source_state (source) VALUES
    ('github'), ('reddit'), ('hackernews')
ON CONFLICT (source) DO NOTHING;
