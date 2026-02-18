import { defineConfig, devices } from '@playwright/test';

const port = Number.parseInt(process.env.VISUAL_PORT ?? '3330', 10);
const baseURL = process.env.VISUAL_BASE_URL ?? `https://localhost:${port}`;
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
    ignoreHTTPSErrors: true,
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
        command: `pnpm dev --host --port ${port}`,
        url: appURL,
        reuseExistingServer: true,
        timeout: 120 * 1000,
      },
});
