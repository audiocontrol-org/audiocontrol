#!/usr/bin/env bash
#
# Run UI test harness e2e tests against the simulated MIDI harness.
#
# These specs mount each editor page through the
# `?midi=simulated&scenario=<name>` URL so the editor talks to a
# SimulatedAdapter replaying a captured NDJSON fixture -- no device,
# no MIDI hardware, no SCSI. The Vite dev server's fixture middleware
# (see vite.config.ts) serves the fixture from
# modules/sampler-devices/test/fixtures/.
#
# Usage:
#   ./scripts/run-test-harness-e2e.sh [playwright args...]
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "=== Roland S-series UI Test Harness Runner ==="
echo ""

# Step 1: Start dev server on dynamic port
echo "Step 1: Starting dev server..."
VITE_LOG=$(mktemp)

# Kill a process and all its descendants. macOS-portable; doesn't rely on
# setsid (not native on macOS) or `kill -- -PGID` (which would kill our own
# shell if vite inherited our process group).
kill_tree() {
  local pid=$1
  local sig=${2:-TERM}
  # Recurse children first (post-order) so leaves die before parents and we
  # don't lose `pgrep -P` lookups partway through.
  local child
  for child in $(pgrep -P "$pid" 2>/dev/null || true); do
    kill_tree "$child" "$sig"
  done
  kill -"$sig" "$pid" 2>/dev/null || true
}

cleanup() {
  # `pnpm vite` spawns 2-3 intermediate node + nix-store + pnpm-tool layers
  # between us and the actual `vite.js` server. Killing only $VITE_PID
  # leaves the descendants as zombies that accumulate across runs.
  if [ -n "${VITE_PID:-}" ]; then
    kill_tree "$VITE_PID" TERM
    sleep 0.3
    kill_tree "$VITE_PID" KILL
  fi
  rm -f "$VITE_LOG"
}
trap cleanup EXIT INT TERM

pnpm vite --port 0 > "$VITE_LOG" 2>&1 &
VITE_PID=$!

# Wait for server to start and extract port (max 10s)
MAX_WAIT=10
ELAPSED=0
PORT=""

while [ -z "$PORT" ] && [ "$ELAPSED" -lt "$MAX_WAIT" ]; do
  sleep 0.5
  ELAPSED=$((ELAPSED + 1))

  PORT=$(grep -o 'https://localhost:[0-9]*' "$VITE_LOG" 2>/dev/null | head -1 | sed 's/.*://' || true)

  if [ $((ELAPSED % 2)) -eq 0 ]; then
    echo -n "."
  fi
done
echo ""

if [ -z "$PORT" ]; then
  echo "ERROR: Failed to detect server port after ${MAX_WAIT} iterations"
  echo "Vite output:"
  cat "$VITE_LOG"
  exit 1
fi

echo "   Server running on port $PORT"
echo ""

# Step 2: Run Playwright tests (no watchdog needed for fast UI tests)
echo "Step 2: Running UI test harness specs..."
export E2E_PORT="$PORT"
npx playwright test -c playwright.test-harness.config.ts "$@"
