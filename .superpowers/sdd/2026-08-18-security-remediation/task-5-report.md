# Task 5 implementation report — email/generation abuse controls

## Implementation commit

- `ffa87fdffcc5f1cc6d40621689583749bd3cbb12` — `fix: bound authentication and generation abuse`
- `1975c19dbf2eaaa2361b76a379f7f63da49e2d71` — `fix: validate generation upload payloads`

## Delivered controls

- Added a magic-link limiter with independent 5-per-10-minute IP and 3-per-hour normalized-email gates. Email Redis identifiers are HMAC-SHA-256 digests keyed with `RATE_LIMIT_SECRET`; raw addresses are never included in Redis keys.
- Email-link throttling happens before Firebase Admin or Resend. Throttled requests receive the existing generic `200 { ok: true }` shape, while an unavailable production limiter receives `503 { error: "rate_limit_unavailable" }`.
- Capped email-link JSON request bodies at 8 KiB using bounded stream reads and non-sensitive validation errors.
- Made generation and generic per-IP limiter failures fail closed in production. Editors remain exempt from the generation limiter, and development/test retain explicit Redis-free fallbacks.
- Extended the existing production environment refinement to require `RATE_LIMIT_SECRET`, preserving the Task 3 `CRON_SECRET`, Upstash, and QStash checks.
- Rejected declared multipart generation bodies above 4.25 MiB before parsing, leaving 256 KiB of headroom below Vercel's 4.5 MiB request boundary. Uploads cap image files at 4 MiB and normalize multipart media types case-insensitively while preserving parameters.
- Verifies PNG/JPEG/WebP signatures and fully decodes each image with Sharp before hashing, persistence, or queueing. The decoder has a 16 MiB-pixel ceiling, limits processing to one page, checks the decoded format, and rejects malformed header-prefixed payloads and oversized compressed images.

## Files changed

- `src/app/api/auth/email-link/route.ts`
- `src/app/api/generate/route.ts`
- `src/lib/env.ts`
- `src/lib/rate-limit/{auth-email-policy.ts,auth-email.ts,auth-email.test.ts,by-ip.ts,config.ts,index.ts}`
- `src/lib/security/{image-signature.ts,image-signature.test.ts,request-body.ts,request-body.test.ts}`

## Verification

- RED: new focused tests initially failed because the limiter, bounded-body, and signature helpers did not yet exist.
- GREEN: `pnpm exec node --import tsx --test src/lib/rate-limit/auth-email.test.ts src/lib/rate-limit/ip.test.ts src/lib/security/request-body.test.ts src/lib/security/image-signature.test.ts` — 15 passing.
- `pnpm test` — 67 passing, 0 failures.
- `pnpm typecheck` — passed.
- `pnpm lint` — passed with four pre-existing warnings in `LibraryClient.tsx`, `BundlesClient.tsx`, `BrandLogo.tsx`, and `UserMenu.tsx`.
- `git diff --check` — passed.
- Review fix round: `pnpm exec node --import tsx --test src/lib/security/image-signature.test.ts src/lib/security/request-body.test.ts` — 11 passing; `pnpm test` — 72 passing, 0 failures; `pnpm typecheck` — passed; `pnpm lint` — passed with the same four pre-existing warnings.

## Residual concerns

- Requests using chunked multipart transfer have no `Content-Length`; Vercel's 4.5 MiB platform limit remains the outer bound, with post-parse 4 MiB `File.size` and bounded structural image decoding as defense in depth.
- This task intentionally limits the generation upload path named in the remediation plan. The editor-only screenshot upload has separate limits and was not changed.
- Production deployment must provide a 32+ character `RATE_LIMIT_SECRET` alongside the Task 3 Redis credentials; startup now rejects its absence.
