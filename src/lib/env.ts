/**
 * Validated environment variables.
 * Always import from here; never use process.env.X directly in app code.
 */
import { z } from 'zod';

const EnvSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

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
  OPENROUTER_API_KEY: z.string().optional(),

  // Email
  RESEND_API_KEY: z.string().min(1).optional(),

  // Rate limiting
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),

  // Security
  RATE_LIMIT_SECRET: z.string().min(32).optional(),
  TAKEDOWN_SECRET: z.string().min(32).optional(),

  // Safe Browsing
  GOOGLE_SAFE_BROWSING_API_KEY: z.string().min(1).optional(),

  // Cloud Tasks (skip for local dev)
  INLINE_TASKS: z.coerce.boolean().default(true),
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
