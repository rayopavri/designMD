/**
 * Rate-limit gate for `/api/generate`.
 *
 * Three tiers, persisted in Upstash Redis:
 *   - anonymous  → hard ceiling of 3 generations per hour, keyed by client IP
 *                  (sliding window). This is the real abuse gate — it cannot be
 *                  reset by the client. Layered on top is a one-free-generation
 *                  UX gate, ALSO keyed by IP: after the first successful run the
 *                  UI prompts sign-in, but even without the cookie an attacker
 *                  can't exceed the 3/hour IP ceiling. The free-gen gate is
 *                  *peeked* here and only *consumed* (markFreeGenerationUsed)
 *                  once a job is actually created, so a 400/409 doesn't burn it.
 *   - signed-in  → 10 generations per hour (sliding window), keyed by userId
 *   - editor     → unlimited (rate limit not applied)
 *
 * Why IP, not the __anon_id cookie: the cookie is minted fresh whenever it is
 * absent (see getOrCreateAnonToken), so keying the limit on it let an attacker
 * reset the counter every request simply by not sending the cookie — unlimited
 * anonymous generations, each burning a Firecrawl + Gemini + Claude call. On
 * Vercel `x-forwarded-for` is platform-controlled, so IP is a trustworthy key.
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
let _anonIpLimiter: Ratelimit | null = null;
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
// A single free generation per client IP, tracked by a plain Redis key (not a
// sliding window) so it acts as a one-time UX gate that prompts sign-in after
// the first run. Keyed on IP rather than the __anon_id cookie: the cookie is
// re-minted whenever absent, so a cookie key could be reset every request. The
// 30-day TTL keeps the "you've used your free run" state around roughly as long
// as the anon cookie would have lived.
const ANON_FREE_PREFIX = 'rl:generate:anon-free';
const ANON_FREE_TTL_SECONDS = 30 * 24 * 60 * 60;

function anonFreeKey(req: Request): string {
  return `${ANON_FREE_PREFIX}:ip:${getClientIp(req)}`;
}

/**
 * Peek whether this client has already used its one free generation.
 * Non-consuming. Returns false (allow) when Redis isn't configured.
 */
export async function hasUsedFreeGeneration(req: Request): Promise<boolean> {
  const redis = client();
  if (!redis) return false;
  const used = await redis.get(anonFreeKey(req));
  return used != null;
}

/**
 * Consume this client's one free generation. Call only after a job has
 * actually been created, so a validation 400 / dedupe 409 doesn't burn it.
 * SET NX so concurrent first-requests don't double-count.
 */
export async function markFreeGenerationUsed(req: Request): Promise<void> {
  const redis = client();
  if (!redis) return;
  await redis.set(anonFreeKey(req), Date.now(), {
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

// Hard ceiling for anonymous traffic — 3 generations per hour per client IP.
// This is the enforcement layer that can't be reset by the client (unlike the
// __anon_id cookie). The one-free-generation gate sits on top as a UX nudge.
function anonIpLimiter(): Ratelimit | null {
  const redis = client();
  if (!redis) return null;
  if (_anonIpLimiter) return _anonIpLimiter;
  _anonIpLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, '1 h'),
    analytics: true,
    prefix: 'rl:generate:anon-ip',
  });
  return _anonIpLimiter;
}

export interface RateLimitInput {
  req: Request;
  userId: string | null;
  isEditor: boolean;
  /** The visitor's __anon_id cookie value (null for signed-in users). Retained
   * for attribution/claiming; the rate-limit gates key on client IP, not this. */
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

  // Anonymous: enforce the hard per-IP ceiling FIRST (3/hour). This is the
  // real abuse gate — the client can't reset it. slidingWindow.limit() is
  // consuming, so only call it on the anonymous path.
  const ipLimiter = anonIpLimiter();
  if (ipLimiter) {
    const r = await ipLimiter.limit(`ip:${getClientIp(input.req)}`);
    if (!r.success) {
      return {
        ok: false,
        retryAfter: Math.max(0, Math.ceil((r.reset - Date.now()) / 1000)),
        limit: r.limit,
        remaining: r.remaining,
        tier: 'anonymous',
      };
    }
  }

  // One free generation per IP (UX nudge to sign in). Peek only — the route
  // consumes it (markFreeGenerationUsed) after a job is actually created, so a
  // 400/409 doesn't burn the free run.
  const used = await hasUsedFreeGeneration(input.req);
  return used
    ? { ok: false, retryAfter: 0, limit: 1, remaining: 0, tier: 'anonymous' }
    : { ok: true, retryAfter: 0, limit: 1, remaining: 1, tier: 'anonymous' };
}
