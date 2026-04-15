/**
 * E2E tests for Patch editor controls — verified via device readback.
 *
 * After changing a control value in the UI, these tests force a fresh
 * SysEx read of all patch data from the hardware (via the Library page's
 * "Refresh Device" button) and assert against the device's actual memory.
 * This is stronger than navigate-away-and-back, which may serve cached
 * data from the client or store.
 *
 * Pattern:
 *   1. Connect to device, navigate to Patches page
 *   2. Select a non-empty patch
 *   3. Change a control value via the UI
 *   4. Wait for the buffered MIDI write to flush
 *   5. Invalidate caches, navigate to Library, click Refresh Device
 *   6. Read the fresh patch from __deviceDataStore
 *   7. Assert the device value matches what was set
 *
 * Prerequisites:
 *   - Roland S-330 or S-550 connected via MIDI
 *   - At least one non-empty patch on the device
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
import { readPatchFromDevice } from './helpers/device-readback-helpers';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

test.setTimeout(120_000);

const MIDI_SERVER_PORT = process.env.E2E_MIDI_SERVER_PORT;
const DEVICE_TYPE = process.env.E2E_DEVICE_TYPE ?? 's330';
const EDITOR_BASE_PATH = `/roland/${DEVICE_TYPE}/editor`;

const UI_TIMEOUT_MS = 2_000;
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
 * Find the index of the first non-empty patch in the list.
 * Returns null if no non-empty patches are found.
 */
async function findFirstNonEmptyPatchIndex(
  page: import('@playwright/test').Page,
): Promise<number | null> {
  const patchItems = page.locator('[data-testid^="patch-item-"]');
  const count = await patchItems.count();

  for (let i = 0; i < count; i++) {
    const item = patchItems.nth(i);
    const nameEl = item.locator('[data-testid="patch-name"]');

    if ((await nameEl.count()) === 0) continue;

    const name = await nameEl.textContent();
    if (name && name.trim() && !name.includes('(empty)')) {
      const testId = await item.getAttribute('data-testid');
      if (testId) {
        const match = testId.match(/patch-item-(\d+)/);
        if (match) return Number(match[1]);
      }
    }
  }
  return null;
}

/**
 * Select a patch by its index in the list.
 */
async function selectPatch(
  page: import('@playwright/test').Page,
  patchIndex: number,
): Promise<void> {
  const patchItem = page.locator(`[data-testid="patch-item-${patchIndex}"]`);
  await expect(patchItem).toBeVisible({ timeout: UI_TIMEOUT_MS });
  await patchItem.click();

  // Wait for patch editor to appear
  await page.waitForTimeout(500);
}

/**
 * Navigate to the Patches page and wait for items to render.
 */
async function navigateToPatchesPage(
  page: import('@playwright/test').Page,
): Promise<void> {
  const patchesLink = page.locator('a[href$="/patches"]');
  await patchesLink.click();
  await page.waitForURL('**/patches**');

  const patchItems = page.locator('[data-testid^="patch-item-"]');
  await expect(patchItems.first()).toBeVisible({
    timeout: DATA_LOAD_TIMEOUT_MS,
  });
}

/**
 * Change the key mode select to the given value and wait for the write to flush.
 */
async function setKeyMode(
  page: import('@playwright/test').Page,
  mode: string,
): Promise<void> {
  const keyModeSelect = page.locator('[data-testid="patch-key-mode"]');
  await expect(keyModeSelect).toBeVisible({ timeout: UI_TIMEOUT_MS });
  await keyModeSelect.selectOption(mode);
  await page.waitForTimeout(WRITE_FLUSH_MS);
}

// ===========================================================================
// Test Suite
// ===========================================================================

