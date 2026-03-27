#!/usr/bin/env bash
# Run sample editor E2E tests against both sampler-editor and dev harness.
# Starts vite servers on OS-assigned ports (port 0) and captures the
# actual bound ports from vite's stdout — no race conditions.
#
# Usage: ./scripts/run-sample-editor-e2e.sh [playwright args...]

set -euo pipefail

cleanup() {
  [[ -n "${EDITOR_PID:-}" ]] && kill "$EDITOR_PID" 2>/dev/null || true
  [[ -n "${HARNESS_PID:-}" ]] && kill "$HARNESS_PID" 2>/dev/null || true
}
trap cleanup EXIT

# Extract the port vite actually bound to from its stdout.
wait_for_port() {
  local logfile="$1"
  local timeout=30
  local elapsed=0
  while [[ $elapsed -lt $timeout ]]; do
    if grep -q "Local:" "$logfile" 2>/dev/null; then
      grep "Local:" "$logfile" | head -1 | sed 's/.*localhost:\([0-9]*\).*/\1/'
      return 0
    fi
    sleep 0.5
    elapsed=$((elapsed + 1))
  done
  echo "ERROR: vite did not start within ${timeout}s" >&2
  cat "$logfile" >&2
  return 1
}

EDITOR_LOG=$(mktemp)
HARNESS_LOG=$(mktemp)

# Start sampler-editor vite on port 0
VISUAL_HTTP=1 npx vite --port 0 > "$EDITOR_LOG" 2>&1 &
EDITOR_PID=$!

# Start sample-editor dev harness vite on port 0
(cd ../sample-editor && VISUAL_HTTP=1 npx vite --config dev/vite.config.ts --port 0) > "$HARNESS_LOG" 2>&1 &
HARNESS_PID=$!

# Wait for both servers to bind and report their ports
E2E_PORT_EDITOR=$(wait_for_port "$EDITOR_LOG")
E2E_PORT_HARNESS=$(wait_for_port "$HARNESS_LOG")

echo "Running sample editor E2E tests"
echo "  sampler-editor on port $E2E_PORT_EDITOR"
echo "  dev harness on port $E2E_PORT_HARNESS"

export E2E_PORT_EDITOR
export E2E_PORT_HARNESS

npx playwright test --config playwright.sample-editor.config.ts "$@"
