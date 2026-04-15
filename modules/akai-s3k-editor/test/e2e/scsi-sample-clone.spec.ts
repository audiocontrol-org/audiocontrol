/**
 * E2E test for the S3K sample clone feature.
 *
 * Cloning a sample on the S3000XL creates a new sample with " CPY" suffix.
 * The clone operation transfers sample data via SDS, which is slow over SCSI.
 *
 * Requires: Pi running s2p + scsi-midi-bridge with S3000XL connected.
 * Run via: make test-e2e-s3k-scsi ARGS="--grep clone"
 */

import { test, expect } from '@playwright/test';

import {
  buildScsiUrl,
  waitForAppReady,
  connectToDevice,
} from '@audiocontrol/e2e-infra/helpers/connection-helper';

// ---------------------------------------------------------------------------
// Side-channel device query (bypasses UI to verify actual device state)
// ---------------------------------------------------------------------------

import { createScsiMidiTransport } from '@audiocontrol/midi-core';
import { createS3000xlClient } from '@audiocontrol/sampler-devices/s3k';

test.setTimeout(120_000); // SDS transfers are slow

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL;
if (!BRIDGE_URL) {
  throw new Error(
    'E2E_SCSI_BRIDGE_URL must be set. SCSI bridge is the only viable transport ' +
    'for automated S3K tests. Run via: make test-e2e-s3k-scsi',
  );
}

const EDITOR_BASE_PATH = '/akai/s3000xl/editor';

function url(subpath: string = ''): string {
  return buildScsiUrl(EDITOR_BASE_PATH, subpath, BRIDGE_URL);
}

/**
 * Query device sample names directly via the S3K client over SCSI bridge.
 * Bypasses the browser UI to verify what's actually on the device.
 */
async function queryDeviceSamples(): Promise<string[]> {
  const scsi = createScsiMidiTransport({ bridgeUrl: BRIDGE_URL! });
  const client = createS3000xlClient(scsi.adapter, { noCache: true });
  try {
    return await client.fetchSampleNames();
  } finally {
    scsi.disconnect();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Page = import('@playwright/test').Page;

async function navigateToSamples(page: Page): Promise<void> {
  const samplesLink = page.locator('a[href*="samples"]');
  await samplesLink.click();
  await page.waitForURL('**/samples**');
}

async function waitForSampleList(page: Page, minCount: number): Promise<void> {
  // Wait for at least one sample item to appear
  await expect(
    page.locator(`[data-testid="sample-item-${minCount - 1}"]`),
  ).toBeVisible({ timeout: 15_000 });
}

/**
 * Wait for the SteppedProgressDrawer to finish and show the Done button.
 * Uses heartbeat assertions on the dialog to detect stuck operations early.
 */
async function waitForCloneComplete(page: Page): Promise<void> {
  const dialog = page.locator('[role="dialog"]');

  // The dialog should appear quickly after clicking clone
  await expect(dialog).toBeVisible({ timeout: 5_000 });

  // Poll for the Done button with heartbeat checks on the dialog.
  // SDS transfers can take 60+ seconds for large samples.
  const doneButton = dialog.locator('button', { hasText: 'Done' });

  // Heartbeat: every 5 seconds, assert the dialog is still visible
  // (detects cases where the dialog vanishes unexpectedly)
  const maxWaitMs = 90_000;
  const pollIntervalMs = 3_000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    // Heartbeat: dialog must still be open
    await expect(dialog).toBeVisible({ timeout: 2_000 });

    // Check if Done button is visible
    if (await doneButton.isVisible()) {
      return;
    }

    // Also check for error state (Close button instead of Done)
    const closeButton = dialog.locator('button', { hasText: 'Close' });
    if (await closeButton.isVisible()) {
      throw new Error('Clone operation failed — SteppedProgressDrawer shows error state');
    }

    await page.waitForTimeout(pollIntervalMs);
  }

  throw new Error(`Clone did not complete within ${maxWaitMs}ms`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Sample clone', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(url());
    await waitForAppReady(page);
    await connectToDevice(page);
    await navigateToSamples(page);
  });

  test('clone sample creates a copy with CPY suffix', async ({ page }) => {
    // Step 1: Query device samples via side channel to get baseline
    const samplesBefore = await queryDeviceSamples();
    const countBefore = samplesBefore.length;
    expect(countBefore, 'Device must have at least 1 sample to clone').toBeGreaterThanOrEqual(1);

    // Step 2: Wait for the UI sample list to load
    await waitForSampleList(page, countBefore);

    // Step 3: Hover over the first sample item to reveal action buttons
    const firstSample = page.locator('[data-testid="sample-item-0"]');
    await firstSample.hover();

    // Step 4: Click the clone button
    const cloneButton = page.locator('button[title="Clone sample"]').first();
    await expect(cloneButton).toBeVisible({ timeout: 3_000 });
    await cloneButton.click();

    // Step 5: Wait for the SteppedProgressDrawer to complete
    await waitForCloneComplete(page);

    // Step 6: Click Done to dismiss the drawer
    const dialog = page.locator('[role="dialog"]');
    const doneButton = dialog.locator('button', { hasText: 'Done' });
    await doneButton.click();

    // Step 7: Verify via side channel that device now has one more sample
    const samplesAfter = await queryDeviceSamples();
    expect(
      samplesAfter.length,
      `Expected sample count to increase from ${countBefore} to ${countBefore + 1}`,
    ).toBe(countBefore + 1);

    // Step 8: The new sample should contain "CPY" in its name
    const newSamples = samplesAfter.filter(
      (name) => !samplesBefore.includes(name),
    );
    expect(newSamples.length, 'Expected exactly one new sample').toBe(1);
    expect(
      newSamples[0]?.trim(),
      'Cloned sample name should contain CPY suffix',
    ).toContain('CPY');
  });

  test('cloned sample appears in the UI sample list', async ({ page }) => {
    // Query baseline from device
    const samplesBefore = await queryDeviceSamples();
    const countBefore = samplesBefore.length;
    expect(countBefore, 'Device must have at least 1 sample to clone').toBeGreaterThanOrEqual(1);

    // Wait for sample list in UI
    await waitForSampleList(page, countBefore);

    // Hover and clone the first sample
    const firstSample = page.locator('[data-testid="sample-item-0"]');
    await firstSample.hover();

    const cloneButton = page.locator('button[title="Clone sample"]').first();
    await expect(cloneButton).toBeVisible({ timeout: 3_000 });
    await cloneButton.click();

    // Wait for clone to complete and dismiss
    await waitForCloneComplete(page);
    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('button', { hasText: 'Done' }).click();

    // After dismissing, the UI should refresh the sample list.
    // Wait for the list to show the new count.
    await waitForSampleList(page, countBefore + 1);

    // Find a sample item containing "CPY" in its text
    const cpySample = page.locator('[data-testid="sample-name"]', { hasText: 'CPY' });
    await expect(
      cpySample.first(),
      'UI sample list should contain a sample with CPY in its name',
    ).toBeVisible({ timeout: 10_000 });
  });
});
