CREATE TABLE IF NOT EXISTS "user_favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bundle_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bundles" ALTER COLUMN "created_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "generation_jobs" ALTER COLUMN "normalized_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "generation_jobs" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bundles" ADD COLUMN IF NOT EXISTS "companion_status" text DEFAULT 'ready' NOT NULL;--> statement-breakpoint
ALTER TABLE "bundles" ADD COLUMN IF NOT EXISTS "accessibility_notes" text;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN IF NOT EXISTS "source_type" text DEFAULT 'url' NOT NULL;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN IF NOT EXISTS "image_data" text;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN IF NOT EXISTS "image_mime_type" text;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN IF NOT EXISTS "image_hash" text;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN IF NOT EXISTS "brand_name" text;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN IF NOT EXISTS "anon_token" text;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN IF NOT EXISTS "target_bundle_id" uuid;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN IF NOT EXISTS "batch_id" uuid;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN IF NOT EXISTS "auto_publish" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "user_favorites" ADD CONSTRAINT "user_favorites_bundle_id_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."bundles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "user_favorites" ADD CONSTRAINT "user_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_favorites_bundle_user" ON "user_favorites" USING btree ("bundle_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_favorites_bundle" ON "user_favorites" USING btree ("bundle_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_favorites_user" ON "user_favorites" USING btree ("user_id");--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_target_bundle_id_bundles_id_fk" FOREIGN KEY ("target_bundle_id") REFERENCES "public"."bundles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_image_hash" ON "generation_jobs" USING btree ("image_hash","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_batch_id" ON "generation_jobs" USING btree ("batch_id");
