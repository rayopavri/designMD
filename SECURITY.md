# Security Policy

## Open Production Dependency Advisory

Last reviewed: 2026-08-18.

- **GHSA-w5hq-g745-h8pq (`uuid`, moderate):** `pnpm audit --prod` reports
  `firebase-admin@14.2.0 > @google-cloud/storage@7.19.0 > uuid@8.3.2` and
  `... > gaxios@6.7.1 > uuid@9.0.1`. The patched floor is `uuid@11.1.1`, but
  Cloud Storage 7 declares `uuid@^8` and Gaxios 6 declares `uuid@^9`; forcing
  v11 would bypass both declared compatibility ranges. Application source imports
  only `firebase-admin/app` and `firebase-admin/auth`, and those module entry
  points do not import Firebase Admin's Storage module. Exploitation additionally
  requires storage-path code to call UUID v3/v5/v6 with an attacker-controlled
  output buffer. This is an **open residual risk, not an ignored or approved
  exception**. Reassess on each Firebase Admin/Cloud Storage release and remove
  it once upstream supports a patched UUID release.

## Supported Versions

Use this section to tell people about which versions of your project are
currently being supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 5.1.x   | :white_check_mark: |
| 5.0.x   | :x:                |
| 4.0.x   | :white_check_mark: |
| < 4.0   | :x:                |

## Reporting a Vulnerability

Use this section to tell people how to report a vulnerability.

Tell them where to go, how often they can expect to get an update on a
reported vulnerability, what to expect if the vulnerability is accepted or
declined, etc.
