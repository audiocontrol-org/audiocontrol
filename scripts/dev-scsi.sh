#!/usr/bin/env bash
#
# Dev provisioning for SCSI MIDI bridge.
#
# Ensures s2p and scsi-midi-bridge are running on the Pi, then starts
# the S3K editor dev server with the SCSI bridge proxy. Idempotent:
# skips steps that are already done.
#
# Required environment variables (set by Make target):
#   S2P_BIN          - Path to cross-compiled s2p binary (ARM64)
#   SCSI_BRIDGE_BIN  - Path to cross-compiled scsi-midi-bridge binary (ARM64)
#
# Optional environment variables:
#   SCSI_PI_HOST     - Pi hostname (default: s3k.local)
#   SCSI_PI_USER     - Pi SSH user (default: orion)
#
# Usage:
#   make dev-scsi                    # Build binaries, provision Pi, start editor
#   make dev-scsi SCSI_PI_HOST=10.0.0.57

set -euo pipefail

PI_HOST="${SCSI_PI_HOST:-s3k.local}"
PI_USER="${SCSI_PI_USER:-orion}"
PI_SSH="$PI_USER@$PI_HOST"

echo "=== SCSI Dev Environment ==="
echo ""

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
# Step 2: Ensure s2p is running
# ---------------------------------------------------------------------------

echo "Step 2: Checking s2p on Pi..."

if ssh "$PI_SSH" "nc -z localhost 6868 2>/dev/null"; then
  echo "   s2p already running on port 6868"
else
  echo "   s2p not running — deploying and starting..."

  if [ -z "${S2P_BIN:-}" ] || [ ! -f "$S2P_BIN" ]; then
    echo "ERROR: S2P_BIN not set or binary not found: ${S2P_BIN:-<not set>}"
    exit 1
  fi

  scp -q "$S2P_BIN" "$PI_SSH:/tmp/s2p-midi"
  ssh "$PI_SSH" "chmod +x /tmp/s2p-midi"
  ssh "$PI_SSH" "sudo -n /tmp/s2p-midi --port 6868 > /tmp/dev-s2p.log 2>&1 &"

  MAX_WAIT=30
  ELAPSED=0
  while [ "$ELAPSED" -lt "$MAX_WAIT" ]; do
    if ssh "$PI_SSH" "nc -z localhost 6868 2>/dev/null"; then break; fi
    sleep 0.5
    ELAPSED=$((ELAPSED + 1))
  done

  if [ "$ELAPSED" -ge "$MAX_WAIT" ]; then
    echo "ERROR: s2p failed to start (port 6868 not reachable after ${MAX_WAIT}s)"
    ssh "$PI_SSH" "cat /tmp/dev-s2p.log 2>/dev/null" || true
    exit 1
  fi
  echo "   s2p started on port 6868"
fi
echo ""

# ---------------------------------------------------------------------------
# Step 3: Ensure scsi-midi-bridge is running
# ---------------------------------------------------------------------------

echo "Step 3: Checking scsi-midi-bridge on Pi..."

if ssh "$PI_SSH" "nc -z localhost 7033 2>/dev/null"; then
  echo "   Bridge already running on port 7033"
else
  echo "   Bridge not running — deploying and starting..."

  if [ -z "${SCSI_BRIDGE_BIN:-}" ] || [ ! -f "$SCSI_BRIDGE_BIN" ]; then
    echo "ERROR: SCSI_BRIDGE_BIN not set or binary not found: ${SCSI_BRIDGE_BIN:-<not set>}"
    exit 1
  fi

  scp -q "$SCSI_BRIDGE_BIN" "$PI_SSH:/tmp/e2e-scsi-midi-bridge"
  ssh "$PI_SSH" "chmod +x /tmp/e2e-scsi-midi-bridge"
  ssh "$PI_SSH" "nohup /tmp/e2e-scsi-midi-bridge --port 7033 --target-id 6 > /tmp/dev-bridge.log 2>&1 &"

  MAX_WAIT=15
  ELAPSED=0
  while [ "$ELAPSED" -lt "$MAX_WAIT" ]; do
    if ssh "$PI_SSH" "nc -z localhost 7033 2>/dev/null"; then break; fi
    sleep 0.5
    ELAPSED=$((ELAPSED + 1))
  done

  if [ "$ELAPSED" -ge "$MAX_WAIT" ]; then
    echo "ERROR: Bridge failed to start (port 7033 not reachable after ${MAX_WAIT}s)"
    ssh "$PI_SSH" "cat /tmp/dev-bridge.log 2>/dev/null" || true
    exit 1
  fi
  echo "   Bridge started on port 7033"
fi
echo ""

# ---------------------------------------------------------------------------
# Step 4: Validate S3000XL is reachable
# ---------------------------------------------------------------------------

echo "Step 4: Validating S3000XL via bridge..."

BRIDGE_URL="http://$PI_HOST:7033"
STATUS=$(curl -sf "$BRIDGE_URL/status" 2>/dev/null) || {
  echo "ERROR: Cannot reach bridge at $BRIDGE_URL"
  exit 1
}

REACHABLE=$(echo "$STATUS" | grep -o '"samplerReachable":true' || true)
if [ -z "$REACHABLE" ]; then
  echo "WARNING: Bridge is running but S3000XL is not reachable"
  echo "Status: $STATUS"
  echo ""
  echo "The dev server will start, but device operations will fail"
  echo "until the S3000XL is powered on and connected via SCSI."
  echo ""
else
  echo "   S3000XL reachable via SCSI bridge"
  echo ""
fi

# ---------------------------------------------------------------------------
# Step 5: Start Vite dev server
# ---------------------------------------------------------------------------

echo "Step 5: Starting S3K editor dev server..."
echo ""
echo "   Bridge: $BRIDGE_URL (proxied via /scsi-bridge)"
echo ""

cd modules/akai-s3k-editor
exec pnpm dev
