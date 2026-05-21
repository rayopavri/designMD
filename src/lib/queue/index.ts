/**
 * Task queue abstraction.
 *
 * Production (Vercel): publishes to Upstash QStash, which guarantees
 * delivery to the worker URL with retries. This replaces the previous
 * fire-and-forget `void fetch()` pattern, which was unreliable on
 * Vercel serverless — the platform can freeze the runtime the moment
 * the parent function returns, before the unawaited fetch lands.
 *
 * Local dev (INLINE_TASKS=true, no QSTASH_TOKEN): we POST to our own
 * internal task route via fetch. Same fire-and-forget shape as before,
 * which is fine on a long-running dev server.
 *
 * Worker auth:
 *   - QStash deliveries are verified by signature (assertQStashSignature)
 *   - Local inline calls carry x-internal-task-token (assertInternalTaskAuth)
 *   - Worker routes call assertTaskAuth which auto-detects which mode.
 */
import { Client, Receiver } from '@upstash/qstash';
import { env } from '@/lib/env';

export type TaskName = 'scrape-and-extract' | 'author-design-md' | 'generate-companion';

export interface EnqueueResult {
  inline: boolean;
}

let qstashClient: Client | null = null;
function getQStash(): Client | null {
  if (!env.QSTASH_TOKEN) return null;
  if (!qstashClient) {
    qstashClient = new Client({ token: env.QSTASH_TOKEN });
  }
  return qstashClient;
}

let qstashReceiver: Receiver | null = null;
function getReceiver(): Receiver | null {
  if (!env.QSTASH_CURRENT_SIGNING_KEY || !env.QSTASH_NEXT_SIGNING_KEY) return null;
  if (!qstashReceiver) {
    qstashReceiver = new Receiver({
      currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
    });
  }
  return qstashReceiver;
}

export async function enqueueTask<P>(name: TaskName, payload: P): Promise<EnqueueResult> {
  const client = getQStash();
  const workerUrl = `${env.NEXT_PUBLIC_APP_URL}/api/internal/tasks/${name}`;

  if (client) {
    try {
      await client.publishJSON({
        url: workerUrl,
        body: payload as Record<string, unknown>,
        retries: 3,
      });
      return { inline: false };
    } catch (err) {
      console.error(`[task:${name}] QStash publish failed:`, err);
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  if (env.INLINE_TASKS) {
    await runInline(name, payload, workerUrl);
    return { inline: true };
  }

  throw new Error(
    'No task dispatch configured. Set QSTASH_TOKEN (prod) or INLINE_TASKS=true (dev).',
  );
}

async function runInline<P>(name: TaskName, payload: P, url: string): Promise<void> {
  if (!env.INTERNAL_TASK_TOKEN) {
    throw new Error('INTERNAL_TASK_TOKEN is required to dispatch inline tasks');
  }
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

export async function assertQStashSignature(req: Request): Promise<string> {
  const receiver = getReceiver();
  if (!receiver) {
    throw new Response(JSON.stringify({ error: 'QStash signing keys not configured' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
  const signature = req.headers.get('upstash-signature');
  if (!signature) {
    throw new Response(JSON.stringify({ error: 'Missing upstash-signature header' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }
  const body = await req.text();
  const isValid = await receiver.verify({ signature, body });
  if (!isValid) {
    throw new Response(JSON.stringify({ error: 'Invalid QStash signature' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }
  return body;
}

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

/**
 * Worker routes call this single helper. Auto-detects QStash vs inline.
 * QStash mode reads the raw body for signature verification, so it
 * also returns the parsed JSON body — routes should use the returned
 * value rather than calling req.json() again.
 */
export async function assertTaskAuth<T = unknown>(req: Request): Promise<T> {
  if (req.headers.get('upstash-signature')) {
    const body = await assertQStashSignature(req);
    return JSON.parse(body) as T;
  }
  assertInternalTaskAuth(req);
  return (await req.json()) as T;
}
