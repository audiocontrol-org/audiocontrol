#!/usr/bin/env bash
#
# Run a make target with proper log management and completion detection.
#
# Features:
# - Redirects output to a timestamped log file
# - Polls for process completion with exponential backoff (1s, 2s, 4s, 8s, 16s, then 30s intervals)
# - Prints filtered output on each poll (PASS/FAIL/ERROR/Summary lines)
# - Prints full log on completion
# - Returns the make target's exit code
#
# Usage:
#   ./run-and-watch.sh <make-target> [ARGS="..."]
#
# Examples:
#   ./run-and-watch.sh test-scsi-sds-transfer ARGS="--test sds --verbose"
#   ./run-and-watch.sh test-e2e-s3k-device-library ARGS="--grep 'sample round trip'"
#   ./run-and-watch.sh test-e2e-roland-library

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <make-target> [MAKE_ARGS...]"
  echo "Example: $0 test-scsi-sds-transfer ARGS=\"--test sds --verbose\""
  exit 1
fi

TARGET="$1"
shift

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_DIR="/tmp/e2e-logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/${TARGET}-${TIMESTAMP}.log"

echo "=== run-and-watch: ${TARGET} ==="
echo "Log: ${LOG_FILE}"
echo ""

# Run in background
make "$TARGET" "$@" > "$LOG_FILE" 2>&1 &
PID=$!

# Track lines already shown to avoid duplicates
SHOWN_LINES=0

# Poll with exponential backoff: 1, 2, 4, 8, 16, then 30s intervals
INTERVALS=(1 2 4 8 16 30 30 30 30 30 30 30 30 30 30 30 30 30 30 30)
TOTAL_WAITED=0

for INTERVAL in "${INTERVALS[@]}"; do
  sleep "$INTERVAL"
  TOTAL_WAITED=$((TOTAL_WAITED + INTERVAL))

  if ! kill -0 "$PID" 2>/dev/null; then
    # Process finished
    wait "$PID" 2>/dev/null
    EXIT_CODE=$?
    echo ""
    echo "=== Completed in ~${TOTAL_WAITED}s (exit code: ${EXIT_CODE}) ==="
    echo ""

    # Show key results
    grep -E "PASS|FAIL|ERROR|Summary|passed|failed" "$LOG_FILE" 2>/dev/null || true

    echo ""
    echo "Full log: ${LOG_FILE}"
    exit "$EXIT_CODE"
  fi

  # Still running — show new interesting lines
  CURRENT_LINES=$(wc -l < "$LOG_FILE" 2>/dev/null || echo 0)
  if [ "$CURRENT_LINES" -gt "$SHOWN_LINES" ]; then
    NEW_LINES=$(tail -n +"$((SHOWN_LINES + 1))" "$LOG_FILE" | grep -E "PASS|FAIL|ERROR|Step|BROWSER.*error|STUCK|SUCCEED|Sample count|upload|download|connected|preflight" 2>/dev/null || true)
    if [ -n "$NEW_LINES" ]; then
      echo "$NEW_LINES"
    fi
    SHOWN_LINES="$CURRENT_LINES"
  fi
done

# If we get here, the test ran for too long
echo ""
echo "=== TIMEOUT: test still running after ${TOTAL_WAITED}s ==="
echo "Killing PID ${PID}..."
kill "$PID" 2>/dev/null || true
wait "$PID" 2>/dev/null || true
echo "Full log: ${LOG_FILE}"
exit 1
