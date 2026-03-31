/**
 * E2E tests for Tone editor controls — verified via device readback.
 *
 * After changing a control value in the UI, these tests force a fresh
 * SysEx read of all tone data from the hardware (via the Library page's
 * "Refresh Device" button) and assert against the device's actual memory.
 * This is stronger than navigate-away-and-back, which may serve cached
 * data from the client or store.
 *
 * Pattern:
 *   1. Connect to device, navigate to Tones page
 *   2. Select a non-empty tone (one with wave data)
 *   3. Change a control value via the UI
 *   4. Wait for the buffered MIDI write to flush
 *   5. Invalidate caches, navigate to Library, click Refresh Device
 *   6. Read the fresh tone from __deviceDataStore
 *   7. Assert the device value matches what was set
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

/**
 * Drive a ParameterSlider to a target value using arrow keys.
 * Reads aria-valuenow to determine the current position, then presses
 * ArrowRight or ArrowLeft the appropriate number of times.
 */
async function driveSliderToValue(
  slider: import('@playwright/test').Locator,
  targetValue: number,
): Promise<void> {
  const currentValue = Number(
    await slider.getAttribute('aria-valuenow') ?? '64',
  );
  const diff = targetValue - currentValue;

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
}

// ===========================================================================
// Test Suite
// ===========================================================================

