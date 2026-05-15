/**
 * Shared Playwright config factory for the three harness-driven suites
 * (test-harness, wiring, rendering).
 *
 * Each suite differs only in `testDir`, `timeout`, and the diagnostic
 * filename surfaced in the E2E_PORT error message. Every other knob is
 * identical (workers=1, line reporter, chromium 1280x720, baseURL bound
 * to `https://localhost:${E2E_PORT}`). Extracting the common shape here
 * keeps the per-suite configs to the three values that actually differ.
 *
 * Consumers call `defineHarnessConfig({...})` and re-export the result.
 * See `playwright.wiring.config.ts` for the canonical 3-line consumer.
 */

import { defineConfig, devices } from '@playwright/test';

export interface HarnessConfigOptions {
  readonly testDir: string;
  readonly timeoutMs: number;
  readonly configName: string;
}

export function defineHarnessConfig(opts: HarnessConfigOptions): ReturnType<typeof defineConfig> {
  const port = process.env.E2E_PORT;
  if (!port) {
    throw new Error(
      `E2E_PORT must be set. Run via: ./scripts/run-test-harness-e2e.sh ${opts.configName}`,
    );
  }
  return defineConfig({
    testDir: opts.testDir,
    testMatch: '*.spec.ts',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: 0,
    workers: 1,
    reporter: [['line']],
    timeout: opts.timeoutMs,
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
}
