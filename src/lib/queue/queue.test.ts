import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertInternalTaskAuth } from './index';

describe('assertInternalTaskAuth', () => {
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
});
