# Security release checklist

Complete this checklist with fresh evidence for every production release. Do
not mark a browser, build, or authenticated flow as passing from source review
or HTTP status alone. Record command output, date, commit SHA, and any blocker
in the release record.

## Local verification

- [ ] `pnpm install --frozen-lockfile` (when validating the lockfile or a fresh install)
- [ ] `pnpm typecheck`
- [ ] `pnpm lint` — record existing warnings separately; do not introduce errors or new warnings.
- [ ] `pnpm test`
- [ ] `pnpm audit --prod` — review every critical/high advisory and record any residual advisory with package path, reachability, exploit precondition, and owner decision.
- [ ] `pnpm build` with a safe, production-like `DATABASE_URL` and required production environment variables. Do not print or commit credentials. If a local database is unavailable for prerendering, record the database blocker; do not call the build successful.
- [ ] `git diff --check`
- [ ] `git status --short` contains no secrets, generated output, or unrelated files.

## Endpoint and regression checks

- [ ] `GET /api/cron/warm-db` without authentication returns 401.
- [ ] `GET /api/cron/supervise-batches` without authentication returns 401.
- [ ] The authenticated cron smoke uses the configured secret without echoing it and succeeds only when a reachable production-like database is available.
- [ ] JSON-LD payloads contain no literal `</script>`; run the safe JSON source-level regression test as part of `pnpm test`.
- [ ] `/login` and `/auth/callback` reject protocol-relative `returnTo` values such as `//attacker.example`.
- [ ] `/api/generate/[id]` returns 404 for another signed-in user's job and for a mismatched anonymous-token job.
- [ ] Production email-link and generation limits are active: Redis credentials and `RATE_LIMIT_SECRET` are set, and an unavailable limiter returns controlled 503 rather than permitting the request.
- [ ] Production QStash configuration is present: `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, and `QSTASH_NEXT_SIGNING_KEY` are set, `INLINE_TASKS=false`, and an internal worker token cannot authorize a production worker request.
- [ ] Verify `CRON_SECRET` matches between Vercel and GitHub Actions without exposing its value; rotate it and any other exposed credential before release.

## CSP browser release gate — currently blocked

The application is intentionally using `Content-Security-Policy-Report-Only`.
Do **not** switch `next.config.ts` to `Content-Security-Policy` until every item
below passes in an interactive browser with console/network inspection. A curl
or other HTTP-only check is insufficient.

- [ ] Enable the candidate enforced CSP in a production-like deployment; retain `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, and `frame-ancestors 'self'`.
- [ ] Public matrix: `/`, `/library`, and a published `/library/<slug>` render with remote images and no functional CSP violation.
- [ ] Firebase matrix: `/login` starts Google redirect sign-in, `/__/auth/handler` and `/__/firebase/init.json` load through the custom-domain rewrites, and the returning session is established.
- [ ] Redirect matrix: `/login?returnTo=//attacker.example` and `/auth/callback?returnTo=//attacker.example` remain on an internal fallback path.
- [ ] Generation matrix: `/generate` accepts a valid supported upload and starts a job without a CSP break.
- [ ] Job-polling matrix: the creating browser polls its job successfully; a different signed-in user and a different anonymous browser cannot read it.
- [ ] Record every blocked resource or CSP console violation, then allow only the verified required origin/directive. `unsafe-eval` must remain absent in production.
- [ ] After all matrix items pass, change the header from report-only to enforced, rerun the full browser matrix, and attach the evidence to the release record.

### Current release blocker (2026-08-18)

The Task 9 verification environment has no available browser runtime, so it
cannot run the interactive matrix or inspect CSP console/network violations.
Keep CSP report-only until a release operator can complete the matrix above in
a real browser. This blocker does not invalidate the independently tested
JSON-LD serialization, cron authentication, SSRF, rate-limit, account-linking,
upload, or job-polling controls.
