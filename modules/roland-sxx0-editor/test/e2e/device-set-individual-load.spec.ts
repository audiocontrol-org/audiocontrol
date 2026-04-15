/**
 * E2E tests for loading individual tones and patches from a saved set.
 *
 * Test cases:
 *   8.2.3 - Load individual tone from set to device
 *   8.2.4 - Load individual patch from set to device
 *
 * Flow:
 *   1. Write a set fixture directly to OPFS (set.yaml + tone/patch files)
 *   2. Connect to OPFS so the app sees the set
 *   3. Expand the set in the library tree
 *   4. Select an individual tone or patch within the set
 *   5. Click "Import to Device" in the preview panel
 *   6. Confirm the import dialog
 *   7. Verify the item appears on the device
 *
 * Prerequisites:
 *   - Roland S-330 or S-550 connected via MIDI
 *   - devenv shell active
 *
 * Run via: make test-e2e-roland-device ARGS="--grep 'individual.*from set'"
 */

import { test, expect } from '@playwright/test';

// Deviation: Using relative imports because e2e/ is outside src/ and the @/
// path alias only applies to src/. This should not be copied to app code.
import {
  connectToDevice,
  connectToOPFS,
  navigateToLibrary,
  waitForAppReady,
  getMidiStatus,
} from './helpers/connection-helper';
import {
  initializeCleanOPFS,
  cleanupOPFS,
  loadAllDeviceData,
  queryDeviceMemoryState,
} from './helpers/roundtrip-helpers';
import {
  SET_NAME,
  SET_MANIFEST_YAML,
  TONE_YAML,
  TONE_WAV_BASE64,
  PATCH_YAML,
  writeSetFixtureToOPFS,
} from './helpers/set-fixture-helpers';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

test.setTimeout(300_000); // 5 minutes -- MIDI transfers are slow

const MIDI_SERVER_PORT = process.env.E2E_MIDI_SERVER_PORT;
const DEVICE_TYPE = process.env.E2E_DEVICE_TYPE ?? 's330';
const EDITOR_BASE_PATH = `/roland/${DEVICE_TYPE}/editor`;
// Library paths are hardcoded to 's330' in LibraryPage.tsx
const LIBRARY_DEVICE = 's330';

const UI_TIMEOUT_MS = 5_000;
const MIDI_TRANSFER_TIMEOUT_MS = 60_000;

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
  page: import('@playwright/test').Page
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
// Heartbeat-safe import polling
// ---------------------------------------------------------------------------

/**
 * Poll for import-success indicator using short intervals to keep
 * the heartbeat reporter alive during slow MIDI transfers.
 */
async function waitForImportSuccess(
  page: import('@playwright/test').Page,
  description: string
): Promise<void> {
  const POLL_MS = 2_000;
  const MAX_POLLS = MIDI_TRANSFER_TIMEOUT_MS / POLL_MS;
  let done = false;
  for (let i = 0; i < MAX_POLLS && !done; i++) {
    await page.waitForTimeout(POLL_MS);
    done = await page
      .locator('[data-testid="import-success"]')
      .isVisible();
  }
  expect(done, `${description} did not complete in time`).toBe(true);
}

// ===========================================================================
// Test Suite
// ===========================================================================

