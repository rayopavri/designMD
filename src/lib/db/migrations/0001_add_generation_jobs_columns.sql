CREATE TABLE "user_favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bundle_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bundles" ALTER COLUMN "created_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "generation_jobs" ALTER COLUMN "normalized_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "generation_jobs" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bundles" ADD COLUMN "companion_status" text DEFAULT 'ready' NOT NULL;--> statement-breakpoint
ALTER TABLE "bundles" ADD COLUMN "accessibility_notes" text;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "source_type" text DEFAULT 'url' NOT NULL;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "image_data" text;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "image_mime_type" text;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "image_hash" text;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "brand_name" text;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "anon_token" text;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "target_bundle_id" uuid;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "batch_id" uuid;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "auto_publish" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_favorites" ADD CONSTRAINT "user_favorites_bundle_id_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."bundles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_favorites" ADD CONSTRAINT "user_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_favorites_bundle_user" ON "user_favorites" USING btree ("bundle_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_favorites_bundle" ON "user_favorites" USING btree ("bundle_id");--> statement-breakpoint
CREATE INDEX "idx_favorites_user" ON "user_favorites" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_target_bundle_id_bundles_id_fk" FOREIGN KEY ("target_bundle_id") REFERENCES "public"."bundles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_jobs_image_hash" ON "generation_jobs" USING btree ("image_hash","user_id");--> statement-breakpoint
CREATE INDEX "idx_jobs_batch_id" ON "generation_jobs" USING btree ("batch_id");