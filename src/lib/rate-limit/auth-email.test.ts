import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  EMAIL_ADDRESS_LIMIT,
  EMAIL_IP_LIMIT,
  emailRateLimitKey,
  rateLimitConfiguration,
} from './auth-email-policy';

describe('email-link rate limiting', () => {
  it('uses one HMAC key for case and whitespace variants of the same address', () => {
    const first = emailRateLimitKey('  Person@Example.COM ', 'test-rate-limit-secret');
    const second = emailRateLimitKey('person@example.com', 'test-rate-limit-secret');

    assert.equal(first, second);
    assert.doesNotMatch(first, /person@example\.com/i);
  });

  it('uses distinct Redis namespaces for the IP and email gates', () => {
    assert.notEqual(EMAIL_IP_LIMIT.prefix, EMAIL_ADDRESS_LIMIT.prefix);
    assert.equal(EMAIL_IP_LIMIT.limit, 5);
    assert.equal(EMAIL_IP_LIMIT.window, '10 m');
    assert.equal(EMAIL_ADDRESS_LIMIT.limit, 3);
    assert.equal(EMAIL_ADDRESS_LIMIT.window, '1 h');
  });

  it('allows the documented local-development fallback without Redis', () => {
    assert.equal(
      rateLimitConfiguration({ nodeEnv: 'development', redisUrl: undefined, redisToken: undefined, secret: undefined }),
      'disabled',
    );
  });

  it('fails closed when production Redis or the HMAC secret is absent', () => {
    assert.equal(
      rateLimitConfiguration({ nodeEnv: 'production', redisUrl: undefined, redisToken: undefined, secret: undefined }),
      'unavailable',
    );
    assert.equal(
      rateLimitConfiguration({
        nodeEnv: 'production',
        redisUrl: 'https://example.upstash.io',
        redisToken: 'token',
        secret: undefined,
      }),
      'unavailable',
    );
  });
});
