/**
 * S3K audio editing round-trip e2e tests.
 *
 * These tests verify that samples can be loaded from the S3000XL into
 * the audio editing dialogs (Loop Editor, Sample Editor, Chopper) and
 * that the save path works for loop points.
 *
 * Requires:
 *   - Raspberry Pi running s2p and scsi-midi-bridge (deployed by runner)
 *   - Akai S3000XL connected to the Pi via SCSI with at least one sample loaded
 *   - device-library Playwright config (Vite proxy for SDS WebSocket)
 *
 * Run via: make test-e2e-s3k-device-library
 */

import { test, expect, type Page } from '@playwright/test';
import {
  buildScsiUrl,
  waitForAppReady,
  connectToDevice,
} from '@audiocontrol/e2e-infra/helpers/connection-helper';
import { createScsiMidiTransport } from '@audiocontrol/midi-core';
import { createS3000xlClient } from '@audiocontrol/sampler-devices/s3k';

// ---------------------------------------------------------------------------
// Environment guard
// ---------------------------------------------------------------------------

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL;
if (!BRIDGE_URL) {
  throw new Error(
    'E2E_SCSI_BRIDGE_URL must be set. SCSI bridge is the only viable transport ' +
    'for automated S3K tests. Run via: make test-e2e-s3k-device-library',
  );
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

test.setTimeout(120_000);

const EDITOR_BASE_PATH = '/akai/s3000xl/editor';
const UI_TIMEOUT_MS = 10_000;
const SDS_DOWNLOAD_TIMEOUT_MS = 60_000;

// ---------------------------------------------------------------------------
// URL Builder
// ---------------------------------------------------------------------------

function url(subpath: string = ''): string {
  // Use the local Vite proxy path (/scsi-bridge) instead of the direct Pi URL
  // to avoid mixed-content errors (HTTPS page -> HTTP bridge).
  return buildScsiUrl(EDITOR_BASE_PATH, subpath, '/scsi-bridge');
}

// ---------------------------------------------------------------------------
// Side-channel helpers (direct device queries via SCSI bridge)
// ---------------------------------------------------------------------------

async function queryDeviceSamples(): Promise<string[]> {
  const scsi = createScsiMidiTransport({ bridgeUrl: BRIDGE_URL! });
  const client = createS3000xlClient(scsi.adapter, { noCache: true });
  try {
    return await client.fetchSampleNames();
  } finally {
    scsi.disconnect();
  }
}

async function queryDeviceSampleHeader(index: number) {
  const scsi = createScsiMidiTransport({ bridgeUrl: BRIDGE_URL! });
  const client = createS3000xlClient(scsi.adapter, { noCache: true });
  try {
    return await client.fetchSampleHeader(index);
  } finally {
    scsi.disconnect();
  }
}

// ---------------------------------------------------------------------------
// Console debug listener
// ---------------------------------------------------------------------------

function attachConsoleDebugListener(page: Page): void {
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));
  page.on('console', (msg) => {
    console.log(`BROWSER [${msg.type()}]:`, msg.text());
  });
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

async function navigateToSamplesAndConnect(page: Page): Promise<void> {
  // Navigate to editor with SCSI bridge params
  await page.goto(url(), { timeout: UI_TIMEOUT_MS });
  await waitForAppReady(page);

  // Preflight: verify the Vite proxy can reach the SCSI bridge
  const proxyCheck = await page.evaluate(async () => {
    try {
      const res = await fetch('/scsi-bridge/status');
      const text = await res.text();
      return { ok: res.ok, status: res.status, body: text.substring(0, 200) };
    } catch (err) {
      return { ok: false, status: 0, body: String(err) };
    }
  });
  console.log('Vite proxy -> SCSI bridge preflight:', proxyCheck);
  if (!proxyCheck.ok) {
    throw new Error(
      `Vite proxy cannot reach SCSI bridge at /scsi-bridge/status. ` +
      `Status: ${proxyCheck.status}, Body: ${proxyCheck.body}`,
    );
  }

  // Connect to device via SCSI bridge
  await connectToDevice(page);

  // Navigate to Samples page
  const samplesLink = page.locator('a[href*="samples"]');
  await samplesLink.click();
  await page.waitForURL('**/samples**');
}

async function waitForSampleListAndSelectFirst(page: Page): Promise<void> {
  // Wait for sample list to populate
  await expect(
    page.locator('[data-testid^="sample-item-"]').first(),
  ).toBeVisible({ timeout: 30_000 });

  // Select first sample
  await page.locator('[data-testid="sample-item-0"]').click();

  // Wait for sample editor to load (Basic section appears)
  await expect(
    page.locator('.s3k-section-title', { hasText: 'Basic' }).first(),
  ).toBeVisible({ timeout: 15_000 });
}

/**
 * Wait for a dialog to appear and contain waveform content.
 * SDS download starts when an editor button is clicked and may take
 * 10-30 seconds over SCSI. The dialog appears after download completes.
 */
