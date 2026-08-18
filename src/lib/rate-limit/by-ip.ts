/**
 * Generic per-IP rate limiter for unauthenticated / cheap-but-abusable
 * endpoints (search, export, job-status polling).
 *
 * Separate from the /api/generate gate in ./index.ts: that one has bespoke
 * tiering (anon/signed-in/editor) tied to the generation pipeline's cost. This
 * helper is a plain per-IP sliding window any GET route can drop in front of
 * itself to blunt scripted hammering.
 *
 * Local development can run without Redis. Production fails closed when Redis
 * is absent or unavailable so public endpoints never become unmetered.
 */
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { env } from '@/lib/env';
import { getClientIp } from './ip';
import { redisRateLimitConfiguration } from './config';

export interface IpRateLimitResult {
  ok: boolean;
  /** Seconds until the next request is allowed (0 when ok). */
  retryAfter: number;
  limit: number;
  remaining: number;
  unavailable?: true;
}

let _redis: Redis | null = null;
let _warnedDisabled = false;
const _limiters = new Map<string, Ratelimit>();

function client(): Redis | null {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) return null;
  if (_redis) return _redis;
  _redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL!,
    token: env.UPSTASH_REDIS_REST_TOKEN!,
  });
  return _redis;
}

export interface IpRateLimitOptions {
  /** Max requests allowed per window. */
  limit: number;
  /** Sliding window duration, e.g. '1 m', '1 h'. */
  window: `${number} ${'s' | 'm' | 'h' | 'd'}`;
  /** Redis key prefix — unique per endpoint so windows don't collide. */
  prefix: string;
}

function limiterFor(opts: IpRateLimitOptions): Ratelimit | null {
  const redis = client();
  if (!redis) return null;
  const cacheKey = `${opts.prefix}:${opts.limit}:${opts.window}`;
  const existing = _limiters.get(cacheKey);
  if (existing) return existing;
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(opts.limit, opts.window),
    analytics: false,
    prefix: opts.prefix,
  });
  _limiters.set(cacheKey, limiter);
  return limiter;
}

/**
 * Consume one token from the per-IP window for this endpoint. Returns
 * `{ ok: true }` (allow) when Upstash isn't configured.
 */
export async function rateLimitByIp(
  req: Request,
  opts: IpRateLimitOptions,
): Promise<IpRateLimitResult> {
  const configuration = redisRateLimitConfiguration({
    nodeEnv: env.NODE_ENV,
    redisUrl: env.UPSTASH_REDIS_REST_URL,
    redisToken: env.UPSTASH_REDIS_REST_TOKEN,
  });
  if (configuration === 'unavailable') {
    return { ok: false, retryAfter: 0, limit: 0, remaining: 0, unavailable: true };
  }
  if (configuration === 'disabled') {
    if (!_warnedDisabled) {
      console.warn(
        '[rate-limit:by-ip] UPSTASH_REDIS_REST_URL/TOKEN not set — per-IP rate limiting disabled locally.',
      );
      _warnedDisabled = true;
    }
    return { ok: true, retryAfter: 0, limit: opts.limit, remaining: opts.limit };
  }

  const limiter = limiterFor(opts);
  if (!limiter) {
    return env.NODE_ENV === 'production'
      ? { ok: false, retryAfter: 0, limit: 0, remaining: 0, unavailable: true }
      : { ok: true, retryAfter: 0, limit: opts.limit, remaining: opts.limit };
  }
  try {
    const r = await limiter.limit(getClientIp(req));
    return {
      ok: r.success,
      retryAfter: r.success ? 0 : Math.max(0, Math.ceil((r.reset - Date.now()) / 1000)),
      limit: r.limit,
      remaining: r.remaining,
    };
  } catch (error) {
    console.error('[rate-limit:by-ip] limiter failed:', error);
    return env.NODE_ENV === 'production'
      ? { ok: false, retryAfter: 0, limit: 0, remaining: 0, unavailable: true }
      : { ok: true, retryAfter: 0, limit: opts.limit, remaining: opts.limit };
  }
}

/** Standard 429 JSON response for a blocked per-IP request. */
export function tooManyRequests(result: IpRateLimitResult): Response {
  if (result.unavailable) {
    return new Response(JSON.stringify({ error: 'rate_limit_unavailable' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({ error: 'rate_limited', retryAfter: result.retryAfter }), {
    status: 429,
    headers: {
      'content-type': 'application/json',
      'Retry-After': String(result.retryAfter),
      'X-RateLimit-Limit': String(result.limit),
      'X-RateLimit-Remaining': String(result.remaining),
    },
  });
}
