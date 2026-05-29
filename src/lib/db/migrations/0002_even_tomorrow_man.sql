ALTER TABLE "generation_jobs" ADD COLUMN IF NOT EXISTS "firecrawl_done_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN IF NOT EXISTS "gemini_extract_done_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN IF NOT EXISTS "design_md_done_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN IF NOT EXISTS "lint_done_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN IF NOT EXISTS "companion_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN IF NOT EXISTS "companion_done_at" timestamp with time zone;