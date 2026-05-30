#!/bin/bash
set -euo pipefail

# Only run in Claude Code on the web / remote environments.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Enable Corepack so the pnpm version pinned by the repo is used (falls back
# to whatever pnpm is already on PATH if Corepack is unavailable).
corepack enable 2>/dev/null || true

# Install JS dependencies. `pnpm install` (not --frozen-lockfile) is idempotent
# and lets the container cache the resulting node_modules between sessions.
pnpm install
