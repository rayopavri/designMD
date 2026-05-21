# UIUXskills · Tech Stack Report

> Snapshot as of 2026-05-21
> Production URL: https://uiuxskills.com

---

## At a glance

| Layer | Tool | Plan | Monthly cost |
|---|---|---|---|
| Hosting / framework | Vercel | Hobby | $0 |
| Database | Neon Postgres 17 | Free | $0 |
| Auth | Firebase Auth | Free (Spark) | $0 |
| Durable task queue | Upstash QStash | Free | $0 |
| Cache / rate limit | Upstash Redis | Free | $0 |
| Cron | GitHub Actions | Free | $0 |
| Web scraping | Firecrawl | Pay-per-use | ~$0-5 (light use) |
| LLM (authoring) | Anthropic Claude | API | ~$0.02-0.08 per bundle |
| LLM (vision/extract) | Google Gemini | API | ~$0.001-0.005 per bundle |
| **Total live cost** | | | **~$0/mo + per-bundle LLM costs** |

Nothing here is on a paid tier. Everything sits inside generous free allowances at current traffic.

---

## Application layer

### Next.js 15.5.9 (App Router)
- Framework. **Security-pinned floor** — anything below 15.5.9 has a known CVE that Vercel's deploy-time scanner blocks. Do not downgrade.
- App Router with mixed server + client components.
- React Server Components for the public marketing/library pages; client components for `/admin/*` and `/generate` (interactive state, polling).

### React 19
- Bundled with Next.js. No extra config.

### TypeScript 5.7
- Strict mode. All source under `src/`. Build skips ESLint (`eslint.ignoreDuringBuilds: true`) because the migrated Vite code has cosmetic violations — surfaced via `pnpm lint` instead.

### Tailwind CSS v4
- Utility classes. Design tokens (colors, type, spacing) defined inline in `src/lib/ui-data/tokens.ts` and applied via `style={{}}` props (semantic over utility-class soup for color).

### lucide-react
- Icon set. Used throughout the admin + library + home UI.

### Drizzle ORM
- Type-safe SQL. Schema lives at `src/lib/db/schema.ts` — 15 tables, 7 enums, 9 triggers.
- Two drivers in use:
  - `postgres-js` for production runtime (in-app queries).
  - `@neondatabase/serverless` HTTP driver for one-off migration scripts run from local machines (direct TCP to Neon stateless-compute endpoints is unreliable on some networks).

### Zod
- Runtime validation. Used for QStash worker payloads, API query params, and Gemini response narrowing.

### Firebase Admin SDK (`firebase-admin`) + Firebase JS SDK
- Server-side auth verification (admin SDK) + client-side sign-in flow (JS SDK).

### sharp
- Image processing. Clamps Firecrawl full-page screenshots to 1600×4000 JPEG before sending to Gemini so the model doesn't aggressively downscale them. Native dependency (Vercel ships its built binary).

---

## AI providers

### Anthropic Claude
- **Models in use:**
  - `claude-sonnet-4-5` (Sonnet 4.6 alias) — writes canonical DESIGN.md + companion prompts.
  - `claude-haiku-4-5` — reserved (env var set, not yet wired). Intended for Phase 2 Discovery candidate classifier.
- **API:** REST via `@anthropic-ai/sdk`.
- **Cost shape:** ~$3 per 1M input tokens, $15 per 1M output. A typical bundle's two Claude calls (design.md + companion) cost roughly **$0.02-$0.08**.

### Google Gemini
- **Model:** `gemini-2.0-flash-exp` (Gemini 2.5 Flash) for both markdown extraction and image-only extraction.
- **API:** `@google/generative-ai` SDK.
- **Used for:** multi-modal brand extraction (palette, typography, components, design styles, **category**) from URL scrape OR uploaded screenshot.
- **Category extraction is enum-constrained** to the 9 canonical domain slugs — the schema rejects anything else.
- **Cost shape:** ~$0.10 per 1M input tokens. Very cheap. Per-bundle cost typically **<$0.01**.

### Firecrawl
- **API:** `@mendable/firecrawl-js`.
- **Used for:** URL → clean markdown + HTML + computed-style snapshot + full-page screenshot.
- Config: `screenshot@fullPage`, `waitFor: 1500ms`, plus 4 wait/scroll actions (~6s total) to trigger IntersectionObserver lazy-loads on animated landing pages, `timeout: 45_000ms`, `blockAds: true`.
- **Cost shape:** pay-per-scrape; free tier covers light usage. At current generation volume the bill is ~$0-5/mo.

---

## Infrastructure

### Vercel (Hobby plan)
- Hosts the Next.js app, terminates TLS, serves CDN-cached static + edge functions.
- **Constraints driving architecture:**
  - 60s function timeout. Drives the 3-worker pipeline split (`scrape-and-extract` → `author-design-md` → `generate-companion`).
  - Cron jobs limited to once-per-day (tightened ~2026-05-21). Triggered the migration to GitHub Actions cron.
- **GitHub auto-deploy currently broken** — pushes to `main` don't fire the webhook. Workaround: `pnpm dlx vercel --prod` from the local checkout. Linked project lives at `~/.vercel/`.

