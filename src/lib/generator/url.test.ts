import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractDomain, normalizeUrl } from './url';

describe('normalizeUrl', () => {
  it('lowercases the host', () => {
    assert.equal(normalizeUrl('https://EXAMPLE.COM/'), 'https://example.com/');
  });

  it('strips leading www.', () => {
    assert.equal(normalizeUrl('https://www.example.com/'), 'https://example.com/');
  });

  it('strips trailing slash except for root', () => {
    assert.equal(normalizeUrl('https://example.com/'), 'https://example.com/');
    assert.equal(normalizeUrl('https://example.com'), 'https://example.com/');
    assert.equal(normalizeUrl('https://example.com/path/'), 'https://example.com/path');
  });

  it('strips fragments', () => {
    assert.equal(normalizeUrl('https://example.com/path#section'), 'https://example.com/path');
  });

  it('drops tracking query params', () => {
    assert.equal(
      normalizeUrl('https://example.com/path?utm_source=email&gclid=123&ref=foo'),
      'https://example.com/path',
    );
  });

  it('sorts remaining query params', () => {
    assert.equal(
      normalizeUrl('https://example.com/path?z=1&a=2&m=3'),
      'https://example.com/path?a=2&m=3&z=1',
    );
  });

  it('preserves path case', () => {
    assert.equal(normalizeUrl('https://example.com/Docs'), 'https://example.com/Docs');
  });

  it('throws on invalid URLs', () => {
    assert.throws(() => normalizeUrl('not-a-url'), /Invalid URL/);
  });

  it('throws on non-http protocols', () => {
    assert.throws(() => normalizeUrl('ftp://example.com'), /URL must be http or https/);
  });

  it('rejects URLs with username or password userinfo', () => {
    assert.throws(
      () => normalizeUrl('https://username:password@example.com/path'),
      /credentials/i,
    );
    assert.throws(() => normalizeUrl('https://username@example.com/path'), /credentials/i);
  });
});

describe('extractDomain', () => {
  it('returns lowercased host without www', () => {
    assert.equal(extractDomain('https://www.Example.com/path'), 'example.com');
  });

  it('returns host for root URL', () => {
    assert.equal(extractDomain('https://linear.app'), 'linear.app');
  });
});
