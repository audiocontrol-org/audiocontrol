#!/usr/bin/env bash
#
# Run UI test harness e2e tests for keygroup zone components.
#
# Tests ZoneOverview, KeyRangeEditor, and VelocityRangeBar interactions
# using hardcoded keygroups -- no device, MIDI, or watchdog required.
#
# The dev-server launch + port-detection + teardown is shared with the
# Roland harness via modules/e2e-infra/scripts/dev-server-lib.sh.
#
# Usage:
#   ./scripts/run-test-harness-e2e.sh [playwright args...]
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# shellcheck source=../../e2e-infra/scripts/dev-server-lib.sh
source "$SCRIPT_DIR/../../e2e-infra/scripts/dev-server-lib.sh"

echo "=== S3K UI Test Harness Runner ==="
echo ""

run_playwright_harness "playwright.test-harness.config.ts" "$@"
