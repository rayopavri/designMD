/**
 * POST /api/generate
 *
 * Kick off a new generator job. Requires an authenticated user. Accepts
 * either a URL (JSON body) or an uploaded image (multipart form).
 *
 * URL mode (Content-Type: application/json):
 *   Body: { url: string }
 *
 * Upload mode (Content-Type: multipart/form-data):
 *   image:      File (image/png|image/jpeg|image/webp, max ~6 MB)
 *   brandName:  string (1..120 chars)
 *
 * Response: 202 { jobId, status, currentStep }
 *
 * Behaviour:
 *   - URL mode normalises the URL, returns 409 if a published bundle already
 *     exists for it, or reuses an in-flight job for the same user/url.
 *   - Upload mode hashes the image bytes (sha-256) and dedupes against any
 *     in-flight upload job for the same user/hash. The image bytes are
 *     stored on the job row as base64 so the worker can read them.
 */
import { createHash } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { bundles, generationJobs } from '@/lib/db/schema';
import { requireAuth } from '@/lib/auth/session';
import { normalizeUrl } from '@/lib/generator/url';
import { enqueueTask } from '@/lib/queue';

export const runtime = 'nodejs';

const UrlBodySchema = z.object({
  url: z.string().url(),
});

const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // 6 MB raw — base64 expands ~33% but still fits comfortably
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
const BRAND_NAME_MAX = 120;

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }

  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.startsWith('multipart/form-data')) {
    return handleUpload(req, user.id);
  }
  return handleUrl(req, user.id);
}

async function handleUrl(req: NextRequest, userId: string) {
  let body: z.infer<typeof UrlBodySchema>;
  try {
    body = UrlBodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', details: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }

  let normalized: string;
  try {
    normalized = normalizeUrl(body.url);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid URL' },
      { status: 400 },
    );
  }

  // Existing published bundle?
  const [existing] = await db
    .select({ id: bundles.id, slug: bundles.slug, status: bundles.status })
    .from(bundles)
    .where(and(eq(bundles.sourceUrlNormalized, normalized), eq(bundles.status, 'published')))
    .limit(1);
  if (existing) {
    return NextResponse.json(
      { error: 'Already exists', existingBundleSlug: existing.slug },
      { status: 409 },
    );
  }

  // Existing in-flight job for this user/url?
  const [inflight] = await db
    .select()
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.userId, userId),
        eq(generationJobs.normalizedUrl, normalized),
        inArray(generationJobs.status, ['queued', 'running']),
      ),
    )
    .limit(1);
  if (inflight) {
    return NextResponse.json(
      { jobId: inflight.id, status: inflight.status, currentStep: inflight.currentStep ?? null },
      { status: 202 },
    );
  }

  const [job] = await db
    .insert(generationJobs)
    .values({
      url: body.url,
      normalizedUrl: normalized,
      status: 'queued',
      currentStep: 'queued',
      userId,
      sourceType: 'url',
    })
    .returning({ id: generationJobs.id });

  if (!job) {
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500 });
  }

  await enqueueTask('scrape-and-extract', { jobId: job.id });
  return NextResponse.json(
    { jobId: job.id, status: 'queued', currentStep: 'queued' },
    { status: 202 },
  );
}

async function handleUpload(req: NextRequest, userId: string) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid multipart body', details: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }

  const file = form.get('image');
  const brandNameRaw = form.get('brandName');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'image field is required' }, { status: 400 });
  }
  if (typeof brandNameRaw !== 'string' || !brandNameRaw.trim()) {
    return NextResponse.json({ error: 'brandName is required' }, { status: 400 });
  }
  const brandName = brandNameRaw.trim().slice(0, BRAND_NAME_MAX);

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported image type ${file.type}. Use PNG, JPEG, or WebP.` },
      { status: 400 },
    );
  }
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: `Image must be 1 byte to ${MAX_IMAGE_BYTES / 1024 / 1024} MB. Got ${file.size}.` },
      { status: 400 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const hash = createHash('sha256').update(buf).digest('hex');
  const base64 = buf.toString('base64');
  const sourceKey = `upload://${hash}`;

  // Dedupe in-flight upload jobs by user+hash.
  const [inflight] = await db
    .select()
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.userId, userId),
        eq(generationJobs.imageHash, hash),
        inArray(generationJobs.status, ['queued', 'running']),
      ),
    )
    .limit(1);
  if (inflight) {
    return NextResponse.json(
      { jobId: inflight.id, status: inflight.status, currentStep: inflight.currentStep ?? null },
      { status: 202 },
    );
  }

  const [job] = await db
    .insert(generationJobs)
    .values({
      url: sourceKey,
      normalizedUrl: null,
      status: 'queued',
      currentStep: 'queued',
      userId,
      sourceType: 'upload',
      imageData: base64,
      imageMimeType: file.type,
      imageHash: hash,
      brandName,
    })
    .returning({ id: generationJobs.id });

  if (!job) {
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500 });
  }

  await enqueueTask('scrape-and-extract', { jobId: job.id });
  return NextResponse.json(
    { jobId: job.id, status: 'queued', currentStep: 'queued' },
    { status: 202 },
  );
}