test.describe('Tone Editor Controls', () => {
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
  // Tone Name
  // -------------------------------------------------------------------------

  test('tone name edit syncs to device', async ({ page }) => {
    const nameInput = page.locator(
      '[data-testid="tone-detail"] input[type="text"][maxlength="8"]',
    );
    await expect(nameInput).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Clear and type new name, then blur to trigger onCommit
    await nameInput.fill('TESTTNE');
    await nameInput.blur();
    await page.waitForTimeout(WRITE_FLUSH_MS);

    // Read tone back from device hardware
    const deviceTone = await readToneFromDevice(page, testToneIndex);
    expect(deviceTone).not.toBeNull();
    expect(deviceTone!.name).toBe('TESTTNE');
  });

  // -------------------------------------------------------------------------
  // Loop Mode
  // -------------------------------------------------------------------------

  test('loop mode change syncs to device', async ({ page }) => {
    const loopModeSelect = page
      .locator('[data-testid="tone-detail"]')
      .locator('label:has-text("Loop Mode")')
      .locator('..')
      .locator('select');
    await expect(loopModeSelect).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const originalValue = await loopModeSelect.inputValue();

    // Toggle between 'alternating' and 'forward'
    const newValue = originalValue === 'alternating' ? 'forward' : 'alternating';
    await loopModeSelect.selectOption(newValue);
    await page.waitForTimeout(WRITE_FLUSH_MS);

    // Read tone back from device hardware
    const deviceTone = await readToneFromDevice(page, testToneIndex);
    expect(deviceTone).not.toBeNull();
    expect(deviceTone!.loopMode).toBe(newValue);
  });

  // -------------------------------------------------------------------------
  // TVF Cutoff
  // -------------------------------------------------------------------------

  test('TVF cutoff slider syncs to device', async ({ page }) => {
    // Ensure TVF is enabled
    const tvfCheckbox = page.locator('#tvfEnabled');
    await expect(tvfCheckbox).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const isEnabled = await tvfCheckbox.isChecked();
    if (!isEnabled) {
      await tvfCheckbox.click();
      await page.waitForTimeout(WRITE_FLUSH_MS);
    }

    // TVF Cutoff uses ParameterSlider with data-testid="param-cutoff"
    const cutoffContainer = page.locator('[data-testid="param-cutoff"]');
    await expect(cutoffContainer).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const slider = cutoffContainer.locator('[role="slider"]');
    await expect(slider).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const originalValue = Number(
      await slider.getAttribute('aria-valuenow') ?? '64',
    );

    // Set to 80 (unless already 80, then use 50)
    const newValue = originalValue === 80 ? 50 : 80;
    await driveSliderToValue(slider, newValue);
    await page.waitForTimeout(WRITE_FLUSH_MS);

    // Read tone back from device hardware
    const deviceTone = await readToneFromDevice(page, testToneIndex);
    expect(deviceTone).not.toBeNull();
    expect(deviceTone!.tvf.enabled).toBe(true);
    // Allow +-1 tolerance — Radix slider arrow keys may over/undershoot by 1
    expect(Math.abs(deviceTone!.tvf.cutoff - newValue)).toBeLessThanOrEqual(1);
  });

  // -------------------------------------------------------------------------
  // LFO Rate
  // -------------------------------------------------------------------------

  test('LFO rate slider syncs to device', async ({ page }) => {
    const rateContainer = page.locator('[data-testid="param-rate"]');
    await expect(rateContainer).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const slider = rateContainer.locator('[role="slider"]');
    await expect(slider).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const originalValue = Number(
      await slider.getAttribute('aria-valuenow') ?? '64',
    );

    // Set to 90 (unless already 90, then use 40)
    const newValue = originalValue === 90 ? 40 : 90;
    await driveSliderToValue(slider, newValue);
    await page.waitForTimeout(WRITE_FLUSH_MS);

    // Read tone back from device hardware
    const deviceTone = await readToneFromDevice(page, testToneIndex);
    expect(deviceTone).not.toBeNull();
    // Allow +-1 tolerance — Radix slider arrow keys may over/undershoot by 1
    expect(Math.abs(deviceTone!.lfo.rate - newValue)).toBeLessThanOrEqual(1);
  });

  // -------------------------------------------------------------------------
  // Original Key
  // -------------------------------------------------------------------------

  test('original key change syncs to device', async ({ page }) => {
    const keyInput = page.locator('[data-testid="tone-original-key"]');
    await expect(keyInput).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const originalValue = Number(await keyInput.inputValue());

    // Set to 72 (unless already 72, then use 48)
    const newValue = originalValue === 72 ? 48 : 72;
    await keyInput.fill(String(newValue));
    // The onChange handler commits immediately, but blur ensures focus leaves
    await keyInput.blur();
    await page.waitForTimeout(WRITE_FLUSH_MS);

    // Read tone back from device hardware
    const deviceTone = await readToneFromDevice(page, testToneIndex);
    expect(deviceTone).not.toBeNull();
    expect(deviceTone!.originalKey).toBe(newValue);
  });

  // -------------------------------------------------------------------------
  // Output Assign
  // -------------------------------------------------------------------------

  test('output assign change syncs to device', async ({ page }) => {
    const outputSelect = page.locator('[data-testid="tone-output"]');
    await expect(outputSelect).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const originalValue = await outputSelect.inputValue();

    // Toggle between '0' (Mix) and '1' (Out 1)
    const newValue = originalValue === '1' ? '0' : '1';
    await outputSelect.selectOption(newValue);
    await page.waitForTimeout(WRITE_FLUSH_MS);

    // Read tone back from device hardware
    const deviceTone = await readToneFromDevice(page, testToneIndex);
    expect(deviceTone).not.toBeNull();
    expect(deviceTone!.outputAssign).toBe(Number(newValue));
  });

  // -------------------------------------------------------------------------
  // TVF Enabled
  // -------------------------------------------------------------------------

  test('TVF enabled checkbox syncs to device', async ({ page }) => {
    const checkbox = page.locator('[data-testid="tone-tvf-enabled"]');
    await expect(checkbox).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const wasChecked = await checkbox.isChecked();

    // Toggle the checkbox
    await checkbox.click();
    await page.waitForTimeout(WRITE_FLUSH_MS);

    // Read tone back from device hardware
    const deviceTone = await readToneFromDevice(page, testToneIndex);
    expect(deviceTone).not.toBeNull();
    expect(deviceTone!.tvf.enabled).toBe(!wasChecked);
  });

  // -------------------------------------------------------------------------
  // TVA Level
  // -------------------------------------------------------------------------

  test('TVA level slider syncs to device', async ({ page }) => {
    // Scope to the TVA card section to avoid ambiguity with any other
    // "Level" slider on the page (e.g., patch level).
    const tvaSection = page.locator(
      '[data-testid="tone-detail"] .card:has(h4:has-text("TVA"))',
    );
    const levelContainer = tvaSection.locator('[data-testid="param-level"]');
    await expect(levelContainer).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const slider = levelContainer.locator('[role="slider"]');
    await expect(slider).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const originalValue = Number(
      await slider.getAttribute('aria-valuenow') ?? '100',
    );

    // Set to 95 (unless already 95, then use 70)
    const newValue = originalValue === 95 ? 70 : 95;
    await driveSliderToValue(slider, newValue);
    await page.waitForTimeout(WRITE_FLUSH_MS);

    // Read tone back from device hardware
    const deviceTone = await readToneFromDevice(page, testToneIndex);
    expect(deviceTone).not.toBeNull();
    // Allow +-1 tolerance — Radix slider arrow keys may over/undershoot by 1
    expect(Math.abs(deviceTone!.tva.level - newValue)).toBeLessThanOrEqual(1);
  });

  // -------------------------------------------------------------------------
  // Fine Tune
  // -------------------------------------------------------------------------

  test('fine tune slider syncs to device', async ({ page }) => {
    const fineTuneContainer = page.locator('[data-testid="param-fine-tune"]');
    await expect(fineTuneContainer).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const slider = fineTuneContainer.locator('[role="slider"]');
    await expect(slider).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // The slider displays values 0-127 (offset by +64 from the stored -64..+63)
    const originalSliderValue = Number(
      await slider.getAttribute('aria-valuenow') ?? '64',
    );

    // Set slider to 74 (stored value = 10), unless already 74, then use 54 (stored = -10)
    const newSliderValue = originalSliderValue === 74 ? 54 : 74;
    await driveSliderToValue(slider, newSliderValue);
    await page.waitForTimeout(WRITE_FLUSH_MS);

    // The stored fineTune = sliderValue - 64
    const expectedStoredValue = newSliderValue - 64;

    // Read tone back from device hardware
    const deviceTone = await readToneFromDevice(page, testToneIndex);
    expect(deviceTone).not.toBeNull();
    // Allow +-1 tolerance — Radix slider arrow keys may over/undershoot by 1
    expect(
      Math.abs(deviceTone!.fineTune - expectedStoredValue),
    ).toBeLessThanOrEqual(1);
  });
});
