#!/bin/bash
# SessionStart hook: install dependencies so lint/typecheck work in
# Claude Code on the web. Fresh web containers clone the repo without
# node_modules, so install it up front.
set -euo pipefail

# Only run in the remote (web) environment; local machines manage their own deps.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# --frozen-lockfile: reproducible install from the committed pnpm-lock.yaml
# and never mutates the lockfile (keeps the working tree clean). Idempotent
# and reuses the pnpm store cache on subsequent sessions.
pnpm install --frozen-lockfile
