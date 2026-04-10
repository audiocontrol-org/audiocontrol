#!/usr/bin/env bash
# Deploy s2p and scsi-midi-bridge to the Pi, restart daemons, validate.
#
# Required env vars (set by Make):
#   SCSI_PI_HOST  — Pi hostname (default: s3k.local)
#   SCSI_PI_USER  — Pi SSH user (default: orion)
#   S2P_BIN       — Path to cross-compiled s2p binary
#   SCSI_BRIDGE_BIN — Path to cross-compiled scsi-midi-bridge binary
#
# Usage: make deploy-scsi-bridge
set -euo pipefail

PI_HOST="${SCSI_PI_HOST:-s3k.local}"
PI_USER="${SCSI_PI_USER:-orion}"
PI_SSH="${PI_USER}@${PI_HOST}"

# Validate required binaries exist
for var in S2P_BIN SCSI_BRIDGE_BIN; do
  if [ -z "${!var:-}" ] || [ ! -f "${!var}" ]; then
    echo "ERROR: $var not set or file not found (${!var:-<unset>})"
    exit 1
  fi
done

# Validate SSH connectivity
echo "Checking SSH connectivity to ${PI_SSH}..."
if ! ssh -o ConnectTimeout=5 "$PI_SSH" "echo ok" >/dev/null 2>&1; then
  echo "ERROR: Cannot reach ${PI_SSH} via SSH"
  exit 1
fi
echo "   Connected"
echo ""

# ---------------------------------------------------------------------------
# Step 1: Stop existing daemons
# ---------------------------------------------------------------------------

echo "Step 1: Stopping existing daemons..."

# Stop the stock s2p systemd service if it's running — it conflicts with our custom s2p
ssh "$PI_SSH" "sudo systemctl stop s2p 2>/dev/null; sudo systemctl disable s2p 2>/dev/null; true"

# Kill bridge processes (not root-owned)
ssh "$PI_SSH" "killall e2e-scsi-midi-bridge 2>/dev/null; killall scsi-midi-bridge 2>/dev/null; true"

# Kill s2p (root-owned, requires sudo killall). Use -9 to avoid graceful shutdown delays.
ssh "$PI_SSH" "sudo killall -9 s2p-midi 2>/dev/null; sudo killall -9 s2p 2>/dev/null; true"

# Wait for s2p to actually exit — exponential backoff, 10s hard timeout
wait_for_exit() {
  local name="$1"
  local delay=0.1
  local total=0
  while ssh "$PI_SSH" "pgrep -x $name >/dev/null 2>&1"; do
    total=$(echo "$total + $delay" | bc)
    if [ "$(echo "$total >= 10" | bc)" -eq 1 ]; then
      echo "ERROR: $name still running after 10s — aborting"
      exit 1
    fi
    sleep "$delay"
    delay=$(echo "$delay * 2" | bc)
    # Cap individual sleep at 2s
    if [ "$(echo "$delay > 2" | bc)" -eq 1 ]; then delay=2; fi
  done
}

wait_for_exit s2p-midi
wait_for_exit s2p
wait_for_exit e2e-scsi-midi-bridge

echo "   Done"
echo ""

# ---------------------------------------------------------------------------
# Step 2: Deploy binaries
# ---------------------------------------------------------------------------

echo "Step 2: Deploying binaries to Pi..."
scp -q "$S2P_BIN" "$PI_SSH:/tmp/s2p-midi"
scp -q "$SCSI_BRIDGE_BIN" "$PI_SSH:/tmp/e2e-scsi-midi-bridge"
ssh "$PI_SSH" "chmod +x /tmp/s2p-midi /tmp/e2e-scsi-midi-bridge"
echo "   s2p → /tmp/s2p-midi"
echo "   bridge → /tmp/e2e-scsi-midi-bridge"
echo ""

# ---------------------------------------------------------------------------
# Step 3: Start s2p
# ---------------------------------------------------------------------------

echo "Step 3: Starting s2p on Pi..."
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
# Step 4: Start scsi-midi-bridge
# ---------------------------------------------------------------------------

echo "Step 4: Starting scsi-midi-bridge on Pi..."
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
echo "   bridge running on port 7033"
echo ""

# ---------------------------------------------------------------------------
# Step 5: Validate
# ---------------------------------------------------------------------------

echo "Step 5: Validating bridge status..."
STATUS=$(curl -s --max-time 5 "http://${PI_HOST}:7033/status" 2>/dev/null || echo "FAILED")
if echo "$STATUS" | grep -q "samplerReachable"; then
  echo "   Bridge status: $STATUS"
else
  echo "   WARNING: Bridge responded but status unclear: $STATUS"
fi
echo ""
echo "Deploy complete."
