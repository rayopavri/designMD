ALTER TABLE "generation_jobs" ADD COLUMN "phase" text DEFAULT 'scrape_extract' NOT NULL;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "attempts" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "phase_payload" jsonb;