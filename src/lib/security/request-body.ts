export type ReadJsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; error: 'body_too_large' | 'invalid_json' };

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
