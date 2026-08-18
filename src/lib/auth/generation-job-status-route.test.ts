import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getAuthorizedGenerationJobStatus,
  type GenerationJobStatusDependencies,
} from './generation-job-status-route';

const JOB_ID = '3d8dc1d8-2a47-4c1e-a7e9-024912f5ac02';

const job = {
  id: JOB_ID,
  url: 'https://example.com',
  status: 'completed',
  currentStep: 'ready_for_review',
  errorStep: null,
  errorMessage: null,
  resultBundleId: '2e7f7951-8dfb-4471-83a2-dc1d51f0cc64',
  createdAt: new Date('2026-08-18T00:00:00.000Z'),
  updatedAt: new Date(),
  companionStartedAt: null,
  companionDoneAt: null,
  userId: 'owner-user',
  anonToken: null,
} as const;

function dependencies(
  overrides: Partial<GenerationJobStatusDependencies> = {},
): GenerationJobStatusDependencies {
  return {
    findJob: async () => job,
    getViewer: async () => ({ userId: 'owner-user', anonToken: null }),
    findBundleSlug: async () => 'example',
    now: () => Date.now(),
    logLookupFailure: () => {},
    ...overrides,
  };
}

describe('GET /api/generate/[id]', () => {
  it('returns the job to its signed-in owner', async () => {
    const response = await getAuthorizedGenerationJobStatus(JOB_ID, dependencies());

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      jobId: JOB_ID,
      url: 'https://example.com',
      status: 'completed',
      currentStep: 'ready_for_review',
      errorMessage: null,
      errorStep: null,
      resultBundleId: '2e7f7951-8dfb-4471-83a2-dc1d51f0cc64',
      resultBundleSlug: 'example',
      createdAt: '2026-08-18T00:00:00.000Z',
      updatedAt: job.updatedAt.toJSON(),
      companionStartedAt: null,
      companionDoneAt: null,
    });
  });

  it('returns the same not-found response for another user or editor', async () => {
    const response = await getAuthorizedGenerationJobStatus(
      JOB_ID,
      dependencies({ getViewer: async () => ({ userId: 'editor-user', anonToken: null }) }),
    );

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'Not found' });
  });

  it('allows a matching anonymous browser but denies a mismatching one', async () => {
    const anonymousJob = { ...job, userId: null, anonToken: 'anon-owner' };
    const allowed = await getAuthorizedGenerationJobStatus(
      JOB_ID,
      dependencies({
        findJob: async () => anonymousJob,
        getViewer: async () => ({ userId: null, anonToken: 'anon-owner' }),
      }),
    );
    const denied = await getAuthorizedGenerationJobStatus(
      JOB_ID,
      dependencies({
        findJob: async () => anonymousJob,
        getViewer: async () => ({ userId: null, anonToken: 'anon-other' }),
      }),
    );

    assert.equal(allowed.status, 200);
    assert.equal(denied.status, 404);
    assert.deepEqual(await denied.json(), { error: 'Not found' });
  });

  it('makes missing and unauthorized jobs indistinguishable', async () => {
    const missing = await getAuthorizedGenerationJobStatus(
      JOB_ID,
      dependencies({ findJob: async () => null }),
    );
    const unauthorized = await getAuthorizedGenerationJobStatus(
      JOB_ID,
      dependencies({ getViewer: async () => ({ userId: 'other-user', anonToken: null }) }),
    );

    assert.equal(missing.status, 404);
    assert.equal(unauthorized.status, 404);
    assert.deepEqual(await missing.json(), await unauthorized.json());
  });

  it('returns a redacted service-unavailable response when status lookup fails', async () => {
    const diagnostics: string[] = [];
    const response = await getAuthorizedGenerationJobStatus(
      JOB_ID,
      dependencies({
        findJob: async () => {
          throw new Error('{"request":{"body":{"prompt":"private prompt"}}}');
        },
        logLookupFailure: (detail) => diagnostics.push(detail),
      }),
    );

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'generation_unavailable' });
    assert.deepEqual(diagnostics, ['generation_error type=Error']);
  });
});
