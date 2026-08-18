import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { serializeJsonForHtml } from './safe-json';

const jsonLdScriptFiles = [
  'src/app/(public)/page.tsx',
  'src/app/(public)/for/[tool]/page.tsx',
  'src/app/(public)/library/page.tsx',
  'src/app/(public)/library/[slug]/page.tsx',
  'src/app/(public)/library/category/[slug]/page.tsx',
];

describe('serializeJsonForHtml', () => {
  it('escapes HTML-breaking characters', () => {
    const output = serializeJsonForHtml({ value: '</script><script>alert(1)</script>' });

    assert.ok(output);
    assert.doesNotMatch(output, /<\/script>/i);
    assert.ok(output.includes('\\u003c/script\\u003e'));
  });

  it('escapes ampersands and JavaScript line separators', () => {
    const output = serializeJsonForHtml({ value: '&\u2028\u2029' });

    assert.ok(output);
    assert.equal(output, '{"value":"\\u0026\\u2028\\u2029"}');
  });

  it('escapes nested values without changing their structure', () => {
    const output = serializeJsonForHtml({ nested: { values: ['<', '&', '>'] } });

    assert.ok(output);
    assert.equal(output, '{"nested":{"values":["\\u003c","\\u0026","\\u003e"]}}');
  });

  it('matches JSON.stringify for undefined', () => {
    assert.equal(serializeJsonForHtml(undefined), JSON.stringify(undefined));
  });

  it('serializes every JSON-LD script sink through the HTML-safe helper', async () => {
    for (const file of jsonLdScriptFiles) {
      const source = await readFile(path.join(process.cwd(), file), 'utf8');

      assert.match(source, /import \{ serializeJsonForHtml \} from '@\/lib\/security\/safe-json';/);
      assert.match(
        source,
        /dangerouslySetInnerHTML=\{\{ __html: serializeJsonForHtml\((?:jsonLd|collectionJsonLd)\) \?\? '' \}\}/,
      );
      assert.doesNotMatch(source, /dangerouslySetInnerHTML=\{\{ __html: JSON\.stringify\(/);
    }
  });
});
