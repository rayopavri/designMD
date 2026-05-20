/**
 * Task queue abstraction.
 *
 * Local/dev mode (INLINE_TASKS=true): we POST to our own internal task
 * route synchronously — same code path the Cloud Tasks worker will hit
 * in production, just without the queue hop. This means the HTTP
 * response to the user returns as soon as the task is *kicked*; the
 * task itself runs in the background via the inline POST.
 *
 * Production mode: we publish to Google Cloud Tasks. (Implemented when
 * we actually deploy — for now we throw if non-inline is requested.)
 */
import { env } from '@/lib/env';

export type TaskName = 'scrape-and-extract';

export interface EnqueueResult {
  inline: boolean;
}

export async function enqueueTask<P>(name: TaskName, payload: P): Promise<EnqueueResult> {
  if (env.INLINE_TASKS) {
    await runInline(name, payload);
    return { inline: true };
  }
  throw new Error(
    'Cloud Tasks dispatch is not implemented yet. Set INLINE_TASKS=true for local dev.',
  );
}

async function runInline<P>(name: TaskName, payload: P): Promise<void> {
  if (!env.INTERNAL_TASK_TOKEN) {
    throw new Error('INTERNAL_TASK_TOKEN is required to dispatch inline tasks');
  }
  const url = `${env.NEXT_PUBLIC_APP_URL}/api/internal/tasks/${name}`;
  // Fire-and-forget: we don't await the response so the user-facing
  // request returns immediately. We still log errors via .catch().
  void fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-task-token': env.INTERNAL_TASK_TOKEN,
    },
    body: JSON.stringify(payload),
  })
    .then(async (res) => {
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error(`[task:${name}] worker returned ${res.status}: ${text.slice(0, 500)}`);
      }
    })
    .catch((err: unknown) => {
      console.error(
        `[task:${name}] inline dispatch failed:`,
        err instanceof Error ? err.message : err,
      );
    });
}

/**
 * Verify the inbound internal task token from a worker route. Throws a
 * Response if missing/mismatched.
 */
export function assertInternalTaskAuth(req: Request): void {
  if (!env.INTERNAL_TASK_TOKEN) {
    throw new Response(JSON.stringify({ error: 'Internal token not configured' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
  const got = req.headers.get('x-internal-task-token');
  if (got !== env.INTERNAL_TASK_TOKEN) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }
}
