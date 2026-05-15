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
 *
 * 30s timeout — full-page screenshot specs exceed the 15s default used
 * by the contract/in-context suites (test-harness + wiring).
 */

import { defineHarnessConfig } from './playwright.harness.shared';

export default defineHarnessConfig({
  testDir: './test/rendering',
  timeoutMs: 30_000,
  configName: 'playwright.rendering.config.ts',
});
