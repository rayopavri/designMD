# Security Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the application security findings from the 2026-08-18 repository review, reduce abuse and supply-chain risk, and leave a repeatable verification path.

**Architecture:** Add small, reusable security helpers for safe HTML-embedded JSON, internal redirects, cron authentication, SSRF-safe fetching, rate-limit configuration, and job-status authorization. Harden the existing route boundaries in place, upgrade vulnerable dependencies, then enforce the tested security headers and document the operational requirements.

**Tech Stack:** Next.js 15.5, React 19, TypeScript, Firebase Admin/Auth, Drizzle/Postgres, Upstash Redis, QStash, Node test runner via `tsx`, pnpm.

**Spec:** `SECURITY.md` plus the repository security review findings recorded on 2026-08-18.

## Global Constraints

- Use `pnpm` for all package, test, lint, typecheck, and build commands.
- Work directly on `main`; do not create feature branches or pull requests.
- Read the relevant guide in `node_modules/next/dist/docs/` before changing Next.js APIs or upgrading Next.js.
- Never expose `DATABASE_URL`, Firebase Admin credentials, Supabase service-role keys, AI keys, QStash tokens, or Redis tokens to the client.
- Production must fail closed when required security controls are not configured.
- Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm audit --prod` after the implementation; run `pnpm build` with a safe build-time `DATABASE_URL` when production env is unavailable.
- Commit each independently verified task with a clear message and push directly to `origin main`.

---

## Workstream Map

The plan is divided into independently reviewable tasks:

1. Regression-test helpers and establish security-test conventions.
2. Fix stored XSS in JSON-LD and enforce the CSP after browser smoke testing.
3. Make cron and production security configuration fail closed.
4. Harden SSRF and bounded response handling for maintenance fetches.
5. Add email/generation abuse controls and protect upload parsing.
6. Remove unsafe automatic account linking and harden internal redirect handling.
7. Authorize job-status polling and remove internal error leakage.
8. Upgrade dependencies and reconcile the lockfile.
9. Update security documentation and complete the verification/release gate.

## File Map

- `src/lib/security/safe-json.ts`: HTML-safe JSON serialization for JSON-LD.
- `src/lib/security/safe-json.test.ts`: regression tests for `</script>` and Unicode edge cases.
- `src/lib/security/cron-auth.ts`: shared constant-time cron/internal-token authorization.
- `src/lib/security/cron-auth.test.ts`: authorization matrix tests.
- `src/lib/security/redirects.ts`: same-origin internal-path validation.
- `src/lib/security/redirects.test.ts`: open-redirect regression tests.
- `src/lib/security/safe-fetch.ts`: redirect-aware SSRF-safe, byte-capped fetch helper.
- `src/lib/security/safe-fetch.test.ts`: private-IP, redirect, timeout, and size-cap tests.
- `src/lib/rate-limit/auth-email.ts`: per-IP and per-email magic-link throttling.
- `src/lib/rate-limit/auth-email.test.ts`: limiter key and policy tests.
- `src/lib/rate-limit/index.ts`, `src/lib/rate-limit/by-ip.ts`: production fail-closed behavior.
- `src/lib/env.ts`: conditional production validation for required security controls.
- `src/lib/auth/account-linking.ts`: explicit account-linking decision logic.
- `src/lib/auth/account-linking.test.ts`: verified-identity and conflicting-UID tests.
- `src/lib/auth/session.ts`: session lookup used by protected polling.
- `src/lib/db/queries/users.ts`: remove unsafe cross-UID overwrite behavior.
- `src/app/api/auth/email-link/route.ts`: apply throttling and generic responses.
- `src/app/api/auth/session/route.ts`: expose a safe account-link-required response.
- `src/app/api/cron/warm-db/route.ts`: require authentication unconditionally.
- `src/app/api/cron/supervise-batches/route.ts`: use the shared cron auth helper.
- `src/app/api/admin/backfill-logos/route.ts`: use SSRF-safe bounded fetching.
- `src/app/api/generate/route.ts`: reject oversized uploads before multipart parsing where possible and stop returning raw exceptions.
- `src/app/api/generate/[id]/route.ts`: authorize status reads and return safe error fields.
- `src/app/(public)/page.tsx`, `src/app/(public)/for/[tool]/page.tsx`, `src/app/(public)/library/page.tsx`, `src/app/(public)/library/[slug]/page.tsx`, `src/app/(public)/library/category/[slug]/page.tsx`: use safe JSON-LD serialization.
- `next.config.ts`: switch the tested CSP from report-only to enforced mode.
- `package.json`, `pnpm-lock.yaml`: dependency upgrades.
- `SECURITY.md`, `README.md`, `TECH-STACK.md`: reporting, deployment, and security-control documentation.

---

### Task 1: Add regression-testable security primitives

**Files:**
- Create: `src/lib/security/safe-json.ts`
- Create: `src/lib/security/safe-json.test.ts`
- Create: `src/lib/security/redirects.ts`
- Create: `src/lib/security/redirects.test.ts`
- Create: `src/lib/security/cron-auth.ts`
- Create: `src/lib/security/cron-auth.test.ts`

**Interfaces:**
- `serializeJsonForHtml(value: unknown): string` returns JSON safe to place inside an HTML `<script>` element.
- `safeInternalPath(value: string | null | undefined, fallback: string): string` returns a same-origin path or the fallback.
- `isCronAuthorized(req: Request, options: { cronSecret?: string; internalTaskToken?: string; allowInternalDevFallback: boolean; nodeEnv: string }): boolean` returns false when production credentials are missing.

- [ ] **Step 1: Write failing JSON serialization tests.** Cover a string containing `</script><script>alert(1)</script>`, ampersands, U+2028/U+2029, nested objects, and `undefined` behavior matching `JSON.stringify`.

```ts
test('escapes HTML-breaking characters', () => {
  const output = serializeJsonForHtml({ value: '</script><script>alert(1)</script>' });
  assert.doesNotMatch(output, /<\/script>/i);
  assert.match(output, /\\u003c\\/script\\u003e/);
});
```

- [ ] **Step 2: Write failing redirect tests.** Accept `/account?tab=bundles` and `/`, reject `//evil.example`, `/\\evil.example`, `https://evil.example`, `javascript:alert(1)`, and control characters.

