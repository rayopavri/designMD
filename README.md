# UIUXskills

> Curated DESIGN.md bundles paired with calibrated Claude prompts — so your AI tool follows your design system instead of inventing one.

**Live:** [uiuxskills.com](https://uiuxskills.com)

---

## What is this?

UIUXskills is a platform for browsing, generating, and using [DESIGN.md](https://github.com/google/design.md) bundles. A bundle combines two things:

- A **DESIGN.md spec** — a structured document describing a product's visual language: colors, typography, components, spacing, and style guidelines, validated against Google's official schema.
- A **companion prompt** — a system prompt engineered for Claude that loads the spec into context so the model respects the design system during generation.

Paste a product URL into the generator and the pipeline scrapes it, extracts
brand tokens and authors the DESIGN.md with Gemini 3.1 Flash-Lite, lints it
against the schema, and packages it with a Claude Sonnet companion prompt.

---

## Features

- **Bundle library** — searchable, filterable catalog across 9 domain categories (e-commerce, fintech, SaaS, healthcare, and more)
- **AI generation** — URL → scrape → brand extraction → DESIGN.md authoring → schema lint → companion prompt, all in one pipeline
- **Voting** — community upvotes surface the best bundles
- **User accounts** — save favorites, manage and claim your generated bundles
- **Admin review queue** — editorial workflow for publishing community submissions
- **Export** — download spec + prompt as a `.zip` or copy individual blocks

---

## Tech stack

| Layer | Tool |
|---|---|
| Framework | Next.js 16.3 (App Router) + React 19 |
| Language | TypeScript 5.7 (strict mode) |
| Styling | Tailwind CSS v4 + Radix UI |
| Database | Supabase Postgres 17 + Drizzle ORM |
| Auth | Firebase Auth (Google + magic link) |
| LLM — authoring + extraction | Google Gemini 3.1 Flash-Lite |
| LLM — companion prompt | Anthropic Claude Sonnet 4.6 |
| Web scraping | Firecrawl |
| Task queue | Upstash QStash |
| Rate limiting | Upstash Redis |
| Search | Orama (in-process full-text) |
| Hosting | Vercel |

Full detail in [TECH-STACK.md](./TECH-STACK.md).

---

## Local development

### Prerequisites

- Node.js 22+
- pnpm (`npm i -g pnpm`)
- A Supabase project (or any Postgres 17 instance)

### Setup

```bash
git clone https://github.com/rayopavri/designMD.git
cd designMD
pnpm install
```

Create `.env.local` (there is no committed `.env.example`) and fill in the
variables needed for the features you run locally:

| Variable | Source |
|---|---|
| `DATABASE_URL` | Supabase → Project Settings → Database → Transaction pooler URL (port 6543) |
| `FIREBASE_ADMIN_CREDENTIALS_B64` + Firebase `NEXT_PUBLIC_*` values | Firebase Console → Project Settings / service account |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `GEMINI_API_KEY` | Google AI Studio |
| `FIRECRAWL_API_KEY` | firecrawl.dev |
| `UPSTASH_REDIS_REST_URL` + `_TOKEN` | Upstash console |
| `RATE_LIMIT_SECRET` | Generate a unique 32+ character secret |
| `QSTASH_TOKEN` + `QSTASH_CURRENT_SIGNING_KEY` + `QSTASH_NEXT_SIGNING_KEY` | Upstash console, when QStash is enabled |
| `CRON_SECRET` | Generate a unique 16+ character secret; match it in Vercel and GitHub Actions |

Set `INLINE_TASKS=true` in `.env.local` to run the generation pipeline synchronously (bypasses QStash for local dev).

Production has stricter requirements: `CRON_SECRET`, both Upstash Redis
variables, `RATE_LIMIT_SECRET`, `QSTASH_TOKEN`, and both QStash signing keys
are mandatory. `INLINE_TASKS` must be false: production workers accept only
verified QStash signatures. Firebase Admin credentials are needed for
server-side session verification. Rate limiting intentionally fails closed in
production rather than allowing unmetered requests. Keep all server secrets out
of `NEXT_PUBLIC_*` variables. See [SECURITY.md](./SECURITY.md) for the complete
configuration and rotation process.

```bash
pnpm db:migrate      # apply migrations
pnpm db:seed         # optional: seed with sample bundles
pnpm dev             # http://localhost:3000
```

### Other scripts

```bash
pnpm typecheck       # TypeScript check (no emit)
pnpm lint            # ESLint
pnpm test            # Node test suite
pnpm audit --prod    # Production dependency advisories
pnpm build           # Production build (requires production env vars and a reachable DATABASE_URL for prerendering)
pnpm db:studio       # Drizzle Studio (local DB browser)
pnpm search:build    # Rebuild Orama search index
```

---

## Project structure

```
src/
├── app/
│   ├── (public)/           # No auth required
│   │   ├── library/        # Bundle catalog + detail pages
│   │   └── docs/           # Documentation pages
│   ├── (auth)/             # Sign-in / welcome flow
│   ├── account/            # Favorites, owned bundles
│   ├── generate/           # Bundle generation UI
│   ├── admin/              # Editorial review queue
│   └── api/
│       ├── generate/       # Generation pipeline entry point
│       ├── internal/tasks/ # QStash worker endpoints (scrape, author, companion)
│       ├── bundles/        # Bundle CRUD, votes, favorites
│       ├── me/             # Authenticated user endpoints
│       └── admin/          # Admin actions (publish, reject, archive)
├── components/ui/          # Radix UI + Tailwind component library
├── hooks/                  # Custom React hooks
└── lib/
    ├── ai/                 # Claude + Gemini prompt engineering
    ├── auth/               # Firebase auth helpers
    ├── db/                 # Drizzle schema, migrations, queries
    ├── generator/          # DESIGN.md authoring logic
    ├── queue/              # QStash task dispatch
    ├── search/             # Orama index
    └── ui-data/            # Static data, feature flags, design tokens
```

---

## Generation pipeline

Bundle generation runs as three QStash task workers:

1. **`/api/internal/tasks/scrape-and-extract`** — Firecrawl fetches the URL and captures a full-page screenshot; Gemini 3.1 Flash-Lite extracts brand tokens (palette, typography, components, design styles, category).
2. **`/api/internal/tasks/author-design-md`** — Gemini 3.1 Flash-Lite writes the canonical DESIGN.md; output is linted with `@google/design.md`.
3. **`/api/internal/tasks/generate-companion`** — Claude Sonnet 4.6 writes the companion system prompt calibrated for use alongside the spec.

After `scrape-and-extract` persists the draft and phase payload, it dispatches
`author-design-md` and `generate-companion` in parallel. Both hydrate their
inputs from the durable job state. A GitHub Actions watchdog (runs every 5 min)
marks any job stuck in `queued` or `running` for more than 5 minutes as
`failed`.

---

## Deployment

Every push to `main` triggers a production build on Vercel. There is no staging branch — see [AGENTS.md](./AGENTS.md) for the rationale.

Use the [security release checklist](./docs/security/RELEASE-CHECKLIST.md)
before release. CSP is deliberately report-only until its interactive browser
matrix, including Firebase redirect authentication and generation polling,
passes with enforcement enabled.

---

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for what's shipped and what's coming next.
