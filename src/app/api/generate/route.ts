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
 *   image:      File (image/png|image/jpeg|image/webp, max 4 MB)
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
import { getCurrentUser } from '@/lib/auth/session';
import { getOrCreateAnonToken, attachAnonToken } from '@/lib/auth/anon-token';
import { safeGenerationErrorDetail } from '@/lib/auth/job-access';
import { normalizeUrl } from '@/lib/generator/url';
import { enqueueTask } from '@/lib/queue';
import { rateLimitGenerate, markFreeGenerationUsed } from '@/lib/rate-limit';
import {
  isMultipartFormData,
  MAX_GENERATE_IMAGE_BYTES,
  MAX_GENERATE_MULTIPART_BYTES,
  requestExceedsContentLength,
} from '@/lib/security/request-body';
import { validateImageData } from '@/lib/security/image-signature';

export const runtime = 'nodejs';

const UrlBodySchema = z.object({
  url: z.string().url(),
});

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
const BRAND_NAME_MAX = 120;

export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') ?? '';
  // Reject declared oversized payloads before auth, rate-limit, or multipart
  // parsing. The envelope is below Vercel's 4.5 MiB request limit. Chunked
  // requests have no Content-Length; platform limits and File.size below are
  // defense-in-depth for those requests.
  if (isMultipartFormData(contentType) && requestExceedsContentLength(req, MAX_GENERATE_MULTIPART_BYTES)) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
  }

  try {
    // Sign-in is optional now. Signed-in users still get attribution
    // (created_by = user.id); anonymous gets null.
    const user = await getCurrentUser();
    const userId = user?.id ?? null;
    const isEditor = user?.isEditor ?? false;

    // Resolve the anon cookie first so a newly issued ownership token can be
    // attached to every response. Anonymous generation limits are keyed by IP;
    // the cookie authorizes later polling of the job it creates.
    const { token: anonToken, isNew } = await getOrCreateAnonToken(userId);

    // Rate-limit gate. Editors are unmetered; signed-in get 10/hour by userId;
    // anonymous get a single free generation per browser. Returns 429 if exceeded.
    const rl = await rateLimitGenerate({ req, userId, isEditor, anonToken });
    if (!rl.ok) {
      if (rl.unavailable) {
        const res = NextResponse.json({ error: 'rate_limit_unavailable' }, { status: 503 });
        if (isNew && anonToken) attachAnonToken(res, anonToken);
        return res;
      }
      const res = NextResponse.json(
        {
          error: 'rate_limited',
          message: userId
            ? `You've hit the generation limit (${rl.limit} per hour). Try again in ~${Math.ceil(rl.retryAfter / 60)}m.`
            : "You've used your free generation — sign in to generate more.",
          retryAfter: rl.retryAfter,
          limit: rl.limit,
          remaining: rl.remaining,
          tier: rl.tier,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rl.retryAfter),
            'X-RateLimit-Limit': String(rl.limit),
            'X-RateLimit-Remaining': String(rl.remaining),
          },
        },
      );
      // Tag the browser even on a block so it's consistently identified next time.
      if (isNew && anonToken) attachAnonToken(res, anonToken);
      return res;
    }

    const res = isMultipartFormData(contentType)
      ? await handleUpload(req, userId, anonToken, isEditor)
      : await handleUrl(req, userId, anonToken, isEditor);

    // Anonymous: consume the single free generation only when a job was
    // actually created (202), so validation 400s / dedupe 409s don't burn it.
    if (!userId && res.status === 202) {
      await markFreeGenerationUsed(req);
    }

    if (isNew && anonToken) attachAnonToken(res, anonToken);
    return res;
  } catch (err) {
    console.error('[/api/generate] unhandled error:', safeGenerationErrorDetail(err));
    return NextResponse.json({ error: 'generation_failed' }, { status: 500 });
  }
}