- [ ] **Step 3: Write failing cron authorization tests.** Cover correct bearer secret, wrong secret, missing production secret, local internal-token fallback, and wrong internal token.

- [ ] **Step 4: Implement the helpers.** Escape `<`, `>`, `&`, U+2028, and U+2029 after `JSON.stringify`; validate redirects by resolving against a fixed same-origin base and rejecting protocol-relative paths; use `crypto.timingSafeEqual` only after equal-length buffers for secret comparisons.

- [ ] **Step 5: Run focused tests.**

Run: `node --import tsx --test src/lib/security/*.test.ts`

Expected: all new tests pass.

- [ ] **Step 6: Commit.**

```bash
git add src/lib/security
git commit -m "test: add security boundary helpers"
git push origin main
```

### Task 2: Fix stored XSS and enforce CSP

**Files:**
- Modify: `src/app/(public)/page.tsx:107`
- Modify: `src/app/(public)/for/[tool]/page.tsx:102`
- Modify: `src/app/(public)/library/page.tsx:57`
- Modify: `src/app/(public)/library/[slug]/page.tsx:168`
- Modify: `src/app/(public)/library/category/[slug]/page.tsx:109`
- Modify: `next.config.ts:49-92`
- Test: `src/lib/security/safe-json.test.ts`

**Interfaces:**
- Consumes `serializeJsonForHtml` from Task 1.
- Produces JSON-LD script content that cannot terminate its containing script element.

- [ ] **Step 1: Replace every `JSON.stringify(jsonLd)` and `JSON.stringify(collectionJsonLd)` passed to `dangerouslySetInnerHTML` with `serializeJsonForHtml(...)`.** Do not use the helper for ordinary React text nodes.

- [ ] **Step 2: Add a source-level guard test or review check.** Search the application for `dangerouslySetInnerHTML` and confirm every JSON-LD occurrence uses the helper; no raw JSON-LD serialization remains.

- [ ] **Step 3: Run a browser smoke test before enforcing CSP.** Verify `/`, `/library`, `/library/<published-slug>`, `/login`, `/auth/callback`, and `/generate` with Firebase/auth and remote images available. Record any blocked resources from the existing report-only header.

