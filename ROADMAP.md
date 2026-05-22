# UIUXskills · Roadmap & Pending Tasks

> Living document. Update as items ship.
> Last updated: **2026-05-22** (P1-3 favorites shipped + UI polish pass)
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

## 🔁 Remaining housekeeping

- [ ] **Remove unused `BLOB_READ_WRITE_TOKEN` env var** in Vercel + delete the `design-md-blob` store on the Storage tab (we ripped out the screenshot path).
- [ ] **Set `CRON_SECRET` env var in Vercel** (optional). Locks `/api/cron/warm-db` to authenticated callers. Generate a random 32-char string, add to both Vercel env and `.github/workflows/warm-db.yml` as `secrets.CRON_SECRET`.
- [ ] **Vercel project rename** (optional cosmetic): `design-md` → `uiuxskills` in Project Settings → General.

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
- **Status:** `[ ]`
- **Why:** DB columns (`bundles.vote_count`, `bundles.positive_vote_rate`) already exist but no UI. Voting signal is needed to drive Phase 2 Discovery ranking.
- **Acceptance criteria:**
  - Thumbs up/down on bundle detail page
  - Rate-limited (1 vote per user per bundle, can toggle)
  - Anonymous users see the count but can't vote (auth modal upsell on click)
  - `positive_vote_rate` recomputed via SQL trigger or app code

### P1-5 · Anonymous bundle claim flow

- **Priority:** MEDIUM (UX hole, not yet user-reported)
- **Effort:** ~2 hr
- **Status:** `[ ]`
- **Why:** If an anonymous user generates bundles, then later signs in, there's no link between the anonymous bundles and their account.
- **Acceptance criteria:**
  - On sign-in, check `generation_jobs` rows linked to the current session/IP fingerprint
  - Offer one-click "Claim N bundles from this session" in a post-login banner
  - Updates `bundles.created_by` to the new user id

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
- **Status:** `[ ]`
- **Why:** `/library` has category/tool filters but no full-text search across design.md content. Once the catalog crosses ~50 bundles, filters won't be enough.
- **Acceptance criteria:**
  - Orama index built at publish time (or via cron)
  - Search box in `/library` header queries title + description + designMd content
  - Highlights matched snippets in results

### P1-8 · Code TODOs (housekeeping)

- **Priority:** LOW
- **Effort:** ~30 min
- **Status:** `[ ]`
- **Open TODOs in source:**
  - `src/lib/ui-data/mockAuth.ts:298` — Phase 1B: PATCH `/api/me` to persist profile patches
  - `src/app/(public)/library/[slug]/page.tsx:499` — wire CLI snippet to real CLI (depends on the CLI actually existing — see Beyond-4)

---

## Phase 2 — Discovery pipeline

**Gate:** Do not start until Phase 1 voting (P1-4) is live + library has >25 published bundles.

### P2-1 · Discovery candidate fetchers

- **Priority:** GATED
- **Effort:** ~6 hr
- **Status:** `[ ]`
- **Why:** Scaling beyond manual curation. `discovery_candidates` table + `/admin/discovery` page placeholders already exist.
- **Acceptance criteria:**
  - GitHub fetcher: trending repos with marketing sites, design-led READMEs
  - Reddit fetcher: r/web_design, r/userexperience top posts
  - Hacker News fetcher: Show HN with linked product URLs
  - Each writes to `discovery_candidates` with source, url, raw_metadata, fetched_at

### P2-2 · Haiku 4.5 classifier

- **Priority:** GATED
- **Effort:** ~3 hr
- **Status:** `[ ]`
- **Why:** Filter raw candidates down to ones worth generating bundles for. Haiku key is in env, never wired.
- **Acceptance criteria:**
  - Worker reads pending `discovery_candidates`, classifies each (skip / promising / strong)
  - Strong candidates auto-queue a generation job
  - Promising surface in `/admin/discovery` for human approve/skip

### P2-3 · Weekly cron + admin review surface

- **Priority:** GATED
- **Effort:** ~3 hr
- **Status:** `[ ]`
- **Acceptance criteria:**
  - Vercel cron (or QStash) fires weekly: fetchers → classifier → queue
  - `/admin/discovery` shows new candidates with one-click "Generate" / "Skip"
  - Email summary to editors via Resend (when templates land — see Beyond-5)

---

## Beyond — bigger commitments

⚠️ **Always confirm with user before starting any item in this section.** All are 6-12hr or more.

### B-1 · Skill generator pipeline

- **Priority:** UNSCHEDULED
- **Effort:** ~8 hr
- **Status:** `[ ]`
- **Why:** `/generate` shows "Skill" as a preview-only mock. Real pipeline would produce a Claude Skill (frontmatter + SKILL.md + assets) from a URL.

### B-2 · Agent generator pipeline

- **Priority:** UNSCHEDULED
- **Effort:** ~10 hr
- **Status:** `[ ]`
- **Why:** Same — mocked. Would produce a subagent definition with persona, tools, system prompt.

### B-3 · MCP generator pipeline

- **Priority:** UNSCHEDULED
- **Effort:** ~12 hr
- **Status:** `[ ]`
- **Why:** Same — mocked. Would scaffold an MCP server with tools defined from the source product's API.

### B-4 · `npx uiuxskills` CLI

- **Priority:** UNSCHEDULED (docs already advertise it)
- **Effort:** ~6 hr
- **Status:** `[ ]`
- **Why:** Post-rebrand the library page and docs advertise `npx uiuxskills add <id>`. The package doesn't exist on npm.
- **Acceptance criteria:**
  - Publish `uiuxskills` package
  - `add <id>` downloads bundle ZIP + writes to per-tool path (Cursor, Claude Code, Windsurf, etc.)
  - `list` prints catalog
  - `verify` checks installed bundle integrity

### B-5 · Resend email templates

- **Priority:** UNSCHEDULED (depends on Phase 2 + B-4)
- **Effort:** ~4 hr
- **Status:** `[ ]`
- **Templates needed:**
  - Welcome (on first sign-in)
  - Bundle approved (when editor publishes a pending_review bundle)
  - Bundle rejected (with reason)
  - Weekly discovery summary (for editors — see P2-3)

### B-6 · OpenRouter fallback

- **Priority:** UNSCHEDULED (Anthropic/Gemini have been stable)
- **Effort:** ~3 hr
- **Status:** `[ ]`
- **Why:** Key in env, never wired. Insurance against Claude or Gemini 429s during a traffic spike.
- **Acceptance criteria:**
  - When Anthropic/Gemini call returns 429 or 5xx, retry via OpenRouter with equivalent model
  - Logged so we can see how often it triggers

---

## Done (recent)

Most-recent first.

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
