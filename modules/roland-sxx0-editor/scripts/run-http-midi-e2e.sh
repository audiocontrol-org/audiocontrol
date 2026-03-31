#!/usr/bin/env bash
#
# Run hardware e2e tests using HTTP MIDI transport.
#
# This script:
#   1. Validates device is connected (fails fast if not)
#   2. Starts midi-server
#   3. Starts Vite dev server
#   4. Runs Playwright tests with watchdog
#
# Prerequisites:
#   - midi-server binary available via $MIDI_SERVER_BIN or PATH
#   - Roland S-330 or S-550 connected via MIDI
#
# Usage:
#   ./scripts/run-http-midi-e2e.sh [playwright args...]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "=== HTTP MIDI E2E Test Runner ==="
echo ""

# Step 1: Validate device is connected
echo "Step 1: Validating device connection..."

DEVICE_INFO=$(tsx scripts/validate-device.ts 2>&1) || {
  echo ""
  echo "ERROR: No Roland S-series device found"
  echo ""
  echo "Ensure:"
  echo "  - Device is powered on"
  echo "  - MIDI cables are connected (both IN and OUT)"
  echo "  - MIDI interface is recognized by the system"
  echo ""
  exit 1
}

# Extract device info from JSON output (last line is the JSON)
DEVICE_JSON=$(echo "$DEVICE_INFO" | tail -1)
DEVICE_FOUND=$(echo "$DEVICE_JSON" | jq -r '.found')

if [ "$DEVICE_FOUND" != "true" ]; then
  echo ""
  echo "ERROR: Device validation failed"
  echo "$DEVICE_INFO"
  exit 1
fi

MIDI_INPUT_PORT=$(echo "$DEVICE_JSON" | jq -r '.inputPort')
MIDI_OUTPUT_PORT=$(echo "$DEVICE_JSON" | jq -r '.outputPort')
DEVICE_ID=$(echo "$DEVICE_JSON" | jq -r '.deviceId')

echo "   ✓ Device found"
echo "   Input:  $MIDI_INPUT_PORT"
echo "   Output: $MIDI_OUTPUT_PORT"
echo "   Device ID: $DEVICE_ID"
echo ""

# Step 2: Locate midi-server binary
echo "Step 2: Checking for midi-server..."

MIDI_SERVER_CMD=""

if [ -n "${MIDI_SERVER_BIN:-}" ]; then
  if [ -x "$MIDI_SERVER_BIN" ]; then
    MIDI_SERVER_CMD="$MIDI_SERVER_BIN"
    echo "   Found (devenv): $MIDI_SERVER_CMD"
  else
    echo "ERROR: MIDI_SERVER_BIN is set but binary not found or not executable"
    echo "       MIDI_SERVER_BIN=$MIDI_SERVER_BIN"
    exit 1
  fi
elif command -v midi-server &> /dev/null; then
  MIDI_SERVER_CMD="midi-server"
  echo "   Found (PATH): $(which midi-server)"
elif command -v MidiHttpServer &> /dev/null; then
  MIDI_SERVER_CMD="MidiHttpServer"
  echo "   Found (PATH): $(which MidiHttpServer)"
else
  echo "ERROR: midi-server not found"
  echo ""
  echo "Set MIDI_SERVER_BIN or add midi-server to PATH"
  exit 1
fi
echo ""

# Step 3: Start midi-server
echo "Step 3: Starting midi-server..."
MIDI_SERVER_LOG=$(mktemp)
HEARTBEAT_FILE=""
WATCHDOG_PID=""
VITE_PID=""
MIDI_SERVER_PID=""

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

  if [ -n "${MIDI_SERVER_PID:-}" ]; then
    kill "$MIDI_SERVER_PID" 2>/dev/null || true
  fi

  rm -f "$MIDI_SERVER_LOG" "${VITE_LOG:-}"

  if [ -n "${HEARTBEAT_FILE:-}" ] && [ -f "$HEARTBEAT_FILE" ]; then
    rm -f "$HEARTBEAT_FILE"
  fi
}
trap cleanup EXIT