- [ ] **Step 4: Change the header key from `Content-Security-Policy-Report-Only` to `Content-Security-Policy`.** Preserve only origins verified by the smoke test. Keep `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, and `frame-ancestors 'self'`. Remove `unsafe-eval` if the smoke test shows it is not required; if it is required by a dependency, document the dependency and track nonce/hash hardening separately.

- [ ] **Step 5: Run verification.**

Run: `pnpm typecheck && pnpm lint && pnpm test`

Expected: typecheck and tests pass; lint has no new warnings; the browser smoke routes load without CSP violations that break auth or generation.

- [ ] **Step 6: Commit.**

```bash
git add src/app next.config.ts src/lib/security/safe-json.test.ts
git commit -m "fix: prevent JSON-LD script injection"
git push origin main
```

### Task 3: Make cron and production security configuration fail closed

**Files:**
- Modify: `src/lib/env.ts:48-85`
- Modify: `src/lib/security/cron-auth.ts`
- Modify: `src/app/api/cron/warm-db/route.ts:35-42`
- Modify: `src/app/api/cron/supervise-batches/route.ts:30-44`
- Test: `src/lib/security/cron-auth.test.ts`
- Modify: `.github/workflows/warm-db.yml`
- Modify: `.github/workflows/supervise-batches.yml`

**Interfaces:**
- `warm-db` and `supervise-batches` both use `isCronAuthorized`.
- Production env parsing rejects missing `CRON_SECRET` and missing Upstash rate-limit credentials; QStash signing credentials are required whenever `QSTASH_TOKEN` is set.

- [ ] **Step 1: Add failing tests for production configuration.** Test that a production env without `CRON_SECRET` or Upstash credentials is rejected, while test/development envs can run with the documented local fallbacks.

- [ ] **Step 2: Update `env.ts` with a post-parse production refinement.** Require `CRON_SECRET`, `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN` in production. If `QSTASH_TOKEN` is present, require both signing keys. Keep local development behavior explicit rather than implicit.

- [ ] **Step 3: Make `warm-db` fail closed.** Remove the current optional-auth branch. Return `401` for an invalid/missing bearer token and `503` with a non-sensitive configuration error if production startup somehow bypasses env validation.

- [ ] **Step 4: Make `supervise-batches` use the shared helper.** Preserve the internal task-token fallback only for non-production environments; never allow an unauthenticated production request.

- [ ] **Step 5: Update GitHub Actions checks.** Make both workflows fail before `curl` when `CRON_SECRET` is missing, and keep the same secret name on GitHub and Vercel.

- [ ] **Step 6: Run focused and project checks.**

Run: `node --import tsx --test src/lib/security/cron-auth.test.ts && pnpm typecheck && pnpm test`

Expected: missing production credentials fail closed; local test fixtures continue to work.

- [ ] **Step 7: Commit.**

```bash
git add src/lib/env.ts src/lib/security/cron-auth.ts src/lib/security/cron-auth.test.ts src/app/api/cron .github/workflows
git commit -m "fix: fail closed on cron and rate-limit configuration"
git push origin main
```

### Task 4: Harden SSRF and bounded response handling

**Files:**
- Create: `src/lib/security/safe-fetch.ts`
- Create: `src/lib/security/safe-fetch.test.ts`
- Modify: `src/lib/generator/prefetch-names.ts:125-228`
- Modify: `src/app/api/admin/backfill-logos/route.ts:39-59`

**Interfaces:**
- `safeFetchHtml(url: string, options?: { deadlineMs?: number; timeoutMs?: number; maxBytes?: number; maxRedirects?: number; headers?: HeadersInit }): Promise<string | null>` validates every redirect hop, rejects private/link-local/loopback/CGNAT/ULA addresses, requires HTTP(S), bounds body size, and aborts on timeout.
- `isBlockedIp(ip: string): boolean` remains pure and testable.

- [ ] **Step 1: Move the existing SSRF guard into `safe-fetch.ts` without changing behavior.** Preserve DNS lookup of all addresses and reject a hostname if any resolved address is blocked.

- [ ] **Step 2: Write tests for loopback, link-local, private IPv4, CGNAT, IPv4-mapped IPv6, ULA IPv6, unsafe schemes, redirects to blocked hosts, redirect limits, and oversized response bodies.** Mock `fetch` and DNS at the helper boundary.

- [ ] **Step 3: Update `prefetch-names.ts` to call the shared helper.** Keep metadata parsing and Gemini behavior unchanged.

- [ ] **Step 4: Update `backfill-logos` to call the shared helper.** Use a 4-second per-hop timeout, an overall 8-second deadline, a 64 KiB HTML cap, manual redirects, and the existing HTML content-type check. Do not return full source URLs in error bodies.

- [ ] **Step 5: Run focused tests.**

Run: `node --import tsx --test src/lib/security/safe-fetch.test.ts src/lib/generator/url.test.ts`

Expected: blocked destinations never reach `fetch`; valid public redirects still work; oversized bodies are truncated or rejected.

- [ ] **Step 6: Commit.**

```bash
git add src/lib/security/safe-fetch.ts src/lib/security/safe-fetch.test.ts src/lib/generator/prefetch-names.ts src/app/api/admin/backfill-logos/route.ts
git commit -m "fix: harden server-side URL fetching against SSRF"
git push origin main
```

### Task 5: Add email/generation abuse controls and safe upload limits

**Files:**
- Create: `src/lib/rate-limit/auth-email.ts`
- Create: `src/lib/rate-limit/auth-email.test.ts`
- Modify: `src/lib/rate-limit/index.ts`
- Modify: `src/lib/rate-limit/by-ip.ts`
- Modify: `src/app/api/auth/email-link/route.ts:30-79`
- Modify: `src/app/api/generate/route.ts:247-285`
- Modify: `src/lib/env.ts`

**Interfaces:**
- `rateLimitEmailLink(req: Request, email: string): Promise<{ ok: true } | { ok: false; retryAfter: number }>` applies both IP and normalized-email limits.
- Production rate-limit helpers return a controlled configuration failure rather than silently allowing unlimited requests.

- [ ] **Step 1: Write failing limiter tests.** Cover normalized email keys, distinct endpoint prefixes, local-development behavior, and production-missing-Redis behavior.

- [ ] **Step 2: Implement email-link throttling.** Use a per-IP limit of 5 requests per 10 minutes and a per-email limit of 3 requests per hour. Hash the normalized email with `RATE_LIMIT_SECRET` before placing it in Redis; do not put raw addresses in keys.

- [ ] **Step 3: Apply the limiter before calling Firebase Admin or Resend.** Return a generic `200 { ok: true }`-shaped response for throttled requests to avoid giving attackers useful delivery signals; include `Retry-After` only if product UX requires it.

- [ ] **Step 4: Make generic rate-limit helpers fail closed in production.** Return a non-sensitive `503 rate_limit_unavailable` response from affected routes when Redis is absent, rather than the current unlimited path.

- [ ] **Step 5: Reject oversized multipart requests before parsing when `Content-Length` is available.** Set the accepted request envelope to 6 MiB image bytes plus 512 KiB multipart overhead and return `413`. Keep the existing `File.size` check as defense in depth. Document that chunked-body enforcement is delegated to the platform body limit.

- [ ] **Step 6: Run tests and typecheck.**

Run: `node --import tsx --test src/lib/rate-limit/auth-email.test.ts src/lib/rate-limit/ip.test.ts && pnpm typecheck`

Expected: email requests are bounded; production without Redis is unavailable rather than unmetered; valid uploads remain accepted.

- [ ] **Step 7: Commit.**

```bash
git add src/lib/rate-limit src/lib/env.ts src/app/api/auth/email-link/route.ts src/app/api/generate/route.ts
git commit -m "fix: bound authentication and generation abuse"
git push origin main
```

### Task 6: Remove unsafe automatic account linking and harden redirects

**Files:**
- Create: `src/lib/auth/account-linking.ts`
- Create: `src/lib/auth/account-linking.test.ts`
- Modify: `src/lib/db/queries/users.ts:66-93`
- Modify: `src/app/api/auth/session/route.ts:55-67`
- Modify: `src/lib/ui-data/mockAuth.ts:382-388`
- Modify: `src/app/(auth)/login/page.tsx:12-18`
- Modify: `src/app/(auth)/welcome/page.tsx:34-67`
- Modify: `src/app/auth/callback/page.tsx:30-87`

**Interfaces:**
- `shouldReuseUserIdentity(input: { existingFirebaseUid: string; incomingFirebaseUid: string; existingEmailVerified: boolean; incomingEmailVerified: boolean }): boolean` returns true only for the same Firebase UID; a different UID requires explicit provider linking.
- All post-auth destinations pass through `safeInternalPath` from Task 1.

- [ ] **Step 1: Write failing identity tests.** Same UID passes; different UID fails even when the email matches; unverified incoming identities never merge.

- [ ] **Step 2: Remove the `users.email` conflict handler that overwrites `firebaseUid`.** On a conflicting Firebase UID, throw a typed `ACCOUNT_LINK_REQUIRED` error instead of silently transferring the account.

- [ ] **Step 3: Map the typed error to a safe `409 account_link_required` response in `/api/auth/session`.** Do not return existing user IDs, provider details, or database error text.

- [ ] **Step 4: Route every `returnTo` value through `safeInternalPath`.** Apply it in the login effect, welcome redirects, email callback, Google redirect storage, and the final welcome navigation. This closes the `//attacker.example` protocol-relative case in every path.

