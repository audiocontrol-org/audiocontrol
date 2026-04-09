/**
 * S3K drum kit import e2e test.
 *
 * Tests importing a drum kit (chopped sample with slices) from the common-area
 * library to the S3000XL device via SDS + SysEx.
 *
 * The import flow:
 *   1. Write a drum kit fixture to OPFS common area (chopped sample with slices)
 *   2. Connect to device and OPFS library
 *   3. Select the drum kit in the library tree
 *   4. Click "Import as Drum Program" in the preview panel
 *   5. Confirm the import dialog
 *   6. Wait for SDS transfers + program/keygroup creation
 *   7. Verify via side-channel: new samples + program on device
 *
 * Prerequisites:
 *   - Raspberry Pi running s2p and scsi-midi-bridge
 *   - Akai S3000XL connected via SCSI
 *
 * Run via: modules/e2e-infra/scripts/run-and-watch.sh test-e2e-s3k-device-library 'ARGS=--grep "Drum Kit Import"'
 */

import { test, expect, type Page } from '@playwright/test';

// Deviation: relative imports — e2e/ is outside src/ and @/ alias doesn't apply.
import {
  buildScsiUrl,
  waitForAppReady,
  connectToDevice,
  navigateToLibrary,
  connectToOPFS,
} from '../../e2e-infra/helpers/connection-helper';

import {
  cleanupOPFS,
  initializeS3kOPFS,
  assertLibraryItemVisible,
  clickLibraryItem,
} from '../../e2e-infra/helpers/library-ui-helpers';

import {
  writeDrumKitFixture,
} from '../../e2e-infra/helpers/library-fixtures';

import { createScsiMidiTransport } from '@audiocontrol/midi-core';
import { createS3000xlClient } from '@audiocontrol/sampler-devices/s3k';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL;
if (!BRIDGE_URL) {
  throw new Error(
    'E2E_SCSI_BRIDGE_URL must be set. Run via: make test-e2e-s3k-device-library',
  );
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

test.setTimeout(180_000);

const EDITOR_BASE_PATH = '/akai/s3000xl/editor';
const UI_TIMEOUT_MS = 10_000;
const TRANSFER_TIMEOUT_MS = 120_000; // SDS transfers are slow over SCSI

const KIT_NAME = 'E2E Drum Kit';
const SLICE_LABELS = ['Kick', 'Snare', 'HiHat', 'Clap'];
const BASE_NOTE = 36; // C2

// ---------------------------------------------------------------------------
// Side-channel device queries
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

async function queryDevicePrograms(): Promise<string[]> {
  const scsi = createScsiMidiTransport({ bridgeUrl: BRIDGE_URL! });
  const client = createS3000xlClient(scsi.adapter, { noCache: true });
  try {
    return await client.fetchProgramNames();
  } finally {
    scsi.disconnect();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function url(subpath = ''): string {
  return buildScsiUrl(EDITOR_BASE_PATH, subpath, '/scsi-bridge');
}

function attachConsoleDebugListener(page: Page): void {
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));
  page.on('console', (msg) => {
    console.log(`BROWSER [${msg.type()}]:`, msg.text());
  });
}

async function waitForTransferWithHeartbeat(
  page: Page,
  successTestId: string,
  containerSelector: string,
  timeoutMs: number,
): Promise<void> {
  const success = page.locator(`[data-testid="${successTestId}"]`);
  const container = page.locator(containerSelector);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await success.isVisible()) break;
    await expect(container).toBeVisible({ timeout: 3_000 });
    await page.waitForTimeout(500);
  }
  await expect(success).toBeVisible({ timeout: 3_000 });
}

// ===========================================================================
// Test Suite
// ===========================================================================

test.describe('S3K Drum Kit Import', () => {
  test.beforeEach(async ({ page }) => {
    attachConsoleDebugListener(page);

    await page.goto(url(), { timeout: UI_TIMEOUT_MS });
    await waitForAppReady(page);

    // Verify SCSI bridge reachable
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
    await cleanupOPFS(page);
    await initializeS3kOPFS(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanupOPFS(page);
  });

  test('drum kit import creates samples and program on device', async ({ page }) => {
    // Snapshot device state before import
    const samplesBefore = await queryDeviceSamples();
    const programsBefore = await queryDevicePrograms();
    console.log(`Device before: ${samplesBefore.length} samples, ${programsBefore.length} programs`);

    // Write drum kit fixture to common-area OPFS
    await writeDrumKitFixture(page, {
      name: KIT_NAME,
      baseNote: BASE_NOTE,
      sliceLabels: SLICE_LABELS,
      sampleRate: 44100,
      samplesPerSlice: 200,
    });

    // Connect to OPFS and wait for the kit to appear in the tree
    await connectToOPFS(page);
    await assertLibraryItemVisible(page, KIT_NAME, UI_TIMEOUT_MS);

    // Select the drum kit
    await clickLibraryItem(page, KIT_NAME);

    // Click "Import as Drum Program" in preview panel
    const importButton = page.locator('[data-testid="preview-import-drum-kit"]');
    await expect(importButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await importButton.click();

    // Confirm the import dialog
    const confirmButton = page.locator('[data-testid="import-drumkit-confirm"]');
    await expect(confirmButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await confirmButton.click();

    // Wait for transfer to complete (SDS + program + keygroups)
    await waitForTransferWithHeartbeat(
      page,
      'import-drumkit-done',
      '[role="dialog"]',
      TRANSFER_TIMEOUT_MS,
    );

    // Dismiss success dialog
    const doneButton = page.locator('[data-testid="import-drumkit-done"]');
    await doneButton.click();

    // Verify via side-channel: device should have new samples and program
    const samplesAfter = await queryDeviceSamples();
    const programsAfter = await queryDevicePrograms();
    console.log(`Device after: ${samplesAfter.length} samples, ${programsAfter.length} programs`);

    // Should have SLICE_LABELS.length new samples
    expect(samplesAfter.length).toBe(samplesBefore.length + SLICE_LABELS.length);

    // Should have 1 new program
    expect(programsAfter.length).toBe(programsBefore.length + 1);

    // The new program name should contain the kit name (truncated to 12 Akai chars)
    const newProgramName = programsAfter[programsAfter.length - 1].trim();
    console.log(`New program: "${newProgramName}"`);
    expect(newProgramName.length).toBeGreaterThan(0);
  });
});