test.describe('Load Individual Items from Set', () => {
  test.beforeAll(async () => {
    if (!MIDI_SERVER_PORT) {
      throw new Error(
        'E2E_MIDI_SERVER_PORT must be set. Run via: make test-e2e-roland-device'
      );
    }
  });

  test.beforeEach(async ({ page }) => {
    // 1. Load app and connect to MIDI device
    await page.goto(buildUrl(), { timeout: UI_TIMEOUT_MS });
    await waitForAppReady(page);
    await connectToDevice(page);
    expect(await getMidiStatus(page)).toBe('connected');

    // 2. Navigate to Library page
    await navigateToLibrary(page);

    // 3. Clean OPFS so each test starts fresh
    await initializeCleanOPFS(page, LIBRARY_DEVICE);

    // 4. Write set fixture to OPFS before connecting
    await writeSetFixtureToOPFS(
      page,
      LIBRARY_DEVICE,
      SET_NAME,
      SET_MANIFEST_YAML,
      TONE_YAML,
      TONE_WAV_BASE64,
      PATCH_YAML
    );

    // 5. Connect to OPFS so the app loads the fixture
    await connectToOPFS(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanupOPFS(page);
  });

  // -------------------------------------------------------------------------
  // 8.2.3 - Load individual tone from set to device
  // -------------------------------------------------------------------------

  test('load individual tone from set to device', async ({ page }) => {
    attachConsoleDebugListener(page);

    // Step 1: Load device data to know current state
    await loadAllDeviceData(page);
    const beforeState = await queryDeviceMemoryState(page);
    console.log(
      `Before: ${beforeState.occupiedToneCount} tones occupied`
    );

    // Step 2: Find and expand the set in the library tree
    const setItem = page.locator(`[data-testid="set-item-${SET_NAME}"]`);
    await expect(setItem).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Click the expand toggle (chevron) to expand the set
    const expandToggle = setItem.locator('.expand-toggle');
    await expandToggle.click();

    // Wait for the manifest to load and tone entries to appear
    const toneEntry = setItem.locator('text=T01').first();
    await expect(toneEntry).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Step 3: Click the tone entry to select it
    await toneEntry.click();

    // Step 4: Click "Import to Device" in the preview panel
    const importButton = page.locator(
      '[data-testid="import-to-device-button"]'
    );
    await expect(importButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await importButton.click();

    // Step 5: In the import dialog, select target slot and confirm
    const slotSelect = page.locator('[data-testid="target-slot-select"]');
    await expect(slotSelect).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await slotSelect.selectOption('0');

    const confirmButton = page.locator(
      '[data-testid="confirm-import-button"]'
    );
    await expect(confirmButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await confirmButton.click();

    // Step 6: Wait for import success
    await waitForImportSuccess(page, 'Tone import from set');

    // Dismiss success dialog
    const doneButton = page.locator('button', { hasText: 'Done' });
    await doneButton.click();

    // Step 7: Reload device data and verify the tone is on the device
    await loadAllDeviceData(page);
    const afterState = await queryDeviceMemoryState(page);

    const importedTone = afterState.tones[0];
    expect(
      importedTone.empty,
      'Tone slot 0 should be occupied after import'
    ).toBe(false);
    expect(
      importedTone.name,
      'Imported tone name should match fixture'
    ).toBe('SetTone01');

    console.log(
      `After: tone slot 0 = "${importedTone.name}", ` +
        `waveBank=${importedTone.waveBank}, ` +
        `segments=${importedTone.segmentTop}-${importedTone.segmentTop + importedTone.segmentLength - 1}`
    );
  });

  // -------------------------------------------------------------------------
  // 8.2.4 - Load individual patch from set to device
  // -------------------------------------------------------------------------

  test('load individual patch from set to device', async ({ page }) => {
    attachConsoleDebugListener(page);

    // Step 1: Load device data to know current state
    await loadAllDeviceData(page);

    // Step 2: Find and expand the set in the library tree
    const setItem = page.locator(`[data-testid="set-item-${SET_NAME}"]`);
    await expect(setItem).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Click the expand toggle to reveal set contents
    const expandToggle = setItem.locator('.expand-toggle');
    await expandToggle.click();

    // Wait for patch entries to appear
    const patchEntry = setItem.locator('text=P01').first();
    await expect(patchEntry).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Step 3: Click the patch entry to select it
    await patchEntry.click();

    // Step 4: Click "Import to Device" in the preview panel
    const importButton = page.locator(
      '[data-testid="import-to-device-button"]'
    );
    await expect(importButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await importButton.click();

    // Step 5: In the import dialog, select target slot and confirm.
    // The patch import dialog also imports required tones.
    const slotSelect = page.locator('[data-testid="target-slot-select"]');
    await expect(slotSelect).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await slotSelect.selectOption('0');

    const confirmButton = page.locator(
      '[data-testid="confirm-import-button"]'
    );
    await expect(confirmButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await confirmButton.click();

    // Step 6: Wait for import success
    await waitForImportSuccess(page, 'Patch import from set');

    // Dismiss success dialog
    const doneButton = page.locator('button', { hasText: 'Done' });
    await doneButton.click();

    // Step 7: Reload device data and verify the patch is on the device
    await loadAllDeviceData(page);
    const afterState = await queryDeviceMemoryState(page);

    const importedPatch = afterState.patches[0];
    expect(
      importedPatch.empty,
      'Patch slot 0 should be occupied after import'
    ).toBe(false);
    expect(
      importedPatch.name,
      'Imported patch name should match fixture'
    ).toBe('SetPatch01');

    // The patch import should also have imported the dependent tone
    const importedTone = afterState.tones[0];
    expect(
      importedTone.empty,
      'Tone slot 0 should be occupied (patch dependency)'
    ).toBe(false);
    expect(
      importedTone.name,
      'Dependent tone name should match fixture'
    ).toBe('SetTone01');

    console.log(
      `After: patch slot 0 = "${importedPatch.name}", ` +
        `tone slot 0 = "${importedTone.name}"`
    );
  });
});
