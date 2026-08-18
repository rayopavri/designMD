import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import sharp from 'sharp';
import { MAX_GENERATE_IMAGE_BYTES } from './request-body';
import { readValidatedImageUpload } from './image-upload';

describe('readValidatedImageUpload', () => {
  it('rejects an oversized image before decoding it', async () => {
    const result = await readValidatedImageUpload(
      new File([Buffer.alloc(MAX_GENERATE_IMAGE_BYTES + 1)], 'large.png', { type: 'image/png' }),
    );

    assert.deepEqual(result, { ok: false, error: 'image_too_large' });
  });

  it('rejects a structurally malformed image with a valid PNG signature', async () => {
    const malformed = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from('not a PNG'),
    ]);
    const result = await readValidatedImageUpload(
      new File([malformed], 'malformed.png', { type: 'image/png' }),
    );

    assert.deepEqual(result, { ok: false, error: 'invalid_image_data' });
  });

  it('rejects a file whose MIME type is not an allowed screenshot format', async () => {
    const result = await readValidatedImageUpload(
      new File([Buffer.from('GIF89a')], 'animation.gif', { type: 'image/gif' }),
    );

    assert.deepEqual(result, { ok: false, error: 'unsupported_image_type' });
  });

  it('returns bytes for a valid allowed image', async () => {
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#112233' },
    }).png().toBuffer();
    const result = await readValidatedImageUpload(
      new File([png], 'valid.png', { type: 'image/png' }),
    );

    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.input, png);
  });
});
