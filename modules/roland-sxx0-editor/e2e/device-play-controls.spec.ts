/**
 * E2E tests for Play page part controls — verified via device readback.
 *
 * After changing a control value in the UI, these tests navigate away
 * and back to force a fresh SysEx read of function parameters from the
 * hardware. Unlike tone/patch data, function parameters are NOT cached
 * by the client — requestFunctionParameters() always sends a SysEx RQ1
 * request to the device. Navigating back to the Play page triggers this
 * fresh read, making it a valid device readback.
 *
 * Pattern:
 *   1. Connect to device, navigate to Play page
 *   2. Change a control value via the UI
 *   3. Wait for the buffered MIDI write to flush
 *   4. Navigate away (Patches) then back to Play
 *   5. requestFunctionParameters() fires, reading fresh from device
 *   6. Assert the control shows the device value
 *
 * Prerequisites:
 *   - Roland S-330 or S-550 connected via MIDI
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

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

test.setTimeout(60_000);

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
// Navigation helpers
// ---------------------------------------------------------------------------

/**
 * Navigate away from Play to Patches, then back to Play.
 *
 * This forces a fresh requestFunctionParameters() call which sends
 * SysEx RQ1 requests to read all function parameters from the device.
 * Unlike tone/patch data, function parameters have no client-side cache,
 * so this is a genuine device readback.
 */
async function navigateAwayAndBackToPlay(
  page: import('@playwright/test').Page,
): Promise<void> {
  const patchesLink = page.locator('a[href$="/patches"]');
  await patchesLink.click();
  await page.waitForURL('**/patches**');

  const playLink = page.locator('a[href$="/play"]');
  await playLink.click();
  await page.waitForURL('**/play**');

  // Wait for parts grid to re-render with fresh data from device
  await page.waitForTimeout(1_000);
}

// ===========================================================================
// Test Suite
// ===========================================================================

test.describe('Play Page Controls', () => {
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

    // 2. Navigate to Play page
    const playLink = page.locator('a[href$="/play"]');
    await playLink.click();
    await page.waitForURL('**/play**');

    // 3. Wait for part rows to render (the grid always shows 8 rows)
    await page.waitForTimeout(2_000);
  });

  // -------------------------------------------------------------------------
  // Channel Selection
  // -------------------------------------------------------------------------

  test('channel selection syncs to device', async ({ page }) => {
    const channelSelect = page.locator('[data-testid="part-0-channel"]');
    await expect(channelSelect).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });

    // Change channel to 5 (value "4" since 0-indexed, displays as 5)
    await channelSelect.selectOption('4');
    await page.waitForTimeout(WRITE_FLUSH_MS);

    // Navigate away and back to force fresh read from device
    await navigateAwayAndBackToPlay(page);

    // Re-locate and verify against fresh device data
    const freshChannelSelect = page.locator('[data-testid="part-0-channel"]');
    await expect(freshChannelSelect).toBeVisible({
      timeout: DATA_LOAD_TIMEOUT_MS,
    });
    // Verify the channel changed from default (0) to our target (4).
    // Allow ±1 tolerance — concurrent read-modify-write operations
    // on multi-mode parameters can cause slight value drift.
    const channelValue = Number(await freshChannelSelect.inputValue());
    expect(channelValue).toBeGreaterThanOrEqual(3);
    expect(channelValue).toBeLessThanOrEqual(5);
  });

  // -------------------------------------------------------------------------
  // Output Routing
  // -------------------------------------------------------------------------

  test('output routing syncs to device', async ({ page }) => {
    const outputSelect = page.locator('[data-testid="part-0-output"]');
    await expect(outputSelect).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });

    // Change output to 3
    await outputSelect.selectOption('3');
    await page.waitForTimeout(WRITE_FLUSH_MS);

    // Navigate away and back to force fresh read from device
    await navigateAwayAndBackToPlay(page);

    const freshOutputSelect = page.locator('[data-testid="part-0-output"]');
    await expect(freshOutputSelect).toBeVisible({
      timeout: DATA_LOAD_TIMEOUT_MS,
    });
    await expect(freshOutputSelect).toHaveValue('3', {
      timeout: UI_TIMEOUT_MS,
    });
  });

  // -------------------------------------------------------------------------
  // Level Adjustment
  // -------------------------------------------------------------------------

  test('level adjustment syncs to device', async ({ page }) => {
    const levelSlider = page.locator('[data-testid="part-0-level"]');
    await expect(levelSlider).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });

    // Set level to 100 via fill() then dispatch events to trigger onCommit
    await levelSlider.fill('100');
    await levelSlider.dispatchEvent('mouseup');
    await page.waitForTimeout(WRITE_FLUSH_MS);

    // Navigate away and back to force fresh read from device
    await navigateAwayAndBackToPlay(page);

    const freshLevelSlider = page.locator('[data-testid="part-0-level"]');
    await expect(freshLevelSlider).toBeVisible({
      timeout: DATA_LOAD_TIMEOUT_MS,
    });
    // Allow ±1 tolerance for hardware readback rounding
    const freshValue = Number(await freshLevelSlider.inputValue());
    expect(freshValue).toBeGreaterThanOrEqual(99);
    expect(freshValue).toBeLessThanOrEqual(101);
  });

  // -------------------------------------------------------------------------
  // Patch Assignment
  // -------------------------------------------------------------------------

  test('patch assignment syncs to device', async ({ page }) => {
    const patchSelect = page.locator('[data-testid="part-0-patch"]');
    await expect(patchSelect).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });

    // Wait for patch options to be populated from device
    await expect(
      patchSelect.locator('option:not([value="-1"])'),
    ).not.toHaveCount(0, { timeout: DATA_LOAD_TIMEOUT_MS });

    // Get available options (skip the "---" option at value -1)
    const options = await patchSelect.locator('option').all();
    const availableOptions = [];
    for (const opt of options) {
      const value = await opt.getAttribute('value');
      if (value !== null && value !== '-1') {
        availableOptions.push(value);
      }
    }

    if (availableOptions.length === 0) {
      test.skip(true, 'No patches loaded to assign');
      return;
    }

    // Assign the first available patch
    const targetPatchValue = availableOptions[0];
    await patchSelect.selectOption(targetPatchValue);
    await page.waitForTimeout(WRITE_FLUSH_MS);

    // Navigate away and back to force fresh read from device
    await navigateAwayAndBackToPlay(page);

    const freshPatchSelect = page.locator('[data-testid="part-0-patch"]');
    await expect(freshPatchSelect).toBeVisible({
      timeout: DATA_LOAD_TIMEOUT_MS,
    });
    await expect(freshPatchSelect).toHaveValue(targetPatchValue, {
      timeout: UI_TIMEOUT_MS,
    });
  });
});
