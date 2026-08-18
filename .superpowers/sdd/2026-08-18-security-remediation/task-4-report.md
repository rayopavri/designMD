# Task 4 — Harden SSRF and bounded response handling

## Implementation commit

`3f1ddfe513ef9ce19951ddedd4392b9d6acb2110` — `fix: harden server-side URL fetching against SSRF`

`485d4ab786cbf4c839eee624649f44274ac7a2ca` — `fix: pin safe fetch connections to validated addresses`

## Files changed

- `src/lib/security/safe-fetch.ts` — shared public-HTTP(S) fetch boundary with DNS/IP validation, connection-time address pinning through Undici, manual redirect validation, deadlines, per-hop aborts, bounded body reads, userinfo rejection, and redirect credential stripping.
- `src/lib/security/safe-fetch.test.ts` — hermetic DNS/fetch boundary tests plus a loopback-only dispatcher integration test that verifies a pinned connection preserves the requested Host header.
- `src/lib/generator/prefetch-names.ts` — reuses the shared helper while retaining its 38-second shared deadline, metadata behavior, and limits.
- `src/app/api/admin/backfill-logos/route.ts` — reuses the helper with a 4-second hop timeout, 8-second deadline, 64 KiB cap, HTML-only content policy, and a non-sensitive failure message.
- `package.json`, `pnpm-lock.yaml` — add the supported `undici` transport dependency used for connection pinning.

## Verification

- Focused: `node --import tsx --test src/lib/security/safe-fetch.test.ts src/lib/generator/url.test.ts` — 29 passing tests.
- Full: `pnpm test` — 55 passing tests.
- `pnpm typecheck` — passed.
- `pnpm lint` — passed with four existing, unrelated warnings in `LibraryClient.tsx`, `BundlesClient.tsx`, `BrandLogo.tsx`, and `UserMenu.tsx`.

## Residual concerns

- Each outbound connection is now pinned to one DNS answer already validated by the helper; it no longer delegates connection-time resolution to native `fetch`. HTTPS retains the original URL hostname for Host/SNI semantics.
- Response bodies are truncated at the configured cap (rather than rejected) to preserve metadata extraction behavior; stream cancellation prevents retaining bytes beyond the cap.
- The IPv6 special-purpose policy is intentionally conservative. It should be reviewed when IANA special-purpose allocations change.
