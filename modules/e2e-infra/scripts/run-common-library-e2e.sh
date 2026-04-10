#!/usr/bin/env bash
#
# Run shared common-area library e2e tests against any editor's dev server.
#
# Required environment variables:
#   E2E_EDITOR_DIR    — path to the editor module (e.g., modules/akai-s3k-editor)
#   E2E_LIBRARY_URL   — library page URL path (port filled in at runtime)
#   E2E_BASE_URL      — base URL path (port filled in at runtime)
#   E2E_EDITOR_NAME   — display name for test descriptions
#   E2E_OPFS_INIT     — "roland" or "s3k"
#
# Usage:
#   E2E_EDITOR_DIR=modules/akai-s3k-editor \
#   E2E_LIBRARY_URL="/akai/s3000xl/editor/library" \
#   E2E_BASE_URL="/akai/s3000xl/editor" \
#   E2E_EDITOR_NAME="S3K" \
#   E2E_OPFS_INIT="s3k" \
#   ./modules/e2e-infra/scripts/run-common-library-e2e.sh [playwright args...]
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"

: "${E2E_EDITOR_DIR:?E2E_EDITOR_DIR must be set}"
: "${E2E_LIBRARY_URL:?E2E_LIBRARY_URL must be set}"
: "${E2E_BASE_URL:?E2E_BASE_URL must be set}"
: "${E2E_EDITOR_NAME:?E2E_EDITOR_NAME must be set}"
: "${E2E_OPFS_INIT:?E2E_OPFS_INIT must be set}"

cd "$E2E_EDITOR_DIR"

echo "=== Common Library E2E Tests ($E2E_EDITOR_NAME) ==="
echo ""

# Step 1: Start dev server on dynamic port
echo "Step 1: Starting dev server in $E2E_EDITOR_DIR..."
VITE_LOG=$(mktemp)
HEARTBEAT_FILE=""
WATCHDOG_PID=""

cleanup() {
  echo ""
  echo "Cleaning up..."
  if [ -n "${WATCHDOG_PID:-}" ]; then
    kill "$WATCHDOG_PID" 2>/dev/null || true
    wait "$WATCHDOG_PID" 2>/dev/null || true
  fi
  if [ -n "${VITE_PID:-}" ]; then
    kill "$VITE_PID" 2>/dev/null || true
  fi
  rm -f "$VITE_LOG"
  if [ -n "${HEARTBEAT_FILE:-}" ] && [ -f "$HEARTBEAT_FILE" ]; then
    rm -f "$HEARTBEAT_FILE"
  fi
}
trap cleanup EXIT

pnpm vite --port 0 > "$VITE_LOG" 2>&1 &
VITE_PID=$!

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

# Step 2: Run Playwright tests with watchdog
echo "Step 2: Running common library e2e tests..."
echo ""

export E2E_LIBRARY_URL="https://localhost:${PORT}${E2E_LIBRARY_URL}"
export E2E_BASE_URL="https://localhost:${PORT}${E2E_BASE_URL}"
export E2E_EDITOR_NAME
export E2E_OPFS_INIT

HEARTBEAT_FILE="/tmp/e2e-heartbeat-$$.json"
export E2E_HEARTBEAT_FILE="$HEARTBEAT_FILE"

PLAYWRIGHT_LOG=$(mktemp)
npx playwright test -c "$INFRA_DIR/playwright.library.config.ts" "$@" > "$PLAYWRIGHT_LOG" 2>&1 &
PLAYWRIGHT_PID=$!

tsx "$INFRA_DIR/scripts/watchdog.ts" "$PLAYWRIGHT_PID" "$HEARTBEAT_FILE" &
WATCHDOG_PID=$!

echo "[runner] Playwright PID: $PLAYWRIGHT_PID"
echo "[runner] Watchdog PID: $WATCHDOG_PID"
echo "[runner] Heartbeat file: $HEARTBEAT_FILE"
echo ""

set +e
wait "$PLAYWRIGHT_PID"
PLAYWRIGHT_EXIT=$?
set -e

kill "$WATCHDOG_PID" 2>/dev/null || true
wait "$WATCHDOG_PID" 2>/dev/null || true
WATCHDOG_PID=""

cat "$PLAYWRIGHT_LOG"
rm -f "$PLAYWRIGHT_LOG"

if [ "$PLAYWRIGHT_EXIT" -eq 137 ]; then
  echo ""
  echo "=== STUCK TEST DETECTED ==="
  echo "Test runner was killed by watchdog after inactivity."
  echo "Check the last heartbeat event above for the stuck location."
  exit 1
fi

exit "$PLAYWRIGHT_EXIT"
