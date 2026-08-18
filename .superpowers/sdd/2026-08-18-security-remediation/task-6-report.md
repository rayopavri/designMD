# Task 6 implementation report — explicit account linking and safe auth redirects

## Implementation commit

- `01d8aecb28d4fa9c350dcbb1e85adb55e0c845ff` — `fix: require explicit account linking and safe redirects`

## Delivered controls

- Removed the email-conflict fallback that rewrote an existing `users.firebaseUid`. A same-email, different-UID identity now raises the typed `ACCOUNT_LINK_REQUIRED` error; the existing database row, including `is_editor` and `is_verified_creator`, is not updated.
- Preserved normal same-UID reauthentication through the existing Firebase-UID conflict handler. The defensive email-conflict race path returns the original record unchanged only when both identities have the same Firebase UID.
- Mapped the typed identity conflict in `POST /api/auth/session` to `409 { "error": "account_link_required" }`, without returning user IDs, provider data, or database error text. Firebase ID-token and session-cookie verification remain unchanged.
- Applied `safeInternalPath(..., '/generate')` to the login page, welcome page, email callback, auth modal entry, Google redirect session storage, and final post-auth destination.
- Strengthened `safeInternalPath` to reject protocol-relative and backslash authority forms, absolute URLs, control characters (including percent-encoded controls), malformed percent encodings, and percent-encoded slash/backslash authority changes. Valid encoded internal paths remain supported.

## Files changed

- `src/lib/auth/account-linking.ts`
- `src/lib/auth/account-linking.test.ts`
- `src/lib/db/queries/users.ts`
- `src/app/api/auth/session/route.ts`
- `src/lib/security/redirects.ts`
- `src/lib/security/redirects.test.ts`
- `src/lib/ui-data/mockAuth.ts`
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/welcome/page.tsx`
- `src/app/auth/callback/page.tsx`

## Verification

- RED: the new account-linking module tests failed before the helper existed; new encoded redirect cases failed against the prior redirect helper.
- Focused: `node --import tsx --test src/lib/auth/account-linking.test.ts src/lib/security/redirects.test.ts` — 12 passing, 0 failures.
- `pnpm test` — 81 passing, 0 failures.
- `pnpm typecheck` — passed.
- `pnpm lint` — passed with four pre-existing warnings in `LibraryClient.tsx`, `BundlesClient.tsx`, `BrandLogo.tsx`, and `UserMenu.tsx`.
- `git diff --check` — passed before the implementation commit.

## Residual concerns

- This task intentionally requires Firebase-level, authenticated provider linking to produce one Firebase UID; it does not add a new provider-linking UI or API. A collision receives the generic 409 response until linking occurs through the appropriate authenticated Firebase flow.
- No production Firebase or database integration test was run because it would require live credentials. The focused tests cover the identity-decision and privilege-preservation boundary; the session route retains the existing Firebase verification calls unchanged.
- A production build was not run because no safe production-like `DATABASE_URL` was supplied; the required focused tests, full test suite, typecheck, and lint all completed successfully.
