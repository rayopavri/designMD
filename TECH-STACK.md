# UIUXskills · Tech Stack Report

> Snapshot as of 2026-05-23
> Production URL: https://uiuxskills.com

---

## At a glance

| Layer | Tool | Plan | Monthly cost |
|---|---|---|---|
| Hosting / framework | Vercel | Pro | $20 |
| Database | Supabase Postgres 17 (migrated from Neon 2026-05-21) | Free | $0 |
| Auth | Firebase Auth | Free (Spark) | $0 |
| Durable task queue | Upstash QStash | Free | $0 |
| Cache / rate limit | Upstash Redis | Free | $0 |
| Cron | GitHub Actions | Free | $0 |
| Web scraping | Firecrawl | Pay-per-use | ~$0-5 (light use) |
| LLM (authoring + vision/extract) | Google Gemini 3.1 Flash-Lite | API | ~$0.001-0.01 per bundle |
| LLM (companion prompt) | Anthropic Claude Sonnet 4.6 | API | variable by prompt size |
| **Total live cost** | | | **~$20/mo (Vercel Pro) + per-bundle LLM costs** |

Only Vercel is on a paid tier (Pro, for the raised function limits); everything else sits inside generous free allowances at current traffic.

---

## Application layer

### Next.js 16.3.1 (App Router)
- Framework. Keep the pinned release current with Next.js security updates; do not downgrade to a vulnerable version.
- App Router with mixed server + client components.
- React Server Components for the public marketing/library pages; client components for `/admin/*` and `/generate` (interactive state, polling).

### React 19
- Bundled with Next.js. No extra config.

### TypeScript 5.7
- Strict mode. All source under `src/`. Next.js 16 no longer runs ESLint during builds; lint is run explicitly with `pnpm lint`.

### Tailwind CSS v4
- Utility classes. Design tokens (colors, type, spacing) defined inline in `src/lib/ui-data/tokens.ts` and applied via `style={{}}` props (semantic over utility-class soup for color).

### lucide-react
- Icon set. Used throughout the admin + library + home UI.

### Drizzle ORM
- Type-safe SQL. Schema lives at `src/lib/db/schema.ts` — 16 tables, 7 enums, 7 triggers.
- Driver: `postgres-js` against the Supabase transaction pooler (port 6543). `src/lib/db/client.ts` sets `prepare: false` automatically when the URL contains `:6543` because PgBouncer transaction mode forbids prepared statements. SSL is required even in local dev (only skipped for `localhost`/`127.0.0.1`).
- `@neondatabase/serverless` is no longer used in the runtime; it may still appear in `package.json` until cleaned up.

### Zod
- Runtime validation. Used for QStash worker payloads, API query params, and Gemini response narrowing.

### Firebase Admin SDK (`firebase-admin`) + Firebase JS SDK
- Server-side auth verification (admin SDK) + client-side sign-in flow (JS SDK).

### sharp
- Image processing. Clamps Firecrawl's fixed desktop viewport screenshots to 1600×2400 JPEG before sending to Gemini so the model retains text and component detail. Native dependency (Vercel ships its built binary).

---

## AI providers

### Anthropic Claude
- **Models in use:**
  - `claude-sonnet-4-6` — writes companion prompts.
  - `claude-haiku-4-5` — reserved (env var set, not yet wired). Intended for Phase 2 Discovery candidate classifier.
- **API:** REST via `@anthropic-ai/sdk`.
- **Cost shape:** one companion-prompt call per bundle; actual cost depends on prompt size and current provider pricing.

### Google Gemini
- **Model:** `gemini-3.1-flash-lite` (Gemini 3.1 Flash Lite) for markdown extraction, image-only extraction, and direct canonical DESIGN.md authoring.
- **API:** `@google/genai` SDK.
- **Used for:** multi-modal brand extraction (palette, typography, components, design styles, **category**) from URL scrape OR uploaded screenshot, then authoring of the DESIGN.md body. Direct Gemini is the default transport.
- **Optional OpenRouter transport:** `AI_PROVIDER=openrouter` explicitly routes Gemini-owned extraction and authoring calls through OpenRouter and requires server-only `OPENROUTER_API_KEY`. It is a provider selection, not automatic fallback/retry behavior; it does not affect Firecrawl or the direct Anthropic companion call. `OPENROUTER_MODEL` and `OPENROUTER_REASONING_EFFORT` have server-side defaults but may be overridden.
- **Category extraction is enum-constrained** to the 9 canonical domain slugs — the schema rejects anything else.
- **Cost shape:** ~$0.10 per 1M input tokens. Very cheap. Per-bundle cost typically **<$0.01**.

