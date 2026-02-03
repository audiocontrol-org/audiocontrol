#!/bin/bash
#
# MIDI Traffic Capture Script
#
# Captures MIDI SysEx traffic during custom mode write/read test.
# Uses midisnoop to record all MIDI messages exchanged with the device.
#
# Output:
#   - MIDI capture file with timestamped messages
#   - Console display of captured traffic
#

set -euo pipefail

# Directories
CAPTURE_DIR="/Users/orion/work/ol_dsp/modules/audio-control/docs/1.20/issues/40/investigation/midi-captures"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
CAPTURE_FILE="${CAPTURE_DIR}/mode-write-read-${TIMESTAMP}.txt"

# Create capture directory if needed
mkdir -p "${CAPTURE_DIR}"

echo "═══════════════════════════════════════════════════════════════"
echo "MIDI Traffic Capture for Mode Write/Read Test"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Capture file: ${CAPTURE_FILE}"
echo ""
echo "Starting midisnoop in background..."

# Start midisnoop in background, capturing to file
midisnoop > "${CAPTURE_FILE}" 2>&1 &
MIDISNOOP_PID=$!

echo "✓ midisnoop started (PID: ${MIDISNOOP_PID})"
echo ""
echo "Waiting 2 seconds for midisnoop to initialize..."
sleep 2

echo ""
echo "───────────────────────────────────────────────────────────────"
echo "Running integration test..."
echo "───────────────────────────────────────────────────────────────"
echo ""

# Run the integration test
npx tsx test/integration/custom-mode-write-verify.test.ts

TEST_EXIT_CODE=$?

echo ""
echo "───────────────────────────────────────────────────────────────"
echo "Test completed with exit code: ${TEST_EXIT_CODE}"
echo "───────────────────────────────────────────────────────────────"
echo ""

# Give midisnoop time to flush buffers
echo "Waiting 2 seconds for MIDI capture to complete..."
sleep 2

# Stop midisnoop
echo "Stopping midisnoop..."
kill ${MIDISNOOP_PID} 2>/dev/null || true
wait ${MIDISNOOP_PID} 2>/dev/null || true

echo "✓ midisnoop stopped"
echo ""

# Display capture file stats
if [ -f "${CAPTURE_FILE}" ]; then
    FILE_SIZE=$(wc -c < "${CAPTURE_FILE}" | tr -d ' ')
    LINE_COUNT=$(wc -l < "${CAPTURE_FILE}" | tr -d ' ')

    echo "═══════════════════════════════════════════════════════════════"
    echo "MIDI Capture Results"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    echo "File: ${CAPTURE_FILE}"
    echo "Size: ${FILE_SIZE} bytes"
    echo "Lines: ${LINE_COUNT}"
    echo ""

    # Show first 50 lines
    echo "───────────────────────────────────────────────────────────────"
    echo "First 50 lines of capture:"
    echo "───────────────────────────────────────────────────────────────"
    head -50 "${CAPTURE_FILE}"
    echo ""

    # Count SysEx messages
    SYSEX_COUNT=$(grep -c "F0" "${CAPTURE_FILE}" || true)
    echo "───────────────────────────────────────────────────────────────"
    echo "SysEx Messages Found: ${SYSEX_COUNT}"
    echo "───────────────────────────────────────────────────────────────"
    echo ""

    if [ ${SYSEX_COUNT} -gt 0 ]; then
        echo "Extracting SysEx messages containing 'TESTMOD' bytes..."
        echo ""

        # Show SysEx messages that might contain mode name
        # TESTMOD in ASCII: T=0x54, E=0x45, S=0x53, T=0x54, M=0x4D, O=0x4F, D=0x44
        grep "F0" "${CAPTURE_FILE}" | grep -E "54.*45.*53.*54.*4D.*4F.*44" || echo "(No SysEx with TESTMOD pattern found)"
        echo ""
    fi

    echo "═══════════════════════════════════════════════════════════════"
    echo "Next Steps:"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    echo "1. Analyze capture file: ${CAPTURE_FILE}"
    echo "2. Look for SysEx messages (F0...F7)"
    echo "3. Find WRITE messages with mode name 'TESTMOD'"
    echo "4. Find READ response messages"
    echo "5. Compare byte formats"
    echo ""
else
    echo "✗ ERROR: Capture file not created!"
    exit 1
fi

exit ${TEST_EXIT_CODE}
