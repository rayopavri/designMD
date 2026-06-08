/**
 * POST /api/admin/bundles/[slug]/screenshot
 *
 * Two modes, selected by Content-Type:
 *   application/json  { action: "recapture" } — re-scrapes the source URL via
 *                     Firecrawl and replaces the stored screenshot.
 *   multipart/form-data  file field           — accepts an uploaded image,
 *                     normalizes it to 1200×750 WebP, and stores it directly.
 *
 * Both modes always overwrite the existing screenshot (intentional replace).
 * Editor-only. maxDuration=120 to give Firecrawl enough headroom.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireEditor } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { bundles } from '@/lib/db/schema';
import { env } from '@/lib/env';
import { scrapeScreenshot } from '@/lib/ai/firecrawl';
import { captureAndStoreScreenshot } from '@/lib/storage/screenshots';

export const runtime = 'nodejs';
export const maxDuration = 120;

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    await requireEditor();
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }

  const { slug } = await ctx.params;
  if (!slug || slug.length > 200) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  }

  const [bundle] = await db
    .select({ id: bundles.id, sourceUrl: bundles.sourceUrl })
    .from(bundles)
    .where(eq(bundles.slug, slug))
    .limit(1);

  if (!bundle) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const contentType = req.headers.get('content-type') ?? '';

  // ── Upload mode ──────────────────────────────────────────────
  if (contentType.includes('multipart/form-data')) {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: 'Invalid multipart body' }, { status: 400 });
    }

    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file field' }, { status: 400 });
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    const input = Buffer.from(await file.arrayBuffer());
    if (input.length === 0) {
      return NextResponse.json({ error: 'Empty file' }, { status: 400 });
    }

    const stored = await storeBuffer(input, bundle.id);
    if (!stored.url) {
      return NextResponse.json({ error: stored.error ?? 'Failed to store screenshot' }, { status: 500 });
    }
    const url = stored.url;

    await db.update(bundles).set({ previewImageUrl: url }).where(eq(bundles.id, bundle.id));
    return NextResponse.json({ previewImageUrl: url });
  }

  // ── Recapture mode ───────────────────────────────────────────
  let body: { action?: string };
  try {
    body = (await req.json()) as { action?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.action !== 'recapture') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  if (!bundle.sourceUrl || bundle.sourceUrl.startsWith('upload://')) {
    return NextResponse.json(
      { error: 'Bundle has no scrapeable source URL' },
      { status: 422 },
    );
  }

  let screenshotUrl: string;
  try {
    screenshotUrl = await scrapeScreenshot(bundle.sourceUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[admin screenshot recapture] scrape failed:', msg);
    return NextResponse.json({ error: `Firecrawl: ${msg}` }, { status: 502 });
  }

  const url = await captureAndStoreScreenshot({ screenshotUrl, key: bundle.id });
  if (!url) {
    return NextResponse.json({ error: 'Failed to store screenshot' }, { status: 500 });
  }

  await db.update(bundles).set({ previewImageUrl: url }).where(eq(bundles.id, bundle.id));
  return NextResponse.json({ previewImageUrl: url });
}

// Processes a raw image buffer: resize to 1200×750 WebP and upload to Supabase.
async function storeBuffer(input: Buffer, bundleId: string): Promise<{ url: string; error?: never } | { url?: never; error: string }> {
  const base = env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !serviceKey) return { error: 'Supabase env vars not configured' };

  try {
    const sharpMod = (await import('sharp')).default;
    const webp = await sharpMod(input)
      .resize(1200, 750, { fit: 'cover', position: 'top' })
      .webp({ quality: 80 })
      .toBuffer();

    const path = `${bundleId}.webp`;
    const uploadUrl = `${base}/storage/v1/object/bundle-screenshots/${path}`;
    const up = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'image/webp',
        'x-upsert': 'true',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
      body: new Uint8Array(webp),
      signal: AbortSignal.timeout(10_000),
    });
    if (!up.ok) {
      const detail = (await up.text().catch(() => '')).slice(0, 200);
      const msg = `Supabase storage ${up.status}${detail ? `: ${detail}` : ''}`;
      console.error('[admin screenshot upload]', msg);
      return { error: msg };
    }
    return { url: `${base}/storage/v1/object/public/bundle-screenshots/${path}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[admin screenshot upload] failed:', msg);
    return { error: msg };
  }
}
