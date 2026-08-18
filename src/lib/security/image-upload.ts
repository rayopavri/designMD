import { validateImageData } from './image-signature';
import { MAX_GENERATE_IMAGE_BYTES } from './request-body';

export const ALLOWED_UPLOAD_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export type ValidatedImageUpload =
  | { ok: true; input: Buffer }
  | { ok: false; error: 'unsupported_image_type' | 'image_too_large' | 'invalid_image_data' };

/**
 * Reads an allowed upload only after its byte-size bound passes, then verifies
 * its declared MIME type, structural signature, full decode, and pixel limit.
 */
export async function readValidatedImageUpload(file: File): Promise<ValidatedImageUpload> {
  if (!ALLOWED_UPLOAD_IMAGE_MIME_TYPES.has(file.type)) {
    return { ok: false, error: 'unsupported_image_type' };
  }
  if (file.size === 0 || file.size > MAX_GENERATE_IMAGE_BYTES) {
    return { ok: false, error: 'image_too_large' };
  }

  const input = Buffer.from(await file.arrayBuffer());
  if (!(await validateImageData(input, file.type))) {
    return { ok: false, error: 'invalid_image_data' };
  }

  return { ok: true, input };
}
