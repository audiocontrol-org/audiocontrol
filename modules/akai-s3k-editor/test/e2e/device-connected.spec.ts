/**
 * Hardware e2e tests for connected Akai S3000XL device operations.
 *
 * These tests require an actual Akai S3000XL connected via MIDI.
 * They use HTTP MIDI transport via midi-server for fully automated execution.
 *
 * Tests interact with the app's UI, not raw MIDI APIs. Transport selection
 * is pre-configured via query parameters by the test runner.
 */

import { test, expect } from '@playwright/test';

// Deviation: Using relative import because e2e/ is outside src/ and @/ path alias
// only applies to src/. This pattern should not be copied to application code.
import {
  buildUrl,
  waitForAppReady,
  connectToDevice,
  getMidiStatus,
  hasConnectionUI,
} from '@audiocontrol/e2e-infra/helpers/connection-helper';

test.setTimeout(15_000);

const MIDI_SERVER_PORT = process.env.E2E_MIDI_SERVER_PORT;
const EDITOR_BASE_PATH = '/akai/s3000xl/editor';

function url(subpath: string = ''): string {
  return buildUrl(EDITOR_BASE_PATH, subpath, MIDI_SERVER_PORT);
}

test.describe('S3000XL Device Connection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(url());
    await waitForAppReady(page);
  });

  test('app initializes with disconnected state', async ({ page }) => {
    const status = await getMidiStatus(page);
    expect(status).toBe('disconnected');
  });

  test('connection UI is available', async ({ page }) => {
    const hasUI = await hasConnectionUI(page);
    expect(hasUI).toBe(true);
  });

  test('can connect to S3000XL', async ({ page }) => {
    await connectToDevice(page);
    const status = await getMidiStatus(page);
    expect(status).toBe('connected');
  });

  test('connection persists across navigation', async ({ page }) => {
    await connectToDevice(page);

    // Navigate to Programs
    await page.click('a[href*="programs"]');
    await page.waitForURL('**/programs**');

    const status = await getMidiStatus(page);
    expect(status).toBe('connected');
  });
});
