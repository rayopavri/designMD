import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { safeInternalPath } from './redirects';

describe('safeInternalPath', () => {
  it('accepts same-origin relative paths and the root path', () => {
    assert.equal(safeInternalPath('/account?tab=bundles', '/'), '/account?tab=bundles');
    assert.equal(safeInternalPath('/', '/account'), '/');
  });

  it('rejects protocol-relative, absolute, and javascript URLs', () => {
    for (const value of ['//evil.example', '/\\evil.example', 'https://evil.example', 'javascript:alert(1)']) {
      assert.equal(safeInternalPath(value, '/account'), '/account', value);
    }
  });

  it('rejects control characters', () => {
    assert.equal(safeInternalPath('/account\nnext', '/'), '/');
    assert.equal(safeInternalPath('/account\u0000next', '/'), '/');
  });
});
