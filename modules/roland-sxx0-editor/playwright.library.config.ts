/**
 * Playwright config for library OPFS e2e tests.
 *
 * These tests verify that OPFS helpers work correctly in browser context.
 * No MIDI permissions needed, but requires HTTPS for OPFS.
 *
 * Servers are started by scripts/run-library-e2e.sh on OS-assigned ports.
 *
 * This config includes a heartbeat reporter that works with an external
 * watchdog process to detect stuck tests.
 */

import { defineConfig, devices } from '@playwright/test';

const port = process.env.E2E_PORT;

if (!port) {
  throw new Error(
    'E2E_PORT must be set. Run via: ./scripts/run-library-e2e.sh'
  );
}

export default defineConfig({
  testDir: './test/e2e',
  testMatch: 'library-*.spec.ts',
  fullyParallel: false, // Sequential for OPFS isolation
  forbidOnly: !!process.env.CI,
  retries: 0, // No retries - tests should be deterministic
  workers: 1, // Single worker for OPFS isolation
  reporter: [
    ['line'],
    ['./test/e2e/reporters/heartbeat-reporter.ts'],
  ],
  timeout: 15_000, // 15s max per test - fail fast
  use: {
    baseURL: `https://localhost:${port}`,
    ignoreHTTPSErrors: true, // Vite uses self-signed certs
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
