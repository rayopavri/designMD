/**
 * Authorization and response-shaping helpers for generation jobs.
 *
 * The anonymous token is an httpOnly browser cookie, not a substitute for a
 * job ID. Editor tooling has its own requireEditor-protected routes; this
 * public polling helper deliberately grants no role-based bypass.
 */
export interface GenerationJobAccess {
  userId: string | null;
  anonToken: string | null;
}

export interface GenerationJobForPublicStatus {
  id: string;
  url: string;
  status: string;
  currentStep: string | null;
  errorStep: string | null;
  errorMessage: string | null;
  resultBundleId: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  companionStartedAt: Date | null;
  companionDoneAt: Date | null;
}

export interface PublicGenerationJobStatus {
  jobId: string;
  url: string;
  status: string;
  currentStep: string | null;
  errorMessage: string | null;
  errorStep: string | null;
  resultBundleId: string | null;
  resultBundleSlug: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  companionStartedAt: Date | null;
  companionDoneAt: Date | null;
}

/** Authorizes a job owner or the anonymous browser that created the job. */
export function canReadGenerationJob(job: GenerationJobAccess, viewer: GenerationJobAccess): boolean {
  if (job.userId) return viewer.userId === job.userId;
  return Boolean(job.anonToken && viewer.anonToken === job.anonToken);
}

/**
 * Stable public failure codes. Never pass a provider, database, worker, or
 * persisted error string to the browser: those details are for logs/admin
 * diagnostics only.
 */
export function publicGenerationError(status: string, step: string | null): string {
  if (status !== 'failed') return 'generation_failed';
  if (step === 'watchdog' || step === 'supervisor-reap') return 'generation_timed_out';
  if (step === 'scraping-blocked') return 'site_blocks_automation';
  return 'generation_failed';
}

/**
 * Produces the public polling payload. A missing job stays null so the route
 * can return the same 404 response for unknown and unauthorized IDs.
 */
export function publicGenerationJobStatus(
  job: GenerationJobForPublicStatus | null,
  options: { resultBundleSlug: string | null; isStuck?: boolean },
): PublicGenerationJobStatus | null {
  if (!job) return null;

  const status = options.isStuck ? 'failed' : job.status;
  const failureStep = options.isStuck ? 'watchdog' : job.errorStep;
  const failed = status === 'failed';

  return {
    jobId: job.id,
    url: job.url,
    status,
    currentStep: job.currentStep,
    errorMessage: failed ? publicGenerationError(status, failureStep) : null,
    errorStep: failed ? 'generation_failed' : null,
    resultBundleId: job.resultBundleId,
    resultBundleSlug: options.resultBundleSlug,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    companionStartedAt: job.companionStartedAt,
    companionDoneAt: job.companionDoneAt,
  };
}

const DIAGNOSTIC_ERROR_TYPES = new Set([
  'AbortError',
  'Error',
  'FetchError',
  'PostgresError',
  'TimeoutError',
  'TypeError',
  'ZodError',
]);

/**
 * Emits only a small allowlisted diagnostic summary. Provider error messages
 * can embed prompts, request bodies, URLs, and authorization headers, so a
 * blacklist is not a safe boundary for logs or persisted job diagnostics.
 */
export function safeGenerationErrorDetail(error: unknown): string {
  if (!(error instanceof Error)) return 'generation_error type=non_error_throw';

  const type = DIAGNOSTIC_ERROR_TYPES.has(error.name) ? error.name : 'Error';
  return `generation_error type=${type}`;
}
