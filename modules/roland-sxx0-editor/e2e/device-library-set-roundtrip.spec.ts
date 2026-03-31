/**
 * E2E set round-trip test.
 *
 * Saves the device's complete state (tones + patches + wave data) as a
 * library set, then loads it back and verifies the device state matches.
 *
 * Follows CLAUDE.md tenet 4: atomic round trips.
 *
 * Prerequisites:
 *   - Roland S-330 or S-550 connected via MIDI
 *   - Device has at least 1 tone with wave data
 *   - devenv shell active
 *
 * Run via: make test-e2e-device-library -- --grep "set round trip"
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
  createMinimalWavBase64,
  writeToneFixtureToOPFS,
  initializeCleanOPFS,
  cleanupOPFS,
  loadAllDeviceData,
  queryDeviceMemoryState,
  type DeviceMemoryState,
} from './helpers/roundtrip-helpers';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

test.setTimeout(300_000); // 5 minutes -- set operations are slow

const MIDI_SERVER_PORT = process.env.E2E_MIDI_SERVER_PORT;
const DEVICE_TYPE = process.env.E2E_DEVICE_TYPE ?? 's330';
const EDITOR_BASE_PATH = `/roland/${DEVICE_TYPE}/editor`;
// Library paths are hardcoded to 's330' in LibraryPage.tsx (lines 513, 558)
const LIBRARY_DEVICE = 's330';

const UI_TIMEOUT_MS = 2_000;
const MIDI_TRANSFER_TIMEOUT_MS = 60_000;
const SAVE_SET_TIMEOUT_MS = 180_000; // 3 minutes for wave data fetch
const LOAD_SET_TIMEOUT_MS = 180_000; // 3 minutes for wave data upload

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
// Shared Fixtures (reuse tone fixture from roundtrip tests)
// ---------------------------------------------------------------------------

const TONE_FIXTURE_NAME = 'rt-tone';

// Fixture uses 's330' for device/extension because the library path
// is hardcoded to library/s330/ in LibraryPage.tsx
const TONE_YAML = `format: sampler-tone
device: s330
version: 1
name: "RT Tone"
wave:
  file: "${TONE_FIXTURE_NAME}.wav"
  sampleRate: 30000
  loopMode: forward
  startPoint: 0
  endPoint: 30000
  loopPoint: 0
s330:
  originalKey: 60
  outputAssign: 0
`;

const TONE_WAV_BASE64 = createMinimalWavBase64(30000, 1);

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
// Helpers
// ---------------------------------------------------------------------------

/**
 * Import a tone fixture to device slot 0. Used to seed the device when
 * it has no occupied tones.
 */
