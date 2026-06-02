/**
 * Client-side image downscale + re-encode for upload.
 *
 * Screenshots are commonly 10–20 MB lossless PNGs. The `/api/generate`
 * upload path runs on Vercel, whose request-body cap (~4.5 MB) rejects
 * large bodies with a raw 413 "Request Entity Too Large" *before* the
 * route's own validation runs. We sidestep that entirely by downscaling
 * and re-encoding to WebP in the browser, so the uploaded body is ~1 MB.
 *
 * This is lossless for our purposes: Gemini downsamples vision input
 * anyway, so a 1600px-wide WebP carries the same brand signal (palette,
 * type, components) as the raw capture.
 *
 * Browser-only — every export touches `document` / `createImageBitmap`
 * and must be called from a client component in response to user action.
 */

/** Longest width we keep — wide desktop captures rarely need more for token extraction. */
const MAX_WIDTH = 1600;
/** Pixel-area ceiling (~4.19M px). Bounds very tall full-page captures so the canvas stays sane. */
const MAX_AREA = 2048 * 2048;
/** WebP/JPEG quality. 0.82 is visually clean for UI screenshots at a fraction of the bytes. */
const QUALITY = 0.82;
/** Below this, an unscaled image isn't worth re-encoding. */
const SKIP_BELOW_BYTES = 1.2 * 1024 * 1024;

/** Reject pathological inputs before doing any canvas work. */
export const MAX_RAW_BYTES = 40 * 1024 * 1024;
/** Target ceiling for the *uploaded* body — stays safely under Vercel's ~4.5 MB cap. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export interface CompressResult {
  /** Ready-to-upload file (compressed, or the original when compression wasn't worthwhile). */
  file: File;
  width: number;
  height: number;
  originalBytes: number;
  compressedBytes: number;
  /** False when the original was returned untouched (already small, or compression failed). */
  didCompress: boolean;
}

interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  /** Releases the underlying bitmap / object URL. Always call after drawing. */
  cleanup: () => void;
}

/**
 * Decode a file into something drawable. Prefers `createImageBitmap`
 * (fast, off-thread) and falls back to an `<img>` element for older
 * Safari. The returned `cleanup` must run only after `drawImage`, since
 * the `<img>` path keeps an object URL alive until then.
 */
async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Fall through to the <img> path.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('image decode failed'));
      el.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      cleanup: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

/** Promise wrapper around `canvas.toBlob`. */
function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), type, quality));
}

/** Human-readable byte count: KB under 1 MB, otherwise MB. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Downscale + re-encode an image for upload. Never throws — on any
 * failure (decode error, no 2D context, unsupported encode) it returns
 * the original file with `didCompress: false` so the caller can fall
 * back and let the server-side size guard be the backstop.
 */
export async function compressImageForUpload(file: File): Promise<CompressResult> {
  const passthrough = (didCompress = false): CompressResult => ({
    file,
    width: 0,
    height: 0,
    originalBytes: file.size,
    compressedBytes: file.size,
    didCompress,
  });

  if (!file.type.startsWith('image/')) return passthrough();

  let decoded: DecodedImage;
  try {
    decoded = await decodeImage(file);
  } catch {
    return passthrough();
  }

  try {
    const { source, width, height } = decoded;
    if (width === 0 || height === 0) return passthrough();

    // Smallest scale that satisfies both the width cap and the area cap;
    // never upscale.
    const scale = Math.min(1, MAX_WIDTH / width, Math.sqrt(MAX_AREA / (width * height)));

    // Already small *and* no downscale needed → re-encoding buys nothing.
    if (scale === 1 && file.size <= SKIP_BELOW_BYTES) return passthrough();

    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return passthrough();
    ctx.drawImage(source, 0, 0, targetW, targetH);

    // Prefer WebP; some browsers silently hand back PNG when WebP is
    // unsupported, so verify the type and fall back to JPEG.
    let blob = await encode(canvas, 'image/webp', QUALITY);
    if (!blob || blob.type !== 'image/webp') {
      blob = await encode(canvas, 'image/jpeg', QUALITY);
    }
    if (!blob || blob.size >= file.size) return passthrough();

    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    const base = file.name.replace(/\.[^.]+$/, '') || 'screenshot';
    const out = new File([blob], `${base}.${ext}`, {
      type: blob.type,
      lastModified: Date.now(),
    });

    return {
      file: out,
      width: targetW,
      height: targetH,
      originalBytes: file.size,
      compressedBytes: out.size,
      didCompress: true,
    };
  } catch {
    return passthrough();
  } finally {
    decoded.cleanup();
  }
}
