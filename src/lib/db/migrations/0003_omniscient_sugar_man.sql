ALTER TABLE "generation_jobs" ADD COLUMN IF NOT EXISTS "phase" text DEFAULT 'scrape_extract' NOT NULL;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN IF NOT EXISTS "attempts" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN IF NOT EXISTS "phase_payload" jsonb;