async function importToneFixtureToDevice(
  page: import('@playwright/test').Page
): Promise<void> {
  // Write tone fixture to OPFS
  await writeToneFixtureToOPFS(
    page,
    LIBRARY_DEVICE,
    TONE_FIXTURE_NAME,
    TONE_YAML,
    TONE_WAV_BASE64
  );

  // Connect to OPFS so the app sees the fixture (skip if already connected)
  const opfsBtn = page.locator('[data-testid="library-backend-opfs"]');
  if (await opfsBtn.isVisible().catch(() => false)) {
    await connectToOPFS(page);
  }

  // Wait for the fixture to appear in the library tree
  const toneItem = page.locator(
    `[data-testid="library-tone-${TONE_FIXTURE_NAME}"]`
  );
  await expect(toneItem).toBeVisible({ timeout: UI_TIMEOUT_MS });

  // Select the tone and import to slot 0
  await toneItem.click();

  const importButton = page.locator(
    '[data-testid="import-to-device-button"]'
  );
  await expect(importButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
  await importButton.click();

  const slotSelect = page.locator('[data-testid="target-slot-select"]');
  await expect(slotSelect).toBeVisible({ timeout: UI_TIMEOUT_MS });
  await slotSelect.selectOption('0');

  const confirmImport = page.locator(
    '[data-testid="confirm-import-button"]'
  );
  await expect(confirmImport).toBeVisible({ timeout: UI_TIMEOUT_MS });
  await confirmImport.click();

  // Wait for import success — heartbeat-safe polling
  {
    const POLL_MS = 2_000;
    const MAX_POLLS = MIDI_TRANSFER_TIMEOUT_MS / POLL_MS;
    let done = false;
    for (let i = 0; i < MAX_POLLS && !done; i++) {
      await page.waitForTimeout(POLL_MS);
      done = await page.locator('[data-testid="import-success"]').isVisible();
    }
    expect(done, 'Tone import did not complete in time').toBe(true);
  }

  // Dismiss the success dialog
  const doneButton = page.locator('button', { hasText: 'Done' });
  await doneButton.click();
}

/**
 * Compare two DeviceMemoryState snapshots for occupied tone equivalence.
 *
 * Checks:
 *   - Same occupied tone indices
 *   - Same tone names at each occupied index
 *   - Same wave allocations (bank, segmentTop, segmentLength)
 */
function assertDeviceStatesMatch(
  before: DeviceMemoryState,
  after: DeviceMemoryState
): void {
  const occupiedBefore = before.tones
    .filter((t) => !t.empty)
    .sort((a, b) => a.index - b.index);
  const occupiedAfter = after.tones
    .filter((t) => !t.empty)
    .sort((a, b) => a.index - b.index);

  // Same number of occupied tones
  expect(
    occupiedAfter.length,
    `Expected ${occupiedBefore.length} occupied tones after load, got ${occupiedAfter.length}`
  ).toBe(occupiedBefore.length);

  // Same indices occupied
  const beforeIndices = occupiedBefore.map((t) => t.index);
  const afterIndices = occupiedAfter.map((t) => t.index);
  expect(
    afterIndices,
    'Occupied tone indices should match after set load'
  ).toEqual(beforeIndices);

  // Same names and wave allocations at each occupied slot
  for (let i = 0; i < occupiedBefore.length; i++) {
    const b = occupiedBefore[i];
    const a = occupiedAfter[i];

    expect(
      a.name,
      `Tone at index ${b.index}: name mismatch`
    ).toBe(b.name);

    expect(
      a.waveBank,
      `Tone at index ${b.index}: waveBank mismatch`
    ).toBe(b.waveBank);

    expect(
      a.segmentTop,
      `Tone at index ${b.index}: segmentTop mismatch`
    ).toBe(b.segmentTop);

    expect(
      a.segmentLength,
      `Tone at index ${b.index}: segmentLength mismatch`
    ).toBe(b.segmentLength);
  }

  // Same occupied patch count
  expect(
    after.occupiedPatchCount,
    `Expected ${before.occupiedPatchCount} occupied patches after load, got ${after.occupiedPatchCount}`
  ).toBe(before.occupiedPatchCount);
}

// ===========================================================================
// Test Suite
// ===========================================================================

test.describe('Device Set Round Trip', () => {
  test.beforeAll(async () => {
    if (!MIDI_SERVER_PORT) {
      throw new Error(
        'E2E_MIDI_SERVER_PORT must be set. Run via: make test-e2e-device-library'
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
  });

  test.afterEach(async ({ page }) => {
    await cleanupOPFS(page);
  });

  // -------------------------------------------------------------------------
  // Set Round Trip
  // -------------------------------------------------------------------------

  test('set round trip: save device state, load back, compare', async ({
    page,
  }) => {
    attachConsoleDebugListener(page);

    // Step 1: Ensure the device has data. Load device data first
    // (Refresh Device doesn't need OPFS). If empty, import a tone.
    await loadAllDeviceData(page);
    const initialState = await queryDeviceMemoryState(page);

    if (initialState.occupiedToneCount === 0) {
      console.log(
        'Device has no occupied tones -- importing fixture tone to slot 0'
      );
      await importToneFixtureToDevice(page);
      // Reload device data to reflect the import
      await loadAllDeviceData(page);
    }

    // Ensure OPFS is connected (skip if already connected)
    const opfsConnectBtn = page.locator('[data-testid="library-backend-opfs"]');
    if (await opfsConnectBtn.isVisible().catch(() => false)) {
      await connectToOPFS(page);
    }

    // Step 2: Snapshot "before" state
    const beforeState = await queryDeviceMemoryState(page);
    expect(
      beforeState.occupiedToneCount,
      'Device must have at least 1 occupied tone for set round trip'
    ).toBeGreaterThanOrEqual(1);

    console.log(
      `Before state: ${beforeState.occupiedToneCount} tones, ` +
        `${beforeState.occupiedPatchCount} patches`
    );

    // Step 3: Save device state as a set
    // Wait for the save button to become enabled — it's disabled while
    // device data is loading and when library isn't connected.
    const saveButton = page.locator('[data-testid="save-set-button"]');
    await expect(saveButton).toBeEnabled({ timeout: 30_000 });
    await saveButton.click();

    // Fill in set name
    const nameInput = page.locator('[data-testid="set-name-input"]');
    await expect(nameInput).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await nameInput.fill('E2E_Set');

    // Confirm save
    const confirmSave = page.locator('[data-testid="confirm-save-set"]');
    await expect(confirmSave).toBeEnabled({ timeout: UI_TIMEOUT_MS });
    await confirmSave.click();

    // Wait for save to complete (wave data fetch from device is slow).
    // Use polling instead of one long waitForSelector — each poll is a
    // Playwright step that feeds the heartbeat reporter, preventing the
    // watchdog from killing the test during slow MIDI transfers.
    {
      const POLL_MS = 2_000;
      const MAX_POLLS = SAVE_SET_TIMEOUT_MS / POLL_MS;
      let saved = false;
      for (let i = 0; i < MAX_POLLS && !saved; i++) {
        await page.waitForTimeout(POLL_MS);
        saved = await page.locator('[data-testid="save-success"]').isVisible();
        if (!saved) {
          // Log progress for diagnostics
          const status = await page.locator('[data-testid="save-progress"]').textContent().catch(() => '');
          if (i % 5 === 0) console.log(`  Save progress: ${status || 'working...'}`);
        }
      }
      expect(saved, 'Set save did not complete in time').toBe(true);
    }

    console.log('Set saved successfully');

    // Close the save dialog
    const closeSaveDialog = page.locator('button', { hasText: 'Done' });
    if (await closeSaveDialog.isVisible().catch(() => false)) {
      await closeSaveDialog.click();
    } else {
      // Fallback: Cancel also closes the dialog
      await page.locator('button', { hasText: 'Cancel' }).click();
    }
    await expect(page.locator('[data-testid="set-name-input"]')).not.toBeVisible({ timeout: UI_TIMEOUT_MS });
    console.log('Save dialog closed');

    // Step 4: Verify set appears in library tree
    // The set name "E2E_Set" may appear under the Sets section.
    // Try multiple selector strategies.
    await page.waitForTimeout(1000); // Let library refresh
    const setItem = page.locator('text=E2E_Set').first();
    await expect(setItem).toBeVisible({ timeout: UI_TIMEOUT_MS });

    console.log('Set "E2E_Set" visible in library tree');

    // Step 5: Select the set in the library tree
    await setItem.click();
    console.log('Set selected');

    // Step 6: Load the saved set back to device
    const loadButton = page.locator('[data-testid="load-set-button"]');
    await expect(loadButton).toBeEnabled({ timeout: UI_TIMEOUT_MS });
    console.log('Load button enabled');
    await loadButton.click();

    // Confirm load
    const confirmLoad = page.locator('[data-testid="confirm-load-set"]');
    await expect(confirmLoad).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await confirmLoad.click();

    // Wait for load to complete — same heartbeat-safe polling as save
    {
      const POLL_MS = 2_000;
      const MAX_POLLS = LOAD_SET_TIMEOUT_MS / POLL_MS;
      let loaded = false;
      for (let i = 0; i < MAX_POLLS && !loaded; i++) {
        await page.waitForTimeout(POLL_MS);
        loaded = await page.locator('[data-testid="load-success"]').isVisible();
        if (!loaded) {
          const status = await page.locator('[data-testid="load-progress"]').textContent().catch(() => '');
          if (i % 5 === 0) console.log(`  Load progress: ${status || 'working...'}`);
        }
      }
      expect(loaded, 'Set load did not complete in time').toBe(true);
    }

    console.log('Set loaded successfully');

    // Close the load dialog
    const closeLoadDialog = page.locator('button', { hasText: 'Done' });
    if (await closeLoadDialog.isVisible().catch(() => false)) {
      await closeLoadDialog.click();
    } else {
      // Fallback: Cancel also closes the dialog
      await page.locator('button', { hasText: 'Cancel' }).click();
    }

    // Step 7: Reload device data and snapshot "after" state
    await loadAllDeviceData(page);
    const afterState = await queryDeviceMemoryState(page);

    console.log(
      `After state: ${afterState.occupiedToneCount} tones, ` +
        `${afterState.occupiedPatchCount} patches`
    );

    // Step 8: Compare before/after
    assertDeviceStatesMatch(beforeState, afterState);

    console.log('Set round trip: before/after states match');
  });
});
