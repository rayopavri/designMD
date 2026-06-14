/**
 * Validated environment variables.
 * Always import from here; never use process.env.X directly in app code.
 */
import { z } from 'zod';

const EnvSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // Storage (Supabase Storage — durable website screenshots for the detail hero).
  // Server-only; never expose the service-role key to the client.
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // Firebase Admin (server-side)
  FIREBASE_ADMIN_CREDENTIALS_B64: z.string().min(1).optional(),

  // Firebase client (NEXT_PUBLIC_*)
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1).optional(),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1).optional(),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1).optional(),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1).optional(),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1).optional(),

  // AI APIs
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  FIRECRAWL_API_KEY: z.string().min(1).optional(),

  // AI provider switch — temporary OpenRouter fallback for the Gemini calls
  // (see src/lib/ai/openrouter.ts). Default 'google' keeps the direct-Gemini
  // path untouched; set AI_PROVIDER='openrouter' + OPENROUTER_API_KEY to route
  // extraction/authoring through OpenRouter while the Google project is denied.
  AI_PROVIDER: z.enum(['google', 'openrouter']).default('google'),
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENROUTER_MODEL: z.string().min(1).default('google/gemini-3.5-flash'),
  OPENROUTER_REASONING_EFFORT: z.enum(['low', 'medium', 'high']).default('medium'),

  // Email
  RESEND_API_KEY: z.string().min(1).optional(),
  // Sender identity for transactional email (sign-in links, notifications).
  // Must be on a domain verified in Resend (SPF/DKIM/DMARC) or mail lands in
  // spam / is rejected. Change this once uiuxskills.com is verified.
  EMAIL_FROM: z.string().min(1).default('UIUXskills <hello@uiuxskills.com>'),

  // Rate limiting
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),

  // QStash (durable task queue — replaces fragile fire-and-forget on Vercel)
  QSTASH_TOKEN: z.string().min(1).optional(),
  QSTASH_CURRENT_SIGNING_KEY: z.string().min(1).optional(),
  QSTASH_NEXT_SIGNING_KEY: z.string().min(1).optional(),

  // Security
  RATE_LIMIT_SECRET: z.string().min(32).optional(),
  TAKEDOWN_SECRET: z.string().min(32).optional(),
  // Bearer token the Vercel Cron supervisor must present. When unset (local
  // dev), the supervisor route falls back to the internal task token so it
  // can still be invoked manually.
  CRON_SECRET: z.string().min(16).optional(),

  // Bulk-upload supervisor: max generation jobs (across all batches) the
  // dispatcher lets run concurrently. Bounds downstream API pressure
  // (Firecrawl / Gemini / Anthropic) and Vercel function fan-out.
  BULK_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(3),

  // Safe Browsing
  GOOGLE_SAFE_BROWSING_API_KEY: z.string().min(1).optional(),

  // Cloud Tasks (skip for local dev)
  INLINE_TASKS: z.coerce.boolean().default(true),
  // Feature flags
  FIRECRAWL_EXTRACT_ENABLED: z.coerce.boolean().default(false),
  INTERNAL_TASK_TOKEN: z.string().min(16).optional(),
  CLOUD_TASKS_QUEUE_GENERATOR: z.string().optional(),
  CLOUD_TASKS_QUEUE_DISCOVERY: z.string().optional(),
  GCP_PROJECT_ID: z.string().optional(),
  GCP_LOCATION: z.string().default('us-central1'),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

// Optional fields stay optional during Phase 1A so the app boots without
// every API key set. We'll tighten this as we wire each feature in.
// Treat empty strings as missing (Zod .optional() only accepts undefined).
const rawEnv = Object.fromEntries(
  Object.entries(process.env).map(([k, v]) => [k, v === '' ? undefined : v])
);
export const env = EnvSchema.parse(rawEnv);
export type Env = z.infer<typeof EnvSchema>;
