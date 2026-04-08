#!/usr/bin/env bash
#
# Shared SCSI MIDI E2E test runner.
#
# This script is called FROM an editor module directory. It:
#   1. Verifies SSH connectivity to the Pi
#   2. Deploys s2p and scsi-midi-bridge binaries to the Pi
#   3. Starts s2p and bridge on the Pi
#   4. Validates S3000XL is reachable via bridge
#   5. Starts Vite dev server locally
#   6. Runs Playwright tests with watchdog
#
# Required environment variables:
#   S2P_BIN - Path to cross-compiled s2p binary (ARM64)
#   SCSI_BRIDGE_BIN - Path to cross-compiled scsi-midi-bridge binary (ARM64)
#
# Optional environment variables:
#   SCSI_PI_HOST - Pi hostname (default: s3k.local)
#   SCSI_PI_USER - Pi SSH user (default: orion)
#   E2E_PLAYWRIGHT_CONFIG - Playwright config file (default: playwright.scsi-midi.config.ts)
#
# Usage:
#   S2P_BIN=/path/to/s2p SCSI_BRIDGE_BIN=/path/to/bridge ./run-scsi-midi-e2e.sh [playwright args...]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"

PI_HOST="${SCSI_PI_HOST:-s3k.local}"
PI_USER="${SCSI_PI_USER:-orion}"
PI_SSH="$PI_USER@$PI_HOST"

echo "=== SCSI MIDI E2E Test Runner ==="
echo ""

# Validate required binaries
if [ -z "${S2P_BIN:-}" ] || [ ! -f "$S2P_BIN" ]; then
  echo "ERROR: S2P_BIN not set or binary not found"
  echo "       S2P_BIN=${S2P_BIN:-<not set>}"
  exit 1
fi

if [ -z "${SCSI_BRIDGE_BIN:-}" ] || [ ! -f "$SCSI_BRIDGE_BIN" ]; then
  echo "ERROR: SCSI_BRIDGE_BIN not set or binary not found"
  echo "       SCSI_BRIDGE_BIN=${SCSI_BRIDGE_BIN:-<not set>}"
  exit 1
fi

# ---------------------------------------------------------------------------
# Cleanup trap
# ---------------------------------------------------------------------------

HEARTBEAT_FILE=""
WATCHDOG_PID=""
VITE_PID=""
VITE_LOG=""

