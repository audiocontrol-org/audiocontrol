/**
 * Playwright config for loop editor integration tests.
 *
 * Uses a dynamic port to avoid collisions with running dev servers.
 * Set E2E_PORT env var before running, or default to 0 (OS-assigned).
 */

import { defineConfig, devices } from '@playwright/test';

const port = parseInt(process.env.E2E_PORT ?? '0', 10);

export default defineConfig({
  testDir: './e2e',
  testMatch: 'loop-editor-synth.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'line',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `VISUAL_HTTP=1 npx vite --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
