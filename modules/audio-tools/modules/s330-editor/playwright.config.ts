import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Run tests sequentially for hardware tests
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for hardware tests
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3330',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Grant MIDI permissions for SysEx testing
    permissions: ['midi', 'midi-sysex'],
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3330',
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
