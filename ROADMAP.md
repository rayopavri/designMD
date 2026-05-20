# UIUXskills · Roadmap & Pending Tasks

> Living document. Update as items ship.
> Last updated: **2026-05-20** (post-QStash)
> Current state: **Live in production** at https://uiuxskills.com (and design-md-chi.vercel.app)

---

## Status legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- `[-]` Cancelled / deferred indefinitely

---

## 🔥 Immediate verification (post-rebrand, 2026-05-20)

Things to confirm now that `UIUXofAi → UIUXskills` shipped (`d030690`).

- [ ] **Vercel deploy succeeded** — check Deployments tab, look for commit `d030690`, status `Ready`
- [ ] **Domain shows new brand** — open https://uiuxskills.com and confirm header reads "UIUXskills" and sign-in card says "Sign in to UIUXskills"
- [ ] **`NEXT_PUBLIC_APP_URL` env var** in Vercel points to `https://uiuxskills.com` (was likely pointing at the `.vercel.app` URL)
- [ ] **Firebase Auth → Authorized domains** includes `uiuxskills.com` (Google sign-in will fail silently if not)
- [ ] **Vercel project rename** (optional cosmetic) — `design-md` → `uiuxskills` in Project Settings → General

## 🔥 QStash setup (required for post-QStash deploy to actually work)

The fire-and-forget task pattern that lost the Lando Norris companion prompt is now replaced with Upstash QStash. To activate it:

- [ ] **Open Upstash Console** at https://console.upstash.com/
- [ ] **Click the "QStash" tab** in the left sidebar (NOT Redis — that's already set up)
- [ ] **Copy three values** from the dashboard:
  - `QSTASH_TOKEN` (top of the page)
  - `QSTASH_CURRENT_SIGNING_KEY` (under "Signing Keys")
  - `QSTASH_NEXT_SIGNING_KEY` (under "Signing Keys")
- [ ] **In Vercel** → Project Settings → Environment Variables, add all three (Production + Preview + Development scopes)
- [ ] **Redeploy** (Vercel will redeploy automatically on next push, or hit "Redeploy" on the latest deployment)
- [ ] **Recover Lando Norris bundle** — once deployed, go to `/admin/bundles`, search "lando norris", click "Re-run companion" (new cyan button visible whenever `companionStatus !== ready`)
- [ ] **Test a new generation** — generate any bundle on `/generate`. Companion should land as `ready` within ~15s of design.md being persisted (no more stuck pending bundles).

---

## Phase 1 — Polish & lock-in (the current product)

The product works end-to-end. These items close gaps between what the UI *promises* and what it *delivers*, and prep the platform for real traffic.

### P1-1 · Legal pages

- **Priority:** HIGH (blocker for any marketing push)
- **Effort:** ~1 hr
- **Status:** `[ ]`
- **Why:** Required before any non-trivial public traffic. Terms / Privacy / Attribution are standard legal hygiene.
- **Acceptance criteria:**
  - `/legal/terms`, `/legal/privacy`, `/legal/attribution` pages exist
  - Footer links to all three
  - Privacy mentions: Firebase Auth, Neon (Postgres), Upstash Redis (rate limit IPs), Vercel hosting, Claude/Gemini API processing of submitted URLs
  - Attribution lists: `@google/design.md`, Firecrawl, Tailwind, Next.js

### P1-2 · History page (`/account/bundles`)

- **Priority:** HIGH (closes a stated promise in the auth modal)
- **Effort:** ~2 hr
- **Status:** `[ ]`
- **Why:** Auth modal copy literally says *"track URLs you've generated"*. Today that's vaporware.
- **Acceptance criteria:**
  - Signed-in route `/account/bundles` lists bundles where `bundles.created_by = currentUser.uid`
  - Shows status (personal, pending_review, published, etc.) with same subdued banner pattern
  - Empty state with CTA to `/generate`
  - Header gets a "Your bundles" link visible only when signed in

### P1-3 · Favorites UI

- **Priority:** MEDIUM (second half of the auth modal promise)
- **Effort:** ~3 hr
- **Status:** `[ ]`
- **Why:** Auth modal also promises "save favorites".
- **Acceptance criteria:**
  - New table `user_favorites (user_id, bundle_id, created_at)` + migration
  - Heart button on bundle detail page (signed-in only; signed-out shows tooltip "Sign in to save")
  - `/account/favorites` page listing saved bundles
  - Optimistic toggle with rollback on error

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
- **Status:** `[ ]`
- **Why:** When a brand redesigns, the existing bundle gets stale. Today only path is delete + regenerate.
- **Acceptance criteria:**
  - Button on `/admin/bundles` row: "Re-run pipeline"
  - Spawns a new `generation_jobs` row with `parent_bundle_id` set
  - On completion, new bundle replaces old (or is linked as a version) — decide which during build

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
  - `src/app/(public)/library/[slug]/page.tsx:479` — wire CLI snippet to real CLI (depends on the CLI actually existing — see Beyond-4)

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