### Firecrawl
- **API:** `@mendable/firecrawl-js`.
- **Used for:** URL → clean markdown + HTML + computed-style snapshot + fixed desktop viewport screenshot.
- Config: a 1440×900, quality-90 screenshot; a 2-second wait, Escape, generic overlay cleanup, and a 600ms settle; then a 1-second scrape wait with a 30-second rich-capture timeout. It deliberately does not use full-page capture or scroll actions; the hero and first sections are the primary visual input.
- **Cost shape:** pay-per-scrape; free tier covers light usage. At current generation volume the bill is ~$0-5/mo.

---

## Infrastructure

### Vercel (Pro plan)
- Hosts the Next.js app, terminates TLS, serves CDN-cached static + edge functions.
- **Node runtime:** Node.js 22+ is declared in `package.json` (`engines.node`).
  Vercel uses this repository-controlled engine range to override the project's
  dashboard default; Vercel manages compatible minor and patch updates.
- **Constraints driving architecture:**
  - Function timeout: Pro allows 300s (standard) / 800s (Fluid Compute). The scrape-and-extract and author-design-md workers each pin `maxDuration = 300s` with a 290s watchdog; the companion worker pins 180s. The 3-worker split predates the Pro upgrade — scrape dispatches authoring and companion work in parallel for latency and retry isolation, not the old 60s cap.
  - Cron jobs limited to once-per-day (tightened ~2026-05-21). Triggered the migration to GitHub Actions cron.
- **Production deploys** — every push to `main` triggers the Vercel production build automatically. Direct `main` commits are the repository's deployment workflow; no staging branch or pull request is used.

### Supabase Postgres (Free plan, current)
- Migrated from Neon on 2026-05-21. Postgres 17, project `uiuxskills` (ref `ppvqdkvpyuntbncdhwtm`, region `us-east-1`).
- Dashboard: https://supabase.com/dashboard/project/ppvqdkvpyuntbncdhwtm
- **Connection path used everywhere:** transaction pooler at `aws-1-us-east-1.pooler.supabase.com:6543`, username `postgres.ppvqdkvpyuntbncdhwtm`. Direct host (`db.<ref>.supabase.co:5432`) is IPv6-only on the Free tier and unreachable from most non-IPv6 networks — do not use it for the runtime.
- **PgBouncer transaction mode** is the only mode that fits the pooler URL. It forbids prepared statements, so `src/lib/db/client.ts` disables them whenever the URL contains `:6543`. Don't remove that toggle.
- **Autosuspend:** Supabase Free pauses only after **7 days of zero activity**, not minutes. The 5-min GitHub Actions tick keeps activity flowing as a side effect; the cron's main job is now the stuck-`generation_jobs` watchdog.
- 16 tables, 7 triggers (vote aggregation, automatic flagging, companion-versioning, and four `updated_at` maintenance triggers). All preserved across the migration.
- Migrations run through `pnpm db:migrate` (`scripts/migrate.ts`) in three phases: idempotent `0000_init.sql`, Drizzle migrations in `_journal.json` order, then idempotent `9999_triggers_and_seed.sql`. Run `pnpm db:generate` after schema changes; do not use `db:push` against shared or production databases.
- **Network constraint:** Deloitte corporate WiFi blocks outbound 5432/6543. Direct `psql`/`pg_dump` from the work Mac on Deloitte network will time out. Tether to a phone hotspot for any direct DB ops. The Vercel-hosted app is unaffected.
- Old Neon project (`ep-patient-mode-aqtwblo0.c-8.us-east-1.aws.neon.tech`) is no longer used by any code and can be deleted.

### Upstash QStash (Free tier)
- Durable HTTP task queue. Replaces a previous `void fetch()` fire-and-forget pattern that lost ~1 in N companion jobs.
- **Signs every webhook delivery**; workers verify via `assertQStashSignature`. Local dev (`INLINE_TASKS=true`) bypasses signing with a shared token.
- `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, and `QSTASH_NEXT_SIGNING_KEY` are required in production. `INLINE_TASKS` is local/test-only and production workers accept only verified QStash signatures.
- Generation endpoints live at `/api/internal/tasks/scrape-and-extract`, `/api/internal/tasks/author-design-md`, and `/api/internal/tasks/generate-companion`. Scrape/extract dispatches authoring and companion work in parallel after persisting the shared phase payload.

### Upstash Redis (Free tier)
- Sliding-window rate limit on `/api/generate` via `@upstash/ratelimit`.
- **Anonymous:** 3 generations/hour per IP.
- **Signed-in:** 10 generations/hour per user.
- **Editors:** unmetered.
- Magic-link requests have separate 5-per-10-minute IP and 3-per-hour normalized-email limits. Email Redis keys contain HMAC digests, not raw email addresses.
- Local development/test may run without Redis. Production requires `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and `RATE_LIMIT_SECRET`; configuration or Redis failures produce a controlled `503 rate_limit_unavailable` response instead of allowing unmetered traffic.

