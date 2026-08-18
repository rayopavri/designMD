import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bulkRerunEnqueueFailureUpdate } from './bulk-rerun-failure';

describe('bulkRerunEnqueueFailureUpdate', () => {
  it('persists only a safe diagnostic for credential-bearing enqueue failures', () => {
    const credential = 'AKIA_TEST_ACCESS_KEY_1234567890';
    const error = Object.assign(
      new Error(`QStash rejected request body: {"prompt":"private prompt","token":"${credential}"}`),
      { code: credential },
    );

    const update = bulkRerunEnqueueFailureUpdate(error);

    assert.equal(update.status, 'failed');
    assert.equal(update.errorStep, 'enqueue');
    assert.equal(update.errorMessage, 'generation_error type=Error');
    assert.doesNotMatch(JSON.stringify(update), /private prompt|AKIA_TEST_ACCESS_KEY/i);
  });
});
