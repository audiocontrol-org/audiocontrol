/**
 * E2E tests for Tone envelope editor controls — verified via device readback.
 *
 * Tests TVA and TVF 8-point envelope parameters: rate/level table inputs
 * and sustain/end point dropdowns. After changing a control value in the UI,
 * these tests force a fresh SysEx read of all tone data from the hardware
 * and assert against the device's actual memory.
 *
 * Pattern:
 *   1. Connect to device, navigate to Tones page
 *   2. Select a non-empty tone (one with wave data)
 *   3. Change an envelope control value via the UI
 *   4. Wait for the buffered MIDI write to flush
 *   5. Invalidate caches, navigate to Library, click Refresh Device
 *   6. Read the fresh tone from __deviceDataStore
 *   7. Assert the device envelope value matches what was set
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

// ===========================================================================
// Test Suite
// ===========================================================================

test.describe('Tone Envelope Controls', () => {
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
  // TVA Envelope Rate Edit
  // -------------------------------------------------------------------------

  test('TVA envelope rate edit syncs to device', async ({ page }) => {
    // Scope to the TVA card section
    const tvaSection = page.locator(
      '[data-testid="tone-detail"] .card:has(h4:has-text("TVA"))',
    );
    await expect(tvaSection).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // The envelope table has two data rows: Rate (first) and Level (second).
    // Each row has 8 number inputs for the 8 envelope points.
    const rateInputs = tvaSection.locator(
      'table tbody tr:first-child input[type="number"]',
    );
    const firstRateInput = rateInputs.first();
    await expect(firstRateInput).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const originalRate = Number(await firstRateInput.inputValue());
    // Toggle between two values; rate range is 1-127
    const newRate = originalRate === 50 ? 80 : 50;
    console.log(`TVA rate: original=${originalRate}, setting to=${newRate}`);

    await firstRateInput.click();
    await firstRateInput.press('Control+a');
    await firstRateInput.type(String(newRate));
    // onChange fires on fill and calls onCommit immediately
    await firstRateInput.blur();
    await page.waitForTimeout(WRITE_FLUSH_MS);

    // Read tone back from device hardware
    const deviceTone = await readToneFromDevice(page, testToneIndex);
    expect(deviceTone).not.toBeNull();
    console.log(`TVA envelope rates from device: ${JSON.stringify(deviceTone!.tva.envelope.rates)}`);
    console.log(`TVA envelope levels from device: ${JSON.stringify(deviceTone!.tva.envelope.levels)}`);
    // Check envelope rate at point 0 with +-1 tolerance
    expect(
      Math.abs(deviceTone!.tva.envelope.rates[0] - newRate),
    ).toBeLessThanOrEqual(1);
  });

  // -------------------------------------------------------------------------
  // TVA Envelope Sustain Point
  // -------------------------------------------------------------------------

  test('TVA envelope sustain point syncs to device', async ({ page }) => {
    const tvaSection = page.locator(
      '[data-testid="tone-detail"] .card:has(h4:has-text("TVA"))',
    );
    await expect(tvaSection).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // The sustain point select is labeled "Sustain Point" inside the TVA card.
    // There may be duplicate selects (normal + expanded view), so take the
    // first visible one in the normal (non-overlay) view.
    const sustainSelect = tvaSection
      .locator('label:has-text("Sustain Point")')
      .locator('..')
      .locator('select')
      .first();
    await expect(sustainSelect).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const originalValue = Number(await sustainSelect.inputValue());
    // Toggle between 0 and 2 (display labels "1" and "3")
    const newValue = originalValue === 2 ? 0 : 2;

    await sustainSelect.selectOption(String(newValue));
    await page.waitForTimeout(WRITE_FLUSH_MS);

    // Read tone back from device hardware
    const deviceTone = await readToneFromDevice(page, testToneIndex);
    expect(deviceTone).not.toBeNull();
    expect(deviceTone!.tva.envelope.sustainPoint).toBe(newValue);
  });

  // -------------------------------------------------------------------------
  // TVF Envelope Rate Edit
  // -------------------------------------------------------------------------

  test('TVF envelope rate edit syncs to device', async ({ page }) => {
    // Ensure TVF is enabled so envelope inputs are interactive
    const tvfCheckbox = page.locator('[data-testid="tone-tvf-enabled"]');
    await expect(tvfCheckbox).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const isEnabled = await tvfCheckbox.isChecked();
    if (!isEnabled) {
      await tvfCheckbox.click();
      await page.waitForTimeout(WRITE_FLUSH_MS);
    }

    // Scope to the TVF card section
    const tvfSection = page.locator(
      '[data-testid="tone-detail"] .card:has(h4:has-text("TVF"))',
    );
    await expect(tvfSection).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Rate inputs are in the first data row of the envelope table
    const rateInputs = tvfSection.locator(
      'table tbody tr:first-child input[type="number"]',
    );
    const firstRateInput = rateInputs.first();
    await expect(firstRateInput).toBeVisible({ timeout: UI_TIMEOUT_MS });
    // Inputs should be enabled now that TVF is on
    await expect(firstRateInput).toBeEnabled();

    const originalRate = Number(await firstRateInput.inputValue());
    const newRate = originalRate === 60 ? 90 : 60;

    await firstRateInput.fill(String(newRate));
    await firstRateInput.blur();
    await page.waitForTimeout(WRITE_FLUSH_MS);

    // Read tone back from device hardware
    const deviceTone = await readToneFromDevice(page, testToneIndex);
    expect(deviceTone).not.toBeNull();
    expect(deviceTone!.tvf.enabled).toBe(true);
    // Check envelope rate at point 0 with +-1 tolerance
    expect(
      Math.abs(deviceTone!.tvf.envelope.rates[0] - newRate),
    ).toBeLessThanOrEqual(1);
  });

  // -------------------------------------------------------------------------
  // TVF Envelope Sustain Point
  // -------------------------------------------------------------------------

  test('TVF envelope sustain point syncs to device', async ({ page }) => {
    // Ensure TVF is enabled so envelope controls are interactive
    const tvfCheckbox = page.locator('[data-testid="tone-tvf-enabled"]');
    await expect(tvfCheckbox).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const isEnabled = await tvfCheckbox.isChecked();
    if (!isEnabled) {
      await tvfCheckbox.click();
      await page.waitForTimeout(WRITE_FLUSH_MS);
    }

    const tvfSection = page.locator(
      '[data-testid="tone-detail"] .card:has(h4:has-text("TVF"))',
    );
    await expect(tvfSection).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // The sustain point select is labeled "Sustain Point" inside the TVF card
    const sustainSelect = tvfSection
      .locator('label:has-text("Sustain Point")')
      .locator('..')
      .locator('select')
      .first();
    await expect(sustainSelect).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await expect(sustainSelect).toBeEnabled();

    const originalValue = Number(await sustainSelect.inputValue());
    // Toggle between 0 and 2 (display labels "1" and "3")
    const newValue = originalValue === 2 ? 0 : 2;

    await sustainSelect.selectOption(String(newValue));
    await page.waitForTimeout(WRITE_FLUSH_MS);

    // Read tone back from device hardware
    const deviceTone = await readToneFromDevice(page, testToneIndex);
    expect(deviceTone).not.toBeNull();
    expect(deviceTone!.tvf.enabled).toBe(true);
    expect(deviceTone!.tvf.envelope.sustainPoint).toBe(newValue);
  });
});
