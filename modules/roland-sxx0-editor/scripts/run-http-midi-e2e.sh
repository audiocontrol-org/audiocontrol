#!/usr/bin/env bash
#
# Run hardware e2e tests using HTTP MIDI transport.
#
# This script uses the external midi-server to handle MIDI communication,
# bypassing the Web MIDI API which crashes in Playwright with SysEx permissions.
#
# Prerequisites:
#   - midi-server binary available via:
#     1. $MIDI_SERVER_BIN environment variable (set by devenv), OR
#     2. midi-server in PATH
#   - Roland S-330 or S-550 connected via MIDI
#
# Usage:
#   ./scripts/run-http-midi-e2e.sh [playwright args...]
#
# With devenv:
#   devenv shell
#   ./scripts/run-http-midi-e2e.sh [playwright args...]
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "=== HTTP MIDI E2E Test Runner ==="
echo ""

# Step 1: Locate midi-server binary
# Priority: $MIDI_SERVER_BIN (devenv) > PATH lookup
echo "Step 1: Checking for midi-server..."

MIDI_SERVER_CMD=""

if [ -n "${MIDI_SERVER_BIN:-}" ]; then
  # devenv environment - use the provided binary path
  if [ -x "$MIDI_SERVER_BIN" ]; then
    MIDI_SERVER_CMD="$MIDI_SERVER_BIN"
    echo "   Found (devenv): $MIDI_SERVER_CMD"
  else
    echo "ERROR: MIDI_SERVER_BIN is set but binary not found or not executable"
    echo "       MIDI_SERVER_BIN=$MIDI_SERVER_BIN"
    echo "       Run: devenv script build:midi-server"
    exit 1
  fi
elif command -v midi-server &> /dev/null; then
  # Fallback to PATH lookup
  MIDI_SERVER_CMD="midi-server"
  echo "   Found (PATH): $(which midi-server)"
else
  echo "ERROR: midi-server not found"
  echo ""
  echo "Options:"
  echo "  1. Use devenv: cd to repo root, run 'devenv shell', then 'devenv script build:midi-server'"
  echo "  2. Install midi-server from https://github.com/audiocontrol-org/midi-server"
  exit 1
fi
echo ""

# Step 2: Start midi-server on dynamic port
echo "Step 2: Starting midi-server..."
MIDI_SERVER_LOG=$(mktemp)
HEARTBEAT_FILE=""
WATCHDOG_PID=""
VITE_PID=""
MIDI_SERVER_PID=""

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

  # Kill midi-server if running
  if [ -n "${MIDI_SERVER_PID:-}" ]; then
    kill "$MIDI_SERVER_PID" 2>/dev/null || true
  fi

  # Clean up temp files
  rm -f "$MIDI_SERVER_LOG" "${VITE_LOG:-}"

  # Clean up heartbeat file if it exists
  if [ -n "${HEARTBEAT_FILE:-}" ] && [ -f "$HEARTBEAT_FILE" ]; then
    rm -f "$HEARTBEAT_FILE"
  fi
}
trap cleanup EXIT

# Start midi-server with port 0 (OS assigns available port)
"$MIDI_SERVER_CMD" --port 0 > "$MIDI_SERVER_LOG" 2>&1 &
MIDI_SERVER_PID=$!

# Wait for server to start and extract port (max 10s)
MAX_WAIT=20
ELAPSED=0
MIDI_SERVER_PORT=""

while [ -z "$MIDI_SERVER_PORT" ] && [ "$ELAPSED" -lt "$MAX_WAIT" ]; do
  sleep 0.5
  ELAPSED=$((ELAPSED + 1))

  # Look for JSON output with port
  MIDI_SERVER_PORT=$(grep -o '"port":[0-9]*' "$MIDI_SERVER_LOG" 2>/dev/null | head -1 | grep -o '[0-9]*' || true)

  # Progress indicator
  if [ $((ELAPSED % 2)) -eq 0 ]; then
    echo -n "."
  fi
done
echo ""

if [ -z "$MIDI_SERVER_PORT" ]; then
  echo "ERROR: Failed to detect midi-server port after ${MAX_WAIT} iterations"
  echo "midi-server output:"
  cat "$MIDI_SERVER_LOG"
  exit 1
fi

echo "   midi-server running on port $MIDI_SERVER_PORT"
echo ""

# Step 3: Start dev server on dynamic port
echo "Step 3: Starting dev server..."
VITE_LOG=$(mktemp)

# Start vite in background
pnpm vite --port 0 > "$VITE_LOG" 2>&1 &
VITE_PID=$!

# Wait for server to start and extract port (max 10s)
MAX_WAIT=20
ELAPSED=0
VITE_PORT=""

while [ -z "$VITE_PORT" ] && [ "$ELAPSED" -lt "$MAX_WAIT" ]; do
  sleep 0.5
  ELAPSED=$((ELAPSED + 1))

  # Look for "Local: https://localhost:XXXX/" in output
  VITE_PORT=$(grep -o 'https://localhost:[0-9]*' "$VITE_LOG" 2>/dev/null | head -1 | sed 's/.*://' || true)

  # Progress indicator
  if [ $((ELAPSED % 2)) -eq 0 ]; then
    echo -n "."
  fi
done
echo ""

if [ -z "$VITE_PORT" ]; then
  echo "ERROR: Failed to detect Vite port after ${MAX_WAIT} iterations"
  echo "Vite output:"
  cat "$VITE_LOG"
  exit 1
fi

echo "   Vite server running on port $VITE_PORT"
echo ""

# Step 4: Run Playwright tests with watchdog
echo "Step 4: Running HTTP MIDI e2e tests with watchdog..."
echo ""

export E2E_VITE_PORT="$VITE_PORT"
export E2E_MIDI_SERVER_PORT="$MIDI_SERVER_PORT"

# Set heartbeat file path before starting Playwright
HEARTBEAT_FILE="/tmp/e2e-heartbeat-$$.json"
export E2E_HEARTBEAT_FILE="$HEARTBEAT_FILE"

# Start Playwright in background
PLAYWRIGHT_LOG=$(mktemp)
npx playwright test -c playwright.http-midi.config.ts "$@" > "$PLAYWRIGHT_LOG" 2>&1 &
PLAYWRIGHT_PID=$!

# Start watchdog in background
tsx scripts/watchdog.ts "$PLAYWRIGHT_PID" "$HEARTBEAT_FILE" &
WATCHDOG_PID=$!

echo "[runner] Playwright PID: $PLAYWRIGHT_PID"
echo "[runner] Watchdog PID: $WATCHDOG_PID"
echo "[runner] Heartbeat file: $HEARTBEAT_FILE"
echo "[runner] midi-server port: $MIDI_SERVER_PORT"
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
