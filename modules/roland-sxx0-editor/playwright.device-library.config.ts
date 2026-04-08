/**
 * Playwright config for device+library e2e tests.
 *
 * These tests require both a connected Roland S-330/S-550 via midi-server
 * AND OPFS library access. They verify round-trip flows: export from device
 * to library, import from library to device, etc.
 *
 * Servers are started by scripts/run-device-library-e2e.sh on OS-assigned ports.
 *
 * Environment variables (set by runner):
 *   E2E_VITE_PORT - Vite dev server port
 *   E2E_MIDI_SERVER_PORT - midi-server HTTP port
 *   E2E_MIDI_INPUT_PORT - Discovered MIDI input port name
 *   E2E_MIDI_OUTPUT_PORT - Discovered MIDI output port name
 *   E2E_DEVICE_ID - Roland device ID (usually 0)
 *   E2E_DEVICE_TYPE - Device type (s330 or s550)
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
  testMatch: 'device-library-*.spec.ts',
  fullyParallel: false, // Sequential for hardware + OPFS isolation
  forbidOnly: !!process.env.CI,
  retries: 0, // No retries - hardware tests must be deterministic
  workers: 1, // Single worker for hardware + OPFS isolation
  reporter: [
    ['line'],
    ['./e2e/reporters/heartbeat-reporter.ts'],
  ],
  timeout: 60_000, // 60s max per test - device transfers are slow
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
