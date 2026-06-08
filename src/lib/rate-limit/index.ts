/**
 * Rate-limit gate for `/api/generate`.
 *
 * Three tiers, persisted in Upstash Redis:
 *   - anonymous  → ONE free generation per browser (for the ~30d lifetime of
 *                  the __anon_id cookie), keyed by that cookie (falls back to
 *                  IP if the cookie is somehow absent). The gate is *peeked*
 *                  here and only *consumed* (markFreeGenerationUsed) once a job
 *                  is actually created, so a 400/409 doesn't burn the free run.
 *                  After that the UI prompts sign-in.
 *   - signed-in  → 10 generations per hour (sliding window), keyed by userId
 *   - editor     → unlimited (rate limit not applied)
 *
 * Graceful degradation: if UPSTASH_* env vars are unset (e.g. local
 * dev without Upstash configured), the helper logs a one-time warning
 * and allows every request. This avoids blocking development; the
 * production deploy has the env vars set.
 *
 * Upstash free tier: 10,000 commands/day — easily covers thousands of
 * generation attempts (each check is 1-2 commands).
 */
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { env } from '@/lib/env';
import { getClientIp } from './ip';

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the next request is allowed (0 when ok). */
  retryAfter: number;
  /** Total requests allowed in the current window. */
  limit: number;
  /** Requests remaining in the current window. */
  remaining: number;
  /** Which tier applied — useful for debug / 429 response. */
  tier: 'anonymous' | 'signed-in' | 'editor' | 'disabled';
}

let _redis: Redis | null = null;
let _signedInLimiter: Ratelimit | null = null;
let _warnedDisabled = false;

function isConfigured(): boolean {
  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}

function client(): Redis | null {
  if (!isConfigured()) return null;
  if (_redis) return _redis;
  _redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL!,
    token: env.UPSTASH_REDIS_REST_TOKEN!,
  });
  return _redis;
}

// ─── Anonymous one-free-generation gate ──────────────────────────────────
// A single free generation per browser, tracked by a plain Redis key (not a
// sliding window) so it acts as a one-time gate. The 30-day TTL matches the
// __anon_id cookie lifetime (src/lib/auth/anon-token.ts), so the free run
// resets only when the cookie itself expires.
const ANON_FREE_PREFIX = 'rl:generate:anon-free';
const ANON_FREE_TTL_SECONDS = 30 * 24 * 60 * 60;

function anonFreeKey(anonToken: string | null, req: Request): string {
  // Key on the per-browser cookie so an IP change can't reset the gate; fall
  // back to IP only when the cookie is somehow absent.
  return `${ANON_FREE_PREFIX}:${anonToken ?? `ip:${getClientIp(req)}`}`;
}

/**
 * Peek whether this browser has already used its one free generation.
 * Non-consuming. Returns false (allow) when Redis isn't configured.
 */
export async function hasUsedFreeGeneration(
  anonToken: string | null,
  req: Request,
): Promise<boolean> {
  const redis = client();
  if (!redis) return false;
  const used = await redis.get(anonFreeKey(anonToken, req));
  return used != null;
}

/**
 * Consume this browser's one free generation. Call only after a job has
 * actually been created, so a validation 400 / dedupe 409 doesn't burn it.
 * SET NX so concurrent first-requests don't double-count.
 */
export async function markFreeGenerationUsed(
  anonToken: string | null,
  req: Request,
): Promise<void> {
  const redis = client();
  if (!redis) return;
  await redis.set(anonFreeKey(anonToken, req), Date.now(), {
    nx: true,
    ex: ANON_FREE_TTL_SECONDS,
  });
}

function signedInLimiter(): Ratelimit | null {
  const redis = client();
  if (!redis) return null;
  if (_signedInLimiter) return _signedInLimiter;
  _signedInLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 h'),
    analytics: true,
    prefix: 'rl:generate:user',
  });
  return _signedInLimiter;
}

export interface RateLimitInput {
  req: Request;
  userId: string | null;
  isEditor: boolean;
  /** The visitor's __anon_id cookie value (null for signed-in users). Used to
   * key the anonymous one-free-generation gate per browser rather than per IP. */
  anonToken: string | null;
}

export async function rateLimitGenerate(input: RateLimitInput): Promise<RateLimitResult> {
  // Editors are unmetered — they do curation work that may involve many
  // generations.
  if (input.isEditor) {
    return { ok: true, retryAfter: 0, limit: Infinity, remaining: Infinity, tier: 'editor' };
  }

  if (!isConfigured()) {
    if (!_warnedDisabled) {
      console.warn(
        '[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN not set — rate limiting disabled. Set both env vars to enable.',
      );
      _warnedDisabled = true;
    }
    return { ok: true, retryAfter: 0, limit: Infinity, remaining: Infinity, tier: 'disabled' };
  }

  if (input.userId) {
    const limiter = signedInLimiter();
    if (!limiter) {
      return { ok: true, retryAfter: 0, limit: Infinity, remaining: Infinity, tier: 'disabled' };
    }
    const r = await limiter.limit(input.userId);
    return {
      ok: r.success,
      retryAfter: r.success ? 0 : Math.max(0, Math.ceil((r.reset - Date.now()) / 1000)),
      limit: r.limit,
      remaining: r.remaining,
      tier: 'signed-in',
    };
  }

  // Anonymous: one free generation per browser. Peek only — the route consumes
  // it (markFreeGenerationUsed) after a job is actually created, so a 400/409
  // doesn't burn the free run.
  const used = await hasUsedFreeGeneration(input.anonToken, input.req);
  return used
    ? { ok: false, retryAfter: 0, limit: 1, remaining: 0, tier: 'anonymous' }
    : { ok: true, retryAfter: 0, limit: 1, remaining: 1, tier: 'anonymous' };
}
