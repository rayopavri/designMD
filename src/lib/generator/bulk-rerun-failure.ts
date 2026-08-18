import { safeGenerationErrorDetail } from '@/lib/auth/job-access';

/** Maps an enqueue exception to the safe terminal state persisted by bulk reruns. */
export function bulkRerunEnqueueFailureUpdate(error: unknown) {
  return {
    status: 'failed' as const,
    errorStep: 'enqueue',
    errorMessage: safeGenerationErrorDetail(error),
  };
}
