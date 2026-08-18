import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { isCronAuthorized } from './cron-auth';

function makeRequest(headers: Record<string, string>): Request {
  return new Request('https://uiuxskills.com/api/cron/warm-db', { headers });
}

function loadEnvironment(overrides: Record<string, string | undefined>) {
  const baseEnv = { ...process.env };
  for (const name of [
    'CRON_SECRET',
    'QSTASH_TOKEN',
    'QSTASH_CURRENT_SIGNING_KEY',
    'QSTASH_NEXT_SIGNING_KEY',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
  ]) {
    delete baseEnv[name];
  }

  return spawnSync(
    process.execPath,
    ['--import', 'tsx', '--input-type=module', '--eval', "await import('./src/lib/env.ts')"],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...baseEnv,
        DATABASE_URL: 'postgresql://localhost:5432/uiuxskills_test',
        ...overrides,
      },
    },
  );
}

describe('isCronAuthorized', () => {
  it('rejects production startup when CRON_SECRET is absent', () => {
    const result = loadEnvironment({ NODE_ENV: 'production' });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /CRON_SECRET/);
  });

  it('rejects production startup when Upstash rate-limit credentials are absent', () => {
    const result = loadEnvironment({
      NODE_ENV: 'production',
      CRON_SECRET: 'cron-secret-12345',
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /UPSTASH_REDIS_REST_URL/);
    assert.match(result.stderr, /UPSTASH_REDIS_REST_TOKEN/);
  });

  it('rejects startup when QSTASH_TOKEN lacks signing keys', () => {
    const result = loadEnvironment({
      NODE_ENV: 'development',
      QSTASH_TOKEN: 'qstash-token',
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /QSTASH_CURRENT_SIGNING_KEY/);
    assert.match(result.stderr, /QSTASH_NEXT_SIGNING_KEY/);
  });

  it('permits local and test startup without production-only credentials', () => {
    for (const nodeEnv of ['development', 'test']) {
      const result = loadEnvironment({ NODE_ENV: nodeEnv });

      assert.equal(result.status, 0, result.stderr);
    }
  });

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

  it('accepts a valid internal token when a configured bearer secret is wrong', () => {
    assert.equal(
      isCronAuthorized(
        makeRequest({
          authorization: 'Bearer wrong-secret',
          'x-internal-task-token': 'internal-token',
        }),
        {
          cronSecret: 'cron-secret',
          internalTaskToken: 'internal-token',
          allowInternalDevFallback: true,
          nodeEnv: 'development',
        },
      ),
      true,
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
