/**
 * SCSI Disk Browser E2E Tests
 *
 * Tests the disk browser panel on the library page against real Akai disk
 * images served by s2p. Navigates with ?midi=scsi&scsiBridgeUrl=... to
 * set the SCSI transport mode without UI interaction.
 */

import { test, expect } from '@playwright/test';

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL || 'http://s3k.local:7033';
const VITE_PORT = process.env.E2E_VITE_PORT;

function editorUrl(path: string): string {
  const base = `https://localhost:${VITE_PORT}`;
  const params = `?midi=scsi&scsiBridgeUrl=${encodeURIComponent(BRIDGE_URL)}`;
  return `${base}/akai/s3000xl/editor${path}${params}`;
}

test.describe('SCSI Disk Browser', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(editorUrl('/library'));
    // Wait for the disk browser panel to appear
    await page.waitForSelector('text=SCSI Disks', { timeout: 10_000 });
  });

  test('shows SCSI Disks heading', async ({ page }) => {
    await expect(page.locator('text=SCSI Disks')).toBeVisible();
  });

  test('scan finds at least one disk target', async ({ page }) => {
    // Click refresh to trigger scan
    const refreshButton = page.locator('button:has-text("Refresh"), button:has-text("↻")');
    if (await refreshButton.isVisible()) {
      await refreshButton.click();
    }

    // Wait for a target to appear (ID 0 should have a disk image)
    await expect(page.locator('text=ID 0')).toBeVisible({ timeout: 15_000 });
  });

  test('expanding a target shows volumes', async ({ page }) => {
    // Wait for targets to load
    await expect(page.locator('text=ID 0')).toBeVisible({ timeout: 15_000 });

    // Click to expand target 0
    await page.locator('text=ID 0').click();

    // Should show at least one volume
    await expect(page.locator('[class*="volume"], text=/^[A-Z0-9 ]+$/')).toBeVisible({ timeout: 15_000 });
  });

  test('volume contains files', async ({ page }) => {
    await expect(page.locator('text=ID 0')).toBeVisible({ timeout: 15_000 });
    await page.locator('text=ID 0').click();

    // Wait for volume contents to load — look for Sample or Program labels
    await expect(
      page.locator('text=Sample').or(page.locator('text=Program'))
    ).toBeVisible({ timeout: 15_000 });
  });
});
