/**
 * Playwright config for S3K device+library e2e tests.
 *
 * These tests require BOTH the S3000XL via SCSI bridge AND OPFS library
 * access. They verify round-trip workflows: library -> device -> library.
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
    'E2E_VITE_PORT must be set. Run via: make test-e2e-s3k-device-library'
  );
}

if (!scsiBridgeUrl) {
  throw new Error(
    'E2E_SCSI_BRIDGE_URL must be set. Run via: make test-e2e-s3k-device-library'
  );
}

export default defineConfig({
  testDir: './test/e2e',
  testMatch: 'device-library-*.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['line'],
    ['../e2e-infra/reporters/heartbeat-reporter.ts'],
  ],
  timeout: 60_000, // 60s — device transfers (SDS) over SCSI are slow
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
          // requests (HTTPS page -> HTTP bridge) to avoid silent fetch failures.
          args: ['--allow-running-insecure-content'],
        },
      },
    },
  ],
});
