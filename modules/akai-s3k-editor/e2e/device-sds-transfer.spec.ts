/**
 * Hardware e2e tests for SDS sample transfer on Akai S3000XL.
 *
 * These tests require an actual Akai S3000XL connected via MIDI loop
 * with at least one sample loaded. They exercise the Samples page UI
 * for sending and receiving samples via the MIDI Sample Dump Standard.
 *
 * Run via: make test-e2e-s3k-device ARGS="--grep 'SDS'"
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import os from 'os';
import fs from 'fs';

// Deviation: Using relative import because e2e/ is outside src/ and @/ path alias
// only applies to src/. This pattern should not be copied to application code.
import {
  buildUrl,
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

const MIDI_SERVER_PORT = process.env.E2E_MIDI_SERVER_PORT;
const EDITOR_BASE_PATH = '/akai/s3000xl/editor';

// Transfer timeouts — MIDI SDS is slow
const RECEIVE_TIMEOUT_MS = 60_000;
const SEND_TIMEOUT_MS = 60_000;
const ROUND_TRIP_TIMEOUT_MS = 120_000;

// Test fixture: 256 samples, 44100Hz triangle wave
const TEST_NUM_SAMPLES = 256;
const TEST_SAMPLE_RATE = 44100;

function url(subpath = ''): string {
  return buildUrl(EDITOR_BASE_PATH, subpath, MIDI_SERVER_PORT);
}

test.describe('SDS Sample Transfer', () => {
  test.beforeAll(() => {
    if (!MIDI_SERVER_PORT) {
      throw new Error('E2E_MIDI_SERVER_PORT must be set. Run via: make test-e2e-s3k-device');
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

  test('buttons are disabled with no selection, enabled after selection', async ({ page }) => {
    test.setTimeout(15_000);

    const receiveBtn = page.locator('[data-testid="sds-receive-button"]');
    const sendBtn = page.locator('[data-testid="sds-send-button"]');

    // Disabled with no selection
    await expect(receiveBtn).toBeDisabled();
    await expect(sendBtn).toBeDisabled();

    // Select first sample
    await selectSample(page, 0);

    // Now enabled
    await expect(receiveBtn).toBeEnabled();
    await expect(sendBtn).toBeEnabled();
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

  test.describe.serial('round-trip: send then receive', () => {
    // Use the last sample slot to avoid overwriting user data.
    // The dropdown options are "index: name", so we select the last one.
    let targetSlot: number;

    test('send test sample to device via SDS', async ({ page }) => {
      test.setTimeout(ROUND_TRIP_TIMEOUT_MS);

      // Determine the last sample slot
      const select = page.locator('[data-testid="sds-sample-select"]');
      const options = select.locator('option');
      const count = await options.count();
      // First option is placeholder, so last sample is count - 2
      targetSlot = count - 2;
      expect(targetSlot).toBeGreaterThanOrEqual(0);

      await selectSample(page, targetSlot);

      // Generate test WAV and write to temp file
      const wavBuffer = generateTestWavBuffer(TEST_NUM_SAMPLES, TEST_SAMPLE_RATE);
      const tmpFile = path.join(os.tmpdir(), `sds-test-${Date.now()}.wav`);
      fs.writeFileSync(tmpFile, wavBuffer);

      try {
        // Intercept file chooser and provide our test WAV
        const fileChooserPromise = page.waitForEvent('filechooser');
        await page.locator('[data-testid="sds-send-button"]').click();
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(tmpFile);

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

    test('receive same sample back and compare', async ({ page }) => {
      test.setTimeout(ROUND_TRIP_TIMEOUT_MS);

      // Navigate back to samples page (new page context in serial test)
      await navigateToSamples(page);
      await waitForSampleNamesLoaded(page);

      // Select the same slot we sent to
      await selectSample(page, targetSlot);

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
