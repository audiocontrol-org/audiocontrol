import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  testMatch: 'library-*.spec.ts',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 30_000,
  use: {
    ...devices['Desktop Chrome'],
    ignoreHTTPSErrors: true,
  },
});
