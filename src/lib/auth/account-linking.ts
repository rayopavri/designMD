export const ACCOUNT_LINK_REQUIRED = 'ACCOUNT_LINK_REQUIRED' as const;

export class AccountLinkRequiredError extends Error {
  readonly code = ACCOUNT_LINK_REQUIRED;

  constructor() {
    super('An existing account uses a different Firebase identity.');
    this.name = 'AccountLinkRequiredError';
  }
}

export function isAccountLinkRequiredError(error: unknown): error is AccountLinkRequiredError {
  return error instanceof AccountLinkRequiredError ||
    (typeof error === 'object' && error !== null && 'code' in error &&
      (error as { code?: unknown }).code === ACCOUNT_LINK_REQUIRED);
}

export function shouldReuseUserIdentity(input: {
  existingFirebaseUid: string;
  incomingFirebaseUid: string;
  existingEmailVerified: boolean;
  incomingEmailVerified: boolean;
}): boolean {
  return input.existingFirebaseUid === input.incomingFirebaseUid;
}

export function reuseExistingUserIdentity<
  T extends { firebaseUid: string; emailVerified: boolean },
>(
  existing: T,
  incoming: { firebaseUid: string; emailVerified: boolean },
): T {
  if (!shouldReuseUserIdentity({
    existingFirebaseUid: existing.firebaseUid,
    incomingFirebaseUid: incoming.firebaseUid,
    existingEmailVerified: existing.emailVerified,
    incomingEmailVerified: incoming.emailVerified,
  })) {
    throw new AccountLinkRequiredError();
  }

  return existing;
}
