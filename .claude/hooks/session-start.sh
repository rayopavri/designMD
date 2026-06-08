#!/bin/bash
# SessionStart hook: install dependencies so lint/typecheck work in
# Claude Code on the web. Fresh web containers clone the repo without
# node_modules, so install it up front. Also installs + registers the
# headroom context-compression MCP so its tools are available in web sessions.
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

# --- Headroom context-compression MCP (best-effort; never blocks the session) -
# Installs the headroom CLI (cached in container state across sessions) and
# registers its stdio MCP server in ~/.claude.json, so the headroom_* tools
# (compress / retrieve / stats) load in web sessions with no manual step.
# Wrapped in `set +e` so any hiccup here can never fail the hook or block
# startup -- headroom is a nice-to-have; the pnpm deps above are not.
set +e
if ! command -v headroom >/dev/null 2>&1; then
  if command -v pipx >/dev/null 2>&1; then
    pipx install "headroom-ai[proxy,mcp,code,relevance]"
  else
    python3 -m pip install --user "headroom-ai[proxy,mcp,code,relevance]"
  fi
fi
# The stdio server is spawned as a bare `headroom`; pipx/pip install it to
# ~/.local/bin, which isn't always on PATH in a fresh container. Put it on
# PATH for this run and persist it for the session via $CLAUDE_ENV_FILE so the
# MCP server Claude spawns can resolve the command.
export PATH="$HOME/.local/bin:$PATH"
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  PATH_LINE='export PATH="$HOME/.local/bin:$PATH"'
  grep -qsF "$PATH_LINE" "$CLAUDE_ENV_FILE" 2>/dev/null || printf '%s\n' "$PATH_LINE" >> "$CLAUDE_ENV_FILE"
fi
headroom mcp install >/dev/null 2>&1   # idempotent: writes ~/.claude.json
set -e
