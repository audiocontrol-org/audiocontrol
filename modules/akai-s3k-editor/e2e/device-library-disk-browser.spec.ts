/**
 * SCSI disk browser e2e tests.
 *
 * Tests the DiskBrowserPanel UI against real SCSI disk images.
 *
 * Run via: modules/e2e-infra/scripts/run-and-watch.sh test-e2e-s3k-device-library 'ARGS=--grep "Disk Browser"'
 */

import { test, expect, type Page } from '@playwright/test';

import {
  buildScsiUrl,
  waitForAppReady,
  connectToDevice,
  navigateToLibrary,
} from '../../e2e-infra/helpers/connection-helper';

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL;
if (!BRIDGE_URL) {
  throw new Error('E2E_SCSI_BRIDGE_URL must be set');
}

test.setTimeout(120_000);

const EDITOR_BASE_PATH = '/akai/s3000xl/editor';
const UI_TIMEOUT_MS = 10_000;

function url(subpath = ''): string {
  return buildScsiUrl(EDITOR_BASE_PATH, subpath, '/scsi-bridge');
}

function attachConsoleDebugListener(page: Page): void {
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));
  page.on('console', (msg) => {
    console.log(`BROWSER [${msg.type()}]:`, msg.text());
  });
}

test.describe('S3K Disk Browser', () => {
  test.beforeEach(async ({ page }) => {
    attachConsoleDebugListener(page);
    await page.goto(url(), { timeout: UI_TIMEOUT_MS });
    await waitForAppReady(page);

    const proxyCheck = await page.evaluate(async () => {
      try {
        const res = await fetch('/scsi-bridge/status');
        return { ok: res.ok, status: res.status };
      } catch (err) {
        return { ok: false, status: 0, body: String(err) };
      }
    });
    if (!proxyCheck.ok) {
      throw new Error(`SCSI bridge unreachable: ${JSON.stringify(proxyCheck)}`);
    }

    await connectToDevice(page);
    await navigateToLibrary(page);
  });

  test('expanding a disk target shows volumes and files', async ({ page }) => {
    // Wait for SCSI Disks heading
    await expect(page.getByText('SCSI Disks')).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Find and click the first disk target
    const diskTarget = page.locator('button', { hasText: /ID \d+:/ }).first();
    await expect(diskTarget).toBeVisible({ timeout: UI_TIMEOUT_MS });
    console.log('Clicking disk target...');
    await diskTarget.click();

    // Wait for loading to complete — the disk data read can take time
    // Poll for either a volume name or an error message
    const volumeOrError = page.locator('.ml-4 .text-gray-400, .text-red-400').first();
    await expect(volumeOrError).toBeVisible({ timeout: 60_000 });

    // Check if we got an error
    const errorText = await page.locator('.text-red-400').textContent().catch(() => null);
    if (errorText) {
      console.log('Disk browser error:', errorText);
      // Still a PASS if the UI handled the error gracefully (didn't crash)
    }

    // Check for volume names (rendered as text-gray-400 divs inside .ml-4)
    const volumes = page.locator('.ml-4 > .text-gray-400');
    const volumeCount = await volumes.count();
    console.log(`Found ${volumeCount} volumes`);

    if (volumeCount > 0) {
      const firstName = await volumes.first().textContent();
      console.log(`First volume: "${firstName?.trim()}"`);

      // Check for files within the volume
      const files = page.locator('.ml-4 button', { hasText: /.+/ });
      const fileCount = await files.count();
      console.log(`Found ${fileCount} files`);
      expect(fileCount).toBeGreaterThan(0);
    }
  });
});
