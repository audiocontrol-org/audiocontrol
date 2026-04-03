/**
 * Playwright config for SCSI MIDI bridge e2e tests.
 *
 * These tests verify end-to-end communication with the S3000XL over SCSI
 * via the Pi-hosted scsi-midi-bridge and s2p daemons.
 *
 * Servers are started by the shared run-scsi-midi-e2e.sh:
 *   - s2p and scsi-midi-bridge on the Pi (deployed via SCP)
 *   - Vite dev server locally on an OS-assigned port
 *
 * Environment variables (set by runner):
 *   E2E_VITE_PORT - Vite dev server port
 *   E2E_SCSI_BRIDGE_URL - Full URL of the SCSI bridge (e.g., http://s3k.local:7033)
 */

import { defineConfig, devices } from '@playwright/test';

const vitePort = process.env.E2E_VITE_PORT;
const scsiBridgeUrl = process.env.E2E_SCSI_BRIDGE_URL;

if (!vitePort) {
  throw new Error(
    'E2E_VITE_PORT must be set. Run via: ./scripts/run-scsi-midi-e2e.sh'
  );
}

if (!scsiBridgeUrl) {
  throw new Error(
    'E2E_SCSI_BRIDGE_URL must be set. Run via: ./scripts/run-scsi-midi-e2e.sh'
  );
}

export default defineConfig({
  testDir: './e2e',
  testMatch: 'scsi-*.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['line'],
    ['../e2e-infra/reporters/heartbeat-reporter.ts'],
  ],
  timeout: 30_000, // 30s — SCSI operations over network are slower
  use: {
    baseURL: `https://localhost:${vitePort}`,
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        launchOptions: {
          // The SCSI bridge runs on plain HTTP on the Pi. Allow mixed-content
          // requests (HTTPS page → HTTP bridge) to avoid silent fetch failures.
          args: ['--allow-running-insecure-content'],
        },
      },
    },
  ],
});
