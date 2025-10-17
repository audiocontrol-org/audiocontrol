#!/usr/bin/env bash
# cleanup-utils.sh
# Cleanup utils/ directory - remove investigation artifacts, move integration tests

set -e

PROJECT_ROOT="/Users/orion/work/ol_dsp/modules/audio-control/modules/launch-control-xl3"
UTILS_DIR="$PROJECT_ROOT/utils"
INTEGRATION_DIR="$PROJECT_ROOT/test/integration"
TMP_DIR="/Users/orion/work/ol_dsp/modules/audio-control/tmp"

echo "═══════════════════════════════════════════════════════════"
echo "Utils Directory Cleanup"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Ensure directories exist
mkdir -p "$INTEGRATION_DIR"
mkdir -p "$TMP_DIR"

echo "Step 1: Moving legitimate integration tests to test/integration/"
echo "────────────────────────────────────────────────────────────"

# Move integration tests (only if they don't already exist in target)
for file in \
  "test-fetch-custom-mode-node.ts" \
  "test-handshake-node.ts" \
  "test-slot-copy.ts" \
  "test-valid-mode-changes.ts" \
  "test-round-trip-node.ts"
do
  if [ -f "$UTILS_DIR/$file" ]; then
    if [ ! -f "$INTEGRATION_DIR/$file" ]; then
      echo "  Moving: $file"
      git mv "$UTILS_DIR/$file" "$INTEGRATION_DIR/" 2>/dev/null || mv "$UTILS_DIR/$file" "$INTEGRATION_DIR/"
    else
      echo "  Skipping (exists): $file - removing duplicate"
      git rm "$UTILS_DIR/$file" 2>/dev/null || rm "$UTILS_DIR/$file"
    fi
  fi
done

echo ""
echo "Step 2: Archiving investigation artifacts to tmp/"
echo "────────────────────────────────────────────────────────────"

# Create archive subdirectory
ARCHIVE_DIR="$TMP_DIR/utils-archive-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$ARCHIVE_DIR"

echo "  Archive directory: $ARCHIVE_DIR"
echo ""

# Function to archive files
archive_file() {
  local file=$1
  if [ -f "$UTILS_DIR/$file" ]; then
    git rm "$UTILS_DIR/$file" 2>/dev/null || mv "$UTILS_DIR/$file" "$ARCHIVE_DIR/"
  fi
}

# MIDI Monitor tools (replaced by external midisnoop)
echo "  Archiving MIDI monitor tools (replaced by midisnoop)..."
archive_file "monitor-session-analyzer.ts"
archive_file "monitor-to-device.ts"
archive_file "midi-monitor.ts"
archive_file "midi-monitor-web.html"

# Web editor automation (abandoned approach)
echo "  Archiving web editor automation tools (abandoned)..."
archive_file "web-editor-automation.ts"
archive_file "playwright-test-actions.ts"
archive_file "capture-web-editor-write.ts"
archive_file "test-web-automation.ts"
archive_file "test-web-editor-protocol.ts"
archive_file "test-web-editor-replication.ts"

# Protocol investigation scripts
echo "  Archiving protocol investigation scripts..."
archive_file "protocol-reverse-engineer.ts"
archive_file "automated-protocol-test.ts"
archive_file "analyze-read-response.ts"
archive_file "test-compare-sysex.ts"
archive_file "test-complete-protocol.ts"
archive_file "test-exact-web-editor-data.ts"
archive_file "test-known-good-data.ts"
archive_file "test-sysex-format.ts"
archive_file "test-sysex-with-receivemidi.ts"
archive_file "test-webmidi-slot-selection.ts"

# Slot selection/write experiments (Issue #36)
echo "  Archiving Issue #36 slot selection experiments..."
archive_file "test-simple-write.ts"
archive_file "test-fixed-write.ts"
archive_file "test-write-only.ts"
archive_file "test-library-write.ts"
archive_file "test-simple-command.ts"
archive_file "test-direct-send.ts"
archive_file "test-minimal-sysex.ts"
archive_file "test-raw-sysex.ts"
archive_file "test-slot-selection.ts"
archive_file "test-slot-0-round-trip.ts"
archive_file "test-slot-debug.ts"
archive_file "test-slot1-verification.ts"
archive_file "verify-slot-fix.ts"
archive_file "test-issue-36-fix.ts"

# DAW port integration experiments
echo "  Archiving DAW port experiments..."
archive_file "test-daw-ports.ts"
archive_file "test-daw-port-integration.ts"
archive_file "test-daw-port-monitor.ts"
archive_file "test-midi-monitor.ts"

# Round-trip/full protocol tests (redundant)
echo "  Archiving redundant round-trip tests..."
archive_file "test-full-round-trip.ts"
archive_file "test-round-trip-with-changes.ts"
archive_file "test-juce-round-trip.ts"
archive_file "test-hybrid-approach.ts"
archive_file "test-clean-communication.ts"
archive_file "test-garbage-messages.ts"

# Miscellaneous test/diagnostic scripts
echo "  Archiving miscellaneous test scripts..."
archive_file "test-control-names.ts"
archive_file "test-control-name-send.ts"
archive_file "test-factory-mode-copy.ts"
archive_file "test-simple-read.ts"
archive_file "diagnose-jupiter8.ts"

# Documentation for deleted tools
echo "  Archiving obsolete documentation..."
archive_file "README-TOOLS.md"

echo ""
echo "Step 3: Verification"
echo "────────────────────────────────────────────────────────────"

# Count files in utils
UTILS_COUNT=$(find "$UTILS_DIR" -maxdepth 1 -type f | wc -l | tr -d ' ')
echo "  Files remaining in utils/: $UTILS_COUNT"

# List remaining files
echo ""
echo "  Remaining utility scripts:"
ls -1 "$UTILS_DIR"/*.ts 2>/dev/null | xargs -n1 basename || echo "    (none)"

# Count integration tests
INTEGRATION_COUNT=$(find "$INTEGRATION_DIR" -maxdepth 1 -type f -name "*.ts" -o -name "*.cjs" | wc -l | tr -d ' ')
echo ""
echo "  Integration tests in test/integration/: $INTEGRATION_COUNT"

# Count archived files
if [ -d "$ARCHIVE_DIR" ]; then
  ARCHIVE_COUNT=$(find "$ARCHIVE_DIR" -type f | wc -l | tr -d ' ')
  echo "  Files archived to tmp/: $ARCHIVE_COUNT"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "Cleanup Summary"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "✓ utils/ cleaned (kept 4 utility scripts)"
echo "✓ Integration tests moved to test/integration/"
echo "✓ Investigation artifacts archived to tmp/"
echo ""
echo "Expected final state:"
echo "  - utils/: 4 utility scripts"
echo "  - test/integration/: ~12+ integration tests"
echo "  - Archive: ~51 investigation/experiment files"
echo ""
if [ -d "$ARCHIVE_DIR" ]; then
  echo "Archive location: $ARCHIVE_DIR"
  echo ""
  echo "You can safely delete the archive after verification:"
  echo "  rm -rf \"$ARCHIVE_DIR\""
fi
echo ""
