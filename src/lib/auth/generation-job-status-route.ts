import {
  canReadGenerationJob,
  type GenerationJobAccess,
  type GenerationJobForPublicStatus,
  publicGenerationJobStatus,
  safeGenerationErrorDetail,
} from './job-access';

const STALE_JOB_MS = 8 * 60 * 1000;

type GenerationJobStatusRecord = GenerationJobForPublicStatus & GenerationJobAccess;

export interface GenerationJobStatusDependencies {
  findJob(id: string): Promise<GenerationJobStatusRecord | null>;
  getViewer(): Promise<GenerationJobAccess>;
  findBundleSlug(bundleId: string): Promise<string | null>;
  now(): number;
  logLookupFailure(detail: string): void;
}

/** The authorization and response portion of GET /api/generate/[id]. */
export async function getAuthorizedGenerationJobStatus(
  id: string,
  dependencies: GenerationJobStatusDependencies,
): Promise<Response> {
  try {
    const job = await dependencies.findJob(id);
    const viewer = await dependencies.getViewer();
    if (!job || !canReadGenerationJob(job, viewer)) {
      // Do not reveal whether the UUID belongs to another user.
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    const isStuck =
      (job.status === 'running' || job.status === 'queued') &&
      job.updatedAt != null &&
      dependencies.now() - new Date(job.updatedAt).getTime() > STALE_JOB_MS;
    const resultBundleSlug = job.resultBundleId
      ? await dependencies.findBundleSlug(job.resultBundleId)
      : null;

    return Response.json(publicGenerationJobStatus(job, { resultBundleSlug, isStuck }));
  } catch (err) {
    dependencies.logLookupFailure(safeGenerationErrorDetail(err));
    return Response.json({ error: 'generation_unavailable' }, { status: 503 });
  }
}
