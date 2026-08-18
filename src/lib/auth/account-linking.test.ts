import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AccountLinkRequiredError,
  reuseExistingUserIdentity,
  shouldReuseUserIdentity,
} from './account-linking';

describe('shouldReuseUserIdentity', () => {
  it('allows a verified user to reauthenticate with the same Firebase UID', () => {
    assert.equal(
      shouldReuseUserIdentity({
        existingFirebaseUid: 'firebase-user-1',
        incomingFirebaseUid: 'firebase-user-1',
        existingEmailVerified: true,
        incomingEmailVerified: true,
      }),
      true,
    );
  });

  it('requires explicit provider linking when the same email resolves to a different Firebase UID', () => {
    assert.equal(
      shouldReuseUserIdentity({
        existingFirebaseUid: 'firebase-email-link-user',
        incomingFirebaseUid: 'firebase-google-user',
        existingEmailVerified: true,
        incomingEmailVerified: true,
      }),
      false,
    );
  });

  it('does not merge an unverified incoming identity with a different Firebase UID', () => {
    assert.equal(
      shouldReuseUserIdentity({
        existingFirebaseUid: 'firebase-email-link-user',
        incomingFirebaseUid: 'firebase-unverified-google-user',
        existingEmailVerified: true,
        incomingEmailVerified: false,
      }),
      false,
    );
  });

  it('allows same-UID reauthentication without changing provider-linking semantics', () => {
    assert.equal(
      shouldReuseUserIdentity({
        existingFirebaseUid: 'firebase-user-1',
        incomingFirebaseUid: 'firebase-user-1',
        existingEmailVerified: true,
        incomingEmailVerified: false,
      }),
      true,
    );
  });

  it('prevents a different UID from reaching a privileged account', () => {
    assert.equal(
      shouldReuseUserIdentity({
        existingFirebaseUid: 'firebase-editor',
        incomingFirebaseUid: 'firebase-different-user',
        existingEmailVerified: true,
        incomingEmailVerified: true,
      }),
      false,
    );
  });

  it('returns the original privileged record unchanged for same-UID reauthentication', () => {
    const existingUser = {
      firebaseUid: 'firebase-editor',
      emailVerified: true,
      isEditor: true,
      isVerifiedCreator: true,
    };

    const result = reuseExistingUserIdentity(existingUser, {
      firebaseUid: 'firebase-editor',
      emailVerified: true,
    });

    assert.strictEqual(result, existingUser);
    assert.equal(result.isEditor, true);
    assert.equal(result.isVerifiedCreator, true);
  });

  it('raises the account-link requirement before a cross-UID email collision can mutate a record', () => {
    assert.throws(
      () => reuseExistingUserIdentity(
        { firebaseUid: 'firebase-email-link-user', emailVerified: true, isEditor: true },
        { firebaseUid: 'firebase-google-user', emailVerified: true },
      ),
      AccountLinkRequiredError,
    );
  });
});
