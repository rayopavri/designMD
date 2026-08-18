const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
export const MAX_GENERATE_IMAGE_PIXELS = 16 * 1024 * 1024;

export function matchesImageSignature(input: Buffer, mimeType: string): boolean {
  if (mimeType === 'image/png') {
    return input.length >= PNG_SIGNATURE.length && input.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
  }
  if (mimeType === 'image/jpeg') {
    return input.length >= 3 && input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff;
  }
  if (mimeType === 'image/webp') {
    return input.length >= 12 && input.subarray(0, 4).toString('ascii') === 'RIFF' && input.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
}

const SHARP_FORMAT_BY_MIME: Record<string, 'png' | 'jpeg' | 'webp'> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/webp': 'webp',
};

/**
 * Fully decodes a supported upload before persistence. The pixel ceiling and
 * single-page policy bound decompression work and reject animated payloads.
 */
export async function validateImageData(input: Buffer, mimeType: string): Promise<boolean> {
  const expectedFormat = SHARP_FORMAT_BY_MIME[mimeType];
  if (!expectedFormat || !matchesImageSignature(input, mimeType)) return false;

  try {
    const sharp = (await import('sharp')).default;
    const image = sharp(input, {
      animated: false,
      failOn: 'error',
      limitInputPixels: MAX_GENERATE_IMAGE_PIXELS,
      pages: 1,
      sequentialRead: true,
    });
    const metadata = await image.metadata();
    const pixels = (metadata.width ?? 0) * (metadata.height ?? 0);
    if (
      metadata.format !== expectedFormat ||
      !metadata.width ||
      !metadata.height ||
      pixels > MAX_GENERATE_IMAGE_PIXELS ||
      (metadata.pages ?? 1) !== 1
    ) {
      return false;
    }

    // `raw()` forces libvips to decode the full image rather than merely read
    // metadata, catching truncated or malformed data after valid headers.
    await image.ensureAlpha().raw().toBuffer();
    return true;
  } catch {
    return false;
  }
}
