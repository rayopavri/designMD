/**
 * Downloads the Firecrawl screenshot for a scraped page and uploads it
 * to Vercel Blob. Returns the public Blob URL, or null on any failure —
 * the home gallery's card renders a designed fallback when null.
 *
 * Non-fatal by design: a missing thumbnail must never block bundle
 * generation.
 */
import { put } from '@vercel/blob';

const FETCH_TIMEOUT_MS = 15_000;
const MAX_BYTES = 5_000_000;

export async function uploadScreenshotToBlob(input: {
  screenshotUrl: string | null;
  slugHint: string;
}): Promise<string | null> {
  const { screenshotUrl, slugHint } = input;
  if (!screenshotUrl) return null;
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.warn('[upload-screenshot] BLOB_READ_WRITE_TOKEN missing; skipping');
    return null;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(screenshotUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn(`[upload-screenshot] fetch failed: ${res.status}`);
      return null;
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) {
      console.warn(`[upload-screenshot] unexpected size: ${buf.byteLength} bytes`);
      return null;
    }

    const contentType = res.headers.get('content-type') ?? 'image/png';
    const ext = contentType.includes('jpeg') || contentType.includes('jpg')
      ? 'jpg'
      : contentType.includes('webp')
        ? 'webp'
        : 'png';

    const key = `screenshots/${slugHint}-${Date.now()}.${ext}`;
    const blob = await put(key, buf, {
      access: 'public',
      contentType,
      addRandomSuffix: true,
    });
    return blob.url;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[upload-screenshot] upload failed:', msg);
    return null;
  }
}
