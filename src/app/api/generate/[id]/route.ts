/**
 * GET /api/generate/[id]
 *
 * Poll a generator job's status. A UUID identifies a job but does not grant
 * access: signed-in jobs require their owner session and anonymous jobs
 * require the httpOnly browser token that created them.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { bundles, generationJobs } from '@/lib/db/schema';
import { getCurrentUser } from '@/lib/auth/session';
import { readAnonToken } from '@/lib/auth/anon-token';
import {
  canReadGenerationJob,
  publicGenerationJobStatus,
  safeGenerationErrorDetail,
} from '@/lib/auth/job-access';
import { rateLimitByIp, tooManyRequests } from '@/lib/rate-limit/by-ip';

export const runtime = 'nodejs';

// A running job whose updatedAt hasn't changed in this window is presumed
// stuck (worker SIGKILL'd before its in-process watchdog could mark it
// failed). This must stay at or beyond batch.ts's LEASE_MS (7 min) — the
// supervisor cron's authoritative reap threshold — or this UI-only heuristic
// fires first and permanently halts client polling (see GeneratePage.tsx)
// before the backend has actually given up on a job that's still legitimately
// running. Treat it as failed in the response so the client stops polling and
// clears the entry — the DB row stays as-is but no UI will ever show it again.
const STALE_JOB_MS = 8 * 60 * 1000;

interface RouteContext {
  params: Promise<{ id: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest, ctx: RouteContext) {
  // Loose per-IP cap — the client polls this every couple seconds while a job
  // runs, so keep the ceiling well above legitimate poll frequency.
  const rl = await rateLimitByIp(req, { limit: 120, window: '1 m', prefix: 'rl:job-status' });
  if (!rl.ok) return tooManyRequests(rl);

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  try {
    const [job] = await db
      .select()
      .from(generationJobs)
      .where(eq(generationJobs.id, id))
      .limit(1);

    const [user, anonToken] = await Promise.all([getCurrentUser(), readAnonToken()]);
    if (!job || !canReadGenerationJob(job, { userId: user?.id ?? null, anonToken })) {
      // Do not reveal whether the UUID belongs to another user.
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Detect stuck-running rows: job never transitioned out of running because
    // the worker process was killed before cleanup could run.
    const isStuck =
      (job.status === 'running' || job.status === 'queued') &&
      job.updatedAt != null &&
      Date.now() - new Date(job.updatedAt).getTime() > STALE_JOB_MS;

    let resultBundleSlug: string | null = null;
    if (job.resultBundleId) {
      const [b] = await db
        .select({ slug: bundles.slug })
        .from(bundles)
        .where(eq(bundles.id, job.resultBundleId))
        .limit(1);
      resultBundleSlug = b?.slug ?? null;
    }

    return NextResponse.json(publicGenerationJobStatus(job, { resultBundleSlug, isStuck }));
  } catch (err) {
    console.error('[/api/generate/[id]] status lookup failed:', safeGenerationErrorDetail(err));
    return NextResponse.json({ error: 'generation_unavailable' }, { status: 503 });
  }
}