### Neon Postgres (Free plan)
- Postgres 17, serverless with branching. Single `production` branch.
- **Autosuspend:** 5 minutes idle → cold-start (~500ms-2s) on next request. Mitigated by the GitHub Actions cron warmer.
- 15 tables, 9 triggers (vote counting, slug uniqueness, accessibility check).
- Migrations applied via `pnpm tsx scripts/migrate-*.ts` from local machine using the HTTP driver.

### Upstash QStash (Free tier)
- Durable HTTP task queue. Replaces a previous `void fetch()` fire-and-forget pattern that lost ~1 in N companion jobs.
- **Signs every webhook delivery**; workers verify via `assertQStashSignature`. Local dev (`INLINE_TASKS=true`) bypasses signing with a shared token.
- Chains the 3 workers: `scrape-and-extract` enqueues `author-design-md`, which enqueues `generate-companion`.

### Upstash Redis (Free tier)
- Sliding-window rate limit on `/api/generate` via `@upstash/ratelimit`.
- **Anonymous:** 3 generations/hour per IP.
- **Signed-in:** 10 generations/hour per user.
- **Editors:** unmetered.
- Graceful degrade: if env vars unset (local dev), all requests pass through.

### Firebase Auth (Free / Spark plan)
- Google + email magic-link sign-in.
- Server-side ID-token verification via Admin SDK.
- Authorized domains: `localhost`, `designmd-2ff95.firebaseapp.com`, `design-md-chi.vercel.app`, `uiuxskills.com`, `www.uiuxskills.com`.

### GitHub Actions (Free for public repos)
- Workflow at `.github/workflows/warm-db.yml`. Runs every 5 minutes.
- **Two side effects per tick:**
  1. `SELECT 1` to keep Neon out of autosuspend.
  2. Marks any `generation_jobs` row in `queued` or `running` for more than 5 minutes as `failed` — watchdog for Vercel-killed pipelines.

---

## Tooling

### pnpm
- Package manager. Lockfile is `pnpm-lock.yaml`.
- Note: `@google/design.md` ships YAML data files that pnpm symlinks. `next.config.ts` has `outputFileTracingIncludes` to ensure Vercel bundles them with every worker route that lints.

### `@google/design.md` (the linter)
- Official Google DESIGN.md schema validator.
- Runs in `author-design-md` worker after Sonnet writes the file.
- Produces structured warnings + errors that feed into the coverage scoring.

### GitHub
- Repo: `rayopavri/designMD` on `main` branch.
- `replit-archive` branch holds the frozen old Replit code.

### Vercel CLI (`vercel` via `pnpm dlx`)
- Currently the primary deploy path while the GitHub webhook is being fixed.
- Run from `designmd-app/` after committing: `pnpm dlx vercel --prod`.

---

## Removed from stack (recent)

- **Vercel Blob** + `@vercel/blob` package (removed 2026-05-21). Was storing full-page website screenshots; the home grid now uses palette-bar library cards which don't need them. Gemini still gets the screenshot in-memory from Firecrawl during extraction.
- **Vercel Cron** for the Neon warmer (replaced by GitHub Actions on 2026-05-21 due to Hobby plan limits).

---

## Cost projection

At current volume (~5-10 generations/day, no marketing push):

- **Vercel** — $0 (Hobby covers it).
- **Neon** — $0 (Free covers 191 active hours/month; warmer keeps us in the active window but well under cap).
- **Upstash** — $0 (Free tier covers 500k QStash + 10k Redis commands/day; we use a fraction).
- **Firebase** — $0 (Spark plan covers 50k MAU; we have ~1).
- **GitHub Actions** — $0 (8,640 free minutes/month; we use ~150/month for the warmer).
- **Firecrawl** — ~$0-5 depending on scrape volume.
- **Claude + Gemini** — ~$0.02-0.08 per generated bundle. At 10/day = **~$10-25/mo**.

**Realistic monthly burn at current scale: $10-30 in API costs, zero infra.**

Inflection points:
- ~50 generations/day → Firecrawl free tier may run out, expect ~$20/mo on that line.
- ~100k page views/month → Vercel Hobby is still fine; Neon Free is fine.
- ~500k page views/month → consider Vercel Pro ($20/mo) for better function limits + analytics.
- ~5,000 signed-in users → Firebase Spark still fine until 50k MAU.

---

## Could we move to one cloud?

Short answer: **not worth it at this stage.**

Detailed comparison in earlier session, but summary:

- **Vercel → Cloud Run + Firebase Hosting:** lose Next.js ISR / image optimization / edge caching. Major DIY work.
- **Neon → Cloud SQL:** ~$10/mo minimum even idle, no serverless / branching / autosuspend.
- **Vercel Blob → Cloud Storage:** direct swap (but we don't use Blob anymore).
- **Upstash Redis → Memorystore:** ~$40/mo minimum, requires VPC setup.
- **Upstash QStash → Cloud Tasks:** ✅ works, same cost shape.
- **Firebase Auth + Gemini are already Google.** No change.
- **Firecrawl + Claude:** no GCP equivalents. Must stay third-party.

Moving everything to GCP at this scale would cost **$50+/mo** plus 2-3 weeks of migration work, and lose Vercel's Next.js superpowers. Stay where we are until traffic or compliance forces a change.
