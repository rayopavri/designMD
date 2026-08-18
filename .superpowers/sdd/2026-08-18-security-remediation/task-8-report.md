# Task 8 — Production dependency remediation report

Date: 2026-08-18

## Audit outcome

| Audit run | Critical | High | Moderate | Low | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Before remediation | 2 | 23 | 27 | 1 | 53 |
| After remediation | 0 | 0 | 2 | 0 | 2 |

The current `pnpm audit --prod` result has no critical or high production
advisories. No audit suppressions, ignores, or lockfile edits were used.

## Package and lockfile changes

- Upgraded Next from 15.5.23 to 16.3.1, alongside React and React DOM 19.2.8
  and `eslint-config-next` 16.3.1. Next 16 removes `next lint` and the
  `eslint` config key, so `pnpm lint` now invokes the existing flat ESLint
  configuration directly. Its mandatory JSX compiler setting updated
  `tsconfig.json` from `preserve` to `react-jsx`.
- Upgraded Firebase to 12.17.1 and Firebase Admin to 14.2.0; Google Secret
  Manager and Cloud Tasks to 6.3.0; Firecrawl to 4.32.2; Google GenAI to
  2.17.1; Google Design.md to 0.4.0; and the Anthropic SDK to 0.117.1.
- Raised direct patched floors: `js-yaml` 4.3.1, `nanoid` 5.1.16, and `sharp`
  0.35.3. Drizzle ORM is already at its latest compatible release (0.45.2).
- Used scoped pnpm overrides for patched versions that remain compatible with
  their parents: `shell-quote` 1.9.0, `websocket-driver` 0.7.5, `ws` 8.21.0,
  `protobufjs` 7.6.5, gRPC 1.9.16/1.14.4, and form-data 2.5.6/4.0.6.
- Regenerated `pnpm-lock.yaml` only through `pnpm add`, `pnpm pkg set`, and
  `pnpm install`.

## Compatibility work

The Next 15→16 migration guidance was reviewed before upgrading. The source
already used asynchronous request APIs and had no synchronous route/page
parameter access. It does not use a custom webpack config or PPR. The retained
`src/middleware.ts` convention remains supported but is deprecated upstream.

Anthropic SDK 0.117 adds required citation metadata to beta text blocks, making
the previous hand-written content type predicate invalid. A tested structural
extractor now handles citation-bearing text blocks and ignores non-text blocks.

## Residual risk

`pnpm why uuid --prod` identifies two moderate GHSA-w5hq-g745-h8pq paths:

1. `firebase-admin > @google-cloud/storage > uuid@8.3.2`
2. `firebase-admin > @google-cloud/storage > gaxios > uuid@9.0.1`

Firebase Admin 14.2.0 and Cloud Storage 8.0.0 are the latest available
releases. The patched UUID floor (11.1.1) falls outside both parent dependency
ranges, so it was not forced. The app imports only Firebase Admin's `app` and
`auth` subpaths, whose entry points do not import Storage. Exploitation also
requires a Storage code path to use UUID v3/v5/v6 with an attacker-controlled
output buffer. This remains open and is documented in `SECURITY.md`; it is not
an owner-approved exception or audit suppression.

## Verification

- `pnpm install` completed with the regenerated lockfile.
- `pnpm audit --prod`: 0 critical, 0 high, 2 moderate (the documented UUID
  paths above).
- `pnpm typecheck`: passed.
- `pnpm lint`: completed with 0 errors and 4 pre-existing warnings (two hook
  dependency warnings and two `no-img-element` warnings). Next 16's new React
  Compiler rules are disabled pending a dedicated UI migration so lint preserves
  the prior project baseline.
- `pnpm test`: passed, 100 tests / 0 failures.
- `pnpm build` with production-mode placeholder configuration compiled and ran
  TypeScript successfully, then could not prerender database-backed public pages
  because the safe local `DATABASE_URL` has no running Postgres server. A clean
  output build reached the expected database query and failed with
  `ECONNREFUSED`; no source or dependency compatibility failure remained.
