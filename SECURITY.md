# Security Policy

## Supported versions

Security fixes are released on `main` and deployed to the current production
version of UIUXskills. Older deployments, forks, and unmaintained commits are
not supported.

| Version | Security support |
| --- | --- |
| Current production deployment from `main` | Supported |
| Earlier deployments and commits | Not supported |

The production runtime requires Node.js 22 or later. Keep Next.js, Firebase,
and the production dependency graph current through the release process below.

## Reporting a vulnerability

Report suspected vulnerabilities privately to
[uiuxofai@gmail.com](mailto:uiuxofai@gmail.com) with the subject
`[SECURITY] UIUXskills`. Include affected URLs or code paths, a safe
reproduction, impact, and any suggested mitigation. Do not open a public issue
or include secrets, user data, or exploit payloads in a public channel.

The maintainer will acknowledge a report within two business days, provide a
status update at least weekly while it is being investigated, and coordinate a
fix and disclosure timeline with the reporter. Reports that are out of scope or
not reproducible will receive a reasoned response. If a credential may be
exposed, say so in the first line so its rotation can start immediately.

## Production security controls

- JSON-LD is serialized through `serializeJsonForHtml`, which escapes markup
  delimiters before data reaches an HTML script element. The regression suite
  also checks every JSON-LD `dangerouslySetInnerHTML` sink.
- The CSP in `next.config.ts` is currently **report-only**. It omits
  `unsafe-eval` and retains the required restrictive directives, but it must
  not be changed to enforced mode until the browser smoke matrix in
  [`docs/security/RELEASE-CHECKLIST.md`](docs/security/RELEASE-CHECKLIST.md)
  passes, including Firebase redirect sign-in and generation polling.
- Server-side URL retrieval uses a shared SSRF-safe fetch boundary: only
  public HTTP(S) destinations are accepted, every redirect hop is revalidated,
  connections are pinned to validated DNS answers, and response bodies,
  redirects, and time are bounded.
- Magic-link requests are limited to 5 per 10 minutes by IP and 3 per hour by
  normalized email. Email identifiers are HMAC-hashed before entering Redis.
  Generation limits are 3 per hour by anonymous IP and 10 per hour by signed-in
  user; editors are exempt. Production limiter configuration and Redis failures
  fail closed with a controlled `503 rate_limit_unavailable` response.
- Generation uploads have declared-body, file-size, image-signature, decode,
  and pixel-count limits. Job polling requires the owning session or the
  matching anonymous cookie; unauthorized and unknown job IDs both return 404.
  Public generation errors use stable codes rather than provider or database
  diagnostics.
- Account identities are never merged automatically across Firebase UIDs, even
  when email addresses match. Post-auth destinations are restricted to
  same-origin internal paths.

## Service boundaries and secrets

| Service | Security boundary | Secret handling |
| --- | --- | --- |
| Firebase Auth | Browser sign-in uses Firebase; server sessions verify Firebase ID tokens with the Admin SDK. Account-link conflicts require an explicit linking flow. | `FIREBASE_ADMIN_CREDENTIALS_B64` is server-only. Never expose it or any service-account JSON to the browser. |
| Supabase Postgres and Storage | Drizzle connects as the table owner; RLS is enabled deny-by-default on application tables. The transaction pooler requires prepared statements to stay disabled. | Keep `DATABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` server-only. The service-role key bypasses RLS and is only for server storage operations. |
| Upstash QStash | Production worker deliveries are signature-verified; the internal-token and inline-dispatch fallbacks are limited to development/test. | `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, and `QSTASH_NEXT_SIGNING_KEY` are required in production. |
| Upstash Redis | Redis enforces generation and magic-link abuse limits. | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and `RATE_LIMIT_SECRET` are required in production; do not allow a production fail-open fallback. |
| Production cron routes | `/api/cron/warm-db` and `/api/cron/supervise-batches` require `Authorization: Bearer <CRON_SECRET>`. Missing or invalid credentials return 401; a production configuration failure returns a non-sensitive error. | Configure the identical `CRON_SECRET` in Vercel and GitHub Actions. GitHub workflows stop before making a request when it is absent. |

## Required production configuration

`src/lib/env.ts` enforces `DATABASE_URL` in every environment and the cron and
rate-limit controls below in production. The remaining values are required when
their server-side features are enabled. Set secrets in Vercel (and the matching
GitHub Actions secret where noted), never in source or `NEXT_PUBLIC_*` variables.

| Variable | Requirement |
| --- | --- |
| `DATABASE_URL` | Required in every environment; use the Supabase transaction-pooler URL in production. |
| `CRON_SECRET` | Required in production; use the same value for the Vercel app and GitHub Actions workflows. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Required in production for rate limiting. |
| `RATE_LIMIT_SECRET` | Required in production; HMAC key for non-reversible email limit keys; at least 32 characters. |
| `FIREBASE_ADMIN_CREDENTIALS_B64` | Required for production server-side Firebase session verification and magic-link administration. |
| `QSTASH_TOKEN` | Required in production for durable worker dispatch. |
| `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY` | Required in production and whenever `QSTASH_TOKEN` is configured. |
| `INLINE_TASKS` | Must be `false` in production. It is an explicit development/test-only local dispatch mode. |
| Firebase `NEXT_PUBLIC_*` configuration | Required for browser Firebase sign-in; these values are public identifiers, not secrets. |

Provider API keys and optional storage credentials must also be set for each
enabled production feature. Missing production rate-limit credentials must take
the affected public endpoint out of service; they must never make it unlimited.

## Secret rotation and incident response

1. Contain the incident: revoke or rotate the exposed credential at its issuer
   (Firebase, Supabase, Upstash, Vercel, or the relevant AI/email provider).
2. Replace the value in Vercel; for `CRON_SECRET`, replace the identical GitHub
   Actions secret in the same maintenance window. For QStash, rotate the token
   and both signing keys together.
3. Redeploy production, then verify affected authentication, queue, cron, and
   rate-limit behavior without logging the replacement secret.
4. Review Vercel, provider, and application logs for use of the exposed value;
   invalidate affected sessions or tokens when the provider supports it.
5. Record the incident, scope, rotation time, and follow-up in the private
   incident record. Do not commit credentials or paste them into issues.

## Dependency audit residuals

`pnpm audit --prod` currently has no critical or high advisories. Two moderate
`uuid` advisories (GHSA-w5hq-g745-h8pq) remain through
`firebase-admin@14.2.0 > @google-cloud/storage@7.19.0`:

- `uuid@8.3.2` directly under Cloud Storage.
- `uuid@9.0.1` through `gaxios@6.7.1`.

The patched UUID floor is outside those parents' declared compatibility ranges.
This application imports only `firebase-admin/app` and `firebase-admin/auth`,
not Firebase Admin Storage, and exploitation additionally requires a Storage
path to call UUID v3/v5/v6 with an attacker-controlled output buffer. This is
an open residual risk, not an audit suppression or approved exception. Recheck
the paths on every Firebase Admin/Cloud Storage release and remove the entry
when upstream supports a patched UUID version.

## Release gate

Before every production release, run the commands and service checks in
[`docs/security/RELEASE-CHECKLIST.md`](docs/security/RELEASE-CHECKLIST.md).
Do not claim CSP enforcement, a production build, or an authenticated browser
flow passed without fresh evidence from that checklist.