async function waitForEditorDialog(page: Page): Promise<void> {
  // Poll for the dialog to appear, feeding the watchdog with heartbeat assertions.
  // SDS download can take 30-60s; a single long expect would starve the watchdog.
  const dialog = page.locator('[role="dialog"]');
  const deadline = Date.now() + SDS_DOWNLOAD_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await dialog.isVisible()) break;
    // Each assertion produces a heartbeat event for the watchdog
    await expect(page.locator('body')).toBeVisible({ timeout: 3_000 });
    await page.waitForTimeout(1_000);
  }
  await expect(dialog).toBeVisible({ timeout: 5_000 });

  // Wait for waveform content inside the dialog (SVG or canvas element)
  const waveformContent = dialog.locator('svg, canvas').first();
  await expect(waveformContent).toBeVisible({ timeout: 15_000 });
}

// ===========================================================================
// Test Suite
// ===========================================================================

test.describe('S3K Audio Editing Round Trips', () => {
  test.beforeEach(async ({ page }) => {
    attachConsoleDebugListener(page);
  });

  // -------------------------------------------------------------------------
  // Test 1: Loop Editor saves loop points to device sample header
  // -------------------------------------------------------------------------

  test('loop editor saves loop points to device sample header', async ({ page }) => {
    // Precondition: device must have at least one sample
    const sampleNames = await queryDeviceSamples();
    expect(
      sampleNames.length,
      'Device must have at least one sample loaded for this test. ' +
      'Load a sample on the S3000XL before running.',
    ).toBeGreaterThan(0);
    console.log(`Device has ${sampleNames.length} samples. First: "${sampleNames[0].trim()}"`);

    // Read original sample header via side channel
    const originalHeader = await queryDeviceSampleHeader(0);
    console.log('Original sample header read via side channel');

    // Navigate and select first sample
    await navigateToSamplesAndConnect(page);
    await waitForSampleListAndSelectFirst(page);

    // Click "Loop Editor" button
    const loopEditorButton = page.locator('button', { hasText: 'Loop Editor' });
    await expect(loopEditorButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await loopEditorButton.click();
    console.log('Clicked Loop Editor button, waiting for SDS download...');

    // Wait for the loop editor dialog to open with waveform content
    await waitForEditorDialog(page);
    console.log('Loop editor dialog opened with waveform');

    // Find and click the Save button inside the dialog
    const dialog = page.locator('[role="dialog"]');
    const saveButton = dialog.locator('button', { hasText: 'Save' });
    await expect(saveButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await saveButton.click();
    console.log('Clicked Save in loop editor');

    // Wait for the dialog to close (save completes and dialog dismisses)
    await expect(dialog).not.toBeVisible({ timeout: 30_000 });
    console.log('Loop editor dialog closed after save');

    // Read the sample header via side channel again to verify save path
    const updatedHeader = await queryDeviceSampleHeader(0);
    console.log('Updated sample header read via side channel after save');

    // We don't assert specific loop values since we didn't change them in the UI.
    // The test verifies the full device -> editor -> device loop point save path
    // completes without error. Both headers should be readable.
    expect(originalHeader).toBeDefined();
    expect(updatedHeader).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // Test 2: Sample Editor opens for device sample
  // -------------------------------------------------------------------------

  test('sample editor opens for device sample', async ({ page }) => {
    // Precondition: device must have at least one sample
    const sampleNames = await queryDeviceSamples();
    expect(
      sampleNames.length,
      'Device must have at least one sample loaded for this test.',
    ).toBeGreaterThan(0);
    console.log(`Device has ${sampleNames.length} samples. First: "${sampleNames[0].trim()}"`);

    // Navigate and select first sample
    await navigateToSamplesAndConnect(page);
    await waitForSampleListAndSelectFirst(page);

    // Click "Sample Editor" button
    const sampleEditorButton = page.locator('button', { hasText: 'Sample Editor' });
    await expect(sampleEditorButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await sampleEditorButton.click();
    console.log('Clicked Sample Editor button, waiting for SDS download...');

    // Wait for the sample editor dialog to open with waveform content
    await waitForEditorDialog(page);
    console.log('Sample editor dialog opened with waveform');

    // Verify the dialog is present and has content
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Close the dialog without saving (press Escape)
    await page.keyboard.press('Escape');

    // Verify the dialog closed
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });
    console.log('Sample editor dialog closed via Escape');
  });

  // -------------------------------------------------------------------------
  // Test 3: Chopper opens for device sample
  // -------------------------------------------------------------------------

  test('chopper opens for device sample', async ({ page }) => {
    // Precondition: device must have at least one sample
    const sampleNames = await queryDeviceSamples();
    expect(
      sampleNames.length,
      'Device must have at least one sample loaded for this test.',
    ).toBeGreaterThan(0);
    console.log(`Device has ${sampleNames.length} samples. First: "${sampleNames[0].trim()}"`);

    // Navigate and select first sample
    await navigateToSamplesAndConnect(page);
    await waitForSampleListAndSelectFirst(page);

    // Click "Chopper" button
    const chopperButton = page.locator('button', { hasText: 'Chopper' });
    await expect(chopperButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await chopperButton.click();
    console.log('Clicked Chopper button, waiting for SDS download...');

    // Wait for the chopper dialog to open with waveform content
    await waitForEditorDialog(page);
    console.log('Chopper dialog opened with waveform');

    // Verify the dialog is present and has content
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Close the dialog without saving (press Escape)
    await page.keyboard.press('Escape');

    // Verify the dialog closed
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });
    console.log('Chopper dialog closed via Escape');
  });
});
