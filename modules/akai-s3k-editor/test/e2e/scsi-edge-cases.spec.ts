/**
 * SCSI-specific edge case e2e tests for the S3000XL bridge.
 *
 * These tests cover scenarios unique to the SCSI transport path that
 * don't apply to MIDI cable connections: error recovery, large transfers,
 * and invalid configuration handling.
 *
 * Requires:
 *   - Raspberry Pi running s2p and scsi-midi-bridge
 *   - Akai S3000XL connected via SCSI
 */

import { test, expect } from '@playwright/test';

// Deviation: Using relative import because e2e/ is outside src/ and @/ path alias
// only applies to src/. This pattern should not be copied to application code.
import {
  buildScsiUrl,
  waitForAppReady,
  connectToDevice,
  getMidiStatus,
} from '@audiocontrol/e2e-infra/helpers/connection-helper';

test.setTimeout(30_000);

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL;
const EDITOR_BASE_PATH = '/akai/s3000xl/editor';

function url(subpath: string = ''): string {
  return buildScsiUrl(EDITOR_BASE_PATH, subpath, BRIDGE_URL);
}

test.describe('SCSI Bridge Edge Cases', () => {
  test('invalid bridge URL shows graceful error', async ({ page }) => {
    // Navigate with a bridge URL that doesn't exist
    const badUrl = buildScsiUrl(EDITOR_BASE_PATH, '', 'http://localhost:1');
    await page.goto(badUrl);

    // The app should show an error state, not crash
    // Wait briefly for the connection attempt to fail
    await page.waitForTimeout(3000);

    // Verify the page is still functional (not a blank crash)
    await expect(page.locator('body')).toBeVisible();

    // The MIDI status should indicate an error or disconnected state
    const status = await getMidiStatus(page).catch(() => 'error');
    expect(['disconnected', 'error']).toContain(status);
  });

  test('can connect after initial page load', async ({ page }) => {
    // Load the editor with SCSI transport configured
    await page.goto(url());
    await waitForAppReady(page);

    // Connect and verify
    await connectToDevice(page);
    const status = await getMidiStatus(page);
    expect(status).toBe('connected');

    // Verify we can navigate and still operate
    await page.click('a[href*="programs"]');
    await page.waitForURL('**/programs**');

    // Program list should load (confirms SCSI operations work post-connect)
    await expect(page.locator('[data-testid="program-item-0"]')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('large program list loads completely via SCSI', async ({ page }) => {
    // This test verifies that the SCSI bridge handles multiple sequential
    // SysEx round-trips correctly (Load All fetches all program headers).
    await page.goto(url());
    await waitForAppReady(page);
    await connectToDevice(page);

    // Navigate to programs
    await page.click('a[href*="programs"]');
    await page.waitForURL('**/programs**');

    // Wait for initial program list
    await expect(page.locator('[data-testid="program-item-0"]')).toBeVisible({
      timeout: 15_000,
    });

    // Click "Load All" to fetch all program headers in rapid succession
    const loadAllButton = page.locator('button', { hasText: /load all/i });
    if (await loadAllButton.isVisible()) {
      await loadAllButton.click();

      // Wait for all programs to be fetched (the button should indicate completion)
      await expect(async () => {
        const isDisabled = await loadAllButton.isDisabled();
        const text = await loadAllButton.textContent();
        // Button either disables or changes text when complete
        expect(isDisabled || text?.toLowerCase().includes('loaded')).toBeTruthy();
      }).toPass({ timeout: 30_000 });
    }
  });
});
