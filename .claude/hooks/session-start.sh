#!/bin/bash
set -euo pipefail

# SessionStart hook — prepare the workspace so `build`, `tsc`, and `lint`
# can run in Claude Code on the web sessions, catching breakage before a push.
#
# Verification commands this enables (run before pushing):
#   pnpm --filter web build
#   pnpm --filter web exec tsc --noEmit
#   pnpm --filter web lint

cd "$CLAUDE_PROJECT_DIR"

# Match the pinned package manager (see "packageManager" in package.json).
corepack enable >/dev/null 2>&1 || true

# Install workspace dependencies. Prefer the frozen lockfile (matches CI);
# fall back to a normal install if the lockfile drifts mid-session.
pnpm install --frozen-lockfile || pnpm install
