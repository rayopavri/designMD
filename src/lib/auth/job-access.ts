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

/**
 * Keeps logs and internal diagnostics useful while removing obvious secret
 * carriers from thrown messages before they are persisted or logged.
 */
export function safeGenerationErrorDetail(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/:\/\/[^\s/@]+@/g, '://[redacted]@')
    .replace(/([?&](?:api[_-]?key|token|password|secret)=[^&\s;]+)/gi, (value) => {
      const separator = value[0];
      const key = value.slice(1, value.indexOf('='));
      return `${separator}${key}=[redacted]`;
    })
    .replace(/(bearer\s+)[^\s,;]+/gi, '$1[redacted]')
    .replace(
      /((?:api[_-]?key|token|password|secret)["']?\s*[:=]\s*["']?)([^\s,;"']+)(["']?)/gi,
      '$1[redacted]$3',
    )
    .slice(0, 1000);
}
