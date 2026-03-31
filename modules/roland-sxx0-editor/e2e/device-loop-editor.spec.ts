/**
 * E2E tests for the Loop Editor on the Tones page — verified via device readback.
 *
 * After loading wave data from the device and changing loop/end points in
 * the visual loop editor, these tests force a fresh SysEx read from hardware
 * (via the Library page's "Refresh Device" button) and assert that the
 * device's actual memory matches what was set in the UI.
 *
 * The loop editor's playback mode buttons (no-loop / loop / smoothed-loop)
 * are preview-only — they control local audio playback and do NOT write the
 * device's loopMode field. Device loop mode is set via the tone editor's
 * Loop Mode dropdown (tested in device-tone-controls.spec.ts).
 *
 * Pattern:
 *   1. Connect to device, navigate to Tones page
 *   2. Select a non-empty tone (one with wave data)
 *   3. Click "Load Wave Data" to fetch samples via MIDI and render the loop editor
 *   4. Change a loop/end point value via the loop editor inputs
 *   5. Wait for the buffered MIDI write to flush
 *   6. Invalidate caches, navigate to Library, click Refresh Device
 *   7. Read the fresh tone from __deviceDataStore
 *   8. Assert the device value matches what was set
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
const WRITE_FLUSH_MS = 2_500;

/** Timeout for wave data loading from device via MIDI (slow operation). */
const WAVE_LOAD_TIMEOUT_MS = 60_000;

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
 * Click "Load Wave Data" and wait for the loop editor to render.
 *
 * The wave data fetch is a slow MIDI operation that transfers sample data
 * from the device. We poll for the loop-point-input to appear rather than
 * using waitForFunction, so each poll generates a Playwright step event
 * for the heartbeat reporter.
 */
async function loadWaveDataAndWaitForLoopEditor(
  page: import('@playwright/test').Page,
): Promise<void> {
  // Check if loop editor is already visible (wave data cached from prior test)
  const loopInput = page.getByTestId('loop-point-input');
  if (await loopInput.isVisible().catch(() => false)) {
    console.log('Loop editor already visible (wave data cached)');
    return;
  }

  // Click "Load Wave Data" button to fetch from device
  const loadButton = page.getByRole('button', { name: 'Load Wave Data' });
  await expect(loadButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
  await loadButton.click();

  // Wait for loop editor to render — use polling for heartbeat safety
  // (wave data fetch over MIDI is slow and generates console output)
  const POLL_MS = 2_000;
  const MAX_POLLS = WAVE_LOAD_TIMEOUT_MS / POLL_MS;
  for (let i = 0; i < MAX_POLLS; i++) {
    await page.waitForTimeout(POLL_MS);
    if (await loopInput.isVisible().catch(() => false)) return;
    if (i % 5 === 0 && i > 0) console.log(`  Waiting for wave data... (${i * POLL_MS / 1000}s)`);
  }
  // Final check with proper assertion for error message
  await expect(loopInput).toBeVisible({ timeout: 1000 });
}

// ===========================================================================
// Test Suite
// ===========================================================================

test.describe('Loop Editor — Hardware Sync', () => {
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

    // 4. Load wave data to render the loop editor
    await loadWaveDataAndWaitForLoopEditor(page);
    console.log('Wave data loaded, loop editor visible');
  });

  // -------------------------------------------------------------------------
  // Loop Editor Renders
  // -------------------------------------------------------------------------

  test('loop editor renders after loading wave data', async ({ page }) => {
    // Verify loop editor controls are present
    await expect(page.getByTestId('loop-point-input')).toBeVisible();
    await expect(page.getByTestId('end-point-input')).toBeVisible();

    // Verify playback mode buttons are visible (preview-only controls)
    await expect(page.getByTestId('playback-mode-no-loop')).toBeVisible();
    await expect(page.getByTestId('playback-mode-loop')).toBeVisible();
    await expect(page.getByTestId('playback-mode-smoothed-loop')).toBeVisible();

    // Verify loop point has a numeric value (proves wave data loaded)
    const loopPointValue = await page.getByTestId('loop-point-input').inputValue();
    expect(Number(loopPointValue)).toBeGreaterThanOrEqual(0);

    const endPointValue = await page.getByTestId('end-point-input').inputValue();
    expect(Number(endPointValue)).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Loop Point Change Syncs to Device
  // -------------------------------------------------------------------------

  test('loop point change syncs to device', async ({ page }) => {
    const loopPointInput = page.getByTestId('loop-point-input');
    const endPointInput = page.getByTestId('end-point-input');

    // Read current values from the UI
    const currentLoopPoint = Number(await loopPointInput.inputValue());
    const currentEndPoint = Number(await endPointInput.inputValue());
    console.log(
      `Current loop point: ${currentLoopPoint}, end point: ${currentEndPoint}`,
    );

    // Calculate a new loop point: move 100 samples forward (or backward
    // if that would exceed the end point). Stay within valid range.
    const newLoopPoint =
      currentLoopPoint + 100 < currentEndPoint
        ? currentLoopPoint + 100
        : Math.max(0, currentLoopPoint - 100);

    console.log(`Setting loop point to: ${newLoopPoint}`);

    // Clear, type new value, and blur to trigger onCommit
    await loopPointInput.fill(String(newLoopPoint));
    await loopPointInput.blur();
    await page.waitForTimeout(WRITE_FLUSH_MS);

    // Read tone back from device hardware
    const deviceTone = await readToneFromDevice(page, testToneIndex);
    expect(deviceTone).not.toBeNull();
    console.log(`Device readback loop point: ${deviceTone!.wave.loopPoint}`);

    // Allow +/-1 tolerance for rounding
    expect(
      Math.abs(deviceTone!.wave.loopPoint - newLoopPoint),
    ).toBeLessThanOrEqual(1);
  });

  // -------------------------------------------------------------------------
  // End Point Change Syncs to Device
  // -------------------------------------------------------------------------

  test('end point change syncs to device', async ({ page }) => {
    const loopPointInput = page.getByTestId('loop-point-input');
    const endPointInput = page.getByTestId('end-point-input');

    // Read current values from the UI
    const currentLoopPoint = Number(await loopPointInput.inputValue());
    const currentEndPoint = Number(await endPointInput.inputValue());
    console.log(
      `Current loop point: ${currentLoopPoint}, end point: ${currentEndPoint}`,
    );

    // Calculate a new end point: move 100 samples backward (or forward if
    // that would go below the loop point). End point must be >= loopPoint
    // and >= 4 (minimum enforced by the UI).
    const newEndPoint =
      currentEndPoint - 100 > currentLoopPoint
        ? currentEndPoint - 100
        : currentEndPoint + 100;

    console.log(`Setting end point to: ${newEndPoint}`);

    // Clear, type new value, and blur to trigger onCommit
    await endPointInput.fill(String(newEndPoint));
    await endPointInput.blur();
    await page.waitForTimeout(WRITE_FLUSH_MS);

    // Read tone back from device hardware
    const deviceTone = await readToneFromDevice(page, testToneIndex);
    expect(deviceTone).not.toBeNull();
    console.log(`Device readback end point: ${deviceTone!.wave.endPoint}`);

    // Allow +/-1 tolerance for rounding
    expect(
      Math.abs(deviceTone!.wave.endPoint - newEndPoint),
    ).toBeLessThanOrEqual(1);
  });
});
