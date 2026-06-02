#!/usr/bin/env bash
#
# Run UI test harness e2e tests against the simulated MIDI harness.
#
# These specs mount each editor page through the
# `?midi=simulated&scenario=<name>` URL so the editor talks to a
# SimulatedAdapter replaying a captured NDJSON fixture -- no device,
# no MIDI hardware, no SCSI. The Vite dev server's fixture middleware
# (see vite.config.ts) serves the fixture from
# modules/sampler-devices/test/fixtures/.
#
# The dev-server launch + port-detection + teardown is shared with the
# Akai harness via modules/e2e-infra/scripts/dev-server-lib.sh.
#
# Usage:
#   ./scripts/run-test-harness-e2e.sh [playwright-config-file] [playwright args...]
#
# The first positional argument, if it is a Playwright config file
# (matches `playwright.*.config.ts`), selects which suite to run. If
# omitted, the default `playwright.test-harness.config.ts` is used so
# legacy callers (e.g. `make test-ui-roland ARGS=...`) keep working
# unchanged.
#
# Tier 1 wiring suite:  ./scripts/run-test-harness-e2e.sh playwright.wiring.config.ts
# Rendering smokes:     ./scripts/run-test-harness-e2e.sh playwright.rendering.config.ts
# Default (test/ui):    ./scripts/run-test-harness-e2e.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# shellcheck source=../../e2e-infra/scripts/dev-server-lib.sh
source "$SCRIPT_DIR/../../e2e-infra/scripts/dev-server-lib.sh"

# Pick the Playwright config: explicit first arg if it matches the
# config-file naming pattern, otherwise fall back to the legacy default.
PLAYWRIGHT_CONFIG="playwright.test-harness.config.ts"
if [ "$#" -gt 0 ]; then
  case "$1" in
    playwright.*.config.ts)
      PLAYWRIGHT_CONFIG="$1"
      shift
      ;;
  esac
fi

if [ ! -f "$PROJECT_DIR/$PLAYWRIGHT_CONFIG" ]; then
  echo "ERROR: Playwright config not found at $PROJECT_DIR/$PLAYWRIGHT_CONFIG"
  exit 1
fi

echo "=== Roland S-series UI Test Harness Runner ==="
echo "   Config: $PLAYWRIGHT_CONFIG"
echo ""

run_playwright_harness "$PLAYWRIGHT_CONFIG" "$@"
