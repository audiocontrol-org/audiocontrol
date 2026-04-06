#!/usr/bin/env bash
#
# Shared SCSI Node.js E2E test runner.
#
# Provisions the Pi (deploys s2p + bridge, starts daemons, validates),
# then runs a Node.js test script via tsx. No browser, no Playwright.
#
# Required environment variables:
#   S2P_BIN         - Path to cross-compiled s2p binary (ARM64)
#   SCSI_BRIDGE_BIN - Path to cross-compiled scsi-midi-bridge binary (ARM64)
#   E2E_NODE_SCRIPT - Path to the tsx script to run (relative to e2e-infra)
#
# Optional environment variables:
#   SCSI_PI_HOST - Pi hostname (default: s3k.local)
#   SCSI_PI_USER - Pi SSH user (default: orion)
#
# Usage:
#   S2P_BIN=/path/to/s2p SCSI_BRIDGE_BIN=/path/to/bridge \
#     E2E_NODE_SCRIPT=src/node/scsi-write-test.ts \
#     ./run-scsi-node-e2e.sh [script args...]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"

PI_HOST="${SCSI_PI_HOST:-s3k.local}"
PI_USER="${SCSI_PI_USER:-orion}"
PI_SSH="$PI_USER@$PI_HOST"

echo "=== SCSI Node.js E2E Test Runner ==="
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

if [ -z "${E2E_NODE_SCRIPT:-}" ]; then
  echo "ERROR: E2E_NODE_SCRIPT not set"
  exit 1
fi

# ---------------------------------------------------------------------------
# Cleanup trap
# ---------------------------------------------------------------------------

cleanup() {
  echo ""
  echo "Cleaning up..."
  ssh -o ConnectTimeout=5 "$PI_SSH" "sudo killall s2p-midi 2>/dev/null; true" 2>/dev/null || true
  ssh -o ConnectTimeout=5 "$PI_SSH" "killall e2e-scsi-midi-bridge 2>/dev/null; true" 2>/dev/null || true
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
# Step 2: Pre-flight cleanup
# ---------------------------------------------------------------------------

echo "Step 2: Pre-flight cleanup on Pi..."
ssh "$PI_SSH" "sudo killall s2p-midi 2>/dev/null; true" || true
ssh "$PI_SSH" "killall e2e-scsi-midi-bridge 2>/dev/null; true" || true
ssh "$PI_SSH" "killall scsi-midi-bridge 2>/dev/null; true" || true
sleep 1
echo "   Done"
echo ""

# ---------------------------------------------------------------------------
# Step 3: Deploy binaries
# ---------------------------------------------------------------------------

echo "Step 3: Deploying binaries to Pi..."
scp -q "$S2P_BIN" "$PI_SSH:/tmp/s2p-midi"
scp -q "$SCSI_BRIDGE_BIN" "$PI_SSH:/tmp/e2e-scsi-midi-bridge"
ssh "$PI_SSH" "chmod +x /tmp/s2p-midi /tmp/e2e-scsi-midi-bridge"
echo "   s2p → /tmp/s2p-midi"
echo "   bridge → /tmp/e2e-scsi-midi-bridge"
echo ""

# ---------------------------------------------------------------------------
# Step 4: Start s2p on Pi
# ---------------------------------------------------------------------------

echo "Step 4: Starting s2p on Pi..."
ssh "$PI_SSH" "sudo -n /tmp/s2p-midi --port 6868 > /tmp/e2e-s2p.log 2>&1 &"

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

# ---------------------------------------------------------------------------
# Step 5: Start scsi-midi-bridge on Pi
# ---------------------------------------------------------------------------

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
# Step 7: Run Node.js test script
# ---------------------------------------------------------------------------

echo "Step 7: Running Node.js test: $E2E_NODE_SCRIPT"
echo ""

cd "$INFRA_DIR"
exec npx tsx "$E2E_NODE_SCRIPT" --bridge-url "$BRIDGE_URL" "$@"