- [ ] **Step 5: Run focused tests and inspect auth flows.**

Run: `node --import tsx --test src/lib/auth/account-linking.test.ts src/lib/security/redirects.test.ts`

Expected: no automatic cross-provider account takeover path; invalid return destinations always resolve to `/generate`.

- [ ] **Step 6: Commit.**

```bash
git add src/lib/auth src/lib/db/queries/users.ts src/app/api/auth/session/route.ts src/app/'(auth)' src/app/auth/callback/page.tsx
git commit -m "fix: require explicit account linking and safe redirects"
git push origin main
```

### Task 7: Protect job-status polling and stop leaking internal errors

**Files:**
- Create: `src/lib/auth/job-access.ts`
- Create: `src/lib/auth/job-access.test.ts`
- Modify: `src/app/api/generate/[id]/route.ts:35-105`
- Modify: `src/app/api/generate/route.ts:99-105,111-125,220-237`
- Modify: `src/lib/generator/scrape-and-extract.ts:340-365`
- Modify: `src/lib/generator/author-design-md.ts`
- Modify: `src/lib/generator/generate-companion-task.ts`

**Interfaces:**
- `canReadGenerationJob(job: { userId: string | null; anonToken: string | null }, viewer: { userId: string | null; anonToken: string | null }): boolean` authorizes an owner session or matching anonymous cookie.
- `publicGenerationError(status: string, step: string | null): string` maps internal failures to stable user-facing messages.

