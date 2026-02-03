#!/bin/bash
# Cleanup script for obsolete JUCE/WebMidi files
# Generated: 2025-10-16
# See docs/1.20/issues/36/implementation/workplan.md for context

set -e

echo "═══════════════════════════════════════════════════"
echo "Launch Control XL3 - Obsolete File Cleanup"
echo "═══════════════════════════════════════════════════"
echo ""
echo "This script will remove 62 obsolete files:"
echo "  - 54 utility scripts (monitoring, JUCE, WebMidi)"
echo "  - 2 backend implementations (JuceMidiBackend, WebMidiBackend)"
echo "  - 4 HTML test files"
echo "  - 2 obsolete documentation files"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

# Remove utils/ files
echo ""
echo "→ Removing obsolete utility scripts..."
rm -f utils/analyze-sysex-structure.ts
rm -f utils/capture-device-response.ts
rm -f utils/compare-raw-vs-parsed.ts
rm -f utils/debug-message-builder.ts
rm -f utils/debug-page3-write.ts
rm -f utils/debug-sysex.ts
rm -f utils/extract-page0-mapping.ts
rm -f utils/inspect-mode-data.ts
rm -f utils/inspect-raw-response.ts
rm -f utils/inspect-slot10.ts
rm -f utils/interactive-device-test.ts
rm -f utils/investigate-slot-issue.ts
rm -f utils/launch-juce-midi-server.ts
rm -f utils/list-midi-ports.ts
rm -f utils/minimal-device-test.ts
rm -f utils/minimal-write-test.ts
rm -f utils/monitor-device-activity.ts
rm -f utils/monitor-midi-traffic.ts
rm -f utils/quick-port-check.ts
rm -f utils/read-all-pages.ts
rm -f utils/read-custom-mode.ts
rm -f utils/read-slot-10.ts
rm -f utils/read-slot.ts
rm -f utils/simple-device-test.ts
rm -f utils/simple-read-test.ts
rm -f utils/simple-write-test.ts
rm -f utils/test-device-communication.ts
rm -f utils/test-full-mode-write.ts
rm -f utils/test-invalid-mode.ts
rm -f utils/test-jzz-with-handshake.ts
rm -f utils/test-jzz.ts
rm -f utils/test-midi-backend.ts
rm -f utils/test-multi-page-write.ts
rm -f utils/test-node-midi.ts
rm -f utils/test-page-write.ts
rm -f utils/test-random-changes.ts
rm -f utils/test-read-all-slots.ts
rm -f utils/test-read-slot-3.ts
rm -f utils/test-read.ts
rm -f utils/test-round-trip-validation.ts
rm -f utils/test-round-trip.ts
rm -f utils/test-sysex-page-write.ts
rm -f utils/test-sysex-read.ts
rm -f utils/test-sysex-reception.ts
rm -f utils/test-unmodified-round-trip.ts
rm -f utils/test-web-midi.ts
rm -f utils/test-write-acknowledgement.ts
rm -f utils/test-write-api.ts
rm -f utils/test-write-slot-3.ts
rm -f utils/test-write-timing.ts
rm -f utils/validate-acknowledgement.ts
rm -f utils/verify-midi-input.ts
rm -f utils/verify-sysex-enabled.ts
echo "✓ Removed 54 utility scripts"

# Remove backend files
echo ""
echo "→ Removing obsolete backend implementations..."
rm -f src/backends/JuceMidiBackend.ts
rm -f src/backends/WebMidiBackend.ts
echo "✓ Removed 2 backend files"

# Remove HTML test files
echo ""
echo "→ Removing HTML test files..."
rm -f test-device-communication.html
rm -f test-midi-backend.html
rm -f test-read-custom-mode.html
rm -f test-slot-selection.html
echo "✓ Removed 4 HTML files"

# Remove documentation files
echo ""
echo "→ Removing obsolete documentation..."
rm -f docs/slot-investigation-hypothesis.md
rm -f docs/investigation-plan.md
echo "✓ Removed 2 documentation files"

echo ""
echo "═══════════════════════════════════════════════════"
echo "Cleanup Complete"
echo "═══════════════════════════════════════════════════"
echo ""
echo "Files removed: 62"
echo ""
echo "Remaining files to update manually:"
echo "  1. utils/backup-current-mode.ts"
echo "  2. utils/test-slot-copy.ts"
echo "  3. utils/test-round-trip-node.ts"
echo "  4. test/integration/slot-selection.hardware.test.ts"
echo "  5. src/index.ts"
echo "  6. package.json"
echo ""
echo "See file update instructions for details."
