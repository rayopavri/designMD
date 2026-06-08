/**
 * Durable website-screenshot storage on Supabase Storage.
 *
 * captureAndStoreScreenshot fetches a (short-lived) Firecrawl screenshot URL,
 * normalizes it to a ~16:10 above-the-fold webp via sharp, and uploads it to
 * the public `bundle-screenshots` bucket through the Storage REST API. Returns
 * the public URL, or null on any failure (missing env, dead URL, upload error)
 * — it NEVER throws, so callers on the generation path stay unaffected.
 *
 * Keyed by bundle id, so a regeneration overwrites the previous screenshot.
 * Uses the REST API + fetch (no @supabase/supabase-js dependency) and the
 * sharp binary already bundled for Gemini vision pre-processing.
 */
import { env } from '@/lib/env';

const BUCKET = 'bundle-screenshots';
const FETCH_TIMEOUT_MS = 8_000;
const UPLOAD_TIMEOUT_MS = 10_000;

export async function captureAndStoreScreenshot({
  screenshotUrl,
  key,
}: {
  screenshotUrl: string;
  key: string;
}): Promise<string | null> {
  const base = env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !serviceKey) return null;

  try {
    const res = await fetch(screenshotUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) {
      console.warn(`[screenshots] source fetch ${res.status} for ${screenshotUrl.slice(0, 80)}`);
      return null;
    }
    const input = Buffer.from(await res.arrayBuffer());
    if (input.length === 0) return null;

    const sharpMod = (await import('sharp')).default;
    const webp = await sharpMod(input)
      // Normalize to the 1200×750 (16:10) hero card. Firecrawl captures at a
      // matching 1440×900 (16:10) viewport, so `cover` is a clean proportional
      // downscale — it never slices the left/right edges. `position: 'top'`
      // keeps the above-the-fold hero if a source ever arrives taller than 16:10
      // (cropping the bottom, never the sides).
      .resize(1200, 750, { fit: 'cover', position: 'top' })
      .webp({ quality: 80 })
      .toBuffer();

    const path = `${key}.webp`;
    const uploadUrl = `${base}/storage/v1/object/${BUCKET}/${path}`;
    const up = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'image/webp',
        'x-upsert': 'true',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
      // Copy into a fresh Uint8Array: @types/node types Buffer as
      // Buffer<ArrayBufferLike>, which doesn't satisfy fetch's BodyInit directly.
      body: new Uint8Array(webp),
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    });
    if (!up.ok) {
      console.error(
        `[screenshots] upload failed ${up.status}: ${(await up.text().catch(() => '')).slice(0, 200)}`,
      );
      return null;
    }
    return `${base}/storage/v1/object/public/${BUCKET}/${path}`;
  } catch (err) {
    console.error('[screenshots] capture failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Health-check for the storage setup, surfaced by the admin backfill page so a
 * misconfiguration is obvious instead of silent. Reports whether the env vars
 * are present and whether a real write to the bucket succeeds (which exercises
 * the URL, the service-role key, and the bucket name/permissions in one shot).
 *
 *   configured=false        → SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set
 *                             in the deployed app (or wrong names / not redeployed)
 *   configured=true, ok=false, status=401 → service-role key wrong
 *   configured=true, ok=false, status=400/404 → bucket name/permission issue
 *   ok=true                 → storage is good to go
 */
export async function probeScreenshotStorage(): Promise<{
  configured: boolean;
  ok: boolean;
  status?: number;
  error?: string;
  host?: string;
}> {
  const base = env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !serviceKey) return { configured: false, ok: false };

  // Surfaced to the admin page so a wrong SUPABASE_URL (e.g. a different
  // project, or the Postgres URL pasted by mistake) is immediately visible.
  let host: string | undefined;
  try {
    host = new URL(base).host;
  } catch {
    host = base;
  }

  try {
    const res = await fetch(`${base}/storage/v1/object/${BUCKET}/__healthcheck__.webp`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'image/webp',
        'x-upsert': 'true',
      },
      body: new Uint8Array([82, 73, 70, 70]), // 4 bytes — we only test write auth, not content
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    });
    if (!res.ok) {
      return {
        configured: true,
        ok: false,
        status: res.status,
        error: (await res.text().catch(() => '')).slice(0, 200),
        host,
      };
    }
    return { configured: true, ok: true, status: res.status, host };
  } catch (err) {
    return { configured: true, ok: false, error: err instanceof Error ? err.message : String(err), host };
  }
}
