import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { env } from '@/lib/env';
import { getClientIp } from './ip';
import {
  EMAIL_ADDRESS_LIMIT,
  EMAIL_IP_LIMIT,
  emailRateLimitKey,
  rateLimitConfiguration,
} from './auth-email-policy';

export {
  EMAIL_ADDRESS_LIMIT,
  EMAIL_IP_LIMIT,
  emailRateLimitKey,
  normalizeEmailForRateLimit,
  rateLimitConfiguration,
} from './auth-email-policy';

export type EmailRateLimitResult =
  | { ok: true }
  | { ok: false; retryAfter: number; unavailable?: true };

let redis: Redis | null = null;
let ipLimiter: Ratelimit | null = null;
let emailLimiter: Ratelimit | null = null;
let warnedDisabled = false;

function unavailable(): EmailRateLimitResult {
  return { ok: false, retryAfter: 0, unavailable: true };
}

function getRedis(): Redis | null {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) return null;
  if (redis) return redis;
  redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
  return redis;
}

function getIpLimiter(redisClient: Redis): Ratelimit {
  if (ipLimiter) return ipLimiter;
  ipLimiter = new Ratelimit({
    redis: redisClient,
    limiter: Ratelimit.slidingWindow(EMAIL_IP_LIMIT.limit, EMAIL_IP_LIMIT.window),
    analytics: false,
    prefix: EMAIL_IP_LIMIT.prefix,
  });
  return ipLimiter;
}

function getEmailLimiter(redisClient: Redis): Ratelimit {
  if (emailLimiter) return emailLimiter;
  emailLimiter = new Ratelimit({
    redis: redisClient,
    limiter: Ratelimit.slidingWindow(EMAIL_ADDRESS_LIMIT.limit, EMAIL_ADDRESS_LIMIT.window),
    analytics: false,
    prefix: EMAIL_ADDRESS_LIMIT.prefix,
  });
  return emailLimiter;
}

function blocked(reset: number): EmailRateLimitResult {
  return { ok: false, retryAfter: Math.max(0, Math.ceil((reset - Date.now()) / 1000)) };
}

/** Applies independent per-IP and per-normalized-email magic-link limits. */
export async function rateLimitEmailLink(req: Request, email: string): Promise<EmailRateLimitResult> {
  const configuration = rateLimitConfiguration({
    nodeEnv: env.NODE_ENV,
    redisUrl: env.UPSTASH_REDIS_REST_URL,
    redisToken: env.UPSTASH_REDIS_REST_TOKEN,
    secret: env.RATE_LIMIT_SECRET,
  });

  if (configuration === 'disabled') {
    if (!warnedDisabled) {
      console.warn('[rate-limit:auth-email] Redis is not configured; local email-link limits are disabled.');
      warnedDisabled = true;
    }
    return { ok: true };
  }
  if (configuration === 'unavailable') return unavailable();

  try {
    const redisClient = getRedis();
    if (!redisClient || !env.RATE_LIMIT_SECRET) {
      return env.NODE_ENV === 'production' ? unavailable() : { ok: true };
    }

    const ip = await getIpLimiter(redisClient).limit(getClientIp(req));
    if (!ip.success) return blocked(ip.reset);

    const address = await getEmailLimiter(redisClient).limit(
      emailRateLimitKey(email, env.RATE_LIMIT_SECRET),
    );
    return address.success ? { ok: true } : blocked(address.reset);
  } catch (error) {
    console.error('[rate-limit:auth-email] limiter failed:', error);
    return env.NODE_ENV === 'production' ? unavailable() : { ok: true };
  }
}
