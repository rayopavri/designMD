CREATE TYPE "public"."bundle_status" AS ENUM('personal', 'pending_review', 'published', 'flagged', 'rejected', 'archived');--> statement-breakpoint
CREATE TYPE "public"."bundle_type" AS ENUM('design_md', 'skill', 'agent');--> statement-breakpoint
CREATE TYPE "public"."candidate_status" AS ENUM('unclassified', 'classified', 'auto_drafted', 'queued_for_review', 'approved', 'rejected', 'duplicate');--> statement-breakpoint
CREATE TYPE "public"."collection_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."generation_status" AS ENUM('queued', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('open', 'in_progress', 'completed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."verification_method" AS ENUM('auto_track_record', 'application_approved', 'editor_grant');--> statement-breakpoint
CREATE TABLE "abuse_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"ip_hash" text,
	"signal_type" text NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "banned_users" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"reason" text NOT NULL,
	"banned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"banned_by" uuid
);
--> statement-breakpoint
CREATE TABLE "bundle_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"normalized_url" text NOT NULL,
	"title" text,
	"description" text,
	"requested_by" uuid,
	"upvote_count" integer DEFAULT 1 NOT NULL,
	"voted_user_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"status" "request_status" DEFAULT 'open' NOT NULL,
	"completed_bundle_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bundle_requests_normalized_url_unique" UNIQUE("normalized_url")
);
--> statement-breakpoint
CREATE TABLE "bundle_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bundle_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"worked" boolean NOT NULL,
	"reason_tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_reason_tags" CHECK (all_valid_vote_reasons("bundle_votes"."reason_tags")),
	CONSTRAINT "chk_reason_requires_failure" CHECK ("bundle_votes"."worked" = TRUE OR array_length("bundle_votes"."reason_tags", 1) > 0)
);
--> statement-breakpoint
CREATE TABLE "bundles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"type" "bundle_type" DEFAULT 'design_md' NOT NULL,
	"design_md" text,
	"companion_prompt" text NOT NULL,
	"companion_prompt_version" integer DEFAULT 1 NOT NULL,
	"companion_prompt_updated_at" timestamp with time zone,
	"companion_prompt_updated_by" uuid,
	"coverage_score" integer,
	"coverage_colors" integer,
	"coverage_typography" integer,
	"coverage_layout" integer,
	"coverage_elevation" integer,
	"coverage_shapes" integer,
	"coverage_components" integer,
	"coverage_dos_donts" integer,
	"primary_category_id" uuid,
	"secondary_category_id" uuid,
	"design_style" text[] DEFAULT '{}'::text[] NOT NULL,
	"compatible_tools" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" "bundle_status" DEFAULT 'personal' NOT NULL,
	"is_curated" boolean DEFAULT false NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"created_by" uuid NOT NULL,
	"source_url" text,
	"source_url_normalized" text,
	"source_domain" text,
	"author_name" text,
	"author_email" text,
	"author_url" text,
	"license" text,
	"attribution_statement" text,
	"takedown_token" text,
	"takedown_claimed" boolean DEFAULT false NOT NULL,
	"claimed_by" uuid,
	"claimed_at" timestamp with time zone,
	"palette_colors" text[] DEFAULT '{}'::text[] NOT NULL,
	"brand_logo_url" text,
	"brand_initial" text,
	"brand_color" text,
	"vote_count" integer DEFAULT 0 NOT NULL,
	"positive_vote_count" integer DEFAULT 0 NOT NULL,
	"positive_vote_rate" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"copy_count" integer DEFAULT 0 NOT NULL,
	"download_count" integer DEFAULT 0 NOT NULL,
	"cli_install_count" integer DEFAULT 0 NOT NULL,
	"content_fingerprint" text,
	"verified_at" timestamp with time zone,
	"is_stale" boolean DEFAULT false NOT NULL,
	"submitted_at" timestamp with time zone,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "bundles_slug_unique" UNIQUE("slug"),
	CONSTRAINT "bundles_takedown_token_unique" UNIQUE("takedown_token"),
	CONSTRAINT "chk_coverage_score" CHECK ("bundles"."coverage_score" IS NULL OR ("bundles"."coverage_score" BETWEEN 0 AND 100)),
	CONSTRAINT "chk_coverage_colors" CHECK ("bundles"."coverage_colors" IS NULL OR ("bundles"."coverage_colors" BETWEEN 0 AND 100)),
	CONSTRAINT "chk_coverage_typography" CHECK ("bundles"."coverage_typography" IS NULL OR ("bundles"."coverage_typography" BETWEEN 0 AND 100)),
	CONSTRAINT "chk_coverage_layout" CHECK ("bundles"."coverage_layout" IS NULL OR ("bundles"."coverage_layout" BETWEEN 0 AND 100)),
	CONSTRAINT "chk_coverage_elevation" CHECK ("bundles"."coverage_elevation" IS NULL OR ("bundles"."coverage_elevation" BETWEEN 0 AND 100)),
	CONSTRAINT "chk_coverage_shapes" CHECK ("bundles"."coverage_shapes" IS NULL OR ("bundles"."coverage_shapes" BETWEEN 0 AND 100)),
	CONSTRAINT "chk_coverage_components" CHECK ("bundles"."coverage_components" IS NULL OR ("bundles"."coverage_components" BETWEEN 0 AND 100)),
	CONSTRAINT "chk_coverage_dos_donts" CHECK ("bundles"."coverage_dos_donts" IS NULL OR ("bundles"."coverage_dos_donts" BETWEEN 0 AND 100)),
	CONSTRAINT "chk_design_style" CHECK (all_valid_design_styles("bundles"."design_style")),
	CONSTRAINT "chk_compatible_tools" CHECK (all_valid_tools("bundles"."compatible_tools")),
	CONSTRAINT "chk_source_url" CHECK ("bundles"."source_url" IS NULL OR "bundles"."source_url" ~* '^https?://[^\s<>"{}|\\^`\[\]]+$'),
	CONSTRAINT "chk_palette_colors" CHECK (all_valid_hex_colors("bundles"."palette_colors"))
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	"level" integer NOT NULL,
	"color" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug"),
	CONSTRAINT "chk_level" CHECK ("categories"."level" IN (1, 2)),
	CONSTRAINT "chk_level2_has_parent" CHECK ("categories"."level" = 1 OR "categories"."parent_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "collection_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"bundle_id" uuid NOT NULL,
	"role" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "chk_role" CHECK ("collection_items"."role" IN ('design_md','skill','agent'))
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"primary_category_id" uuid,
	"design_style" text[] DEFAULT '{}'::text[] NOT NULL,
	"compatible_tools" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" "collection_status" DEFAULT 'draft' NOT NULL,
	"is_curated" boolean DEFAULT false NOT NULL,
	"copy_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collections_slug_unique" UNIQUE("slug"),
	CONSTRAINT "chk_col_design_style" CHECK (all_valid_design_styles("collections"."design_style"))
);
--> statement-breakpoint
CREATE TABLE "discovery_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"source_id" text NOT NULL,
	"source_url" text NOT NULL,
	"raw_content" text,
	"content_fingerprint" text,
	"author_name" text,
	"author_handle" text,
	"author_url" text,
	"author_email" text,
	"license" text,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"classified_at" timestamp with time zone,
	"is_safe" boolean,
	"is_relevant" boolean,
	"is_ai_generated" boolean,
	"content_quality" integer,
	"specificity_score" integer,
	"composite_score" integer,
	"suggested_category" text,
	"suggested_style" text[],
	"classifier_notes" text,
	"auto_drafted_at" timestamp with time zone,
	"draft_design_md" text,
	"draft_companion_prompt" text,
	"status" "candidate_status" DEFAULT 'unclassified' NOT NULL,
	"rejected_reason" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"promoted_to_bundle_id" uuid,
	CONSTRAINT "chk_source" CHECK ("discovery_candidates"."source" IN ('github','reddit','hackernews'))
);
--> statement-breakpoint
CREATE TABLE "discovery_source_state" (
	"source" text PRIMARY KEY NOT NULL,
	"last_run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_cursor" text,
	"last_run_status" text DEFAULT 'pending' NOT NULL,
	"items_found" integer DEFAULT 0 NOT NULL,
	"items_classified" integer DEFAULT 0 NOT NULL,
	"errors" text
);
--> statement-breakpoint
CREATE TABLE "domain_blocklist" (
	"domain" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"reason" text,
	"added_by" uuid,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text,
	CONSTRAINT "chk_blocklist_category" CHECK ("domain_blocklist"."category" IN ('nsfw','malware','spam','scrape_ban','manual'))
);
--> statement-breakpoint
CREATE TABLE "generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"normalized_url" text NOT NULL,
	"status" "generation_status" DEFAULT 'queued' NOT NULL,
	"current_step" text,
	"user_id" uuid NOT NULL,
	"existing_bundle_id" uuid,
	"is_update_requested" boolean DEFAULT false NOT NULL,
	"result_bundle_id" uuid,
	"error_message" text,
	"error_step" text,
	"compliance_passed" boolean,
	"compliance_blocked_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guardrail_rejections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow" text NOT NULL,
	"layer" text NOT NULL,
	"url" text,
	"candidate_id" uuid,
	"user_id" uuid,
	"reason" text NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_workflow" CHECK ("guardrail_rejections"."workflow" IN ('generator','discovery'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firebase_uid" text NOT NULL,
	"auth_provider" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"handle" text,
	"bio" text,
	"portfolio_url" text,
	"figma_profile_url" text,
	"dribbble_url" text,
	"behance_url" text,
	"linkedin_url" text,
	"preferred_tools" text[] DEFAULT '{}'::text[] NOT NULL,
	"preferred_style" text[] DEFAULT '{}'::text[] NOT NULL,
	"email_on_submission_decision" boolean DEFAULT true NOT NULL,
	"email_on_listing_claim" boolean DEFAULT true NOT NULL,
	"email_on_weekly_digest" boolean DEFAULT false NOT NULL,
	"is_editor" boolean DEFAULT false NOT NULL,
	"is_verified_creator" boolean DEFAULT false NOT NULL,
	"verification_method" "verification_method",
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_firebase_uid_unique" UNIQUE("firebase_uid"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_handle_unique" UNIQUE("handle"),
	CONSTRAINT "chk_auth_provider" CHECK ("users"."auth_provider" IN ('google','email')),
	CONSTRAINT "chk_preferred_tools" CHECK (all_valid_tools("users"."preferred_tools")),
	CONSTRAINT "chk_preferred_style" CHECK (all_valid_design_styles("users"."preferred_style"))
);
--> statement-breakpoint
CREATE TABLE "verification_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"portfolio_url" text NOT NULL,
	"bio" text NOT NULL,
	"profile_links" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"review_notes" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "verification_applications_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "chk_app_status" CHECK ("verification_applications"."status" IN ('pending','approved','rejected'))
);
--> statement-breakpoint
ALTER TABLE "abuse_signals" ADD CONSTRAINT "abuse_signals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "banned_users" ADD CONSTRAINT "banned_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "banned_users" ADD CONSTRAINT "banned_users_banned_by_users_id_fk" FOREIGN KEY ("banned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundle_requests" ADD CONSTRAINT "bundle_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundle_requests" ADD CONSTRAINT "bundle_requests_completed_bundle_id_bundles_id_fk" FOREIGN KEY ("completed_bundle_id") REFERENCES "public"."bundles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundle_votes" ADD CONSTRAINT "bundle_votes_bundle_id_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."bundles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundle_votes" ADD CONSTRAINT "bundle_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundles" ADD CONSTRAINT "bundles_companion_prompt_updated_by_users_id_fk" FOREIGN KEY ("companion_prompt_updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundles" ADD CONSTRAINT "bundles_primary_category_id_categories_id_fk" FOREIGN KEY ("primary_category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundles" ADD CONSTRAINT "bundles_secondary_category_id_categories_id_fk" FOREIGN KEY ("secondary_category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundles" ADD CONSTRAINT "bundles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundles" ADD CONSTRAINT "bundles_claimed_by_users_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundles" ADD CONSTRAINT "bundles_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_bundle_id_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."bundles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_primary_category_id_categories_id_fk" FOREIGN KEY ("primary_category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_candidates" ADD CONSTRAINT "discovery_candidates_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_candidates" ADD CONSTRAINT "discovery_candidates_promoted_to_bundle_id_bundles_id_fk" FOREIGN KEY ("promoted_to_bundle_id") REFERENCES "public"."bundles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_blocklist" ADD CONSTRAINT "domain_blocklist_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_existing_bundle_id_bundles_id_fk" FOREIGN KEY ("existing_bundle_id") REFERENCES "public"."bundles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_result_bundle_id_bundles_id_fk" FOREIGN KEY ("result_bundle_id") REFERENCES "public"."bundles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardrail_rejections" ADD CONSTRAINT "guardrail_rejections_candidate_id_discovery_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."discovery_candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardrail_rejections" ADD CONSTRAINT "guardrail_rejections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_applications" ADD CONSTRAINT "verification_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_applications" ADD CONSTRAINT "verification_applications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_abuse_user_date" ON "abuse_signals" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_votes_bundle_user" ON "bundle_votes" USING btree ("bundle_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_votes_bundle" ON "bundle_votes" USING btree ("bundle_id");--> statement-breakpoint
CREATE INDEX "idx_votes_user" ON "bundle_votes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bundles_status" ON "bundles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bundles_created_by" ON "bundles" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_bundles_status_creator" ON "bundles" USING btree ("status","created_by");--> statement-breakpoint
CREATE INDEX "idx_bundles_source_normalized" ON "bundles" USING btree ("source_url_normalized");--> statement-breakpoint
CREATE INDEX "idx_bundles_fingerprint" ON "bundles" USING btree ("content_fingerprint");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_collection_bundle" ON "collection_items" USING btree ("collection_id","bundle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_candidates_source" ON "discovery_candidates" USING btree ("source","source_id");--> statement-breakpoint
CREATE INDEX "idx_candidates_status" ON "discovery_candidates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_candidates_fingerprint" ON "discovery_candidates" USING btree ("content_fingerprint");--> statement-breakpoint
CREATE INDEX "idx_blocklist_category" ON "domain_blocklist" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_jobs_user" ON "generation_jobs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_jobs_normalized_url" ON "generation_jobs" USING btree ("normalized_url");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_firebase_uid" ON "users" USING btree ("firebase_uid");