/**
 * Playwright config for test harness UI tests.
 *
 * These tests verify UI component interactions using hardcoded data
 * — no device or MIDI required.
 *
 * No heartbeat/watchdog needed — these are fast UI tests against static data.
 */

import { defineHarnessConfig } from './playwright.harness.shared';

export default defineHarnessConfig({
  testDir: './test/ui',
  timeoutMs: 15_000,
  configName: 'playwright.test-harness.config.ts',
});
