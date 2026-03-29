/**
 * Playwright config for hardware e2e tests using HTTP MIDI transport.
 *
 * These tests use the external midi-server to handle MIDI communication,
 * bypassing the Web MIDI API which crashes in Playwright with SysEx permissions.
 *
 * This approach works around Playwright bug #29686 where auto-granted MIDI SysEx
 * permissions cause Chrome to crash.
 *
 * Servers are started by scripts/run-http-midi-e2e.sh on OS-assigned ports.
 *
 * This config includes a heartbeat reporter that works with an external
 * watchdog process to detect stuck tests. The watchdog kills the runner
 * if no heartbeat is received for 5 seconds.
 */

import { defineConfig, devices } from '@playwright/test';

const vitePort = process.env.E2E_VITE_PORT;
const midiServerPort = process.env.E2E_MIDI_SERVER_PORT;

if (!vitePort) {
  throw new Error(
    'E2E_VITE_PORT must be set. Run via: ./scripts/run-http-midi-e2e.sh'
  );
}

if (!midiServerPort) {
  throw new Error(
    'E2E_MIDI_SERVER_PORT must be set. Run via: ./scripts/run-http-midi-e2e.sh'
  );
}

export default defineConfig({
  testDir: './e2e',
  testMatch: 'hardware-*.spec.ts',
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
    baseURL: `https://localhost:${vitePort}`,
    ignoreHTTPSErrors: true, // Vite uses self-signed certs
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // NOTE: No MIDI permissions needed - HTTP transport doesn't use Web MIDI API
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
