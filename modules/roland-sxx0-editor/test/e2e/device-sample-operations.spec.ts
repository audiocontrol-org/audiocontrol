/**
 * E2E tests for sample export/import operations on the Tones page.
 *
 * These tests verify that:
 *   - Exporting a tone's sample produces a valid WAV download
 *   - Importing a WAV file into a tone slot writes data to the device
 *   - Wave bank selection during import is respected
 *
 * Pattern:
 *   1. Connect to device, navigate to Tones page
 *   2. Select an appropriate tone (non-empty for export, any for import)
 *   3. Perform the export or import operation via the UI
 *   4. Verify results via download properties or device readback
 *
 * Prerequisites:
 *   - Roland S-330 or S-550 connected via MIDI
 *   - At least one tone with sample data loaded on the device
 *   - midi-server running (started by run script)
 *   - devenv shell active
 *
 * Run via: make test-e2e-hardware
 */

import { test, expect } from '@playwright/test';

// Deviation: Using relative imports because e2e/ is outside src/ and the @/
// path alias only applies to src/. This should not be copied to app code.
import {
  connectToDevice,
  waitForAppReady,
  getMidiStatus,
} from './helpers/connection-helper';
import { readToneFromDevice } from './helpers/device-readback-helpers';
import { createMinimalWavBase64 } from './helpers/roundtrip-helpers';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

test.setTimeout(120_000);

const MIDI_SERVER_PORT = process.env.E2E_MIDI_SERVER_PORT;
const DEVICE_TYPE = process.env.E2E_DEVICE_TYPE ?? 's330';
const EDITOR_BASE_PATH = `/roland/${DEVICE_TYPE}/editor`;

const UI_TIMEOUT_MS = 5_000;
const DATA_LOAD_TIMEOUT_MS = 15_000;

/** Time to wait after a UI change for the buffered MIDI write to flush
 *  and for the device to finish processing the parameter write. */
const WRITE_FLUSH_MS = 2500;

// ---------------------------------------------------------------------------
// URL Builder
// ---------------------------------------------------------------------------

function buildUrl(subpath = ''): string {
  const normalized = subpath === '/' ? '' : subpath;
  const fullPath = normalized
    ? `${EDITOR_BASE_PATH}/${normalized}`
    : EDITOR_BASE_PATH;
  if (!MIDI_SERVER_PORT) return fullPath;
  const separator = fullPath.includes('?') ? '&' : '?';
  return `${fullPath}${separator}midi=http&midiServerPort=${MIDI_SERVER_PORT}`;
}

// ---------------------------------------------------------------------------
// Console Debug Listener
// ---------------------------------------------------------------------------

function attachConsoleDebugListener(
  page: import('@playwright/test').Page,
): void {
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));
  page.on('console', (msg) => {
    const text = msg.text();
    if (
      text.includes('S330Client') ||
      text.includes('S550Client') ||
      msg.type() === 'error' ||
      msg.type() === 'warning'
    ) {
      console.log(`BROWSER:`, text);
    }
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Find the index of the first non-empty tone in the list.
 * A non-empty tone has a visible name that is not "(empty)" or blank.
 * Returns null if no non-empty tones are found.
 */
async function findFirstNonEmptyToneIndex(
  page: import('@playwright/test').Page,
): Promise<number | null> {
  const toneItems = page.locator('[data-testid^="tone-item-"]');
  const count = await toneItems.count();

  for (let i = 0; i < count; i++) {
    const item = toneItems.nth(i);
    const nameEl = item.locator('[data-testid="tone-name"]');

    if ((await nameEl.count()) === 0) continue;

    const name = await nameEl.textContent();
    if (name && name.trim() && !name.includes('(empty)')) {
      const testId = await item.getAttribute('data-testid');
      if (testId) {
        const match = testId.match(/tone-item-(\d+)/);
        if (match) return Number(match[1]);
      }
    }
  }
  return null;
}

/**
 * Select a tone by its index in the list.
 */
async function selectTone(
  page: import('@playwright/test').Page,
  toneIndex: number,
): Promise<void> {
  const toneItem = page.locator(`[data-testid="tone-item-${toneIndex}"]`);
  await expect(toneItem).toBeVisible({ timeout: UI_TIMEOUT_MS });
  // Click the button inside the tone item (the div wrapper doesn't handle clicks)
  await toneItem.locator('button').first().click();

  // Wait for tone editor to appear (may need bank load from device)
  const toneDetail = page.locator('[data-testid="tone-detail"]');
  await expect(toneDetail).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });
}

/**
 * Navigate to the Tones page and wait for items to render.
 */
