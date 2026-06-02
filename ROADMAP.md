# UIUXskills · Roadmap & Pending Tasks

> Living document. Update as items ship.
> Last updated: **2026-06-02** (show nav links for logged-out users at small breakpoint)
> Current state: **Live in production** at https://uiuxskills.com

---

## Status legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- `[-]` Cancelled / deferred indefinitely

---

## ✅ Done 2026-05-21 (eve) — brand-logo extraction + bulk re-run + admin monitor

- [x] **Brand logos shown on library cards + bundle detail page.** New `src/lib/ai/logo-extract.ts` parses HTML head for `apple-touch-icon` → `icon` (largest size) → `og:image` → `/favicon.ico`. Wired into `firecrawl.ts` → `scrape-and-extract.ts` so every new generation populates the existing `bundles.brand_logo_url` column. New `<BrandLogo>` client component renders with `onError` fallback to Google favicons, then hides. 8 seed bundles hand-picked. (`9cff766`, `b16facf`)
- [x] **One-time backfill endpoint** `POST /api/admin/backfill-logos` for older bundles where `brand_logo_url IS NULL`. Concurrency-limited fetch + extract loop, safe to re-run. (`db8b49f`)
- [x] **Bulk re-run with staggered QStash delays.** `POST /api/admin/bundles/bulk-rerun` accepts `{ slugs?, all?, status? }`, caps at 50/call, staggers via QStash native `delay` (30s between deliveries) so workers fire one-at-a-time instead of bursting Firecrawl/Gemini. Companion `GET .../bulk-rerun/status` returns live counts + recent failures. (`b1d1ec7`)
- [x] **`enqueueTask` extended with `delaySeconds` option** so any caller can schedule a delayed delivery. Existing call sites unchanged (param is optional). (`b1d1ec7`)
- [x] **Persistent pipeline-status indicator on admin edit panel.** New `GET /api/admin/bundles/[slug]/job-status` returns the most recent generation_jobs row. Admin page auto-polls every 3s while status is `queued`/`running`. Re-run progress bar survives page reloads — close the tab, come back, still shows the live state. Red banner for failed jobs shows step + error message. (`9a9edeb`)
- [x] **Re-run button disabled while job in flight.** Reads from `latestJob` (server truth), not just in-session click state — stays disabled across reloads, re-enables only on completed/failed. (`07c84ea`)
- [x] **Admin bundle panel stripped to monitor view.** Editable form (title, description, category, license, design style, tools, attribution, flags) removed. Save edits / Publish / Re-run companion / Restore / Archive buttons removed. Only `Re-run pipeline · Delete · Open in library` remain. Obsolete 2-min client-side timeout deleted — persistent polling handles it forever. (`3ae9d77`)

## ✅ Done 2026-05-21 — categorization + UI polish + pipeline split

- [x] **Categorization works end-to-end.** Replaced the 6 type categories (saas-web-apps, mobile-apps, etc.) with the 9 canonical domain categories used by the UI (Productivity & SaaS, Developer Tools & IDEs, AI & LLM Platforms, Database & DevOps, Design & Creative Tools, Fintech & Crypto, E-commerce & Retail, Media & Consumer Tech, Automotive). Gemini's `category` field is now enum-constrained — schema rejects anything outside the 9 slugs. Both markdown + image prompts include a taxonomy block with one-line descriptions. All 25 existing bundles backfilled. (`2c15be4`)
- [x] **Home page redesigned** with library-style `<ItemCard>` in a 4-col `gap-px` newspaper grid. Replaces the screenshot-Framer-card experiment. Cards show palette bar + name + tagline + "DESIGN SYSTEM" badge + category tag + tools/updated footer. Chip filters bound to the 9 DB category labels exactly. (`7b9f3a8`)
- [x] **Screenshot infra fully removed.** Vercel Blob store, `@vercel/blob` package, `bundles.screenshot_url` column, `HomeBundleCard`, `useBundles`, screenshot upload helper — all gone. Firecrawl still captures the screenshot in-memory for Gemini vision; we just don't persist it. (`7b9f3a8`)
- [x] **Pipeline split into 3 QStash workers.** `scrape-and-extract` (~25-30s) → `author-design-md` (~30-40s) → `generate-companion` (~10-15s). Each function fits the 60s Vercel Hobby cap. Brand + trimmed markdown travel between phases in the QStash payload. (`37f4eb6`)
- [x] **Admin Re-run pipeline shows live progress.** Sticky action bar renders a 4-phase strip (Page collection / Brand extraction / Design.md authored / Validate & score) that polls `/api/generate/[jobId]` every 2s and animates per-phase as the worker advances. (`939b868`)
- [x] **Admin permanent Delete button.** Editor-only `/api/admin/bundles/[slug]/delete` clears every FK reference (votes, collection_items, request linkages, generation jobs, discovery candidates) and drops the row. Two-step confirmation (window.confirm + type-the-slug) so it can't fire by accident. (`0066dd6`)
- [x] **Cron moved Vercel → GitHub Actions** because Vercel Hobby tightened cron to once-per-day. `.github/workflows/warm-db.yml` runs every 5 min, hits `/api/cron/warm-db` (which now also runs a watchdog that marks stuck `running` jobs older than 5 min as failed). (`45e4188`, `09a3272`)
- [x] **Firecrawl tuned for animated sites.** `screenshot@fullPage` + wait/scroll actions (~6s of actions) so lazy-loaded images and JS-animated content render before capture. `sharp` clamps to 1600×4000 JPEG before Gemini to prevent vision downscaling.

## ✅ Done 2026-06-01 — housekeeping closeout

