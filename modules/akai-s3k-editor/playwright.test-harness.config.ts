/**
 * Playwright config for the keygroup zone test harness UI tests.
 *
 * These tests verify ZoneOverview, KeyRangeEditor, and VelocityRangeBar
 * interactions using hardcoded keygroups -- no device or MIDI required.
 *
 * No heartbeat/watchdog needed -- these are fast UI tests against static data.
 */

import { defineConfig, devices } from '@playwright/test';

const port = process.env.E2E_PORT;

if (!port) {
  throw new Error(
    'E2E_PORT must be set. Run via: ./scripts/run-test-harness-e2e.sh'
  );
}

export default defineConfig({
  testDir: './test/ui',
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
