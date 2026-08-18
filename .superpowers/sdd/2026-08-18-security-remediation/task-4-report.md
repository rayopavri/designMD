# Task 4 — Harden SSRF and bounded response handling

## Implementation commit

`3f1ddfe513ef9ce19951ddedd4392b9d6acb2110` — `fix: harden server-side URL fetching against SSRF`

`485d4ab786cbf4c839eee624649f44274ac7a2ca` — `fix: pin safe fetch connections to validated addresses`

`bcd9207` — `fix: refine safe fetch IPv6 policy`

## Files changed

- `src/lib/security/safe-fetch.ts` — shared public-HTTP(S) fetch boundary with DNS/IP validation, connection-time address pinning through Undici, manual redirect validation, deadlines, per-hop aborts, bounded body reads, userinfo rejection, and redirect credential stripping. NAT64 and 6to4 addresses validate their embedded IPv4 address; `2001::/23` permits only IANA globally reachable more-specific allocations.
- `src/lib/security/safe-fetch.test.ts` — hermetic DNS/fetch boundary tests plus loopback-only dispatcher integrations that verify pinned connections preserve both the requested Host header and the original URL hostname as TLS SNI.
- `src/lib/security/fixtures/origin.test-{key,cert}.txt` — static self-signed test-only TLS material for the hermetic SNI integration test; it is not used by application code.
- `src/lib/generator/prefetch-names.ts` — reuses the shared helper while retaining its 38-second shared deadline, metadata behavior, and limits.
- `src/app/api/admin/backfill-logos/route.ts` — reuses the helper with a 4-second hop timeout, 8-second deadline, 64 KiB cap, HTML-only content policy, and a non-sensitive failure message.
- `package.json`, `pnpm-lock.yaml` — add the supported `undici` transport dependency used for connection pinning.

## Verification

- Focused: `node --import tsx --test src/lib/security/safe-fetch.test.ts src/lib/generator/url.test.ts` — 30 passing tests.
- Full: `pnpm test` — 56 passing tests.
- `pnpm typecheck` — passed.
- `pnpm lint` — passed with four existing, unrelated warnings in `LibraryClient.tsx`, `BundlesClient.tsx`, `BrandLogo.tsx`, and `UserMenu.tsx`.

## Residual concerns

- Each outbound connection is pinned to one DNS answer already validated by the helper; it no longer delegates connection-time resolution to native `fetch`. The hermetic TLS test proves the pinned loopback connection retains the original URL hostname as SNI.
- Response bodies are truncated at the configured cap (rather than rejected) to preserve metadata extraction behavior; stream cancellation prevents retaining bytes beyond the cap.
- The IPv6 special-purpose policy is intentionally conservative while allowing documented public more-specific allocations. It should be reviewed when the [IANA IPv6 Special-Purpose Address Registry](https://www.iana.org/assignments/iana-ipv6-special-registry/) changes.
