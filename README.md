# UIUXskills

> Curated DESIGN.md bundles paired with calibrated Claude prompts — so your AI tool follows your design system instead of inventing one.

**Live:** [uiuxskills.com](https://uiuxskills.com)

---

## What is this?

UIUXskills is a platform for browsing, generating, and using [DESIGN.md](https://github.com/google/design.md) bundles. A bundle combines two things:

- A **DESIGN.md spec** — a structured document describing a product's visual language: colors, typography, components, spacing, and style guidelines, validated against Google's official schema.
- A **companion prompt** — a system prompt engineered for Claude that loads the spec into context so the model respects the design system during generation.

Paste a product URL into the generator and the pipeline scrapes it, extracts brand tokens with Gemini, authors the DESIGN.md with Claude Sonnet, lints it against the schema, and packages both files for export.

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
| Framework | Next.js 15.5 (App Router) + React 19 |
| Language | TypeScript 5.7 (strict mode) |
| Styling | Tailwind CSS v4 + Radix UI |
| Database | Supabase Postgres 17 + Drizzle ORM |
| Auth | Firebase Auth (Google + magic link) |
| LLM — authoring | Anthropic Claude Sonnet |
| LLM — extraction | Google Gemini 2.0 Flash |
| Web scraping | Firecrawl |
| Task queue | Upstash QStash |
| Rate limiting | Upstash Redis |
| Search | Orama (in-process full-text) |
| Hosting | Vercel |

Full detail in [TECH-STACK.md](./TECH-STACK.md).

---

## Local development

### Prerequisites

- Node.js 20+
- pnpm (`npm i -g pnpm`)
- A Supabase project (or any Postgres 17 instance)

### Setup

```bash
git clone https://github.com/rayopavri/designMD.git
cd designMD
pnpm install
```

Copy `.env.example` to `.env.local` and fill in the required variables:

| Variable | Source |
|---|---|
| `DATABASE_URL` | Supabase → Project Settings → Database → Transaction pooler URL (port 6543) |
| `FIREBASE_*` | Firebase Console → Project Settings |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google AI Studio |
| `FIRECRAWL_API_KEY` | firecrawl.dev |
| `UPSTASH_REDIS_REST_URL` + `_TOKEN` | Upstash console |
| `QSTASH_URL` + `QSTASH_TOKEN` + `QSTASH_CURRENT_SIGNING_KEY` + `QSTASH_NEXT_SIGNING_KEY` | Upstash console |

Set `INLINE_TASKS=true` in `.env.local` to run the generation pipeline synchronously (bypasses QStash for local dev).

```bash
pnpm db:migrate      # apply migrations
pnpm db:seed         # optional: seed with sample bundles
pnpm dev             # http://localhost:3000
```

### Other scripts

```bash
pnpm typecheck       # TypeScript check (no emit)
pnpm lint            # ESLint
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
│       ├── internal/       # QStash worker endpoints (scrape, author, companion)
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

Bundle generation runs as a 3-worker chain over QStash:

1. **`scrape-and-extract`** — Firecrawl fetches the URL and captures a full-page screenshot; Gemini extracts brand tokens (palette, typography, components, design styles, category).
2. **`author-design-md`** — Claude Sonnet writes the canonical DESIGN.md; output is linted with `@google/design.md`.
3. **`generate-companion`** — Claude writes the companion system prompt calibrated for use alongside the spec.

Each worker enqueues the next on success. A GitHub Actions watchdog (runs every 5 min) marks any job stuck in `queued` or `running` for more than 5 minutes as `failed`.

---

## Deployment

Every push to `main` triggers a production build on Vercel. There is no staging branch — see [AGENTS.md](./AGENTS.md) for the rationale.

---

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for what's shipped and what's coming next.
