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
  getAuthorizedGenerationJobStatus,
  type GenerationJobStatusDependencies,
} from '@/lib/auth/generation-job-status-route';
import { rateLimitByIp, tooManyRequests } from '@/lib/rate-limit/by-ip';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const productionDependencies: GenerationJobStatusDependencies = {
  async findJob(id) {
    const [job] = await db
      .select()
      .from(generationJobs)
      .where(eq(generationJobs.id, id))
      .limit(1);
    return job ?? null;
  },
  async getViewer() {
    const [user, anonToken] = await Promise.all([getCurrentUser(), readAnonToken()]);
    return { userId: user?.id ?? null, anonToken };
  },
  async findBundleSlug(bundleId) {
    const [bundle] = await db
      .select({ slug: bundles.slug })
      .from(bundles)
      .where(eq(bundles.id, bundleId))
      .limit(1);
    return bundle?.slug ?? null;
  },
  now: () => Date.now(),
  logLookupFailure(detail) {
    console.error('[/api/generate/[id]] status lookup failed:', detail);
  },
};

export async function GET(req: NextRequest, ctx: RouteContext) {
  // Loose per-IP cap — the client polls this every couple seconds while a job
  // runs, so keep the ceiling well above legitimate poll frequency.
  const rl = await rateLimitByIp(req, { limit: 120, window: '1 m', prefix: 'rl:job-status' });
  if (!rl.ok) return tooManyRequests(rl);

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  return getAuthorizedGenerationJobStatus(id, productionDependencies);
}
