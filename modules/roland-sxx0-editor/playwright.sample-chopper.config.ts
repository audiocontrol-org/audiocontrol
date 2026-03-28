/**
 * Playwright config for sample chopper integration tests.
 *
 * Runs production-path tests against both surfaces:
 * 1. sampler-editor — Library page → browse → Open in Chopper → dialog
 * 2. dev-harness — Library panel → click sample → Open in Chopper → dialog
 *
 * Servers are started by scripts/run-sample-chopper-e2e.sh on OS-assigned ports.
 */

import { defineConfig, devices } from '@playwright/test';

const editorPort = process.env.E2E_PORT_EDITOR;
const harnessPort = process.env.E2E_PORT_HARNESS;

if (!editorPort || !harnessPort) {
  throw new Error(
    'E2E_PORT_EDITOR and E2E_PORT_HARNESS must be set. ' +
    'Run via: ./scripts/run-sample-chopper-e2e.sh'
  );
}

export default defineConfig({
  testDir: './e2e',
  testMatch: 'sample-chopper-production.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'line',
  timeout: 60_000,
  projects: [
    {
      name: 'sampler-editor',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        baseURL: `http://localhost:${editorPort}`,
      },
    },
    {
      name: 'dev-harness',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        baseURL: `http://localhost:${harnessPort}`,
      },
    },
  ],
});
