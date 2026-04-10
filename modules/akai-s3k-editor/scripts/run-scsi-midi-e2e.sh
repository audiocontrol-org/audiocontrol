#!/usr/bin/env bash
# Thin wrapper — delegates to the shared SCSI MIDI runner in e2e-infra.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODULE_DIR="$(dirname "$SCRIPT_DIR")"
INFRA_DIR="$(cd "$MODULE_DIR/../e2e-infra" && pwd)"

export E2E_PLAYWRIGHT_CONFIG="${E2E_PLAYWRIGHT_CONFIG:-playwright.scsi-midi.config.ts}"

exec "$INFRA_DIR/scripts/run-scsi-midi-e2e.sh" "$@"
