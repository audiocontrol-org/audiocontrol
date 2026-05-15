/**
 * Playwright config for Tier 1 wiring tests.
 *
 * Wiring tests verify the device-write seam: given a programmatic value
 * change on an editor control, the expected SysEx / parameter-write
 * traffic reaches the simulated MIDI adapter. They run against the
 * simulated harness ('?midi=simulated&scenario=<name>') -- no device,
 * no MIDI hardware, no SCSI.
 *
 * Patterns like locator.fill() / input.value = X / dispatchEvent('change')
 * are appropriate here because Tier 1 isolates the write path, not the
 * user-facing interaction model. See test/wiring/README.md for the full
 * tier contract and the reform spec (workplan 9R-A) for context.
 */

import { defineConfig, devices } from '@playwright/test';

const port = process.env.E2E_PORT;

if (!port) {
  throw new Error(
    'E2E_PORT must be set. Run via: ./scripts/run-test-harness-e2e.sh playwright.wiring.config.ts'
  );
}

export default defineConfig({
  testDir: './test/wiring',
  testMatch: '*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['line']],
  timeout: 15_000,
  use: {
    baseURL: `https://localhost:${port}`,
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
});
