# Task 4 — Harden SSRF and bounded response handling

## Implementation commit

`3f1ddfe513ef9ce19951ddedd4392b9d6acb2110` — `fix: harden server-side URL fetching against SSRF`

## Files changed

- `src/lib/security/safe-fetch.ts` — shared public-HTTP(S) fetch boundary with DNS/IP validation, manual redirect validation, deadlines, per-hop aborts, and bounded body reads.
- `src/lib/security/safe-fetch.test.ts` — hermetic DNS and fetch boundary tests.
- `src/lib/generator/prefetch-names.ts` — reuses the shared helper while retaining its 38-second shared deadline, metadata behavior, and limits.
- `src/app/api/admin/backfill-logos/route.ts` — reuses the helper with a 4-second hop timeout, 8-second deadline, 64 KiB cap, HTML-only content policy, and a non-sensitive failure message.

## Verification

- Focused: `node --import tsx --test src/lib/security/safe-fetch.test.ts src/lib/generator/url.test.ts` — 22 passing tests.
- Full: `pnpm test` — 49 passing tests.
- `pnpm typecheck` — passed.
- `pnpm lint` — passed with four existing, unrelated warnings in `LibraryClient.tsx`, `BundlesClient.tsx`, `BrandLogo.tsx`, and `UserMenu.tsx`.

## Residual concerns

- The helper validates every DNS answer before each outbound request and every redirect target. Native `fetch` performs its own connection-time lookup, so the code cannot cryptographically pin the prevalidated answer without adding a custom dispatcher/agent dependency. The helper fails closed on lookup errors/timeouts and keeps the DNS-to-fetch interval minimal.
- Response bodies are truncated at the configured cap (rather than rejected) to preserve metadata extraction behavior; stream cancellation prevents retaining bytes beyond the cap.
