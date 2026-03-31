/**
 * Playwright config for device-library e2e tests.
 *
 * These tests require both:
 * - HTTP MIDI transport (for device communication)
 * - OPFS access (for library storage)
 *
 * Tests verify importing tones/patches from OPFS library to connected device.
 *
 * Environment variables (set by runner):
 *   E2E_VITE_PORT - Vite dev server port
 *   E2E_MIDI_SERVER_PORT - midi-server HTTP port
 *   E2E_MIDI_INPUT_PORT - Discovered MIDI input port name
 *   E2E_MIDI_OUTPUT_PORT - Discovered MIDI output port name
 *   E2E_DEVICE_ID - Roland device ID (usually 0)
 *
 * Run via: ./scripts/run-device-library-e2e.sh
 */

import { defineConfig, devices } from '@playwright/test';

const vitePort = process.env.E2E_VITE_PORT;
const midiServerPort = process.env.E2E_MIDI_SERVER_PORT;

if (!vitePort) {
  throw new Error(
    'E2E_VITE_PORT must be set. Run via: ./scripts/run-device-library-e2e.sh'
  );
}

if (!midiServerPort) {
  throw new Error(
    'E2E_MIDI_SERVER_PORT must be set. Run via: ./scripts/run-device-library-e2e.sh'
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
  timeout: 15_000, // 15s max per test - fail fast
  use: {
    baseURL: `https://localhost:${vitePort}`,
    ignoreHTTPSErrors: true, // Vite uses self-signed certs
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
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
