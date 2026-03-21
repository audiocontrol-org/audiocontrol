/**
 * Playwright config for loop editor integration tests.
 *
 * Runs the same test suite against two surfaces:
 * 1. sampler-editor test page (/roland/s330/editor/test/loop-editor)
 * 2. loop-editor dev harness (standalone)
 *
 * Servers are started by scripts/run-loop-editor-e2e.sh which binds
 * to OS-assigned ports and passes them via E2E_PORT_EDITOR / E2E_PORT_HARNESS.
 */

import { defineConfig, devices } from '@playwright/test';

const editorPort = process.env.E2E_PORT_EDITOR;
const harnessPort = process.env.E2E_PORT_HARNESS;

if (!editorPort || !harnessPort) {
  throw new Error(
    'E2E_PORT_EDITOR and E2E_PORT_HARNESS must be set. ' +
    'Run via: ./scripts/run-loop-editor-e2e.sh'
  );
}

export default defineConfig({
  testDir: './e2e',
  testMatch: ['loop-editor-synth.spec.ts', 'loop-editor-autodetect.spec.ts', 'loop-editor-smoothing.spec.ts'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'line',
  projects: [
    {
      name: 'sampler-editor',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://localhost:${editorPort}`,
      },
    },
    {
      name: 'dev-harness',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://localhost:${harnessPort}`,
      },
    },
  ],
  // No webServer — servers are managed by run-loop-editor-e2e.sh
});
