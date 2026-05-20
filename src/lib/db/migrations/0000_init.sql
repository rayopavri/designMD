-- ============================================================
-- designmd — initial schema bootstrap (raw SQL)
--
-- Runs BEFORE Drizzle migrations. Creates:
--   1. Required Postgres extensions
--   2. Helper functions used by CHECK constraints
--      (PostgreSQL forbids subqueries in CHECK, so we use
--      plpgsql functions that loop without subqueries)
--
-- Idempotent.
-- ============================================================

-- ─── Extensions ────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Per-value validators (also reusable from app code) ────
CREATE OR REPLACE FUNCTION is_valid_design_style(v TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN v = ANY(ARRAY[
        'minimal','enterprise','bold','playful','accessible','dark-mode'
    ]);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION is_valid_tool(v TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN v = ANY(ARRAY[
        'claude','cursor','lovable','figma-make','replit','all'
    ]);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION is_valid_vote_reason(v TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN v = ANY(ARRAY[
        'colors_off','typography_ignored','spacing_wrong',
        'too_generic','components_missing'
    ]);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ─── Array-level validators (used in CHECK constraints) ────
-- These loop instead of using a subquery so they're legal
-- inside a CHECK constraint.
CREATE OR REPLACE FUNCTION all_valid_design_styles(arr TEXT[])
RETURNS BOOLEAN AS $$
DECLARE v TEXT;
BEGIN
    IF arr IS NULL OR cardinality(arr) = 0 THEN RETURN TRUE; END IF;
    FOREACH v IN ARRAY arr LOOP
        IF NOT is_valid_design_style(v) THEN RETURN FALSE; END IF;
    END LOOP;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION all_valid_tools(arr TEXT[])
RETURNS BOOLEAN AS $$
DECLARE v TEXT;
BEGIN
    IF arr IS NULL OR cardinality(arr) = 0 THEN RETURN TRUE; END IF;
    FOREACH v IN ARRAY arr LOOP
        IF NOT is_valid_tool(v) THEN RETURN FALSE; END IF;
    END LOOP;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION all_valid_vote_reasons(arr TEXT[])
RETURNS BOOLEAN AS $$
DECLARE v TEXT;
BEGIN
    IF arr IS NULL OR cardinality(arr) = 0 THEN RETURN TRUE; END IF;
    FOREACH v IN ARRAY arr LOOP
        IF NOT is_valid_vote_reason(v) THEN RETURN FALSE; END IF;
    END LOOP;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION all_valid_hex_colors(arr TEXT[])
RETURNS BOOLEAN AS $$
DECLARE v TEXT;
BEGIN
    IF arr IS NULL OR cardinality(arr) = 0 THEN RETURN TRUE; END IF;
    FOREACH v IN ARRAY arr LOOP
        IF v !~ '^#[0-9A-Fa-f]{6}$' THEN RETURN FALSE; END IF;
    END LOOP;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
