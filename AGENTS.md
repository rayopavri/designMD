# UIUXskills — Agent instructions

This is the source for [uiuxskills.com](https://uiuxskills.com): a platform for browsing, generating, and using DESIGN.md bundles paired with calibrated Claude prompts. Users paste a URL, a 3-worker AI pipeline produces a validated DESIGN.md spec + companion prompt, and the result is published to a searchable library.

---

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Git workflow: commit directly to main

The user has granted standing permission to push directly to `main`. **Do not create or use `claude/*` (or any other feature) branches**, even when the harness assigns one. Workflow for every change:

1. Make the edit on `main` locally (`git checkout main && git pull origin main` first if not already there).
2. Commit with a clear message.
3. `git push origin main`.
4. Do not open a pull request. Every push triggers a production Vercel build automatically.

Rationale: solo project, preview deploys are intentionally restricted to `main` in `vercel.json` (production env vars aren't scoped to previews), so feature branches add friction with no upside.

Override only if the user explicitly asks for a branch + PR for a specific change (e.g., "open a draft PR so I can review before merging").

---

# Commands

pnpm only. The repository has a Node test suite (`*.test.ts`, run through
`tsx`); run `pnpm test` as well as `pnpm typecheck` and `pnpm lint` after
runtime changes.

| Command | Use |
|---|---|
| `pnpm dev` | Dev server. `INLINE_TASKS=true` runs the 3-worker pipeline in-process (no QStash). |
| `pnpm test` | Node test suite. The script supplies synthetic local `DATABASE_URL` and internal-task values; it does not require a reachable database. |
| `pnpm typecheck` | `tsc --noEmit` — the first check after any edit; needs no env vars. |
| `pnpm lint` | `eslint .`. Next 16 does not run ESLint during builds, so run this explicitly; the current baseline has four unrelated warnings. |
| `pnpm build` | `next build`. Imports `src/lib/env.ts`, which Zod-validates env **at import time**, so `DATABASE_URL` must be set or the build throws. |
| `pnpm db:generate` | Drizzle diff of `schema.ts` vs the last snapshot → new migration file. Offline (no DB). Run after any schema change. |
| `pnpm db:migrate` | Apply migrations (three-phase — see Database). Needs DB access. |
| `pnpm db:push` | Applies schema without a migration file — avoid on shared/prod DBs; it causes snapshot drift. |
| `pnpm db:studio` / `pnpm db:seed` | Drizzle Studio / seed data. Need DB access. |
| `pnpm search:build` | Rebuild the Orama search index (`scripts/build-search-index.ts`). |

Every `db:*` command except `db:generate` hits the pooler on port 6543 — blocked on Deloitte office WiFi, so tether to a hotspot.

---

# Architecture overview

## Generation pipeline

Three QStash task workers run the generation pipeline:

1. `POST /api/internal/tasks/scrape-and-extract` — Firecrawl scrapes the URL + fixed 1440×900 screenshot; Gemini 3.1 Flash-Lite extracts brand tokens (palette, typography, components, design styles, category).
2. `POST /api/internal/tasks/author-design-md` — Gemini 3.1 Flash-Lite writes the DESIGN.md; `@google/design.md` lints it.
3. `POST /api/internal/tasks/generate-companion` — Claude Sonnet 4.6 writes the companion system prompt.

After scrape/extract persists the shared phase payload, it dispatches authoring
and companion work in parallel. `src/lib/queue/` handles dispatch.
`INLINE_TASKS=true` bypasses QStash only in local development/test; production
requires signed QStash deliveries.

Gemini-owned extraction and authoring calls use direct Gemini by default.
`AI_PROVIDER=openrouter` is an explicit, opt-in transport selection for those
calls and requires `OPENROUTER_API_KEY`; it is not an automatic fallback and
does not affect Firecrawl or the direct Anthropic companion worker.

## Database

Supabase Postgres 17 via Drizzle ORM. Schema at `src/lib/db/schema.ts` — 16 tables, 7 enums, and 7 triggers (vote counting, slug uniqueness, etc.). Row Level Security is enabled on every table (deny-by-default, no policies); the app connects as the table-owner role and bypasses it, so RLS is transparent to the app. See `docs/DATABASE-SECURITY.md`.

**Critical:** the connection uses the transaction pooler (port 6543). `src/lib/db/client.ts` disables prepared statements when the URL contains `:6543` because PgBouncer transaction mode forbids them. Do not remove that toggle.

**Migrations run in three phases** via `pnpm db:migrate` (`scripts/migrate.ts`), not just the Drizzle folder:

1. `0000_init.sql` — extensions + validation functions that the `schema.ts` CHECK constraints call (`all_valid_tools`, `all_valid_design_styles`, `all_valid_hex_colors`, …).
2. Drizzle migrations in `_journal.json` order.
3. `9999_triggers_and_seed.sql` — triggers + category seed.

`0000_init.sql` and `9999_triggers_and_seed.sql` are hand-written (NOT drizzle-generated) and both re-run on every `db:migrate`, so keep them idempotent. A new table must include `.enableRLS()` in `schema.ts` so the generated migration keeps RLS on.

## Auth

Firebase Auth. Server-side token verification via Admin SDK (`src/lib/auth/`); client-side sign-in via Firebase JS SDK. Authorization is via **boolean flags on the `users` table**, not a role enum: `is_editor` (privileged actions — unlimited rate limit, auto-publish on generate) and `is_verified_creator`. The editor gate is enforced in `src/lib/auth/session.ts`.

Google sign-in uses `signInWithRedirect` (not popup — see the comment in `src/lib/ui-data/mockAuth.ts`) against the custom auth domain `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=uiuxskills.com`. That requires `next.config.ts` to proxy **both** `/__/auth/:path*` and `/__/firebase/:path*` to `designmd-2ff95.firebaseapp.com` — see the gotcha below and `TECH-STACK.md` for the full failure mode.

## Feature flags

The previous `PHASE_2_SHELVES_ENABLED` flag (formerly in `src/lib/ui-data/featureFlags.ts`) has been removed. Phase 2 surfaces (CLI shelf, skills/agents/MCPs) are currently not rendered. The `discovery_candidates` and related Phase 2 schema tables exist but are not yet wired to fetchers, classifiers, or admin UI — see `ROADMAP.md`.

## Search

Orama in-process full-text index. Rebuilt with `pnpm search:build`. Served from `GET /api/search`.

## Rate limiting

Upstash Redis sliding window on `/api/generate`: 3/hour anonymous (by IP), 10/hour signed-in, unlimited for editors.

---

# Key file locations

| What | Where |
|---|---|
| DB schema | `src/lib/db/schema.ts` |
| Drizzle queries | `src/lib/db/queries/` |
| AI author prompts | `src/lib/ai/generate-design-md.ts`, `src/lib/generator/` |
| Gemini extraction | `src/lib/ai/gemini.ts` |
| QStash workers | `src/app/api/internal/tasks/` |
| Design tokens | `src/lib/ui-data/tokens.ts` |
| Auth helpers | `src/lib/auth/` |
| Rate limiting | `src/lib/rate-limit/` |
| Shell / nav | `src/components/ui/Shell.tsx` |
| Migration runner + SQL phases | `scripts/migrate.ts`, `src/lib/db/migrations/` |
| Database security / RLS | `docs/DATABASE-SECURITY.md` |

---

# Constraints and gotchas

- **Vercel worker timeouts (Pro: 300s standard / 800s Fluid)** — `scrape-and-extract` and `author-design-md` each pin `maxDuration = 300s` with 290s watchdogs; `generate-companion` pins 180s. The split preserves parallelism and retry isolation, not an old 60s cap. Don't collapse workers.
- **Runtime/dependencies** — Next.js is pinned to 16.3.1, React to 19.2.8, and `package.json` requires Node.js 22+. The latest recorded production audit has no critical/high findings and two documented moderate Firebase Admin/Cloud Storage UUID paths; re-run `pnpm audit --prod` when changing dependencies.
- **PgBouncer transaction mode** — no prepared statements via the pooler. `client.ts` handles this automatically; don't remove the `prepare: false` guard.
- **`@google/design.md` external package** — `next.config.ts` includes `outputFileTracingIncludes` to ensure Vercel bundles the YAML data files. Don't remove that config.
- **Custom Firebase auth domain needs two rewrites, not one** — `next.config.ts` must proxy both `/__/auth/:path*` and `/__/firebase/:path*` to `designmd-2ff95.firebaseapp.com`. The OAuth handler page (served via the `/__/auth/*` rewrite) itself fetches `/__/firebase/init.json` to bootstrap its own `firebase.initializeApp()`; if that second rewrite is missing, the fetch 404s against our own app and `signInWithRedirect` silently strands — browser lands back on the app signed out, no error, no `/api/auth/session` call. If Google sign-in ever regresses this way, check Network for that 404 first.
- **Deloitte corporate WiFi blocks port 5432/6543** — tether to a phone hotspot for any direct DB operations from a work machine.
- **ESLint is not part of Next 16 builds** — `pnpm lint` runs the flat ESLint config directly. Treat new warnings as regressions; the four current unrelated warnings are documented in the security release evidence.
- **No `.env.example` yet** — required env vars are documented in `README.md` and `TECH-STACK.md`.