### Firebase Auth (Free / Spark plan)
- Google + email magic-link sign-in.
- Server-side ID-token verification via Admin SDK.
- `FIREBASE_ADMIN_CREDENTIALS_B64` stays server-only and is required for production server session verification and magic-link administration. Browser Firebase `NEXT_PUBLIC_*` settings are public identifiers, never substitutes for the Admin credential.
- Different Firebase UIDs are never merged automatically, even for matching emails; the client receives a safe account-link-required response. Every post-auth `returnTo` is restricted to a same-origin internal path.
- Authorized domains: `localhost`, `designmd-2ff95.firebaseapp.com`, `design-md-chi.vercel.app`, `uiuxskills.com`, `www.uiuxskills.com`.

#### Custom auth domain (`NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=uiuxskills.com`)
The Vercel env var is set to the custom domain rather than the default
`designmd-2ff95.firebaseapp.com`, so the Google sign-in redirect reads "to
continue to `uiuxskills.com`" instead of the raw Firebase project domain.
This requires proxying **two** Firebase Hosting reserved paths from
`uiuxskills.com` to `designmd-2ff95.firebaseapp.com` — both handled by the
`rewrites()` block in `next.config.ts` source:

- `/__/auth/:path*` — the OAuth handler/iframe pages themselves
  (`__/auth/handler`, `__/auth/iframe`).
- `/__/firebase/:path*` — `__/firebase/init.json`, which the handler page
  fetches (relative to whatever origin loaded it) to bootstrap its own
  `firebase.initializeApp()` call. Missing this one doesn't break loading the
  handler page, but it 404s that fetch and silently strands
  `signInWithRedirect`: the browser lands back on the app with no error and
  no session, because the handler never got the config it needed to relay
  the OAuth result back.

If Google sign-in ever regresses to "redirects to Google, comes back signed
out, no error," check Network for a 404 on `/__/firebase/init.json` before
anything else — that's this exact failure mode.

**Current verification status (2026-08-18):** the Task 9 HTTP observation
returned 404 for `/__/firebase/init.json` through both `uiuxskills.com` and
the Firebase origin. HTTP status alone cannot establish the redirect flow or
isolate the cause, but it leaves custom-domain redirect sign-in unverified.
Resolve the 404 and complete the interactive Firebase matrix in
[`docs/security/RELEASE-CHECKLIST.md`](docs/security/RELEASE-CHECKLIST.md)
before enforcing CSP.

The OAuth consent-screen app name (Google Cloud Console → **APIs & Services →
OAuth consent screen**, project `designmd-2ff95`) should also be `UIUXskills`,
not the default, so the consent screen itself doesn't show a raw project id.

The **magic-link email** is already branded (sent via Resend from a verified
domain, `src/lib/email/sign-in-email.ts`) — none of the above concerns it.

### GitHub Actions (Free for public repos)
- Workflow at `.github/workflows/warm-db.yml`. Runs every 5 minutes.
- **Two side effects per tick:**
  1. `SELECT 1` — historically kept Neon out of autosuspend; on Supabase this is cosmetic (Free only pauses after 7 days idle).
  2. Marks any `generation_jobs` row in `queued` or `running` for more than 5 minutes as `failed` — watchdog for Vercel-killed pipelines. **This is the load-bearing reason the cron still runs every 5 min, not every 24h.**
- Both `/api/cron/warm-db` and `/api/cron/supervise-batches` require `Authorization: Bearer <CRON_SECRET>` in production. The matching workflows fail before making a request if the GitHub `CRON_SECRET` is missing; Vercel and GitHub Actions must use the same rotated value.

### Application security controls

