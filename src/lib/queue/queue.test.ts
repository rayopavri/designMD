import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertInternalTaskAuth, canUseInlineDispatch } from './index';

const productionEnvironment = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://localhost:5432/uiuxskills_test',
  CRON_SECRET: 'cron-secret-for-queue-tests',
  UPSTASH_REDIS_REST_URL: 'https://redis.example.test',
  UPSTASH_REDIS_REST_TOKEN: 'redis-token-for-queue-tests',
  RATE_LIMIT_SECRET: 'rate-limit-secret-for-queue-tests-123456',
  QSTASH_TOKEN: 'qstash-token-for-queue-tests',
  QSTASH_CURRENT_SIGNING_KEY: 'current-signing-key-for-queue-tests',
  QSTASH_NEXT_SIGNING_KEY: 'next-signing-key-for-queue-tests',
  INLINE_TASKS: 'false',
  INTERNAL_TASK_TOKEN: 'internal-token-for-queue-tests',
};

function runWithEnvironment(
  source: string,
  overrides: Record<string, string | undefined> = {},
) {
  const childEnv = {
    ...process.env,
    ...productionEnvironment,
    ...overrides,
  } as NodeJS.ProcessEnv;
  for (const [name, value] of Object.entries(childEnv)) {
    if (value === undefined) delete childEnv[name];
  }

  return spawnSync(
    process.execPath,
    ['--import', 'tsx', '--input-type=module', '--eval', source],
    { cwd: process.cwd(), encoding: 'utf8', env: childEnv },
  );
}

describe('assertInternalTaskAuth', () => {
  it('allows inline dispatch only outside production', () => {
    assert.equal(canUseInlineDispatch('development', true), true);
    assert.equal(canUseInlineDispatch('test', true), true);
    assert.equal(canUseInlineDispatch('production', true), false);
    assert.equal(canUseInlineDispatch('production', false), false);
  });

  it('throws 401 when token is missing', () => {
    const req = new Request('https://example.com', {
      headers: {},
    });

    try {
      assertInternalTaskAuth(req);
      assert.fail('expected a Response to be thrown');
    } catch (err) {
      assert.ok(err instanceof Response);
      assert.equal((err as Response).status, 401);
    }
  });

  it('throws 401 when token is wrong', () => {
    const req = new Request('https://example.com', {
      headers: { 'x-internal-task-token': 'wrong-token' },
    });

    try {
      assertInternalTaskAuth(req);
      assert.fail('expected a Response to be thrown');
    } catch (err) {
      assert.ok(err instanceof Response);
      assert.equal((err as Response).status, 401);
    }
  });

  it('returns when token matches', () => {
    const req = new Request('https://example.com', {
      headers: { 'x-internal-task-token': 'test-internal-token-123' },
    });

    assert.doesNotThrow(() => assertInternalTaskAuth(req));
  });

  it('rejects production startup without QStash even when inline tasks are requested', () => {
    const result = runWithEnvironment("await import('./src/lib/env.ts')", {
      QSTASH_TOKEN: undefined,
      QSTASH_CURRENT_SIGNING_KEY: undefined,
      QSTASH_NEXT_SIGNING_KEY: undefined,
      INLINE_TASKS: 'true',
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /QSTASH_TOKEN/);
  });

  it('rejects INLINE_TASKS=true in production even with QStash credentials', () => {
    const result = runWithEnvironment("await import('./src/lib/env.ts')", {
      INLINE_TASKS: 'true',
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /INLINE_TASKS/);
  });

  it('accepts an explicit false INLINE_TASKS production setting', () => {
    const result = runWithEnvironment(`
      const { env } = await import('./src/lib/env.ts');
      process.exitCode = env.INLINE_TASKS === false ? 0 : 1;
    `);

    assert.equal(result.status, 0, result.stderr);
  });

  it('rejects the internal worker token in production', () => {
    const result = runWithEnvironment(`
      const { assertTaskAuth } = await import('./src/lib/queue/index.ts');
      const req = new Request('https://uiuxskills.com/api/internal/tasks/scrape-and-extract', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-task-token': 'internal-token-for-queue-tests',
        },
        body: '{}',
      });
      try {
        await assertTaskAuth(req);
        process.exitCode = 1;
      } catch (error) {
        process.exitCode = error instanceof Response && error.status === 401 ? 0 : 2;
      }
    `);

    assert.equal(result.status, 0, result.stderr);
  });

  it('uses signature verification rather than the internal token in production', () => {
    const result = runWithEnvironment(`
      const { assertTaskAuth } = await import('./src/lib/queue/index.ts');
      const req = new Request('https://uiuxskills.com/api/internal/tasks/scrape-and-extract', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'upstash-signature': 'invalid-signature',
          'x-internal-task-token': 'internal-token-for-queue-tests',
        },
        body: '{}',
      });
      try {
        await assertTaskAuth(req);
        process.exitCode = 1;
      } catch (error) {
        process.exitCode = error instanceof Response && error.status === 401 ? 0 : 2;
      }
    `);

    assert.equal(result.status, 0, result.stderr);
  });
});