async function handleUrl(req: NextRequest, userId: string | null, anonToken: string | null, isEditor: boolean) {
  let body: z.infer<typeof UrlBodySchema>;
  try {
    body = UrlBodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  let normalized: string;
  try {
    normalized = normalizeUrl(body.url);
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  // Existing active bundle for this URL? Matches the scope of the
  // uq_bundles_source_active index so we return a clean 409 instead of
  // letting a duplicate hit the DB and surface as a 500. We block on any
  // active status — not just 'published' — because the index forbids a
  // second active bundle regardless of who owns it or whether it's live yet.
  let existing: { slug: string; status: string } | undefined;
  try {
    [existing] = await db
      .select({ slug: bundles.slug, status: bundles.status })
      .from(bundles)
      .where(
        and(
          eq(bundles.sourceUrlNormalized, normalized),
          inArray(bundles.status, ['personal', 'pending_review', 'published', 'flagged']),
        ),
      )
      .limit(1);
  } catch (err) {
    console.error('[/api/generate] bundles lookup failed:', safeGenerationErrorDetail(err));
    return NextResponse.json({ error: 'database_unavailable' }, { status: 503 });
  }
  if (existing) {
    // Only expose the slug for a published bundle (publicly resolvable);
    // for in-flight/private statuses we block without leaking the slug.
    return NextResponse.json(
      existing.status === 'published'
        ? { error: 'Already exists', existingBundleSlug: existing.slug }
        : { error: 'A bundle for this URL is already being processed' },
      { status: 409 },
    );
  }

  // Existing in-flight job for this user/url? Only applies to signed-in
  // users — anonymous gets a fresh job each time. (Rate limiting will
  // be the abuse gate; we don't try to dedupe by IP here.)
  // Skip jobs whose updatedAt hasn't moved in 4 min — that exceeds every
  // individual provider substage timeout and should not block a fresh run.
  // The supervisor's 7-min lease remains the durable recovery backstop.
  const STALE_JOB_MS = 4 * 60 * 1000;
  if (userId) {
    try {
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
      const isStale =
        inflight &&
        inflight.updatedAt != null &&
        Date.now() - new Date(inflight.updatedAt).getTime() > STALE_JOB_MS;
      if (inflight && !isStale) {
        return NextResponse.json(
          { jobId: inflight.id, status: inflight.status, currentStep: inflight.currentStep ?? null },
          { status: 202 },
        );
      }
    } catch (err) {
      console.error('[/api/generate] inflight job lookup failed:', safeGenerationErrorDetail(err));
      return NextResponse.json({ error: 'database_unavailable' }, { status: 503 });
    }
  }

  let job: { id: string } | undefined;
  try {
    [job] = await db
      .insert(generationJobs)
      .values({
        url: body.url,
        normalizedUrl: normalized,
        status: 'queued',
        currentStep: 'queued',
        userId,
        sourceType: 'url',
        anonToken: userId ? null : anonToken,
        // Editor-owned jobs auto-publish when the quality bar is met (≥60%).
        autoPublish: isEditor,
      })
      .returning({ id: generationJobs.id });
  } catch (err) {
    console.error('[/api/generate] job insert failed:', safeGenerationErrorDetail(err));
    return NextResponse.json({ error: 'database_unavailable' }, { status: 503 });
  }

  if (!job) {
    return NextResponse.json({ error: 'database_unavailable' }, { status: 503 });
  }

  try {
    await enqueueTask('scrape-and-extract', { jobId: job.id });
  } catch (err) {
    console.error('[/api/generate] enqueueTask failed:', safeGenerationErrorDetail(err));
    return NextResponse.json({ error: 'queue_unavailable' }, { status: 503 });
  }

  return NextResponse.json(
    { jobId: job.id, status: 'queued', currentStep: 'queued' },
    { status: 202 },
  );
}

async function handleUpload(req: NextRequest, userId: string | null, anonToken: string | null, isEditor: boolean) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid multipart body' }, { status: 400 });
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
  if (file.size === 0 || file.size > MAX_GENERATE_IMAGE_BYTES) {
    return NextResponse.json(
      { error: `Image must be 1 byte to ${MAX_GENERATE_IMAGE_BYTES / 1024 / 1024} MB. Got ${file.size}.` },
      { status: 400 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (!(await validateImageData(buf, file.type))) {
    return NextResponse.json({ error: 'Invalid image data' }, { status: 400 });
  }
  const hash = createHash('sha256').update(buf).digest('hex');
  const base64 = buf.toString('base64');
  const sourceKey = `upload://${hash}`;

  // Dedupe in-flight upload jobs by user+hash (signed-in users only).
  if (userId) {
    try {
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
    } catch (err) {
      console.error('[/api/generate] upload inflight job lookup failed:', safeGenerationErrorDetail(err));
      return NextResponse.json({ error: 'database_unavailable' }, { status: 503 });
    }
  }

  let job: { id: string } | undefined;
  try {
    [job] = await db
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
        anonToken: userId ? null : anonToken,
        // Editor-owned jobs auto-publish when the quality bar is met (≥60%).
        autoPublish: isEditor,
      })
      .returning({ id: generationJobs.id });
  } catch (err) {
    console.error('[/api/generate] upload job insert failed:', safeGenerationErrorDetail(err));
    return NextResponse.json({ error: 'database_unavailable' }, { status: 503 });
  }

  if (!job) {
    return NextResponse.json({ error: 'database_unavailable' }, { status: 503 });
  }

  try {
    await enqueueTask('scrape-and-extract', { jobId: job.id });
  } catch (err) {
    console.error('[/api/generate] upload enqueueTask failed:', safeGenerationErrorDetail(err));
    return NextResponse.json({ error: 'queue_unavailable' }, { status: 503 });
  }
  return NextResponse.json(
    { jobId: job.id, status: 'queued', currentStep: 'queued' },
    { status: 202 },
  );
}
