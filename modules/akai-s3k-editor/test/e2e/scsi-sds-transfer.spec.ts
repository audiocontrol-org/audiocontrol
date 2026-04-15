/**
 * SCSI MIDI bridge e2e tests for SDS sample transfer on Akai S3000XL.
 *
 * These tests require:
 *   - Raspberry Pi running s2p and scsi-midi-bridge (deployed by runner)
 *   - Akai S3000XL connected to the Pi via SCSI
 *   - At least one sample loaded on the device
 *
 * They exercise the Samples page UI for sending and receiving samples
 * via the MIDI Sample Dump Standard, tunneled over the SCSI bridge.
 *
 * Run via: make test-e2e-s3k-scsi ARGS="--grep 'SDS'"
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import os from 'os';
import fs from 'fs';

// Deviation: Using relative import because e2e/ is outside src/ and @/ path alias
// only applies to src/. This pattern should not be copied to application code.
import {
  buildScsiUrl,
  waitForAppReady,
  connectToDevice,
} from '../../e2e-infra/helpers/connection-helper';

import {
  generateTestWavBuffer,
  navigateToSamples,
  waitForSampleNamesLoaded,
  selectSample,
  attachSdsConsoleListener,
} from './helpers/sds-helpers';

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL;
const EDITOR_BASE_PATH = '/akai/s3000xl/editor';

// Transfer timeouts — MIDI SDS is slow
const RECEIVE_TIMEOUT_MS = 60_000;
const SEND_TIMEOUT_MS = 60_000;
const ROUND_TRIP_TIMEOUT_MS = 120_000;

// Test fixture: 256 samples, 44100Hz triangle wave
const TEST_NUM_SAMPLES = 256;
const TEST_SAMPLE_RATE = 44100;

function url(subpath = ''): string {
  return buildScsiUrl(EDITOR_BASE_PATH, subpath, BRIDGE_URL);
}

test.describe('SDS Sample Transfer (SCSI)', () => {
  test.beforeAll(() => {
    if (!BRIDGE_URL) {
      throw new Error(
        'E2E_SCSI_BRIDGE_URL must be set. Run via: make test-e2e-s3k-scsi'
      );
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(url());
    await waitForAppReady(page);
    attachSdsConsoleListener(page);
    await connectToDevice(page);
    await navigateToSamples(page);
    await waitForSampleNamesLoaded(page);
  });

  // --- Suite 1: Navigation ---

  test('sample dropdown is populated from device', async ({ page }) => {
    test.setTimeout(30_000);
    const select = page.locator('[data-testid="sds-sample-select"]');
    const options = select.locator('option');
    const count = await options.count();
    expect(count).toBeGreaterThan(1);
  });

  test('receive button is disabled with no selection, enabled after selection', async ({ page }) => {
    test.setTimeout(15_000);

    const receiveBtn = page.locator('[data-testid="sds-receive-button"]');

    // Receive disabled with no selection
    await expect(receiveBtn).toBeDisabled();

    // Select first sample
    await selectSample(page, 0);

    // Now enabled
    await expect(receiveBtn).toBeEnabled();
  });

  // --- Suite 2: Receive ---

  test('receive from device completes with sample info', async ({ page }) => {
    test.setTimeout(RECEIVE_TIMEOUT_MS);

    await selectSample(page, 0);
    await page.locator('[data-testid="sds-receive-button"]').click();

    // Wait for received info to appear
    const receivedInfo = page.locator('[data-testid="sds-received-info"]');
    await expect(receivedInfo).toBeVisible({ timeout: RECEIVE_TIMEOUT_MS });

    // Verify metadata is populated
    const sampleCount = page.locator('[data-testid="sds-received-sample-count"]');
    const sampleRate = page.locator('[data-testid="sds-received-sample-rate"]');

    await expect(sampleCount).toBeVisible();
    await expect(sampleRate).toBeVisible();

    // Sample count should be a positive number
    const countText = await sampleCount.textContent();
    expect(Number(countText?.replace(/,/g, ''))).toBeGreaterThan(0);

    // Download button should be visible
    await expect(page.locator('[data-testid="sds-download-button"]')).toBeVisible();
  });

  // --- Suite 3: Round-Trip ---
  //
  // The S3000XL always creates a NEW sample slot when receiving SDS data.
  // It never overwrites. So the round-trip is:
  //   1. Count samples before send
  //   2. Send new sample via SDS ("Add as new")
  //   3. Sample list refreshes — new sample appears at the end
  //   4. Select the newly created last sample
  //   5. Receive it back and compare metadata

  test.describe.serial('round-trip: send then receive', () => {
    let sampleCountBefore: number;

    test('send test sample to device via SDS', async ({ page }) => {
      test.setTimeout(ROUND_TRIP_TIMEOUT_MS);

      // Count samples before send
      const select = page.locator('[data-testid="sds-sample-select"]');
      const optionsBefore = select.locator('option');
      const countBefore = await optionsBefore.count();
      // First option is placeholder
      sampleCountBefore = countBefore - 1;

      // Generate test WAV and write to temp file
      const wavBuffer = generateTestWavBuffer(TEST_NUM_SAMPLES, TEST_SAMPLE_RATE);
      const tmpFile = path.join(os.tmpdir(), `sds-scsi-test-${Date.now()}.wav`);
      fs.writeFileSync(tmpFile, wavBuffer);

      try {
        // Click Send -> file picker -> provide test WAV
        const fileChooserPromise = page.waitForEvent('filechooser');
        await page.locator('[data-testid="sds-send-button"]').click();
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(tmpFile);

        // Confirmation panel appears — "Add as new" is the default
        await expect(page.locator('[data-testid="sds-send-confirm-panel"]')).toBeVisible({
          timeout: 5_000,
        });

        // Click Send to confirm
        await page.locator('[data-testid="sds-send-confirm-button"]').click();

        // Wait for progress to start
        await expect(page.locator('[data-testid="sds-progress-percent"]')).toBeVisible({
          timeout: 10_000,
        });

        // Wait for progress to disappear (transfer complete)
        await expect(page.locator('[data-testid="sds-progress-percent"]')).not.toBeVisible({
          timeout: SEND_TIMEOUT_MS,
        });

        // No error should be displayed
        await expect(page.locator('[data-testid="sds-error"]')).not.toBeVisible();
        await expect(page.locator('[data-testid="sds-parse-error"]')).not.toBeVisible();
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });

    test('receive newly created sample back and compare', async ({ page }) => {
      test.setTimeout(ROUND_TRIP_TIMEOUT_MS);

      // beforeEach already connected and navigated to Samples, but the
      // sample list was fetched before the device committed the new sample.
      // Navigate away and back to force a fresh fetch from the device.
      await page.waitForTimeout(2000);
      await page.locator('a[href*="programs"]').click();
      await page.waitForURL('**/programs**');
      await navigateToSamples(page);
      await waitForSampleNamesLoaded(page);

      // Verify sample count increased by 1
      const select = page.locator('[data-testid="sds-sample-select"]');
      const options = select.locator('option');
      const count = await options.count();
      const currentSampleCount = count - 1; // subtract placeholder
      expect(currentSampleCount).toBe(sampleCountBefore + 1);

      // Select the last sample (the one we just sent)
      const newSampleIndex = currentSampleCount - 1;
      await selectSample(page, newSampleIndex);

      // Click receive
      await page.locator('[data-testid="sds-receive-button"]').click();

      // Wait for received info
      const receivedInfo = page.locator('[data-testid="sds-received-info"]');
      await expect(receivedInfo).toBeVisible({ timeout: RECEIVE_TIMEOUT_MS });

      // Compare sample count — should match what we sent
      const countText = await page
        .locator('[data-testid="sds-received-sample-count"]')
        .textContent();
      const receivedCount = Number(countText?.replace(/,/g, ''));
      expect(receivedCount).toBe(TEST_NUM_SAMPLES);

      // Compare sample rate — SDS encodes as period in ns, so there may be
      // rounding. Allow +/-1 Hz tolerance.
      const rateText = await page
        .locator('[data-testid="sds-received-sample-rate"]')
        .textContent();
      const receivedRate = Number(rateText?.replace(/,/g, ''));
      expect(Math.abs(receivedRate - TEST_SAMPLE_RATE)).toBeLessThanOrEqual(1);
    });
  });
});