"$MIDI_SERVER_CMD" --port 0 > "$MIDI_SERVER_LOG" 2>&1 &
MIDI_SERVER_PID=$!

# Wait for server to start and extract port
MAX_WAIT=20
ELAPSED=0
MIDI_SERVER_PORT=""

while [ -z "$MIDI_SERVER_PORT" ] && [ "$ELAPSED" -lt "$MAX_WAIT" ]; do
  sleep 0.5
  ELAPSED=$((ELAPSED + 1))
  MIDI_SERVER_PORT=$(grep -o '"port":[0-9]*' "$MIDI_SERVER_LOG" 2>/dev/null | head -1 | grep -o '[0-9]*' || true)
  if [ $((ELAPSED % 2)) -eq 0 ]; then
    echo -n "."
  fi
done
echo ""

if [ -z "$MIDI_SERVER_PORT" ]; then
  echo "ERROR: Failed to detect midi-server port"
  echo "midi-server output:"
  cat "$MIDI_SERVER_LOG"
  exit 1
fi

echo "   midi-server running on port $MIDI_SERVER_PORT"
echo ""

# Step 4: Start Vite dev server
echo "Step 4: Starting dev server..."
VITE_LOG=$(mktemp)

pnpm vite --port 0 > "$VITE_LOG" 2>&1 &
VITE_PID=$!

MAX_WAIT=20
ELAPSED=0
VITE_PORT=""

while [ -z "$VITE_PORT" ] && [ "$ELAPSED" -lt "$MAX_WAIT" ]; do
  sleep 0.5
  ELAPSED=$((ELAPSED + 1))
  VITE_PORT=$(grep -o 'https://localhost:[0-9]*' "$VITE_LOG" 2>/dev/null | head -1 | sed 's/.*://' || true)
  if [ $((ELAPSED % 2)) -eq 0 ]; then
    echo -n "."
  fi
done
echo ""

if [ -z "$VITE_PORT" ]; then
  echo "ERROR: Failed to detect Vite port"
  echo "Vite output:"
  cat "$VITE_LOG"
  exit 1
fi

echo "   Vite server running on port $VITE_PORT"
echo ""

# Step 5: Run Playwright tests with watchdog
echo "Step 5: Running HTTP MIDI e2e tests..."
echo ""

export E2E_VITE_PORT="$VITE_PORT"
export E2E_MIDI_SERVER_PORT="$MIDI_SERVER_PORT"
export E2E_MIDI_INPUT_PORT="$MIDI_INPUT_PORT"
export E2E_MIDI_OUTPUT_PORT="$MIDI_OUTPUT_PORT"
export E2E_DEVICE_ID="$DEVICE_ID"

HEARTBEAT_FILE="/tmp/e2e-heartbeat-$$.json"
export E2E_HEARTBEAT_FILE="$HEARTBEAT_FILE"

PLAYWRIGHT_LOG=$(mktemp)
npx playwright test -c playwright.http-midi.config.ts "$@" > "$PLAYWRIGHT_LOG" 2>&1 &
PLAYWRIGHT_PID=$!

tsx scripts/watchdog.ts "$PLAYWRIGHT_PID" "$HEARTBEAT_FILE" &
WATCHDOG_PID=$!

echo "[runner] Playwright PID: $PLAYWRIGHT_PID"
echo "[runner] Watchdog PID: $WATCHDOG_PID"
echo "[runner] midi-server: http://localhost:$MIDI_SERVER_PORT"
echo "[runner] Device: $MIDI_OUTPUT_PORT (ID $DEVICE_ID)"
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
  echo "Test runner was killed by watchdog after 5 seconds of inactivity."
  exit 1
fi

exit "$PLAYWRIGHT_EXIT"