cleanup() {
  echo ""
  echo "Cleaning up..."

  # Local processes
  if [ -n "${WATCHDOG_PID:-}" ]; then
    kill "$WATCHDOG_PID" 2>/dev/null || true
    wait "$WATCHDOG_PID" 2>/dev/null || true
  fi
  [ -n "${VITE_PID:-}" ] && kill "$VITE_PID" 2>/dev/null || true

  # Remote processes on Pi (sudo killall is NOPASSWD in sudoers)
  ssh -o ConnectTimeout=5 "$PI_SSH" "sudo killall s2p-midi 2>/dev/null; true" 2>/dev/null || true
  ssh -o ConnectTimeout=5 "$PI_SSH" "killall e2e-scsi-midi-bridge 2>/dev/null; true" 2>/dev/null || true

  # Temp files
  rm -f "${VITE_LOG:-}" "${HEARTBEAT_FILE:-}"
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# Step 1: Verify SSH connectivity
# ---------------------------------------------------------------------------

echo "Step 1: Verifying SSH to $PI_SSH..."

if ! ssh -o ConnectTimeout=5 -o BatchMode=yes "$PI_SSH" true 2>/dev/null; then
  echo ""
  echo "ERROR: Cannot SSH to $PI_SSH"
  echo ""
  echo "Ensure:"
  echo "  - Pi is powered on and reachable at $PI_HOST"
  echo "  - SSH key authentication is configured for $PI_USER"
  echo "  - Override with: SCSI_PI_HOST=<ip> SCSI_PI_USER=<user>"
  echo ""
  exit 1
fi
echo "   SSH OK"
echo ""

# ---------------------------------------------------------------------------
# Step 2: Check if correct binaries are already deployed and running
# ---------------------------------------------------------------------------

echo "Step 2: Checking deployment state on Pi..."

LOCAL_S2P_HASH=$(md5 -q "$S2P_BIN" 2>/dev/null || md5sum "$S2P_BIN" 2>/dev/null | cut -d' ' -f1)
LOCAL_BRIDGE_HASH=$(md5 -q "$SCSI_BRIDGE_BIN" 2>/dev/null || md5sum "$SCSI_BRIDGE_BIN" 2>/dev/null | cut -d' ' -f1)

REMOTE_S2P_HASH=$(ssh "$PI_SSH" "md5sum /tmp/s2p-midi 2>/dev/null | cut -d' ' -f1" || echo "none")
REMOTE_BRIDGE_HASH=$(ssh "$PI_SSH" "md5sum /tmp/e2e-scsi-midi-bridge 2>/dev/null | cut -d' ' -f1" || echo "none")

S2P_RUNNING=$(ssh "$PI_SSH" "pgrep -x s2p-midi >/dev/null 2>&1 && echo yes || echo no")
BRIDGE_RUNNING=$(ssh "$PI_SSH" "pgrep -x e2e-scsi-midi-bridge >/dev/null 2>&1 && echo yes || echo no")

NEED_DEPLOY=false
NEED_RESTART=false

if [ "$LOCAL_S2P_HASH" != "$REMOTE_S2P_HASH" ] || [ "$LOCAL_BRIDGE_HASH" != "$REMOTE_BRIDGE_HASH" ]; then
  echo "   Binaries changed — need redeploy"
  NEED_DEPLOY=true
  NEED_RESTART=true
elif [ "$S2P_RUNNING" != "yes" ] || [ "$BRIDGE_RUNNING" != "yes" ]; then
  echo "   Binaries match but daemons not running — need restart"
  NEED_RESTART=true
else
  echo "   Binaries match and daemons running — skipping deploy"
fi
echo ""

# ---------------------------------------------------------------------------
# Step 3: Deploy binaries (only if changed)
# ---------------------------------------------------------------------------

if [ "$NEED_DEPLOY" = "true" ]; then
  echo "Step 3: Deploying binaries to Pi..."
  # Kill old processes first
  ssh "$PI_SSH" "sudo killall s2p-midi 2>/dev/null; true" || true
  ssh "$PI_SSH" "killall e2e-scsi-midi-bridge 2>/dev/null; true" || true
  sleep 1
  scp -q "$S2P_BIN" "$PI_SSH:/tmp/s2p-midi"
  scp -q "$SCSI_BRIDGE_BIN" "$PI_SSH:/tmp/e2e-scsi-midi-bridge"
  ssh "$PI_SSH" "chmod +x /tmp/s2p-midi /tmp/e2e-scsi-midi-bridge"
  echo "   s2p → /tmp/s2p-midi"
  echo "   bridge → /tmp/e2e-scsi-midi-bridge"
  echo ""
elif [ "$NEED_RESTART" = "true" ]; then
  echo "Step 3: Binaries already deployed, killing stale processes..."
  ssh "$PI_SSH" "sudo killall s2p-midi 2>/dev/null; true" || true
  ssh "$PI_SSH" "killall e2e-scsi-midi-bridge 2>/dev/null; true" || true
  sleep 1
  echo "   Done"
  echo ""
else
  echo "Step 3: Skipped (already deployed and running)"
  echo ""
fi

# ---------------------------------------------------------------------------
# Step 4: Start s2p on Pi
# ---------------------------------------------------------------------------

if [ "$NEED_RESTART" = "false" ]; then
  echo "Step 4: s2p already running — skipped"
  echo ""
else
echo "Step 4: Starting s2p on Pi..."
ssh "$PI_SSH" "sudo -n /tmp/s2p-midi --port 6868 > /tmp/e2e-s2p.log 2>&1 &"

# Wait for port 6868
MAX_WAIT=30
ELAPSED=0
while [ "$ELAPSED" -lt "$MAX_WAIT" ]; do
  if ssh "$PI_SSH" "nc -z localhost 6868 2>/dev/null"; then
    break
  fi
  sleep 0.5
  ELAPSED=$((ELAPSED + 1))
  if [ $((ELAPSED % 4)) -eq 0 ]; then echo -n "."; fi
done
echo ""

if [ "$ELAPSED" -ge "$MAX_WAIT" ]; then
  echo "ERROR: s2p failed to start (port 6868 not reachable after ${MAX_WAIT}s)"
  echo "s2p log:"
  ssh "$PI_SSH" "cat /tmp/e2e-s2p.log 2>/dev/null" || true
  exit 1
fi
echo "   s2p running on port 6868"
echo ""
fi

# ---------------------------------------------------------------------------
# Step 5: Start scsi-midi-bridge on Pi
# ---------------------------------------------------------------------------

if [ "$NEED_RESTART" = "false" ]; then
  echo "Step 5: scsi-midi-bridge already running — skipped"
  echo ""
else
echo "Step 5: Starting scsi-midi-bridge on Pi..."
ssh "$PI_SSH" "nohup /tmp/e2e-scsi-midi-bridge --port 7033 --target-id 6 > /tmp/e2e-bridge.log 2>&1 &"

MAX_WAIT=15
ELAPSED=0
while [ "$ELAPSED" -lt "$MAX_WAIT" ]; do
  if ssh "$PI_SSH" "nc -z localhost 7033 2>/dev/null"; then
    break
  fi
  sleep 0.5
  ELAPSED=$((ELAPSED + 1))
  if [ $((ELAPSED % 4)) -eq 0 ]; then echo -n "."; fi
done
echo ""

if [ "$ELAPSED" -ge "$MAX_WAIT" ]; then
  echo "ERROR: scsi-midi-bridge failed to start (port 7033 not reachable after ${MAX_WAIT}s)"
  echo "Bridge log:"
  ssh "$PI_SSH" "cat /tmp/e2e-bridge.log 2>/dev/null" || true
  exit 1
fi
echo "   Bridge running on port 7033"
echo ""
fi

# ---------------------------------------------------------------------------
# Step 6: Validate S3000XL is reachable
# ---------------------------------------------------------------------------

echo "Step 6: Validating S3000XL via bridge..."

BRIDGE_URL="http://$PI_HOST:7033"
STATUS=$(curl -sf "$BRIDGE_URL/status" 2>/dev/null) || {
  echo "ERROR: Cannot reach bridge at $BRIDGE_URL"
  exit 1
}

REACHABLE=$(echo "$STATUS" | grep -o '"samplerReachable":true' || true)
if [ -z "$REACHABLE" ]; then
  echo "ERROR: Bridge is running but S3000XL is not reachable"
  echo "Status: $STATUS"
  echo ""
  echo "Ensure the S3000XL is powered on and connected via SCSI"
  exit 1
fi

echo "   S3000XL reachable via SCSI bridge"
echo ""

# ---------------------------------------------------------------------------
# Step 7: Start Vite dev server locally
# ---------------------------------------------------------------------------

echo "Step 7: Starting preview server (serves production build from dist/)..."
VITE_LOG=$(mktemp)

pnpm vite preview --port 0 > "$VITE_LOG" 2>&1 &
VITE_PID=$!

MAX_WAIT=20
ELAPSED=0
VITE_PORT=""

while [ -z "$VITE_PORT" ] && [ "$ELAPSED" -lt "$MAX_WAIT" ]; do
  sleep 0.5
  ELAPSED=$((ELAPSED + 1))
  VITE_PORT=$(grep -o 'https://localhost:[0-9]*' "$VITE_LOG" 2>/dev/null | head -1 | sed 's/.*://' || true)
  if [ $((ELAPSED % 2)) -eq 0 ]; then echo -n "."; fi
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

# ---------------------------------------------------------------------------
# Step 8: Run Playwright tests with watchdog
# ---------------------------------------------------------------------------

echo "Step 8: Running SCSI MIDI e2e tests..."
echo ""

PLAYWRIGHT_CONFIG="${E2E_PLAYWRIGHT_CONFIG:-playwright.scsi-midi.config.ts}"

export E2E_VITE_PORT="$VITE_PORT"
export E2E_SCSI_BRIDGE_URL="$BRIDGE_URL"

HEARTBEAT_FILE="/tmp/e2e-heartbeat-$$.json"
export E2E_HEARTBEAT_FILE="$HEARTBEAT_FILE"

PLAYWRIGHT_LOG=$(mktemp)
npx playwright test -c "$PLAYWRIGHT_CONFIG" "$@" > "$PLAYWRIGHT_LOG" 2>&1 &
PLAYWRIGHT_PID=$!

tsx "$INFRA_DIR/scripts/watchdog.ts" "$PLAYWRIGHT_PID" "$HEARTBEAT_FILE" &
WATCHDOG_PID=$!

echo "[runner] Playwright PID: $PLAYWRIGHT_PID"
echo "[runner] Watchdog PID: $WATCHDOG_PID"
echo "[runner] Bridge: $BRIDGE_URL"
echo "[runner] Config: $PLAYWRIGHT_CONFIG"
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
  echo "Test runner was killed by watchdog after inactivity timeout."
  exit 1
fi

exit "$PLAYWRIGHT_EXIT"
