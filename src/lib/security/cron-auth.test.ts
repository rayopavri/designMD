import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isCronAuthorized } from './cron-auth';

function makeRequest(headers: Record<string, string>): Request {
  return new Request('https://uiuxskills.com/api/cron/warm-db', { headers });
}

describe('isCronAuthorized', () => {
  it('accepts the correct bearer cron secret', () => {
    assert.equal(
      isCronAuthorized(makeRequest({ authorization: 'Bearer cron-secret' }), {
        cronSecret: 'cron-secret',
        allowInternalDevFallback: false,
        nodeEnv: 'production',
      }),
      true,
    );
  });

  it('rejects a wrong bearer secret', () => {
    assert.equal(
      isCronAuthorized(makeRequest({ authorization: 'Bearer wrong-secret' }), {
        cronSecret: 'cron-secret',
        internalTaskToken: 'internal-token',
        allowInternalDevFallback: true,
        nodeEnv: 'development',
      }),
      false,
    );
  });

  it('rejects production requests when the cron secret is missing', () => {
    assert.equal(
      isCronAuthorized(makeRequest({ 'x-internal-task-token': 'internal-token' }), {
        internalTaskToken: 'internal-token',
        allowInternalDevFallback: true,
        nodeEnv: 'production',
      }),
      false,
    );
  });

  it('allows the internal task token fallback in local development', () => {
    assert.equal(
      isCronAuthorized(makeRequest({ 'x-internal-task-token': 'internal-token' }), {
        internalTaskToken: 'internal-token',
        allowInternalDevFallback: true,
        nodeEnv: 'development',
      }),
      true,
    );
  });

  it('rejects a wrong internal task token', () => {
    assert.equal(
      isCronAuthorized(makeRequest({ 'x-internal-task-token': 'wrong-token' }), {
        internalTaskToken: 'internal-token',
        allowInternalDevFallback: true,
        nodeEnv: 'development',
      }),
      false,
    );
  });
});
