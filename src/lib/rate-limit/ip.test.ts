import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getClientIp } from './ip';

function makeReq(headers: Record<string, string>): Request {
  return new Request('https://example.com', { headers });
}

describe('getClientIp', () => {
  it('reads the first entry from x-forwarded-for', () => {
    const req = makeReq({ 'x-forwarded-for': '203.0.113.1, 70.41.3.18, 150.172.238.178' });
    assert.equal(getClientIp(req), '203.0.113.1');
  });

  it('trims whitespace from x-forwarded-for entries', () => {
    const req = makeReq({ 'x-forwarded-for': '  203.0.113.1  , 70.41.3.18' });
    assert.equal(getClientIp(req), '203.0.113.1');
  });

  it('falls back to x-real-ip', () => {
    const req = makeReq({ 'x-real-ip': '198.51.100.1' });
    assert.equal(getClientIp(req), '198.51.100.1');
  });

  it('prefers x-forwarded-for over x-real-ip', () => {
    const req = makeReq({
      'x-forwarded-for': '203.0.113.1',
      'x-real-ip': '198.51.100.1',
    });
    assert.equal(getClientIp(req), '203.0.113.1');
  });

  it('returns unknown when no header is present', () => {
    const req = makeReq({});
    assert.equal(getClientIp(req), 'unknown');
  });
});