- [ ] **Step 1: Write failing access tests.** A signed-in user can read only their own job; an anonymous caller can read only a job with the same anonymous token; missing/mismatched credentials return false.

- [ ] **Step 2: Authorize `/api/generate/[id]`.** Load the current user and anonymous cookie, require ownership before returning URL, status, bundle IDs, or timestamps, and return `404` for unauthorized/unknown jobs so the endpoint does not become an oracle.

- [ ] **Step 3: Replace raw exception details in `/api/generate`.** Keep detailed errors in server logs and the database, but return stable messages such as `invalid_request`, `database_unavailable`, `queue_unavailable`, and `generation_failed`.

- [ ] **Step 4: Sanitize polling errors.** Return only approved public failure messages; do not expose provider responses, database exception strings, URLs containing credentials, or stack-like messages.

- [ ] **Step 5: Run focused tests and the full suite.**

Run: `node --import tsx --test src/lib/auth/job-access.test.ts src/lib/generator/*.test.ts src/lib/queue/queue.test.ts && pnpm test`

Expected: unauthorized job IDs behave like missing IDs; all existing polling and pipeline tests pass.

- [ ] **Step 6: Commit.**

```bash
git add src/lib/auth/job-access.ts src/lib/auth/job-access.test.ts src/app/api/generate src/lib/generator
git commit -m "fix: authorize job polling and redact generation errors"
git push origin main
```

### Task 8: Upgrade vulnerable dependencies and reconcile the lockfile

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Review: `node_modules/next/dist/docs/` before changing Next.js

**Interfaces:**
- The application remains on a supported Next.js major unless the upgrade requires a documented migration; no vulnerability is suppressed without a written reachability rationale.

- [ ] **Step 1: Inspect current package availability and Next migration notes.** Run `pnpm outdated` and read the relevant Next.js 15/16 upgrade guidance before changing the pinned Next version.

