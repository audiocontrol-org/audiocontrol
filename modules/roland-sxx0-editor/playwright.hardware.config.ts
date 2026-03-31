/**
 * Playwright config for hardware e2e tests.
 *
 * These tests require actual Roland S-series hardware connected via MIDI.
 * Run device discovery first: pnpm test:device
 *
 * Servers are started by scripts/run-hardware-e2e.sh on OS-assigned ports.
 *
 * This config includes a heartbeat reporter that works with an external
 * watchdog process to detect stuck tests. The watchdog kills the runner
 * if no heartbeat is received for 5 seconds.
 */

import { defineConfig, devices } from '@playwright/test';

const port = process.env.E2E_PORT;

if (!port) {
  throw new Error(
    'E2E_PORT must be set. Run via: ./scripts/run-hardware-e2e.sh'
  );
}

export default defineConfig({
  testDir: './e2e',
  testMatch: 'device-*.spec.ts',
  fullyParallel: false, // Sequential for hardware tests
  forbidOnly: !!process.env.CI,
  retries: 0, // No retries for hardware tests
  workers: 1, // Single worker for hardware tests
  reporter: [
    ['line'],
    ['./e2e/reporters/heartbeat-reporter.ts'],
  ],
  timeout: 10_000, // 10s max per test - fail fast
  use: {
    baseURL: `https://localhost:${port}`,
    ignoreHTTPSErrors: true, // Vite uses self-signed certs
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Grant MIDI permissions for SysEx testing
    permissions: ['midi', 'midi-sysex'],
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],
});
