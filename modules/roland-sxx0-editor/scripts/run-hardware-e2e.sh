#!/usr/bin/env bash
#
# Run hardware e2e tests against connected Roland S-series device.
#
# This script includes a watchdog system that detects stuck tests.
# The watchdog monitors heartbeat updates from the Playwright reporter
# and kills the test runner if no heartbeat is received for 5 seconds.
#
# Prerequisites:
#   - Roland S-330 or S-550 connected via MIDI
#   - MIDI interface available
#
# Usage:
#   ./scripts/run-hardware-e2e.sh [playwright args...]
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
INFRA_DIR="$(cd "$PROJECT_DIR/../e2e-infra" && pwd)"

cd "$PROJECT_DIR"

echo "=== Hardware E2E Test Runner ==="
echo ""

# Step 1: Validate device connection
echo "Step 1: Discovering MIDI device..."
DEVICE_JSON=$(tsx scripts/validate-device.ts 2>/dev/null || true)

if [ -z "$DEVICE_JSON" ]; then
  echo "ERROR: Device validation failed to produce output"
  exit 1
fi

DEVICE_FOUND=$(echo "$DEVICE_JSON" | grep -o '"found":true' || true)
if [ -z "$DEVICE_FOUND" ]; then
  echo "ERROR: No Roland S-series device found"
  echo "       Connect a device and try again"
  exit 1
fi

# Extract port info for logging
MIDI_PORT=$(echo "$DEVICE_JSON" | sed -n 's/.*"outputPort":"\([^"]*\)".*/\1/p')
DEVICE_ID=$(echo "$DEVICE_JSON" | sed -n 's/.*"deviceId":\([0-9]*\).*/\1/p')
echo "   Found device on: $MIDI_PORT (device ID $DEVICE_ID)"
echo ""

# Step 2: Start dev server on dynamic port
echo "Step 2: Starting dev server..."
VITE_LOG=$(mktemp)
HEARTBEAT_FILE=""
WATCHDOG_PID=""

# Cleanup function
cleanup() {
  echo ""
  echo "Cleaning up..."

  # Kill watchdog if running
  if [ -n "${WATCHDOG_PID:-}" ]; then
    kill "$WATCHDOG_PID" 2>/dev/null || true
    wait "$WATCHDOG_PID" 2>/dev/null || true
  fi

  # Kill vite if running
  if [ -n "${VITE_PID:-}" ]; then
    kill "$VITE_PID" 2>/dev/null || true
  fi

  # Clean up temp files
  rm -f "$VITE_LOG"

  # Clean up heartbeat file if it exists
  if [ -n "${HEARTBEAT_FILE:-}" ] && [ -f "$HEARTBEAT_FILE" ]; then
    rm -f "$HEARTBEAT_FILE"
  fi
}
trap cleanup EXIT

# Start vite in background, capture output
pnpm vite --port 0 > "$VITE_LOG" 2>&1 &
VITE_PID=$!

# Wait for server to start and extract port (max 10s)
MAX_WAIT=10
ELAPSED=0
PORT=""

while [ -z "$PORT" ] && [ "$ELAPSED" -lt "$MAX_WAIT" ]; do
  sleep 0.5
  ELAPSED=$((ELAPSED + 1))

  # Look for "Local: https://localhost:XXXX/" in output
  PORT=$(grep -o 'https://localhost:[0-9]*' "$VITE_LOG" 2>/dev/null | head -1 | sed 's/.*://' || true)

  # Progress indicator
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

# Step 3: Run Playwright tests with watchdog
echo "Step 3: Running hardware e2e tests with watchdog..."
echo ""

export E2E_PORT="$PORT"
export E2E_MIDI_PORT="$MIDI_PORT"
export E2E_DEVICE_ID="$DEVICE_ID"

# Set heartbeat file path before starting Playwright
HEARTBEAT_FILE="/tmp/e2e-heartbeat-$$.json"
export E2E_HEARTBEAT_FILE="$HEARTBEAT_FILE"

# Start Playwright in background
PLAYWRIGHT_LOG=$(mktemp)
npx playwright test -c playwright.hardware.config.ts "$@" > "$PLAYWRIGHT_LOG" 2>&1 &
PLAYWRIGHT_PID=$!

# Start watchdog in background (use shared e2e-infra watchdog — same
# convention as akai-s3k-editor/scripts/run-library-e2e.sh)
tsx "$INFRA_DIR/scripts/watchdog.ts" "$PLAYWRIGHT_PID" "$HEARTBEAT_FILE" &
WATCHDOG_PID=$!

echo "[runner] Playwright PID: $PLAYWRIGHT_PID"
echo "[runner] Watchdog PID: $WATCHDOG_PID"
echo "[runner] Heartbeat file: $HEARTBEAT_FILE"
echo ""

# Wait for Playwright to finish
set +e
wait "$PLAYWRIGHT_PID"
PLAYWRIGHT_EXIT=$?
set -e

# Kill watchdog (it may have already exited)
kill "$WATCHDOG_PID" 2>/dev/null || true
wait "$WATCHDOG_PID" 2>/dev/null || true
WATCHDOG_PID=""

# Show Playwright output
cat "$PLAYWRIGHT_LOG"
rm -f "$PLAYWRIGHT_LOG"

# Check exit codes
if [ "$PLAYWRIGHT_EXIT" -eq 137 ]; then
  echo ""
  echo "=== STUCK TEST DETECTED ==="
  echo "Test runner was killed by watchdog after 5 seconds of inactivity."
  echo "Check the last heartbeat event above for the stuck location."
  exit 1
fi

exit "$PLAYWRIGHT_EXIT"
