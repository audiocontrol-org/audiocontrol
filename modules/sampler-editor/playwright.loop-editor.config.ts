/**
 * Playwright config for loop editor integration tests.
 *
 * Runs the same test suite against two surfaces:
 * 1. sampler-editor test page (/roland/s330/editor/test/loop-editor)
 * 2. loop-editor dev harness (standalone)
 *
 * Each surface gets its own dynamic port via E2E_PORT_EDITOR and E2E_PORT_HARNESS.
 * Both use useLoopEditor + keyboard note input — the tests verify they behave identically.
 */

import { defineConfig, devices } from '@playwright/test';

const editorPort = parseInt(process.env.E2E_PORT_EDITOR ?? '0', 10);
const harnessPort = parseInt(process.env.E2E_PORT_HARNESS ?? '0', 10);

export default defineConfig({
  testDir: './e2e',
  testMatch: 'loop-editor-synth.spec.ts',
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
  webServer: [
    {
      command: `VISUAL_HTTP=1 npx vite --port ${editorPort}`,
      url: `http://localhost:${editorPort}`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `npx vite --config ../loop-editor/dev/vite.config.ts --port ${harnessPort}`,
      url: `http://localhost:${harnessPort}`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