test.describe('Patch Editor Controls', () => {
  let testPatchIndex: number;

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

    // 2. Navigate to Patches page
    await navigateToPatchesPage(page);

    // 3. Find and select the first non-empty patch
    const foundIndex = await findFirstNonEmptyPatchIndex(page);
    if (foundIndex === null) {
      test.skip(true, 'No non-empty patches found on device');
      return;
    }
    testPatchIndex = foundIndex;
    await selectPatch(page, testPatchIndex);
  });

  // -------------------------------------------------------------------------
  // Patch Name
  // -------------------------------------------------------------------------

  test('patch name edit syncs to device', async ({ page }) => {
    // Click the name display to enter edit mode
    const nameDisplay = page.locator('h3.font-mono');
    await expect(nameDisplay).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await nameDisplay.click();

    // Now an input should be visible for editing
    const nameInput = page.locator('input[type="text"][maxlength="12"]');
    await expect(nameInput).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Clear and type new name
    await nameInput.fill('TESTPCH');
    await nameInput.press('Enter');
    await page.waitForTimeout(WRITE_FLUSH_MS);

    // Read patch back from device hardware
    const devicePatch = await readPatchFromDevice(page, testPatchIndex);
    expect(devicePatch).not.toBeNull();
    expect(devicePatch!.name).toBe('TESTPCH');
  });

  // -------------------------------------------------------------------------
  // Key Mode
  // -------------------------------------------------------------------------

  test('key mode change syncs to device', async ({ page }) => {
    const keyModeSelect = page
      .locator('label:has-text("Key Mode")')
      .locator('..')
      .locator('select');
    await expect(keyModeSelect).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const originalValue = await keyModeSelect.inputValue();

    // Change to 'v-sw' (unless already v-sw, then use 'normal')
    const newValue = originalValue === 'v-sw' ? 'normal' : 'v-sw';
    await keyModeSelect.selectOption(newValue);
    await page.waitForTimeout(WRITE_FLUSH_MS);

    // Read patch back from device hardware
    const devicePatch = await readPatchFromDevice(page, testPatchIndex);
    expect(devicePatch).not.toBeNull();
    expect(devicePatch!.keyMode).toBe(newValue);
  });

  // -------------------------------------------------------------------------
  // Bender Range
  // -------------------------------------------------------------------------

  test('bender range change syncs to device', async ({ page }) => {
    const benderSelect = page
      .locator('label:has-text("P.Bend Range")')
      .locator('..')
      .locator('select');
    await expect(benderSelect).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const originalValue = await benderSelect.inputValue();

    // Change to 5 (unless already 5, then use 3)
    const newValue = originalValue === '5' ? '3' : '5';
    await benderSelect.selectOption(newValue);
    await page.waitForTimeout(WRITE_FLUSH_MS);

    // Read patch back from device hardware
    const devicePatch = await readPatchFromDevice(page, testPatchIndex);
    expect(devicePatch).not.toBeNull();
    expect(devicePatch!.benderRange).toBe(Number(newValue));
  });

  // -------------------------------------------------------------------------
  // Level Slider
  // -------------------------------------------------------------------------

  test('level slider syncs to device', async ({ page }) => {
    const levelContainer = page.locator('[data-testid="param-level"]');
    await expect(levelContainer).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const slider = levelContainer.locator('[role="slider"]');
    await expect(slider).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const originalValue = Number(
      await slider.getAttribute('aria-valuenow') ?? '127',
    );

    // Set to 100 (unless already 100, then use 80)
    const newValue = originalValue === 100 ? 80 : 100;
    const diff = newValue - originalValue;

    await slider.focus();
    if (diff > 0) {
      for (let i = 0; i < diff; i++) {
        await slider.press('ArrowRight');
      }
    } else {
      for (let i = 0; i < Math.abs(diff); i++) {
        await slider.press('ArrowLeft');
      }
    }
    await slider.blur();
    await page.waitForTimeout(WRITE_FLUSH_MS);

    // Read patch back from device hardware
    const devicePatch = await readPatchFromDevice(page, testPatchIndex);
    expect(devicePatch).not.toBeNull();
    // Allow +-1 tolerance — Radix slider arrow keys may over/undershoot by 1
    expect(Math.abs(devicePatch!.level - newValue)).toBeLessThanOrEqual(1);
  });

  // -------------------------------------------------------------------------
  // Aftertouch Sensitivity Slider
  // -------------------------------------------------------------------------

  test('aftertouch sensitivity syncs to device', async ({ page }) => {
    const container = page.locator('[data-testid="param-a-t-sense"]');
    await expect(container).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const slider = container.locator('[role="slider"]');
    await expect(slider).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const originalValue = Number(
      await slider.getAttribute('aria-valuenow') ?? '64',
    );

    // Set to 80 (unless already 80, then use 50)
    const newValue = originalValue === 80 ? 50 : 80;
    const diff = newValue - originalValue;

    await slider.focus();
    if (diff > 0) {
      for (let i = 0; i < diff; i++) {
        await slider.press('ArrowRight');
      }
    } else {
      for (let i = 0; i < Math.abs(diff); i++) {
        await slider.press('ArrowLeft');
      }
    }
    await slider.blur();
    await page.waitForTimeout(WRITE_FLUSH_MS);

    // Read patch back from device hardware
    const devicePatch = await readPatchFromDevice(page, testPatchIndex);
    expect(devicePatch).not.toBeNull();
    // Allow +-1 tolerance — Radix slider arrow keys may over/undershoot by 1
    expect(Math.abs(devicePatch!.aftertouchSens - newValue)).toBeLessThanOrEqual(1);
  });

  // -------------------------------------------------------------------------
  // Aftertouch Assign
  // -------------------------------------------------------------------------

  test('aftertouch assign change syncs to device', async ({ page }) => {
    const atAssignSelect = page.locator('[data-testid="patch-at-assign"]');
    await expect(atAssignSelect).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const originalValue = await atAssignSelect.inputValue();

    // Toggle between 'volume' and 'modulation'
    const newValue = originalValue === 'volume' ? 'modulation' : 'volume';
    await atAssignSelect.selectOption(newValue);
    await page.waitForTimeout(WRITE_FLUSH_MS);

    // Read patch back from device hardware
    const devicePatch = await readPatchFromDevice(page, testPatchIndex);
    expect(devicePatch).not.toBeNull();
    expect(devicePatch!.aftertouchAssign).toBe(newValue);
  });

  // -------------------------------------------------------------------------
  // Key Assign
  // -------------------------------------------------------------------------

  test('key assign change syncs to device', async ({ page }) => {
    const keyAssignSelect = page.locator('[data-testid="patch-key-assign"]');
    await expect(keyAssignSelect).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const originalValue = await keyAssignSelect.inputValue();

    // Toggle between 'fix' and 'rotary'
    const newValue = originalValue === 'fix' ? 'rotary' : 'fix';
    await keyAssignSelect.selectOption(newValue);
    await page.waitForTimeout(WRITE_FLUSH_MS);

    // Read patch back from device hardware
    const devicePatch = await readPatchFromDevice(page, testPatchIndex);
    expect(devicePatch).not.toBeNull();
    expect(devicePatch!.keyAssign).toBe(newValue);
  });

  // -------------------------------------------------------------------------
  // Output Assign
  // -------------------------------------------------------------------------

  test('output assign change syncs to device', async ({ page }) => {
    const outputSelect = page.locator('[data-testid="patch-output"]');
    await expect(outputSelect).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const originalValue = await outputSelect.inputValue();

    // Change to output 3 (value '2') unless already there, then use output 1 (value '0')
    const newValue = originalValue === '2' ? '0' : '2';
    await outputSelect.selectOption(newValue);
    await page.waitForTimeout(WRITE_FLUSH_MS);

    // Read patch back from device hardware
    const devicePatch = await readPatchFromDevice(page, testPatchIndex);
    expect(devicePatch).not.toBeNull();
    expect(devicePatch!.outputAssign).toBe(Number(newValue));
  });

  // -------------------------------------------------------------------------
  // Velocity Threshold Slider (V-Sw mode only)
  // -------------------------------------------------------------------------

  test('velocity threshold slider syncs to device', async ({ page }) => {
    // The V-Sw Thresh slider is only active when key mode is 'v-sw'.
    // Set key mode to v-sw first and wait for the write to flush.
    await setKeyMode(page, 'v-sw');

    const container = page.locator('[data-testid="param-v-sw-thresh"]');
    await expect(container).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const slider = container.locator('[role="slider"]');
    await expect(slider).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const originalValue = Number(
      await slider.getAttribute('aria-valuenow') ?? '64',
    );

    // Set to 90 (unless already 90, then use 60)
    const newValue = originalValue === 90 ? 60 : 90;
    const diff = newValue - originalValue;

    await slider.focus();
    if (diff > 0) {
      for (let i = 0; i < diff; i++) {
        await slider.press('ArrowRight');
      }
    } else {
      for (let i = 0; i < Math.abs(diff); i++) {
        await slider.press('ArrowLeft');
      }
    }
    await slider.blur();
    await page.waitForTimeout(WRITE_FLUSH_MS);

    // Read patch back from device hardware
    const devicePatch = await readPatchFromDevice(page, testPatchIndex);
    expect(devicePatch).not.toBeNull();
    // Allow +-1 tolerance — Radix slider arrow keys may over/undershoot by 1
    expect(Math.abs(devicePatch!.velocityThreshold - newValue)).toBeLessThanOrEqual(1);
  });

  // -------------------------------------------------------------------------
  // Velocity Mix Ratio Slider (V-Mix mode only)
  // -------------------------------------------------------------------------

  test('velocity mix ratio slider syncs to device', async ({ page }) => {
    // The V-Mix Ratio slider is only active when key mode is 'v-mix'.
    // Set key mode to v-mix first and wait for the write to flush.
    await setKeyMode(page, 'v-mix');

    const container = page.locator('[data-testid="param-v-mix-ratio"]');
    await expect(container).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const slider = container.locator('[role="slider"]');
    await expect(slider).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const originalValue = Number(
      await slider.getAttribute('aria-valuenow') ?? '64',
    );

    // Set to 100 (unless already 100, then use 70)
    const newValue = originalValue === 100 ? 70 : 100;
    const diff = newValue - originalValue;

    await slider.focus();
    if (diff > 0) {
      for (let i = 0; i < diff; i++) {
        await slider.press('ArrowRight');
      }
    } else {
      for (let i = 0; i < Math.abs(diff); i++) {
        await slider.press('ArrowLeft');
      }
    }
    await slider.blur();
    await page.waitForTimeout(WRITE_FLUSH_MS);

    // Read patch back from device hardware
    const devicePatch = await readPatchFromDevice(page, testPatchIndex);
    expect(devicePatch).not.toBeNull();
    // Allow +-1 tolerance — Radix slider arrow keys may over/undershoot by 1
    expect(Math.abs(devicePatch!.velocityMixRatio - newValue)).toBeLessThanOrEqual(1);
  });

  // -------------------------------------------------------------------------
  // Tone Zone Assignment (Layer 1)
  // -------------------------------------------------------------------------

  test('tone zone assignment syncs to device', async ({ page }) => {
    // Ensure key mode is 'normal' so Layer 1 is the only active layer.
    // This simplifies the test — we only need to verify toneLayer1.
    await setKeyMode(page, 'normal');

    // Find the Tone Mapping card section
    const toneMappingSection = page.locator(
      '.card:has(h4:has-text("Tone Mapping"))',
    );
    await expect(toneMappingSection).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Check if there are existing zone bars. If none, add one first.
    const zoneBars = toneMappingSection.locator(
      '.relative.h-12 button',
    );
    const zoneCount = await zoneBars.count();

    if (zoneCount === 0) {
      // Click "Add Zone" to create a zone
      const addZoneBtn = toneMappingSection
        .getByText('+ Add Zone')
        .first();
      await expect(addZoneBtn).toBeVisible({ timeout: UI_TIMEOUT_MS });
      await addZoneBtn.click();
      await page.waitForTimeout(500);
    } else {
      // Click the first zone bar to select it
      await zoneBars.first().click();
      await page.waitForTimeout(500);
    }

    // The zone edit panel should now be visible with Tone/Start Key/End Key
    const editPanel = toneMappingSection.locator(
      'text=Editing Zone',
    );
    await expect(editPanel).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Read the current tone dropdown value
    const toneSelect = toneMappingSection
      .locator('label:has-text("Tone")')
      .locator('..')
      .locator('select')
      .first();
    await expect(toneSelect).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const originalTone = Number(await toneSelect.inputValue());
    // Toggle between tone 0 and tone 1
    const newTone = originalTone === 1 ? 0 : 1;
    await toneSelect.selectOption(String(newTone));

    // Click Apply to commit the staged changes
    const applyBtn = toneMappingSection.getByText('Apply');
    await expect(applyBtn).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await applyBtn.click();
    await page.waitForTimeout(WRITE_FLUSH_MS);

    // Read patch back from device hardware
    const devicePatch = await readPatchFromDevice(page, testPatchIndex);
    expect(devicePatch).not.toBeNull();

    // Verify that at least one entry in toneLayer1 matches the new tone.
    // The zone spans a key range, so multiple entries may be set to newTone.
    const matchingEntries = devicePatch!.toneLayer1.filter(
      (t) => t === newTone,
    );
    expect(matchingEntries.length).toBeGreaterThan(0);
  });
});
