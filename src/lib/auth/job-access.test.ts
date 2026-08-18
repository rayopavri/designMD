import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canReadGenerationJob,
  publicGenerationError,
  publicGenerationJobStatus,
  safeGenerationErrorDetail,
} from './job-access';

describe('canReadGenerationJob', () => {
  it('allows a signed-in owner to read their own job', () => {
    assert.equal(
      canReadGenerationJob(
        { userId: 'user-owner', anonToken: null },
        { userId: 'user-owner', anonToken: null },
      ),
      true,
    );
  });

  it('denies another signed-in user, including an editor, access to an owned job', () => {
    assert.equal(
      canReadGenerationJob(
        { userId: 'user-owner', anonToken: null },
        { userId: 'user-editor', anonToken: null },
      ),
      false,
    );
  });

  it('allows an anonymous job only to the browser with its matching anonymous token', () => {
    assert.equal(
      canReadGenerationJob(
        { userId: null, anonToken: 'anon-owner' },
        { userId: null, anonToken: 'anon-owner' },
      ),
      true,
    );
  });

  it('preserves an anonymous job read while that same browser signs in', () => {
    assert.equal(
      canReadGenerationJob(
        { userId: null, anonToken: 'anon-owner' },
        { userId: 'user-now-signed-in', anonToken: 'anon-owner' },
      ),
      true,
    );
  });

  it('denies missing and mismatched anonymous credentials', () => {
    const job = { userId: null, anonToken: 'anon-owner' };

    assert.equal(canReadGenerationJob(job, { userId: null, anonToken: null }), false);
    assert.equal(canReadGenerationJob(job, { userId: null, anonToken: 'anon-other' }), false);
    assert.equal(
      canReadGenerationJob({ userId: null, anonToken: null }, { userId: null, anonToken: null }),
      false,
    );
  });
});

describe('public generation job status', () => {
  const job = {
    id: '3d8dc1d8-2a47-4c1e-a7e9-024912f5ac02',
    url: 'https://example.com',
    status: 'failed',
    currentStep: 'extracting',
    errorStep: 'extracting',
    errorMessage:
      'Google provider failed: https://user:super-secret@example.test/?api_key=top-secret\n at worker.ts:14',
    resultBundleId: null,
    createdAt: new Date('2026-08-18T00:00:00.000Z'),
    updatedAt: new Date('2026-08-18T00:00:01.000Z'),
    companionStartedAt: null,
    companionDoneAt: null,
  } as const;

  it('returns null for a missing job so callers can use one not-found outcome', () => {
    assert.equal(publicGenerationJobStatus(null, { resultBundleSlug: null }), null);
  });

  it('preserves queued, running, and completed states without an error payload', () => {
    for (const status of ['queued', 'running', 'completed'] as const) {
      const result = publicGenerationJobStatus({ ...job, status, errorMessage: null, errorStep: null }, {
        resultBundleSlug: 'example',
      });

      assert.equal(result?.status, status);
      assert.equal(result?.errorMessage, null);
      assert.equal(result?.errorStep, null);
    }
  });

  it('redacts stored provider and stack details for a failed job', () => {
    const result = publicGenerationJobStatus(job, { resultBundleSlug: null });

    assert.equal(result?.status, 'failed');
    assert.equal(result?.errorStep, 'generation_failed');
    assert.equal(result?.errorMessage, 'generation_failed');
    assert.doesNotMatch(JSON.stringify(result), /super-secret|top-secret|worker\.ts|provider failed/i);
  });

  it('never exposes userinfo from a legacy stored job URL', () => {
    const result = publicGenerationJobStatus(
      { ...job, url: 'https://legacy-user:legacy-password@example.com/private?keep=value' },
      { resultBundleSlug: null },
    );

    assert.equal(result?.url, 'https://example.com/private?keep=value');
    assert.doesNotMatch(JSON.stringify(result), /legacy-user|legacy-password/);
  });

  it('uses stable public error codes for timeout and blocked-site failures', () => {
    assert.equal(publicGenerationError('failed', 'watchdog'), 'generation_timed_out');
    assert.equal(publicGenerationError('failed', 'scraping-blocked'), 'site_blocks_automation');
    assert.equal(publicGenerationError('failed', 'extracting'), 'generation_failed');
    assert.equal(publicGenerationError('running', 'extracting'), 'generation_failed');
  });

  it('returns an allowlisted diagnostic without retaining credential-bearing error text', () => {
    assert.equal(
      safeGenerationErrorDetail(
        new Error(
          'Postgres error for postgresql://admin:database-secret@db.example/test?password=query-secret; Bearer bearer-secret',
        ),
      ),
      'generation_error type=Error',
    );
  });

  it('does not retain provider prompt, request, content, URL, or authorization payloads', () => {
    const providerPayload = JSON.stringify({
      prompt: 'proprietary prompt text',
      request: {
        url: 'https://provider.example/v1/generate',
        body: { content: 'private source content' },
        headers: { authorization: 'Bearer provider-token' },
      },
      response: { content: 'model response content' },
    });

    const detail = safeGenerationErrorDetail(new Error(providerPayload));

    assert.equal(detail, 'generation_error type=Error');
    assert.doesNotMatch(detail, /prompt|request|content|provider\.example|provider-token/i);
  });

  it('does not retain an uppercase credential-shaped error code', () => {
    const credentialShapedCode = 'AKIA_TEST_ACCESS_KEY_1234567890';
    const error = Object.assign(new Error('provider request failed'), {
      code: credentialShapedCode,
    });

    const detail = safeGenerationErrorDetail(error);

    assert.equal(detail, 'generation_error type=Error');
    assert.doesNotMatch(detail, new RegExp(credentialShapedCode));
  });
});
