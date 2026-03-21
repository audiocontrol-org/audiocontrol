#!/usr/bin/env bash
# Run loop editor E2E tests against both sampler-editor and dev harness.
# Each surface gets its own dynamically assigned port.
#
# Usage: ./scripts/run-loop-editor-e2e.sh [playwright args...]

set -euo pipefail

# Get two free ports from the OS
read -r E2E_PORT_EDITOR E2E_PORT_HARNESS < <(node -e "
  const net = require('net');
  function getPort() {
    return new Promise(resolve => {
      const s = net.createServer();
      s.listen(0, () => { resolve(s.address().port); s.close(); });
    });
  }
  Promise.all([getPort(), getPort()]).then(([a, b]) => console.log(a + ' ' + b));
")

export E2E_PORT_EDITOR
export E2E_PORT_HARNESS
echo "Running loop editor E2E tests"
echo "  sampler-editor on port $E2E_PORT_EDITOR"
echo "  dev harness on port $E2E_PORT_HARNESS"
exec npx playwright test --config playwright.loop-editor.config.ts "$@"
