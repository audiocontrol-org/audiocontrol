#!/usr/bin/env bash
#
# Shared dev-server launcher for editor UI test harnesses.
#
# Encapsulates the OS-assigned-port -> Vite-dev-server -> wait-for-ready
# -> hand-off-port -> teardown flow that the per-editor
# run-test-harness-e2e.sh scripts previously each carried a copy of
# (akai-s3k-editor + roland-sxx0-editor). The promo-screenshot capture
# engine (editor-ux-refinement Phase 2) is the second consumer.
#
# Usage (the caller must already be `cd`'d into the editor project dir so
# `pnpm vite` and the Playwright config resolve relative to it):
#
#   source "<rel>/e2e-infra/scripts/dev-server-lib.sh"
#   run_playwright_harness "playwright.test-harness.config.ts" "$@"
#
# This file is sourced, not executed; it defines functions only.

# Kill a process and all its descendants. macOS-portable; doesn't rely on
# setsid (not native on macOS) or `kill -- -PGID` (which would kill our own
# shell if vite inherited our process group). `pnpm vite` spawns 2-3
# intermediate node + nix-store + pnpm-tool layers between us and the actual
# vite.js server, so killing only the top PID leaves descendants as zombies
# that accumulate across runs.
ac_kill_tree() {
  local pid=$1
  local sig=${2:-TERM}
  # Recurse children first (post-order) so leaves die before parents and we
  # don't lose `pgrep -P` lookups partway through.
  local child
  for child in $(pgrep -P "$pid" 2>/dev/null || true); do
    ac_kill_tree "$child" "$sig"
  done
  kill -"$sig" "$pid" 2>/dev/null || true
}

# Teardown for the Vite process tree + its log. Reads the AC_VITE_PID /
# AC_VITE_LOG globals (set by run_playwright_harness) rather than locals so
# it still resolves when fired from the script-level EXIT trap, after
# run_playwright_harness has already returned.
ac_dev_server_cleanup() {
  if [ -n "${AC_VITE_PID:-}" ]; then
    ac_kill_tree "$AC_VITE_PID" TERM
    sleep 0.3
    ac_kill_tree "$AC_VITE_PID" KILL
  fi
  [ -n "${AC_VITE_LOG:-}" ] && rm -f "$AC_VITE_LOG"
}

# run_playwright_harness <playwright-config> [playwright args...]
# Starts a Vite dev server on an OS-assigned port, waits for it to print its
# HTTPS URL, exports E2E_PORT, runs Playwright against the given config, and
# tears the server process tree down on exit. Returns non-zero (and prints
# the Vite output) if the port never appears.
run_playwright_harness() {
  local playwright_config=$1
  shift

  echo "Step 1: Starting dev server..."
  AC_VITE_LOG=$(mktemp)
  trap ac_dev_server_cleanup EXIT INT TERM

  pnpm vite --port 0 > "$AC_VITE_LOG" 2>&1 &
  AC_VITE_PID=$!

  # Poll the Vite log for its announced HTTPS port (no ACK to await in bash;
  # the server prints the URL once it's listening). Max ~5s of polling.
  local max_wait=10
  local elapsed=0
  local port=""
  while [ -z "$port" ] && [ "$elapsed" -lt "$max_wait" ]; do
    sleep 0.5
    elapsed=$((elapsed + 1))
    port=$(grep -o 'https://localhost:[0-9]*' "$AC_VITE_LOG" 2>/dev/null | head -1 | sed 's/.*://' || true)
    if [ $((elapsed % 2)) -eq 0 ]; then
      echo -n "."
    fi
  done
  echo ""

  if [ -z "$port" ]; then
    echo "ERROR: Failed to detect server port after ${max_wait} iterations"
    echo "Vite output:"
    cat "$AC_VITE_LOG"
    return 1
  fi

  echo "   Server running on port $port"
  echo ""

  echo "Step 2: Running UI test harness specs..."
  export E2E_PORT="$port"
  npx playwright test -c "$playwright_config" "$@"
}
