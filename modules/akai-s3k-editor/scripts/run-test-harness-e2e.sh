#!/usr/bin/env bash
#
# Run UI test harness e2e tests for keygroup zone components.
#
# Tests ZoneOverview, KeyRangeEditor, and VelocityRangeBar interactions
# using hardcoded keygroups -- no device, MIDI, or watchdog required.
#
# Usage:
#   ./scripts/run-test-harness-e2e.sh [playwright args...]
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "=== S3K UI Test Harness Runner ==="
echo ""

# Step 1: Start dev server on dynamic port
echo "Step 1: Starting dev server..."
VITE_LOG=$(mktemp)

cleanup() {
  if [ -n "${VITE_PID:-}" ]; then
    kill "$VITE_PID" 2>/dev/null || true
  fi
  rm -f "$VITE_LOG"
}
trap cleanup EXIT

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
