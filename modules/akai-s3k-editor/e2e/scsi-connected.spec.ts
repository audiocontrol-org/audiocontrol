/**
 * SCSI MIDI bridge e2e tests for S3000XL device operations.
 *
 * These tests require:
 *   - Raspberry Pi running s2p and scsi-midi-bridge (deployed by runner)
 *   - Akai S3000XL connected to the Pi via SCSI
 *
 * The SCSI transport is selected via query parameters set by the runner.
 * Tests interact with the app's UI, not raw SCSI/MIDI APIs.
 */

import { test, expect } from '@playwright/test';

// Deviation: Using relative import because e2e/ is outside src/ and @/ path alias
// only applies to src/. This pattern should not be copied to application code.
import {
  buildScsiUrl,
  waitForAppReady,
  connectToDevice,
  getMidiStatus,
} from '../../e2e-infra/helpers/connection-helper';

test.setTimeout(30_000);

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL;
const EDITOR_BASE_PATH = '/akai/s3000xl/editor';

function url(subpath: string = ''): string {
  return buildScsiUrl(EDITOR_BASE_PATH, subpath, BRIDGE_URL);
}

test.describe('S3000XL SCSI Bridge Connection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(url());
    await waitForAppReady(page);
  });

  test('can connect to S3000XL via SCSI bridge', async ({ page }) => {
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

  test('can retrieve sample list', async ({ page }) => {
    await connectToDevice(page);

    // Navigate to samples section
    await page.click('a[href*="samples"]');
    await page.waitForURL('**/samples**');

    // The S3000XL should have samples loaded — verify the list renders
    // TODO: Update selector when sample list UI is finalized
    await expect(page.locator('[data-testid="sample-list"] li, [data-testid="sample-row"]').first())
      .toBeVisible({ timeout: 30_000 });
  });
});