async function navigateToTonesPage(
  page: import('@playwright/test').Page,
): Promise<void> {
  const tonesLink = page.locator('a[href$="/tones"]');
  await tonesLink.click();
  await page.waitForURL('**/tones**');

  const toneItems = page.locator('[data-testid^="tone-item-"]');
  await expect(toneItems.first()).toBeVisible({
    timeout: DATA_LOAD_TIMEOUT_MS,
  });
}

// ===========================================================================
// Test Suite
// ===========================================================================

test.describe('Sample Export/Import Operations', () => {
  let testToneIndex: number;

  test.beforeAll(async () => {
    if (!MIDI_SERVER_PORT) {
      throw new Error(
        'E2E_MIDI_SERVER_PORT must be set. Run via: make test-e2e-hardware',
      );
    }
  });

  test.beforeEach(async ({ page }) => {
    attachConsoleDebugListener(page);

    // 1. Load app and connect to MIDI device
    await page.goto(buildUrl(), { timeout: UI_TIMEOUT_MS });
    await waitForAppReady(page);
    await connectToDevice(page);
    expect(await getMidiStatus(page)).toBe('connected');

    // 2. Navigate to Tones page
    await navigateToTonesPage(page);

    // 3. Find and select the first non-empty tone
    const foundIndex = await findFirstNonEmptyToneIndex(page);
    console.log(`Found non-empty tone at index: ${foundIndex}`);
    if (foundIndex === null) {
      test.skip(true, 'No non-empty tones found on device');
      return;
    }
    testToneIndex = foundIndex;
    console.log(`Selecting tone ${testToneIndex}...`);
    await selectTone(page, testToneIndex);
    console.log('Tone selected, editor visible');
  });

  // -------------------------------------------------------------------------
  // 3.3.1 — Export Sample
  // -------------------------------------------------------------------------

  test('export sample downloads WAV file', async ({ page }) => {
    const exportButton = page.locator('[data-testid="export-sample-button"]')
      .or(page.locator('button', { hasText: 'Export Sample' }));
    await expect(exportButton.first()).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await expect(exportButton.first()).toBeEnabled();

    // Set up download promise BEFORE clicking (non-blocking)
    const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
    await exportButton.first().click();

    // Poll with heartbeat-safe waits while download is in progress
    // The wave data transfer via MIDI can take 10-60 seconds
    let download: Awaited<ReturnType<typeof page.waitForEvent>> | null = null;
    const POLL_INTERVAL = 2_000;
    const MAX_POLLS = 30;
    for (let poll = 0; poll < MAX_POLLS; poll++) {
      const resolved = await Promise.race([
        downloadPromise.then((d) => d),
        page.waitForTimeout(POLL_INTERVAL).then(() => null),
      ]);
      if (resolved) {
        download = resolved;
        break;
      }
      console.log(`Export in progress... (${(poll + 1) * 2}s)`);
    }

    expect(download, 'Download should complete within timeout').not.toBeNull();

    // Verify download has a .wav filename
    const filename = download!.suggestedFilename();
    expect(filename).toMatch(/\.wav$/i);
    console.log(`Downloaded: ${filename}`);

    // Verify the download completed (path is non-null when the file was saved)
    const downloadPath = await download!.path();
    expect(downloadPath).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // 3.3.2 — Import Sample
  // -------------------------------------------------------------------------

  test('import sample from WAV file to device', async ({ page }) => {
    // Open import dialog
    const importButton = page.locator('[data-testid="import-sample-button"]')
      .or(page.locator('button', { hasText: 'Import Sample' }));
    await expect(importButton.first()).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await importButton.first().click();

    // Wait for dialog to appear
    await expect(
      page.getByText(/Import Sample to T/),
    ).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Create a minimal WAV (0.5s at 30kHz = 15000 samples) and upload it
    const wavBase64 = createMinimalWavBase64(30000, 0.5);
    const wavBuffer = Buffer.from(wavBase64, 'base64');

    const fileInput = page.locator('[data-testid="import-file-input"]')
      .or(page.locator('input[type="file"]'));
    await fileInput.setInputFiles({
      name: 'test-sample.wav',
      mimeType: 'audio/wav',
      buffer: wavBuffer,
    });

    // Wait for WAV info to appear (confirms file was parsed)
    await expect(
      page.getByText(/30000/),
    ).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Fill tone name
    const nameInput = page.locator('[data-testid="import-tone-name"]');
    await expect(nameInput).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await nameInput.clear();
    await nameInput.fill('IMPTEST');

    // Select wave bank A if the selector is visible
    const bankSelect = page.locator('[data-testid="import-wave-bank"]');
    if (await bankSelect.isVisible()) {
      await bankSelect.selectOption('0');
    }

    // Click the submit/import button inside the dialog
    const submitButton = page.locator('[data-testid="import-submit"]')
      .or(page.locator('button', { hasText: 'Import' }).last());
    await submitButton.click();

    // Wait for import to complete — dialog shows "Sample imported successfully!"
    const POLL_INTERVAL = 2_000;
    const MAX_POLLS = 30; // 30 x 2s = 60s max
    let importSucceeded = false;

    for (let poll = 0; poll < MAX_POLLS; poll++) {
      await page.waitForTimeout(POLL_INTERVAL);

      // Check for success message
      const successVisible = await page
        .getByText('Sample imported successfully')
        .isVisible();
      if (successVisible) {
        importSucceeded = true;
        break;
      }

      // Check for error message
      const errorEl = page.locator('.text-red-500, .text-red-400');
      if (await errorEl.isVisible()) {
        const errorText = await errorEl.textContent();
        throw new Error(`Import failed with error: ${errorText}`);
      }
    }

    expect(importSucceeded, 'Import should complete within timeout').toBe(true);

    // Click Done to close the dialog
    const doneButton = page.locator('button', { hasText: 'Done' });
    if (await doneButton.isVisible()) {
      await doneButton.click();
    }

    // Wait for device to process the write
    await page.waitForTimeout(WRITE_FLUSH_MS);

    // Verify the tone now has data on the device
    const deviceTone = await readToneFromDevice(page, testToneIndex);
    expect(deviceTone).not.toBeNull();
    expect(deviceTone!.name.trim()).toBe('IMPTEST');
    expect(deviceTone!.wave.segmentLength).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 3.3.3 — Import Sample with Wave Bank B
  // -------------------------------------------------------------------------

  test('import sample with wave bank B selection', async ({ page }) => {
    // Open import dialog
    const importButton = page.locator('[data-testid="import-sample-button"]')
      .or(page.locator('button', { hasText: 'Import Sample' }));
    await expect(importButton.first()).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await importButton.first().click();

    // Wait for dialog to appear
    await expect(
      page.getByText(/Import Sample to T/),
    ).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Create a minimal WAV and upload it
    const wavBase64 = createMinimalWavBase64(30000, 0.5);
    const wavBuffer = Buffer.from(wavBase64, 'base64');

    const fileInput = page.locator('[data-testid="import-file-input"]')
      .or(page.locator('input[type="file"]'));
    await fileInput.setInputFiles({
      name: 'test-sample-bank-b.wav',
      mimeType: 'audio/wav',
      buffer: wavBuffer,
    });

    // Wait for WAV info to appear
    await expect(
      page.getByText(/30000/),
    ).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Fill tone name
    const nameInput = page.locator('[data-testid="import-tone-name"]');
    await expect(nameInput).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await nameInput.clear();
    await nameInput.fill('IMPBNKB');

    // Select wave bank B
    const bankSelect = page.locator('[data-testid="import-wave-bank"]');
    await expect(bankSelect).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await bankSelect.selectOption('1'); // Bank B

    // Click the submit/import button
    const submitButton = page.locator('[data-testid="import-submit"]')
      .or(page.locator('button', { hasText: 'Import' }).last());
    await submitButton.click();

    // Wait for import success message
    const POLL_INTERVAL = 2_000;
    const MAX_POLLS = 30;
    let importSucceeded = false;

    for (let poll = 0; poll < MAX_POLLS; poll++) {
      await page.waitForTimeout(POLL_INTERVAL);

      const successVisible = await page
        .getByText('Sample imported successfully')
        .isVisible();
      if (successVisible) {
        importSucceeded = true;
        break;
      }

      const errorEl = page.locator('.text-red-500, .text-red-400');
      if (await errorEl.isVisible()) {
        const errorText = await errorEl.textContent();
        throw new Error(`Import failed with error: ${errorText}`);
      }
    }

    expect(importSucceeded, 'Import should complete within timeout').toBe(true);

    // Click Done to close dialog
    const doneButton = page.locator('button', { hasText: 'Done' });
    if (await doneButton.isVisible()) {
      await doneButton.click();
    }

    // Wait for device to process
    await page.waitForTimeout(WRITE_FLUSH_MS);

    // Verify the tone has data in wave bank B
    const deviceTone = await readToneFromDevice(page, testToneIndex);
    expect(deviceTone).not.toBeNull();
    expect(deviceTone!.name.trim()).toBe('IMPBNKB');
    expect(deviceTone!.wave.bank).toBe(1);
    expect(deviceTone!.wave.segmentLength).toBeGreaterThan(0);
  });
});
