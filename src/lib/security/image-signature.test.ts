import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import sharp from 'sharp';
import { matchesImageSignature, validateImageData } from './image-signature';

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

  it('accepts complete PNG, JPEG, and WebP files after decoding them', async () => {
    const source = { create: { width: 2, height: 2, channels: 3 as const, background: '#112233' } };
    const fixtures: Array<[string, Buffer]> = [
      ['image/png', await sharp(source).png().toBuffer()],
      ['image/jpeg', await sharp(source).jpeg().toBuffer()],
      ['image/webp', await sharp(source).webp().toBuffer()],
    ];

    for (const [mimeType, input] of fixtures) {
      assert.equal(await validateImageData(input, mimeType), true, mimeType);
    }
  });

  it('rejects a PNG header prefix that cannot be structurally decoded', async () => {
    const malformed = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from('not a PNG'),
    ]);

    assert.equal(matchesImageSignature(malformed, 'image/png'), true);
    assert.equal(await validateImageData(malformed, 'image/png'), false);
  });

  it('rejects a valid compressed image whose decoded dimensions exceed the pixel limit', async () => {
    const oversized = await sharp({
      create: { width: 4_097, height: 4_097, channels: 3, background: '#000000' },
    })
      .png({ compressionLevel: 9 })
      .toBuffer();

    assert.equal(await validateImageData(oversized, 'image/png'), false);
  });
});
