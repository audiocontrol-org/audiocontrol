#!/bin/bash
# Simple MIDI capture wrapper
# Captures MIDI traffic during integration test execution

CAPTURE_DIR="/Users/orion/work/ol_dsp/modules/audio-control/docs/1.20/issues/40/investigation/midi-captures"
mkdir -p "${CAPTURE_DIR}"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
CAPTURE_FILE="${CAPTURE_DIR}/mode-write-read-${TIMESTAMP}.txt"

echo "Starting MIDI capture to: ${CAPTURE_FILE}"
echo ""

# Start midisnoop in background
midisnoop > "${CAPTURE_FILE}" 2>&1 &
SNOOP_PID=$!

# Wait for initialization
sleep 2

# Run test
echo "Running test..."
npx tsx test/integration/custom-mode-write-verify.test.ts
TEST_RESULT=$?

# Allow capture to finish
sleep 2

# Stop midisnoop
kill ${SNOOP_PID} 2>/dev/null || true
wait ${SNOOP_PID} 2>/dev/null || true

echo ""
echo "Capture saved to: ${CAPTURE_FILE}"
echo ""
echo "Capture file size: $(wc -c < "${CAPTURE_FILE}") bytes"
echo "Capture file lines: $(wc -l < "${CAPTURE_FILE}") lines"
echo ""

exit ${TEST_RESULT}
