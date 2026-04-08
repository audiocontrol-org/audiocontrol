/**
 * S3K Device+Library round-trip e2e tests.
 *
 * These tests require:
 *   - Raspberry Pi running s2p and scsi-midi-bridge (deployed by runner)
 *   - Akai S3000XL connected to the Pi via SCSI
 *   - OPFS library access in the browser
 *
 * Run via: make test-e2e-s3k-device-library
 */

import { test, expect } from '@playwright/test';

// Deviation: Using relative import because e2e/ is outside src/ and @/ path alias
// only applies to src/. This pattern should not be copied to application code.
import {
  buildScsiUrl,
  waitForAppReady,
  connectToDevice,
  getMidiStatus,
  navigateToLibrary,
  connectToOPFS,
} from '../../e2e-infra/helpers/connection-helper';

import {
  cleanupOPFS,
  initializeCommonAreaOPFS,
  writeSampleFixture,
  verifyDirectoryInOPFS,
} from '../../e2e-infra/helpers/library-ui-helpers';

test.setTimeout(60_000);

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL;
const EDITOR_BASE_PATH = '/akai/s3000xl/editor';

function url(subpath: string = ''): string {
  return buildScsiUrl(EDITOR_BASE_PATH, subpath, BRIDGE_URL);
}

test.describe('S3K Device+Library Round Trip', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to editor with SCSI bridge params
    await page.goto(url());
    await waitForAppReady(page);

    // Connect to device via SCSI bridge
    await connectToDevice(page);

    // Navigate to library
    await navigateToLibrary(page);

    // Clean OPFS and set up directory structure
    await cleanupOPFS(page);
    await initializeCommonAreaOPFS(page);

    // Connect to OPFS backend
    await connectToOPFS(page);
  });

  test('device memory panel shows connected state', async ({ page }) => {
    const devicePanel = page.locator('.ac-plugin-library-browser-device');
    await expect(devicePanel).toBeVisible({ timeout: 15_000 });
  });

  test('sample round trip: send to device via SDS, receive back, compare', async ({ page }) => {
    // 1. Write a WAV sample fixture to OPFS
    // 2. Click "Send to Device" on the sample
    // 3. Wait for SDS transfer to complete
    // 4. Select the sample on the device panel
    // 5. Click "Save to Library"
    // 6. Wait for SDS receive to complete
    // 7. Verify the received sample exists in OPFS
    // This is a placeholder -- the full implementation needs the transfer dialog flow
    test.skip();
  });
});