- [x] **Removed unused `BLOB_READ_WRITE_TOKEN` env var** — confirmed absent from Vercel env (the screenshot path was ripped out 2026-05-21; the token was already cleaned up).
- [x] **`CRON_SECRET` set + cron endpoints locked** — present in Vercel Production **and** as a GitHub Actions secret (~2026-05-29, values match). `/api/cron/warm-db` + `/api/cron/supervise-batches` now return **401** unauthenticated, and both cron workflows are green. Verified 2026-06-01.
- [x] **Vercel project renamed** `design-md` → `uiuxskills` via `vercel project rename` (2026-06-01). Local `package.json` `name` renamed to match (`e4506e4`). Custom domain uiuxskills.com + all env/integration wiring unaffected.
- [x] **Deleted the orphaned `design-md-blob` store** (2026-06-01, via `vercel blob delete-store` — store was empty/unlinked: 0 files, 0 connected projects). Housekeeping fully closed.

## ✅ Done 2026-05-22 — housekeeping reconciliation + workflow

- [x] **Switched Claude sessions to direct-to-main workflow.** Solo project + broken preview deploys made the claude/* branch + PR + merge cycle pure friction. AGENTS.md now instructs Claude to commit and push directly to `main`. Production deploys auto-trigger from every push.
- [x] **Restrict Vercel deployments to main branch only.** Preview builds on claude/* and other feature branches were consistently erroring (~30s in) because production env vars (Supabase, QStash, etc.) aren't scoped to preview environments. Added `git.deploymentEnabled = { main: true }` to `vercel.json` so Vercel skips non-main builds entirely. (PR #7, `0649718`)
- [x] **Reconnect Vercel ↔ GitHub webhook** — auto-deploy from `main` working again as of GitHub App reinstall. (`10dd346`)
- [x] **Rotate QStash credentials** — token + signing keys reset, Vercel env vars updated, redeploy verified. (`adb40eb`)
- [x] **Delete duplicate test bundles** (linear-2..linear-7, stripe-2..stripe-5, vercel-2, vercel-3) — 12 rows removed via admin Delete. (`c88e351`)

## ✅ Done 2026-05-20 — rebrand + QStash recovery

- [x] Vercel deploy of QStash + Next.js 15.5.9 succeeded (`d7b54b5`)
- [x] Domain shows UIUXskills brand end-to-end
- [x] Firebase Auth authorized domains include `uiuxskills.com` + `www.uiuxskills.com`
- [x] QStash credentials in Vercel (`QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`)
- [x] Lando Norris bundle recovered (companionStatus: pending → ready, 3130 chars of real Sonnet output)
- [x] QStash dispatch verified end-to-end on production

---

## Phase 1 — Polish & lock-in (the current product)

The product works end-to-end. These items close gaps between what the UI *promises* and what it *delivers*, and prep the platform for real traffic.

### P1-1 · Legal pages

- **Priority:** HIGH (blocker for any marketing push)
- **Effort:** ~1 hr
- **Status:** `[x]` — shipped 2026-05-22
- **Delivered:**
  - `/legal/terms`, `/legal/privacy`, `/legal/attribution` pages (minimal copy, `uiuxofai@gmail.com` contact)
  - Footer links to all three
  - Auth modal fine print now links to `/legal/terms` and `/legal/privacy`
  - Privacy lists: Firebase Auth, Supabase/Postgres, Upstash Redis, Vercel, Claude/Gemini, Firecrawl
  - Attribution lists: `@google/design.md`, Firecrawl, Tailwind, Next.js, Radix UI, Lucide, Drizzle, Orama

### P1-2 · History page (`/account/bundles`)

- **Priority:** HIGH (closes a stated promise in the auth modal)
- **Effort:** ~2 hr
- **Status:** `[x]` — shipped 2026-05-22
- **Delivered:**
  - `/account/bundles` lists all bundles for the signed-in user across all statuses, ordered by `updatedAt desc`
  - Status chips: draft / in review / published / flagged / rejected / archived
  - Bundle count shown inline with the page title
  - Empty state with CTA to `/generate`
  - "Your bundles" link added to UserMenu dropdown (sign-in-gated)
  - New `listUserBundles()` DB query + `GET /api/me/bundles` API route

### P1-3 · Favorites UI

- **Priority:** MEDIUM (second half of the auth modal promise)
- **Effort:** ~3 hr
- **Status:** `[x]` — shipped 2026-05-22
- **Delivered:**
  - New `user_favorites (id, user_id, bundle_id, created_at)` table with unique index on `(bundle_id, user_id)`, cascade-delete FKs to bundles + users. Schema added to `src/lib/db/schema.ts`; raw CREATE TABLE SQL applied via Supabase SQL editor.
  - DB queries: `listUserFavorites`, `addFavorite`, `removeFavorite`, `isBundleFavorited`, `getFavoriteBundleIds` in `src/lib/db/queries/favorites.ts`
  - API routes: `GET /api/me/favorites`, `POST|DELETE /api/bundles/[slug]/favorite`, `GET /api/bundles/[slug]/favorite/check`
  - Heart button on bundle detail page with optimistic toggle + rollback on error. Signed-out → opens auth modal with "Sign in to save" tooltip.
  - `/account/favorites` page listing saved bundles, ordered by saved-at desc, with empty-state CTA to `/library`
  - "Your favorites" link added to UserMenu dropdown

### P1-4 · Voting UI on bundle pages

- **Priority:** MEDIUM (gates Phase 2)
- **Effort:** ~2 hr
- **Status:** `[x]` — shipped 2026-05-22
- **Delivered:**
  - `GET/POST/DELETE /api/bundles/[slug]/vote` — auth-gated, Drizzle upsert via `onConflictDoUpdate` on `uq_votes_bundle_user`. DB trigger `trg_vote_stats` handles `vote_count` / `positive_vote_count` / `positive_vote_rate` aggregation automatically.
  - `VoteWidget` client component on the bundle detail hero (alongside the favorite button). Thumbs-up posts immediately; thumbs-down expands an inline tag picker (5 valid reasons from `is_valid_vote_reason()`) — required by the `chk_reason_requires_failure` DB constraint.
  - Optimistic updates with rollback on error (same pattern as the favorite button).
  - Anonymous users see the count + percentage but clicking either thumb opens the auth modal with the current path as the post-login destination.
  - Toggle behavior: clicking the active vote again deletes the row; switching from up → down (or vice versa) updates the existing row via upsert.
  - Auto-flag side effect kept implicit — the existing `trg_auto_flag` trigger flips published bundles to `flagged` after ≥5 votes below 60%. No UI change required.

### P1-5 · Anonymous bundle claim flow

- **Priority:** MEDIUM (UX hole, not yet user-reported)
- **Effort:** ~2 hr
- **Status:** `[x]` — shipped 2026-05-22
- **Delivered:**
  - `generation_jobs.anon_token` column added (Supabase SQL editor) — partial-indexed on non-null
  - Cookie helper `src/lib/auth/anon-token.ts` — httpOnly `__anon_id` with 30-day TTL, single-use (nulled out on claim)
  - `/api/generate` writes `anonToken` to anonymous jobs and sets the cookie on the 202 response
  - `/api/me/claim-bundles` (GET preview + POST claim) — JOIN on `result_bundle_id` + `anon_token`, transactional update to `bundles.created_by`
  - `ClaimBundlesBanner` — sticky banner under header on sign-in, optimistic claim + sessionStorage dismiss
  - Hidden on `/welcome` to avoid stacking with the welcome flow

### P1-6 · Re-trigger generation (admin)

- **Priority:** LOW (admin convenience)
- **Effort:** ~2 hr
- **Status:** `[x]` — shipped 2026-05-20
- **Why:** When a brand redesigns, the existing bundle gets stale. Today only path is delete + regenerate.
- **Delivered:**
  - Cyan **Re-run pipeline** button on `/admin/bundles` detail panel, visible for URL-sourced bundles only
  - New `generation_jobs.target_bundle_id` column tells the worker to UPDATE the existing bundle in place (preserving slug, votes, editor edits) instead of INSERTing a new one
  - Editor-managed fields preserved: `title`, `description`, `license`, `attributionStatement`, `isFeatured`, `isCurated`, `primaryCategoryId`
  - System fields overwritten: `designMd`, `companionPrompt`, palette, all coverage scores, accessibility notes, brand color/initial
  - Published bundles stay published during the re-run; status/quality gate is skipped
  - In-flight dedup: 409 if a re-run is already queued/running for that bundle
  - UI polls the detail panel every 3s until `companionStatus` flips to `ready`/`failed` (90s timeout)

### P1-7 · Search index (Orama)

- **Priority:** LOW (filters work for now)
- **Effort:** ~3 hr
- **Status:** `[x]` — shipped 2026-05-22
- **Delivered:**
  - `src/lib/search/index.ts` — in-memory Orama index over title/description/designMd/tools/category with 5-min TTL and concurrent-build deduplication
  - `listPublishedForIndex()` query (no MAX_LIMIT cap) for full-corpus index builds
  - `GET /api/search?q=...` returns ranked hits with boosted title/category/tools; falls back to DB ilike on Orama error so the UI never goes blank
  - `invalidateSearchIndex()` hooked into publish / archive / restore / reject / delete admin routes
  - Library page replaces client-side `.includes()` with debounced 250ms server search for DB bundles (non-bundle items still use client haystack)
  - Cmd+K from anywhere navigates to `/library`
- **Note:** Highlights not implemented — Orama returns ranked results, the UI just filters the existing card grid. Revisit if explicit snippet highlighting is needed.

### P1-8 · Code TODOs (housekeeping)

- **Priority:** LOW
- **Effort:** ~30 min
- **Status:** `[x]` — shipped 2026-05-22
- **Delivered:**
  - `PATCH /api/me` implemented with Zod validation (`displayName` / `handle` / `preferredTools`). Returns 409 on duplicate handle (PG 23505)
  - `updateProfile()` rewritten as async: optimistic state update + server persist + rollback on error. Existing callers without `await` still see optimistic update
  - CLI snippet comment re-worded to reference roadmap B-4 (the block was already correctly flag-gated; the TODO was misleading)
  - `grep -rn 'TODO' src/` returns **zero** hits

---

## Phase 2 — Discovery pipeline

**Gate:** ✅ **Cleared 2026-06-01.** Phase 1 closed (P1-4 voting live 2026-05-22) and the library now has **106 published bundles** — the >25 threshold is met ~4× (verified live via `/api/bundles`). Phase 2 is **actionable**; start with **P2-1** (it feeds P2-2 → P2-3).

**Design reconciled 2026-06-01.** The original three bullets had drifted from what `discovery_candidates` actually models. The schema already encodes a richer pipeline: a **guardrails layer** (`is_safe` / `is_relevant` / `is_ai_generated` per candidate + `domain_blocklist` + `guardrail_rejections` keyed on `workflow='discovery'`), **multi-axis scoring** (`content_quality`, `specificity_score`, `composite_score`, `suggested_category`, `suggested_style[]`), and **inline auto-drafting** (`draft_design_md` / `draft_companion_prompt` → `promoted_to_bundle_id`). The `candidate_status` state machine is `unclassified → classified → auto_drafted → queued_for_review → approved │ rejected │ duplicate`. As of 2026-06-01 the discovery + guardrail tables are migrated but **entirely unwired** — no fetcher, classifier, query layer, or `/admin/discovery` page exist yet (the earlier "placeholders already exist" note was wrong; only the tables are real).

**Decisions:**

- **Automation = classify-&-surface first.** Fetch → guardrail → Haiku score → rank into `/admin/discovery`; editor clicks "Generate" → the existing generation pipeline. No drafting/generation spend on an uncalibrated classifier, and no unreviewed rows in `bundles`. The schema's `auto_drafted` / draft columns stay ready: once the scores prove trustworthy, switch on a draft worker between `classified` and `queued_for_review` — additive, not a rewrite.
- **Source order = Hacker News → GitHub → Reddit.** HN's Algolia API is keyless and "Show HN" links real product URLs with a maker inviting traffic (cleanest attribution + signal). GitHub second (no official trending API — scrape/search). Reddit last (needs OAuth).
- **Cron = GitHub Actions + `CRON_SECRET`,** not Vercel cron (Hobby caps Vercel cron at once/day — the same reason `warm-db` and `supervise-batches` moved). Copy `supervise-batches.yml`.
- **Reconciled supervisor, not a choreographed chain.** Mirror the generator's DB-as-truth model; `discovery_source_state` holds the per-source cursor/lease. Fan-out respects the 60s function cap: one worker per source/candidate, thin `{ candidateId }` messages hydrated from the DB.
- **Don't re-scrape / dedup hard.** Fetchers store `raw_content` + `content_fingerprint` (sha256 of the normalized URL). Dedup against other candidates (fingerprint / `uq_candidates_source`) and active bundles (`source_url_normalized`, reusing `normalizeUrl`) **before** spending any tokens.

### P2-1 · Source fetchers + pre-guardrail

- **Priority:** HIGH — entry point (feeds P2-2/P2-3)
- **Effort:** ~5 hr (HN slice ~2 hr; GitHub + Reddit adapters after)
- **Status:** `[~]` — HN slice in progress 2026-06-01
- **Acceptance criteria:**
  - `discover-fetch` worker (per source) writes `unclassified` candidates with `source`, `source_id`, `source_url`, `raw_content`, attribution (`author_*`), `content_fingerprint`
  - Pre-guardrail before insert: `domain_blocklist` check + fingerprint/source dedup + dedup vs active bundles; skips logged to `guardrail_rejections` (`workflow='discovery'`)
  - Per-source cursor / run state in `discovery_source_state`
  - HN adapter first (keyless Algolia, `tags=show_hn`); GitHub + Reddit drop in behind the same worker
  - `scripts/discover-once.ts` runs a source once and prints rows for eyeballing (no classifier yet)

### P2-2 · Haiku 4.5 classifier

- **Priority:** MEDIUM (depends on P2-1)
- **Effort:** ~3 hr
- **Status:** `[ ]`
- **Why:** Rank candidates worth generating. `claude-haiku-4-5` is already defined in `src/lib/ai/anthropic.ts` (its docblock literally names it "the discovery classifier") but is never called.
- **Acceptance criteria:**
  - Worker reads `unclassified` candidates; one Haiku call per candidate returns structured output — `is_safe` / `is_relevant` / `is_ai_generated` + `content_quality` / `specificity_score` / `composite_score` + `suggested_category` (enum-constrained to the 9 canonical slugs) + `suggested_style[]` + `classifier_notes`; status → `classified`
  - Unsafe / irrelevant candidates → `rejected`, reason logged to `guardrail_rejections`
  - Reconciled via the supervisor (re-derives pending classify work from `candidate_status`); respects the 60s cap with per-candidate fan-out
  - *(Upgrade path, deferred)* strong candidates → draft worker → `auto_drafted` / `queued_for_review`

### P2-3 · Weekly cron + `/admin/discovery` review surface

- **Priority:** MEDIUM (depends on P2-1 + P2-2)
- **Effort:** ~3 hr
- **Status:** `[ ]`
- **Acceptance criteria:**
  - GitHub Actions workflow fires weekly → `CRON_SECRET`-protected `/api/cron/discover` → enqueues per-source fetch → supervisor reconciles classify work (model on `supervise-batches.yml` + its route)
  - `/admin/discovery` (modeled on `/admin/queue`) lists candidates by status with composite score, suggested category/style, source attribution, and one-click **Generate** (→ existing pipeline) / **Reject**
  - Email summary to editors via Resend deferred to B-5

---

## Beyond — bigger commitments

⚠️ **Always confirm with user before starting any item in this section.** All are 6-12hr or more.

### B-1 · Skill generator pipeline — ❌ cancelled 2026-06-01
### B-2 · Agent generator pipeline — ❌ cancelled 2026-06-01
### B-3 · MCP generator pipeline — ❌ cancelled 2026-06-01
### B-4 · `npx uiuxskills` CLI — ❌ cancelled 2026-06-01

- **Status:** `[-]` cancelled
- **Resolution:** The skills / agents / MCP / CLI surfaces were removed from the product on 2026-06-01 (`1354b22`). UIUXskills is now exclusively a DESIGN.md + companion-prompt generator and a library of design-system bundles, so these generator pipelines and the CLI are no longer planned. The `/generate` mocks, shelf UI, and `/docs/cli` page are gone. Re-open only if the multi-artifact direction is revived.

### B-5 · Resend email templates

- **Priority:** UNSCHEDULED (depends on Phase 2 + B-4)
- **Effort:** ~4 hr
- **Status:** `[ ]`
- **Templates needed:**
  - Welcome (on first sign-in)
  - Bundle approved (when editor publishes a pending_review bundle)
  - Bundle rejected (with reason)
  - Weekly discovery summary (for editors — see P2-3)

### B-6 · OpenRouter fallback — ❌ cancelled 2026-06-01

- **Status:** `[-]` cancelled
- **Resolution:** OpenRouter removed entirely. The pipeline is direct-provider only (Gemini 3.1 Flash-Lite + Anthropic Sonnet 4.6). Instead of a cross-provider fallback, each AI call uses a per-call timeout sized to its 300s Pro worker — **author 240s, extraction 180s, companion 90s** — so a slow-but-valid generation finishes rather than being cut off. Transient 429s are retried in-call (Gemini `withGeminiRetry`; Anthropic SDK `maxRetries: 2`) and at the job level (QStash retry + supervisor resume). Accepted tradeoff: a sustained provider outage fails the step rather than failing over.

---

## Done (recent)

Most-recent first.

- [x] **2026-06-02** - Show Library and Generate nav links for logged-out users at sm breakpoint. The main <nav> is hidden md:flex, so on 640–767px screens logged-out users had no navigation links — only a Sign in button. Logged-in users still had "Submit a URL" (hidden sm:inline) at those widths. Added Library and Generate links (hidden sm:inline md:hidden) to the logged-out branch of the header so they appear at sm widths without duplicating the main nav on md+ screens. (`45f54fe`)
- [x] **2026-06-01** - Fixed slow/stuck authoring (generation hanging at step 3 "Design.md authored"). The author Gemini call (`generateTextFromGemini`, `gemini-3.1-flash-lite`) set no `thinkingConfig`, so it ran at Gemini 3's default **high** thinking level — on heavy pages (e.g. front.com) a single non-streaming call exceeded **180s** (vs ~8-15s typical), risking the 240s abort / 290s worker watchdog and leaving the UI stuck at step 3. Set `thinkingConfig: { thinkingLevel: MEDIUM }` on the author call only (~5s thinking ceiling, spec quality preserved); extraction is bounded structured JSON and already fast (~9s), so untouched. (`7af2715`) · Researched against Gemini 3 thinking docs (default high; levels minimal/low/medium/high; `thinkingBudget` deprecated in favor of `thinkingLevel`; SDK `@google/genai` v2.6.0 `ThinkingLevel.MEDIUM`). `tsc` clean. Can't test locally (Sensitive env empty) — verify on the next prod generation; bump the level if a spec looks thin.
- [x] **2026-06-01** - Removed the skills / agents / MCP / CLI surfaces — UIUXskills is now exclusively a DESIGN.md + companion-prompt generator plus a design-system bundle library. Deleted the `PHASE_2_SHELVES_ENABLED` flag and every branch, the `SkillItem`/`AgentItem`/`McpItem` types + their seed data in `items.ts`, the shelf system in `libraryFilters.ts`, the `/docs/cli` page, `nonBundleInstall.ts`, `WorksWellWith`, and `featureFlags.ts`. `/generate` lost its type dropdown / URL type-detection / mock skill-agent-mcp pipelines / "preview only" banner — it's now URL + screenshot → design.md + companion. The library is bundles-only (category filter, no shelves). The generation pipeline (scrape-and-extract → author-design-md → generate-companion), the bundles table, and BundleView are untouched. B-1/B-2/B-3/B-4 cancelled. (`1354b22`) · **Verified:** `tsc` clean (0 errors); `next build` compiled + types valid (DB data-collection step fails locally only — Sensitive env empty); dev-server smoke test of `/`, `/library`, `/generate` shows the bundle-only UI with no CLI/shelf/type surfaces (only expected DB/Firebase env errors from dummy local secrets). Prod build runs with real env on push.
- [x] **2026-06-01** - Removed OpenRouter entirely — pipeline is now direct Gemini + Claude only. Deleted `openrouter.ts` + the OpenRouter-only comparison script and raised per-call timeouts to use the 300s Pro workers (author 10s→240s, extraction 90s→180s, companion 45s→90s + pinned Anthropic `maxRetries:2`) so slow-but-valid generations finish instead of being cut off. Transient 429s still retried in-call (`withGeminiRetry` / SDK) + at the job level (QStash + supervisor). B-6 marked cancelled. (`3c265f6`) · **Verified:** `tsc` clean · 0 OpenRouter refs · author path reaches `generateTextFromGemini` direct (no OpenRouter in the call chain) · prod deploy **Ready** (build passed). Confirmed **live in production**: generated `dub.co` end-to-end in ~46s (scrape → Gemini extract → direct-Gemini author → Sonnet companion → `ready_for_review`), no OpenRouter, no errors. (A local run isn't possible — Vercel stores the keys Sensitive, so `vercel env pull` returns them empty.)
- [x] **2026-06-01** - P2-1 discovery fetch slice (HN): reconciled the Phase 2 design with the schema + platform patterns, then shipped the Hacker News source (keyless Algolia `tags=show_hn`), the pre-guardrail (third-party-chrome host denylist + fingerprint/active-bundle dedup), the `discover-fetch` worker, and the discovery query layer. Worker is inert pending the P2-3 cron. Eyeballed live (kept 13 product surfaces, filtered 16 repo/registry/store pages). tsc + eslint clean. (`898008f`)
- [x] **2026-06-01** - Phase 2 ungated: verified 106 published bundles live via /api/bundles (>25 gate cleared ~4×); flipped P2-1/2/3 from GATED to actionable
- [x] **2026-06-01** - Housekeeping closeout: renamed Vercel project + package `design-md` → `uiuxskills`; verified CRON_SECRET lock is live (cron endpoints 401) and BLOB_READ_WRITE_TOKEN already removed (e4506e4)
- [x] **2026-05-30** - generate: handle source-URL dedup gracefully at the app layer (b9ecf6c)
- [x] **2026-05-30** - db: add partial unique index guarding active bundles per source URL (83b6736)
- [x] **2026-05-30** - Admin bundles: show/edit brand logo, reorder actions, fix approve icon (108aa21)
- [x] **2026-05-30** - Add SessionStart hook to install deps in web sessions (5ce2511)
- [x] **2026-05-30** - Add trademark disclaimer below related section on detail pages (059a69e)
- [x] **2026-05-30** - Fix roadmap auto-update hook: add skip-guard + self-commit (3cb4591)
- [x] **2026-05-29** - Fix type error in companion model A/B harness breaking the build (635504d)
- [x] **2026-05-29** - Add 429/RESOURCE_EXHAUSTED retry to direct Gemini calls (038c1c9)
- [x] **2026-05-29** - Add 429/RESOURCE_EXHAUSTED retry to direct Gemini calls (547a1bc)
- [x] **2026-05-29** - Re-run existing personal drafts in place instead of duplicating (8b51ecf)
- [x] **2026-05-29** - chore: roadmap auto-update (27da7b5)
- [x] **2026-05-29** - Only PATCH changed bundle fields on manual save, fix validation error display (999b079)
- [x] **2026-05-27** - Pin search_path = public on all 11 plpgsql functions (a685803)
- [x] **2026-05-27** - chore: roadmap auto-update (a0ae2db)
- [x] **2026-05-27** - chore: roadmap auto-update (85fb507)
- [x] **2026-05-27** - Make per-stage telemetry stamps tolerate a missing migration (b325c0d)
- [x] **2026-05-27** - chore: roadmap auto-update (eb22b3d)
- [x] **2026-05-27** - chore: roadmap auto-update (9712d6b)
- [x] **2026-05-27** - Mark @mendable/firecrawl-js external so Webpack stops choking on its undici dynamic import (65cb24f)
- [x] **2026-05-27** - chore: roadmap auto-update (57e7e6f)
- [x] **2026-05-27** - chore: roadmap auto-update (000fc55)
- [x] **2026-05-27** - chore: roadmap auto-update (7fd4643)
- [x] **2026-05-27** - Improve rerun-bundle script diagnostics with fuzzy matches (81b2a5a)
- [x] **2026-05-27** - chore: roadmap auto-update (b13cc66)
- [x] **2026-05-27** - chore: roadmap auto-update (f6122c3)
- [x] **2026-05-27** - chore: roadmap auto-update (1434c76)
- [x] **2026-05-26** - Clear all hard lint errors so pnpm lint can gate (5bb588e)
- [x] **2026-05-26** - Roadmap auto-update via PostToolUse hook (c0c80d0)
- [x] **2026-05-26** - chore: roadmap auto-update (8d37da9)
- [x] **2026-05-26** - Tighten Firecrawl aggregate budget + log enrichment skips (63bcbf3)
- [x] **2026-05-26** - Kebab scale names + handle composite/whitespace refs in pruner (0f40db3)
- [x] **2026-05-26** - Harden admin Publish: preserve reviewNotes, seed submittedAt, gate clicks (3c88483)
- [x] **2026-05-26** - Status-gate watchdog cleanup + QStash retry guard in author worker (274de8a)
- [x] **2026-05-30** - chore: roadmap auto-update (9ce0b80)
- [x] **2026-05-29** - chore: roadmap auto-update (452839d)
- [x] **2026-05-28** - chore: roadmap auto-update (0fef1df)
- [x] **2026-05-27** - chore: roadmap auto-update (d6f77de)
- [x] **2026-05-26** - chore: roadmap auto-update (d469a65)
- [x] **2026-05-26** - chore: roadmap auto-update (a84bdae)
- [x] **2026-05-26** - chore: roadmap auto-update (11494d2)
- [x] **2026-05-26** - Prune unresolvable component token refs in Gemini sanitize (1b19468)
- [x] **2026-05-26** - Roadmap auto-update via PostToolUse hook (80ac3ce)
- [x] **2026-05-26** - Call advanceBatch in author watchdog cleanup — fixes bulk-batch stalls (a3e20dd)
- [x] **2026-05-26** - chore: roadmap auto-update (3bfbf73)
- [x] **2026-05-26** - Add Publish button to admin bundle detail — unblocks stuck personal bundles (ce7e520)
- [x] **2026-05-26** - chore: roadmap auto-update (3702572)
- [x] **2026-05-26** - Add client-side timeout to Firecrawl SDK calls — fixes 220s stuck UI (8352da)
- [x] **2026-05-25** - chore: roadmap auto-update (38dbd06)
- [x] **2026-05-25** - Fix Vercel build: cast system block past stale SDK types (957ded0)
- [x] **2026-05-25** - chore: roadmap auto-update (4fe1356)
- [x] **2026-05-25** - chore: roadmap auto-update (c47236e)
- [x] **2026-05-25** - Cache Sonnet system prompt to cut DESIGN.md authoring TTFT (142ee76)
- [x] **2026-05-25** - chore: roadmap auto-update (0003d94)
- [x] **2026-05-26** - Speed up DESIGN.md authoring to fit Vercel's 60s function cap (0cc82d7)
- [x] **2026-05-25** - chore: roadmap auto-update (169787d)
- [x] **2026-05-25** - chore: roadmap auto-update (0607c4e)
- [x] **2026-05-25** - Switch Gemini extraction model to 3.5 Flash (7347097)
- [x] **2026-05-25** - chore: roadmap auto-update (4956c1c)
- [x] **2026-05-25** - chore: roadmap auto-update (6cda1cb)
- [x] **2026-05-25** - Use Gemini 3.1 Flash for brand extraction (1a3b0e0)
- [x] **2026-05-28** - Add re-run pipeline button to reviewer queue (110e981)
- [x] **2026-05-27** - Roadmap auto-update via PostToolUse hook (a58a6d7)
- [x] **2026-05-26** - Bump batch subpage scrape 2->3 now that Firecrawl is on Hobby plan (54311b6)
- [x] **2026-05-24** - Roadmap auto-update via PostToolUse hook (07f0bb5)
- [x] **2026-05-26** - Roadmap auto-update via PostToolUse hook (077e1dc)
- [x] **2026-05-24** - Add markdown-only fallback for slow-rendering sites (cae20e5)
- [x] **2026-05-24** - chore: roadmap auto-update (d90bf2f)
- [x] **2026-05-24** - chore: roadmap auto-update (dd1500b)
- [x] **2026-05-26** - chore: roadmap auto-update (b5e581d)
- [x] **2026-05-24** - chore: roadmap auto-update (2105920)
- [x] **2026-05-27** - Roadmap auto-update via PostToolUse hook (9e421b6)
- [x] **2026-05-26** - Fix Worker 1 timeout causing watchdog failures (ae72730)
- [x] **2026-05-24** - chore: roadmap auto-update (c0fa2a2)
- [x] **2026-05-27** - Add re-run button to bulk upload UI + coverage-guided pipeline (29a8ce8)
- [x] **2026-05-24** - chore: roadmap auto-update (9e8c5a3)
- [x] **2026-05-24** - feat: smart multi-page scraping for better first-run coverage (eab0103)
- [x] **2026-05-26** - Swap Gemini 2.5 Flash → 3.1 Flash Lite for brand extraction (6ad47e4)
- [x] **2026-05-24** - chore: roadmap auto-update (e3c5e29)
- [x] **2026-05-24** - Fix: make 0001 migration idempotent (IF NOT EXISTS everywhere) (6bb1a8b)
- [x] **2026-05-24** - Fix: explicitly set autoPublish=false on all non-bulk-upload job inserts (b14a6a7)
- [x] **2026-05-23** - Roadmap auto-update via PostToolUse hook (4c8c9b0)
- [x] **2026-05-23** - Fix: BatchRow type must satisfy Record<string, unknown> for db.execute (f6de66e)
- [x] **2026-05-26** - Roadmap auto-update via PostToolUse hook (a2f4e43)
- [x] **2026-05-25** - Fix: wrap useSearchParams in Suspense boundary to unblock Vercel build (10d006f)
- [x] **2026-05-25** - Roadmap auto-update via PostToolUse hook (8397a03)
- [x] **2026-05-24** - Roadmap auto-update via PostToolUse hook (d4b33e1)
- [x] **2026-05-23** - Bulk upload: persistent batch view + shared admin nav (303d786)
- [x] **2026-05-27** - Bulk upload: add manual refresh button to live status view (4699eac)
- [x] **2026-05-26** - Bulk upload: add manual refresh button to live status view (4699eac)
- [x] **2026-05-23** - chore: roadmap auto-update (348473e)
- [x] **2026-05-23** - Bulk upload: sequential processing with live status polling (55d76bd)
- [x] **2026-05-26** - chore: roadmap auto-update (9d6cc7f)
- [x] **2026-05-23** - chore: roadmap auto-update (a6c5f11)
- [x] **2026-05-26** - Bulk upload: flag low-coverage bundles for review instead of auto-publishing (62ba856)
- [x] **2026-05-23** - chore: roadmap auto-update (a915fce)
- [x] **2026-05-23** - Add bulk URL upload with auto-publish for rapid bundle generation (781455e)
- [x] **2026-05-23** - chore: roadmap auto-update (af85c2d)
- [x] **2026-05-23** - chore: roadmap auto-update (41f206d)
- [x] **2026-05-25** - Update roadmap with favicon entry (3c38738)
- [x] **2026-05-23** - Use uploaded favicon.ico from public/ directory (a87c104)
- [x] **2026-05-25** - Update roadmap with doc rewrite entry (66f0ef9)
- [x] **2026-05-24** - Rewrite README with product description and expand AGENTS.md for AI agents (f43a187)
- [x] **2026-05-23** - Fix generate page to accept bare domains in URL input (465a2fd)
- [x] **2026-05-24** - Add UIUXskills wordmark next to logo in nav (ec7d735)
- [x] **2026-05-23** - Remove '/ 042' version tag from logo link in nav (f7875fb)
- [x] **2026-05-23** - Remove '/ 042' version tag from logo link in nav (841b53c)
- [x] **2026-05-24** · Increase logo size 25% — nav 30→38px, footer 20→25px. (`4394035`)
- [x] **2026-05-23** · Increase logo size 25% — nav 30→38px, footer 20→25px. (`5341999cd`)
- [x] **2026-05-23** · Roadmap auto-update logging via PostToolUse hook: chore commit recorded latest deployments (2a8a419). (`2a8a419`)
- [x] **2026-05-24** · Logo PNG integration shipped: replaced CSS-text U⚡X with actual logo.png (transparent bg, black letterforms) in nav and footer. Invert(1) filter flips to white for dark nav. Nav: 30px height · footer: 20px at 75% opacity. (`9ee62aa`)
- [x] **2026-05-24** · Roadmap auto-update PostToolUse hook executed: ROADMAP.md updated with today's date (2026-05-24). (`c329e08`)
- [x] **2026-05-23** · Roadmap + memory auto-update PostToolUse hook committed: ROADMAP.md updated with today's date + new Done entry; deployments.md memory section added with commit SHAs + changed files list. Hook fires after each `git push` to main. (`3c9cdd3`)
- [x] **2026-05-23** · Replace nav logo transparent+stroke with solid INK fill for better compatibility: transparent + -webkit-text-stroke silently fails when stroke rendering unsupported, making logo invisible. Switch to solid INK fill with double-shadow for 3D depth hint — always renders. (`534501e`)
- [x] **2026-05-24** · Roadmap + memory auto-update wired to PostToolUse hook: after each `git push` to main, post-hook commits roadmap updates (today's date + last shipped entry) and primes deployments.md memory with commit SHAs + changed files. (`8b6c9bc`)
- [x] **2026-05-23** · Admin review queue detail pane redesigned to match library bundle layout: 12-col hero grid with left 7 cols (title, description, metadata) + right 5 cols (coverage card + artifact chips), shared CodePanel tabs replacing flat code blocks. (`fe19d33`)
- [x] **2026-05-23** · Roadmap updated with logo branding entry + last-updated bump. (`6e19a7e`)
- [x] **2026-05-23** · Replace UIUXskills wordmark with U⚡X hollow logo mark. Nav + footer render hollow outline via -webkit-text-stroke + text-shadow depth; favicon switched to ⚡ bolt outline on dark square; OG/social logo updated to full U⚡X mark. (`a3664e9`)
- [x] **2026-05-22** · **Phase 1 fully closed.** P1-4 voting UI shipped: thumbs up/down on every bundle detail page via `/api/bundles/[slug]/vote` (GET/POST/DELETE, upsert on `uq_votes_bundle_user`). `VoteWidget` handles optimistic updates, inline tag picker for downvotes (required by DB constraint), and auth-modal upsell for anonymous users. DB trigger `trg_vote_stats` auto-recomputes `positive_vote_rate` — no app-level aggregation needed. Phase 2 now unblocked. (`314c8cf`)
- [x] **2026-05-22** · P1-5 anonymous bundle claim flow shipped: `__anon_id` httpOnly cookie + `generation_jobs.anon_token` + `/api/me/claim-bundles` + post-login `ClaimBundlesBanner`. (`7b13e1e`)
- [x] **2026-05-22** · P1-7 Orama full-text search shipped: in-memory index over title/description/designMd with 5-min TTL, `/api/search` endpoint with DB fallback, invalidation hooks on all admin actions, debounced library search, Cmd+K navigation. (`5da099b`)
- [x] **2026-05-22** · P1-8 source TODOs closed: `PATCH /api/me` implemented (Zod + 409 on duplicate handle); `updateProfile()` async with optimistic + rollback; CLI snippet comment re-worded. Zero TODOs remain. (`3c35ee0`)
- [x] **2026-05-22** · UI polish pass: brand logos now fall through to Google Favicons in `/account/bundles` + `/account/favorites` (no more blank glyphs); empty 4th-column slot in the home bundle grid no longer shows as a grey box; top "operational / build / clock" status bar removed; `UIUXskills` wordmark bumped 14px → 17px; hero top padding reduced 80px → 64px. (`5918df8`, `606824b`, `72e84a6`, `f4c03d4`)
- [x] **2026-05-22** · P1-3 Favorites UI shipped — heart button on bundle detail, `/account/favorites` page, `user_favorites` table.
- [x] **2026-05-22** · P1-2 History page (`/account/bundles`) shipped — lists user's bundles across all statuses, count chip inline with title.
- [x] **2026-05-22** · P1-1 Legal pages shipped — `/legal/terms`, `/legal/privacy`, `/legal/attribution` linked from footer + auth modal.
- [x] **2026-05-21** · Auto-categorize bundles into 9 domain categories. Gemini schema enum-constrained, taxonomy migration, backfill of 25 existing bundles. (`2c15be4`)
- [x] **2026-05-21** · Home page swapped to library-style ItemCard in 4-col grid. Screenshot infra (Vercel Blob, `@vercel/blob`, HomeBundleCard, screenshot_url column) removed. (`7b9f3a8`)
- [x] **2026-05-21** · Pipeline split into 3 QStash workers to fit 60s Hobby cap. (`37f4eb6`)
- [x] **2026-05-21** · Admin Re-run pipeline live progress strip + permanent Delete button. (`939b868`, `0066dd6`)
- [x] **2026-05-21** · Cron warmer moved Vercel → GitHub Actions + stuck-job watchdog. (`45e4188`, `09a3272`)
- [x] **2026-05-20** · Vercel Cron warms Neon every 4 min (`GET /api/cron/warm-db`) to dodge the 5-min autosuspend on Free tier. Removes cold-start latency for the first visitor in idle windows. (`2adb726`) — *superseded by GitHub Actions cron on 2026-05-21.*
- [x] **2026-05-20** · P1-6 done: admin "Re-run pipeline" button. Full extraction pipeline re-runs against existing source URL, overwrites system fields in place, preserves editor edits + slug + votes. (`4a1c768`)
- [x] **2026-05-20** · QStash replaces fragile fire-and-forget task dispatch. Adds admin "Re-run companion" button for stuck bundles. Idempotent worker auth via signature verification (production) + token (local dev).
- [x] **2026-05-20** · Rebrand UIUXofAi → UIUXskills across UI copy, CLI command, handle domain, localStorage key prefixes (`d030690`)
- [x] **2026-05-20** · Custom domain `uiuxskills.com` attached to Vercel project
- [x] Rate limit `/api/generate` via Upstash Redis (3/hr anon, 10/hr user, unmetered editor) — `931929c`
- [x] Split-hero landing page with sign-in upsell on the right — `4eb326a`
- [x] Optional sign-in + anonymous generation + redirect to library on success — `aea6be6`
- [x] `/admin/bundles` library management page (6 statuses, inline edit, archive/restore/publish) — `f9d4477`
- [x] Companion prompt deferred to second worker function (keeps pipeline under 60s Hobby cap) — `86432cc` / `4118ce5`
- [x] Collapse 8 backend steps into 4 honest UI phases with real wall-clock timers — `d01ebfb` / `0bdddc1`
- [x] Phase 1A-1D initial Next.js 15 deploy + image upload + green build — `6d949a0`

---

## How to use this file

1. Pick the top unblocked item in Phase 1.
2. Set its status to `[~]` when starting.
3. On ship, move it to **Done** with the commit SHA + date and flip to `[x]`.
4. Add new items as they surface — keep Phase 1 / Phase 2 / Beyond ordering intact.
5. Update the "Last updated" date at the top whenever you touch this file.
