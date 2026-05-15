/**
 * Playwright config for rendering smoke tests.
 *
 * Rendering smokes capture visual paint state for inspection. They are
 * NOT a closure gate: they do not assert interaction correctness and
 * contribute zero coverage credit toward the four-tier discipline
 * (workplan 9R-A). The specs under test/rendering/ produce PNGs that
 * land under docs/.../phase-N-task-M-screenshots/ for design review;
 * a green run only proves the page paints, not that it works.
 *
 * Kept as a separate Playwright project so make test-rendering-roland
 * can drive only this directory without pulling in Tier 1 wiring or
 * Tier 2/3 UI suites.
 */

import { defineConfig, devices } from '@playwright/test';

const port = process.env.E2E_PORT;

if (!port) {
  throw new Error(
    'E2E_PORT must be set. Run via: ./scripts/run-test-harness-e2e.sh playwright.rendering.config.ts'
  );
}

export default defineConfig({
  testDir: './test/rendering',
  testMatch: '*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['line']],
  timeout: 30_000,
  use: {
    baseURL: `https://localhost:${port}`,
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
});
