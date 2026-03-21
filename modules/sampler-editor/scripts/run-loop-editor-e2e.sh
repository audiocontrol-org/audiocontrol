#!/usr/bin/env bash
# Run loop editor E2E tests on a dynamically assigned port.
# Usage: ./scripts/run-loop-editor-e2e.sh

set -euo pipefail

# Get a free port from the OS by briefly binding to port 0
E2E_PORT=$(node -e "
  const s = require('net').createServer();
  s.listen(0, () => { console.log(s.address().port); s.close(); });
")

export E2E_PORT
echo "Running loop editor E2E tests on port $E2E_PORT"
exec npx playwright test --config playwright.loop-editor.config.ts "$@"
