/**
 * E2E tests for Play page part controls.
 *
 * Verifies that changes made via the Play page UI are persisted on the
 * device by navigating away and back to force a fresh load of function
 * parameters.
 *
 * Pattern:
 *   1. Connect to device, navigate to Play page
 *   2. Change a control value via the UI
 *   3. Navigate to a different page (flushes pending writes)
 *   4. Navigate back to Play page (triggers fresh load)
 *   5. Assert the control shows the new value
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
 * Navigate away from the current page to Patches, then back to Play.
 * This forces the app to re-request function parameters from the device.
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

  // Wait for parts grid to re-render with fresh data
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
    // Part A (index 0) channel select is the first select in the first part row.
    // The grid has columns: label, VAL, CH, Patch, Out, Level.
    // Each part row has 3 select elements: channel, patch, output.
    // Part A's channel select is the 1st select in the 1st row.

    // Locate all part rows via the grid structure
    const partRows = page.locator(
      '.grid.grid-cols-12.gap-2.py-1\\.5',
    );
    await expect(partRows.first()).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });

    // Part A (first row) has 3 selects: channel, patch, output
    const partASelects = partRows.first().locator('select');

    // Channel is the first select (col-span-1 text-center)
    const channelSelect = partASelects.nth(0);
    await expect(channelSelect).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Change channel to 5 (value "4" since 0-indexed, displays as 5)
    await channelSelect.selectOption('4');

    // Wait briefly for MIDI write to complete
    await page.waitForTimeout(500);

    // Navigate away and back to force fresh read
    await navigateAwayAndBackToPlay(page);

    // Re-locate and verify
    const freshPartRows = page.locator(
      '.grid.grid-cols-12.gap-2.py-1\\.5',
    );
    await expect(freshPartRows.first()).toBeVisible({
      timeout: DATA_LOAD_TIMEOUT_MS,
    });
    const freshChannelSelect = freshPartRows.first().locator('select').nth(0);
    await expect(freshChannelSelect).toHaveValue('4', {
      timeout: UI_TIMEOUT_MS,
    });
  });

  // -------------------------------------------------------------------------
  // Output Routing
  // -------------------------------------------------------------------------

  test('output routing syncs to device', async ({ page }) => {
    const partRows = page.locator(
      '.grid.grid-cols-12.gap-2.py-1\\.5',
    );
    await expect(partRows.first()).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });

    // Output is the 3rd select in each part row
    const outputSelect = partRows.first().locator('select').nth(2);
    await expect(outputSelect).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Change output to 3
    await outputSelect.selectOption('3');

    await page.waitForTimeout(500);

    await navigateAwayAndBackToPlay(page);

    const freshPartRows = page.locator(
      '.grid.grid-cols-12.gap-2.py-1\\.5',
    );
    await expect(freshPartRows.first()).toBeVisible({
      timeout: DATA_LOAD_TIMEOUT_MS,
    });
    const freshOutputSelect = freshPartRows.first().locator('select').nth(2);
    await expect(freshOutputSelect).toHaveValue('3', {
      timeout: UI_TIMEOUT_MS,
    });
  });

  // -------------------------------------------------------------------------
  // Level Adjustment
  // -------------------------------------------------------------------------

  test('level adjustment syncs to device', async ({ page }) => {
    const partRows = page.locator(
      '.grid.grid-cols-12.gap-2.py-1\\.5',
    );
    await expect(partRows.first()).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });

    // Level slider is the input[type="range"] in each part row
    const levelSlider = partRows.first().locator('input[type="range"]');
    await expect(levelSlider).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Set level to 100 via fill() then dispatch events to trigger onCommit
    await levelSlider.fill('100');
    await levelSlider.dispatchEvent('mouseup');

    await page.waitForTimeout(500);

    await navigateAwayAndBackToPlay(page);

    const freshPartRows = page.locator(
      '.grid.grid-cols-12.gap-2.py-1\\.5',
    );
    await expect(freshPartRows.first()).toBeVisible({
      timeout: DATA_LOAD_TIMEOUT_MS,
    });
    const freshLevelSlider = freshPartRows.first().locator('input[type="range"]');
    await expect(freshLevelSlider).toHaveValue('100', {
      timeout: UI_TIMEOUT_MS,
    });
  });

  // -------------------------------------------------------------------------
  // Patch Assignment
  // -------------------------------------------------------------------------

  test('patch assignment syncs to device', async ({ page }) => {
    const partRows = page.locator(
      '.grid.grid-cols-12.gap-2.py-1\\.5',
    );
    await expect(partRows.first()).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });

    // Patch is the 2nd select in each part row
    const patchSelect = partRows.first().locator('select').nth(1);
    await expect(patchSelect).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Get available options (skip the first "---" option at value -1)
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

    await page.waitForTimeout(500);

    await navigateAwayAndBackToPlay(page);

    const freshPartRows = page.locator(
      '.grid.grid-cols-12.gap-2.py-1\\.5',
    );
    await expect(freshPartRows.first()).toBeVisible({
      timeout: DATA_LOAD_TIMEOUT_MS,
    });
    const freshPatchSelect = freshPartRows.first().locator('select').nth(1);
    await expect(freshPatchSelect).toHaveValue(targetPatchValue, {
      timeout: UI_TIMEOUT_MS,
    });
  });
});
