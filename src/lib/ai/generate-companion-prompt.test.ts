import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractCompanionText } from './generate-companion-prompt';

describe('extractCompanionText', () => {
  it('returns text blocks that include Anthropic citations and excludes thinking blocks', () => {
    const result = extractCompanionText([
      { type: 'thinking', thinking: 'Internal reasoning', signature: 'signature' },
      { type: 'text', text: 'First paragraph', citations: [] },
      { type: 'text', text: 'Second paragraph', citations: null },
    ]);

    assert.equal(result, 'First paragraph\nSecond paragraph');
  });
});
