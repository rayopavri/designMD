import { timingSafeEqual } from 'node:crypto';

type CronAuthOptions = {
  cronSecret?: string;
  internalTaskToken?: string;
  allowInternalDevFallback: boolean;
  nodeEnv: string;
};

function secretsMatch(actual: string | null, expected: string | undefined): boolean {
  if (!actual || !expected) {
    return false;
  }

  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function isCronAuthorized(req: Request, options: CronAuthOptions): boolean {
  if (
    options.cronSecret &&
    secretsMatch(req.headers.get('authorization'), `Bearer ${options.cronSecret}`)
  ) {
    return true;
  }

  if (
    options.nodeEnv !== 'production' &&
    options.allowInternalDevFallback
  ) {
    return secretsMatch(req.headers.get('x-internal-task-token'), options.internalTaskToken);
  }

  return false;
}
