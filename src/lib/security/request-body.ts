export type ReadJsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; error: 'body_too_large' | 'invalid_json' };

// Vercel currently caps request bodies at 4.5 MiB. Leave 256 KiB for multipart
// boundaries and form fields so this route rejects locally before the platform.
export const MAX_GENERATE_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_GENERATE_MULTIPART_BYTES = MAX_GENERATE_IMAGE_BYTES + 256 * 1024;

/** Case-insensitive media-type check that preserves support for parameters. */
export function isMultipartFormData(contentType: string | null): boolean {
  return contentType?.split(';', 1)[0]?.trim().toLowerCase() === 'multipart/form-data';
}

/** Returns true only when a declared byte length exceeds the route's envelope. */
export function requestExceedsContentLength(req: Request, maximumBytes: number): boolean {
  const raw = req.headers.get('content-length');
  if (!raw) return false;
  const length = Number(raw);
  return Number.isSafeInteger(length) && length > maximumBytes;
}

/** Reads a JSON request body without buffering more than maximumBytes. */
export async function readJsonBodyWithinLimit(
  req: Request,
  maximumBytes: number,
): Promise<ReadJsonBodyResult> {
  if (requestExceedsContentLength(req, maximumBytes)) {
    return { ok: false, error: 'body_too_large' };
  }

  const reader = req.body?.getReader();
  if (!reader) return { ok: false, error: 'invalid_json' };

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        return { ok: false, error: 'body_too_large' };
      }
      chunks.push(value);
    }

    const body = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { ok: true, value: JSON.parse(new TextDecoder().decode(body)) };
  } catch {
    return { ok: false, error: 'invalid_json' };
  } finally {
    reader.releaseLock();
  }
}