- **JSON-LD:** all JSON-LD script payloads use `serializeJsonForHtml`, escaping `<`, `>`, `&`, U+2028, and U+2029 before HTML insertion. A source-level regression test covers every JSON-LD script sink.
- **CSP:** `next.config.ts` currently delivers `Content-Security-Policy-Report-Only`; `unsafe-eval` is absent. Enforcement is blocked on a real browser smoke matrix covering public pages, remote images, Firebase redirect sign-in/session, generation/upload, auth redirects, and job polling. HTTP status checks do not satisfy this gate.
- **Outbound fetches:** admin logo recovery, metadata prefetch, and Firecrawl screenshot downloads use a shared safe-fetch helper that rejects non-public addresses and unsafe redirect hops, pins validated DNS answers, and applies redirect, deadline, and byte caps. Screenshot responses additionally require an allowed image MIME type with a matching signature.
- **Uploads and polling:** generation uploads reject oversized declared bodies and files, validate/decode supported images, and cap decoded pixels. Job status reads require the owning signed-in session or anonymous token and return the same 404 for unknown and unauthorized IDs; public failures are stable diagnostic codes only.
- **Release evidence:** see [`docs/security/RELEASE-CHECKLIST.md`](docs/security/RELEASE-CHECKLIST.md) and [`SECURITY.md`](SECURITY.md) for the exact checks, production variables, residual audit rationale, and secret-rotation procedure.

---

## Tooling

### pnpm
- Package manager. Lockfile is `pnpm-lock.yaml`.
- Note: `@google/design.md` ships YAML data files that pnpm symlinks. `next.config.ts` has `outputFileTracingIncludes` to ensure Vercel bundles them with every worker route that lints.

### `@google/design.md` (the linter)
- Official Google DESIGN.md schema validator.
- Runs in `author-design-md` after Gemini writes the file.
- Produces structured warnings + errors that feed into the coverage scoring.

### GitHub
- Repo: `rayopavri/designMD` on `main` branch.
- `replit-archive` branch holds the frozen old Replit code.

## Removed from stack (recent)

- **Vercel Blob** + `@vercel/blob` package (removed 2026-05-21). Was storing full-page website screenshots; the home grid now uses palette-bar library cards which don't need them. Gemini still gets the screenshot in-memory from Firecrawl during extraction.
- **Vercel Cron** for the Neon warmer (replaced by GitHub Actions on 2026-05-21 due to Hobby plan limits).
- **Neon Postgres** (replaced by Supabase on 2026-05-21 because Neon Free's 5-minute autosuspend kept causing cold-start timeouts in development).

---

## Phase 2 surfaces

The CLI shelf and skills/agents/MCP surfaces are not currently rendered. The
old `PHASE_2_SHELVES_ENABLED` feature flag has been removed; Phase 2 tables
such as `discovery_candidates` remain in the schema but are not wired to
fetchers, classifiers, or admin UI. See `ROADMAP.md` for the active plan.

---

## Cost projection

At current volume (~5-10 generations/day, no marketing push):

- **Vercel** — $20/mo (Pro plan; the raised function limits size the pipeline worker budgets).
- **Supabase** — $0 (Free covers 500 MB database + 5 GB bandwidth/month + 50k MAU; we're using a fraction).
- **Upstash** — $0 (Free tier covers 500k QStash + 10k Redis commands/day; we use a fraction).
- **Firebase** — $0 (Spark plan covers 50k MAU; we have ~1).
- **GitHub Actions** — $0 (8,640 free minutes/month; we use ~150/month for the warmer).
- **Firecrawl** — ~$0-5 depending on scrape volume.
- **Claude + Gemini** — ~$0.02-0.08 per generated bundle. At 10/day = **~$10-25/mo**.

**Realistic monthly burn at current scale: $20 infra (Vercel Pro) + $10-30 in API costs.**

Inflection points:
- ~50 generations/day → Firecrawl free tier may run out, expect ~$20/mo on that line.
- ~100k page views/month → Vercel Pro covers it comfortably; Supabase Free is fine (you only feel it at the 500 MB / 5 GB egress walls).
- ~500k page views/month → still within Vercel Pro; watch Supabase egress + Firecrawl credits before anything else.
- ~5,000 signed-in users → Firebase Spark still fine until 50k MAU.

---

## Could we move to one cloud?

Short answer: **not worth it at this stage.**

Detailed comparison in earlier session, but summary:

- **Vercel → Cloud Run + Firebase Hosting:** lose Next.js ISR / image optimization / edge caching. Major DIY work.
- **Supabase → Cloud SQL:** ~$10/mo minimum even idle, no built-in dashboard / auth / pooler / no Free tier equivalent.
- **Vercel Blob → Cloud Storage:** direct swap (but we don't use Blob anymore).
- **Upstash Redis → Memorystore:** ~$40/mo minimum, requires VPC setup.
- **Upstash QStash → Cloud Tasks:** ✅ works, same cost shape.
- **Firebase Auth + Gemini are already Google.** No change.
- **Firecrawl + Claude:** no GCP equivalents. Must stay third-party.

Moving everything to GCP at this scale would cost **$50+/mo** plus 2-3 weeks of migration work, and lose Vercel's Next.js superpowers. Stay where we are until traffic or compliance forces a change.
