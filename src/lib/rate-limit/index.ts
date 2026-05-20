/**
 * Rate-limit gate for `/api/generate`.
 *
 * Three tiers (sliding window, persisted in Upstash Redis):
 *   - anonymous  → 3 generations per hour, keyed by IP
 *   - signed-in  → 10 generations per hour, keyed by userId
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
let _anonLimiter: Ratelimit | null = null;
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

function anonLimiter(): Ratelimit | null {
  const redis = client();
  if (!redis) return null;
  if (_anonLimiter) return _anonLimiter;
  _anonLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, '1 h'),
    analytics: true,
    prefix: 'rl:generate:anon',
  });
  return _anonLimiter;
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

  const limiter = anonLimiter();
  if (!limiter) {
    return { ok: true, retryAfter: 0, limit: Infinity, remaining: Infinity, tier: 'disabled' };
  }
  const ip = getClientIp(input.req);
  const r = await limiter.limit(ip);
  return {
    ok: r.success,
    retryAfter: r.success ? 0 : Math.max(0, Math.ceil((r.reset - Date.now()) / 1000)),
    limit: r.limit,
    remaining: r.remaining,
    tier: 'anonymous',
  };
}