- [ ] **Step 2: Upgrade direct vulnerable packages to patched floors.** At minimum target `js-yaml >=4.3.1`, `nanoid >=5.1.16`, and a patched `sharp`. Upgrade `@mendable/firecrawl-js`, Firebase packages, Google Cloud packages, Drizzle/Gel, and Next to versions that remove the vulnerable transitive `axios`, `@grpc/grpc-js`, `protobufjs`, `form-data`, `postcss`, `shell-quote`, `websocket-driver`, and `ws` paths.

- [ ] **Step 3: Regenerate and inspect the lockfile.** Run `pnpm install`, then `pnpm why` for every package still reported by `pnpm audit`.

- [ ] **Step 4: Do not use blanket vulnerability ignores.** If an advisory remains because a package is unreachable, record the package path, runtime reachability, exploit precondition, and owner-approved exception in `SECURITY.md`; otherwise continue upgrading or remove unused dependencies.

- [ ] **Step 5: Run the full validation suite.**

Run: `pnpm audit --prod && pnpm typecheck && pnpm lint && pnpm test`

Expected: zero critical/high advisories where patched releases are available, or an explicit documented exception for each remaining advisory.

- [ ] **Step 6: Commit.**

```bash
git add package.json pnpm-lock.yaml SECURITY.md
git commit -m "chore: upgrade vulnerable production dependencies"
git push origin main
```

### Task 9: Document controls and perform release verification

**Files:**
- Modify: `SECURITY.md`
- Modify: `README.md`
- Modify: `TECH-STACK.md`
- Create: `docs/security/RELEASE-CHECKLIST.md`

**Interfaces:**
- Documentation names the actual reporting contact/process, required production environment controls, supported versions, and the exact verification commands.

- [ ] **Step 1: Replace the boilerplate `SECURITY.md`.** Document supported versions, vulnerability reporting contact, expected response times, secret rotation procedure, and the security boundaries around Firebase, Supabase, QStash, Redis, and production cron routes.

- [ ] **Step 2: Document required production variables.** Include `CRON_SECRET`, both Upstash Redis variables, QStash signing keys when QStash is enabled, Firebase Admin credentials, and the rule that rate limiting must not run fail-open in production.

- [ ] **Step 3: Add `docs/security/RELEASE-CHECKLIST.md`.** Include:

```text
[ ] pnpm typecheck
[ ] pnpm lint
[ ] pnpm test
[ ] pnpm audit --prod
[ ] pnpm build with production-like DATABASE_URL
[ ] GET /api/cron/warm-db without auth returns 401
[ ] GET /api/cron/supervise-batches without auth returns 401
[ ] JSON-LD payloads contain no literal </script>
[ ] /login and /auth/callback reject protocol-relative returnTo values
[ ] /api/generate/[id] rejects another user's/anonymous session's job
[ ] email-link and generation limits are active in production
[ ] browser smoke test passes with enforced CSP
[ ] Vercel and GitHub Actions secrets match and are rotated if exposed
```

- [ ] **Step 4: Run the release checklist and inspect `git diff --check`.** Confirm no secrets, generated files, or unrelated changes are included.

- [ ] **Step 5: Commit and push the documentation.**

```bash
git add SECURITY.md README.md TECH-STACK.md docs/security/RELEASE-CHECKLIST.md
git commit -m "docs: document security controls and release checks"
git push origin main
```

## Final Verification Gate

- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm lint` and confirm no new warnings.
- [ ] Run `pnpm test` and confirm all tests pass.
- [ ] Run `pnpm audit --prod` and review every remaining critical/high advisory.
- [ ] Run `pnpm build` with a safe production-like `DATABASE_URL`; do not print or commit credentials.
- [ ] Perform authenticated and unauthenticated smoke tests for both cron routes.
- [ ] Perform browser smoke tests with enforced CSP on public pages, login, callback, generation, and library detail pages.
- [ ] Confirm `git status --short` contains no unexpected files.
- [ ] Confirm each task was committed and pushed directly to `main`.

## Rollback Notes

- JSON-LD escaping and authorization changes are independently reversible by commit, but rollback should not restore raw `dangerouslySetInnerHTML` JSON or unauthenticated cron behavior.
- Dependency rollback requires restoring both `package.json` and `pnpm-lock.yaml` from the same commit.
- If enforced CSP breaks Firebase redirect auth, temporarily restore report-only mode only while diagnosing the exact blocked origin; keep the JSON-LD serializer and all auth/cron/SSRF fixes active.
