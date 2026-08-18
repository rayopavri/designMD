import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { matchesImageSignature } from './image-signature';

describe('matchesImageSignature', () => {
  it('rejects arbitrary bytes labelled as an allowed image type', () => {
    assert.equal(matchesImageSignature(Buffer.from('not an image'), 'image/png'), false);
  });

  it('accepts the PNG, JPEG, and WebP signatures accepted by the generation route', () => {
    assert.equal(matchesImageSignature(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'image/png'), true);
    assert.equal(matchesImageSignature(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg'), true);
    assert.equal(
      matchesImageSignature(Buffer.from('RIFF\x00\x00\x00\x00WEBP', 'binary'), 'image/webp'),
      true,
    );
  });
});
