import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { serializeJsonForHtml } from './safe-json';

describe('serializeJsonForHtml', () => {
  it('escapes HTML-breaking characters', () => {
    const output = serializeJsonForHtml({ value: '</script><script>alert(1)</script>' });

    assert.doesNotMatch(output, /<\/script>/i);
    assert.ok(output.includes('\\u003c/script\\u003e'));
  });

  it('escapes ampersands and JavaScript line separators', () => {
    const output = serializeJsonForHtml({ value: '&\u2028\u2029' });

    assert.equal(output, '{"value":"\\u0026\\u2028\\u2029"}');
  });

  it('escapes nested values without changing their structure', () => {
    const output = serializeJsonForHtml({ nested: { values: ['<', '&', '>'] } });

    assert.equal(output, '{"nested":{"values":["\\u003c","\\u0026","\\u003e"]}}');
  });

  it('matches JSON.stringify for undefined', () => {
    assert.equal(serializeJsonForHtml(undefined), JSON.stringify(undefined));
  });
});
