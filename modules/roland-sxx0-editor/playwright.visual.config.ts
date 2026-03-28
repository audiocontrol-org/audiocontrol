import { defineConfig, devices } from '@playwright/test';

const port = Number.parseInt(process.env.VISUAL_PORT ?? '4330', 10);
const baseURL = process.env.VISUAL_BASE_URL ?? `http://localhost:${port}`;
const appURL = `${baseURL}/roland/s330/editor/`;

export default defineConfig({
  testDir: './visual',
  testMatch: '**/*.playwright.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'off',
    screenshot: 'off',
    permissions: ['midi', 'midi-sysex'],
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.VISUAL_BASE_URL
    ? undefined
    : {
        // Keep server URL deterministic for Playwright health checks.
        // If the port is busy, fail fast instead of auto-switching ports.
        command: `VISUAL_HTTP=1 pnpm dev --host --port ${port} --strictPort`,
        url: appURL,
        reuseExistingServer: true,
        timeout: 120 * 1000,
      },
});
