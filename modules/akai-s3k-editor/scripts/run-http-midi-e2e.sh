#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODULE_DIR="$(dirname "$SCRIPT_DIR")"
INFRA_DIR="$(cd "$MODULE_DIR/../e2e-infra" && pwd)"

export E2E_VALIDATE_CMD="tsx $INFRA_DIR/scripts/validate-akai-s3000xl.ts"
export E2E_PLAYWRIGHT_CONFIG="playwright.http-midi.config.ts"

exec "$INFRA_DIR/scripts/run-http-midi-e2e.sh" "$@"
