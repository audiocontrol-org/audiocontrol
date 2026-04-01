/**
 * E2E tests for chopping device tones into drum kits.
 *
 * Tests the "Chop into Drum Kit" button on the Tones page, which
 * downloads wave data from a connected device, opens the sample chopper
 * dialog, and saves the result as a drum kit to the OPFS library.
 *
 * Prerequisites:
 *   - Roland S-330 or S-550 connected via MIDI
 *   - At least one tone with sample data loaded on the device
 *   - midi-server running (started by run script)
 *   - devenv shell active
 *
 * Run via: make test-e2e-roland-device ARGS="--grep 'Device Tone Chopper'"
 */

import { test, expect } from '@playwright/test';

// Deviation: Using relative imports because e2e/ is outside src/ and the @/
// path alias only applies to src/. This should not be copied to app code.
import {
  connectToDevice,
  waitForAppReady,
  getMidiStatus,
  connectToOPFS,
} from './helpers/connection-helper';
import {
  initializeCleanOPFS,
  cleanupOPFS,
  listDrumKitDirectories,
  readDrumKitYaml,
} from './helpers/library-opfs-helpers';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

test.setTimeout(120_000);

const MIDI_SERVER_PORT = process.env.E2E_MIDI_SERVER_PORT;
const DEVICE_TYPE = process.env.E2E_DEVICE_TYPE ?? 's330';
const EDITOR_BASE_PATH = `/roland/${DEVICE_TYPE}/editor`;
const LIBRARY_DEVICE = 's330';

const UI_TIMEOUT_MS = 5_000;
const DATA_LOAD_TIMEOUT_MS = 15_000;
/** Wave data download from device can take 10-60s depending on sample size. */
const WAVE_DOWNLOAD_TIMEOUT_MS = 60_000;

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
// Helpers
// ---------------------------------------------------------------------------

function attachConsoleDebugListener(
  page: import('@playwright/test').Page,
): void {
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));
  page.on('console', (msg) => {
    const text = msg.text();
    if (
      text.includes('Client') ||
      text.includes('error') ||
      msg.type() === 'error'
    ) {
      console.log(`BROWSER:`, text);
    }
  });
}

/**
 * Find the index of the first tone with sample data (wave.endPoint > 0).
 */
async function findFirstToneWithSampleData(
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
 * Select a tone by its index and wait for the editor to appear.
 */
async function selectTone(
  page: import('@playwright/test').Page,
  toneIndex: number,
): Promise<void> {
  const toneItem = page.locator(`[data-testid="tone-item-${toneIndex}"]`);
  await expect(toneItem).toBeVisible({ timeout: UI_TIMEOUT_MS });
  await toneItem.locator('button').first().click();

  const toneDetail = page.locator('[data-testid="tone-detail"]');
  await expect(toneDetail).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });
}

// ===========================================================================
// Test Suite
// ===========================================================================

test.describe('Device Tone Chopper', () => {
  let testToneIndex: number;

  test.beforeAll(async () => {
    if (!MIDI_SERVER_PORT) {
      throw new Error(
        'E2E_MIDI_SERVER_PORT must be set. Run via: make test-e2e-roland-device',
      );
    }
  });

  test.beforeEach(async ({ page }) => {
    attachConsoleDebugListener(page);

    // 1. Load app and connect to device
    await page.goto(buildUrl(), { timeout: UI_TIMEOUT_MS });
    await waitForAppReady(page);
    await connectToDevice(page);
    expect(await getMidiStatus(page)).toBe('connected');

    // 2. Navigate to Tones page
    const tonesLink = page.locator('a[href$="/tones"]');
    await tonesLink.click();
    await page.waitForURL('**/tones**');

    // Wait for tone items to render
    const toneItems = page.locator('[data-testid^="tone-item-"]');
    await expect(toneItems.first()).toBeVisible({
      timeout: DATA_LOAD_TIMEOUT_MS,
    });

    // 3. Find a tone with sample data
    const foundIndex = await findFirstToneWithSampleData(page);
    console.log(`Found tone with sample data at index: ${foundIndex}`);
    if (foundIndex === null) {
      test.skip(true, 'No tones with sample data found on device');
      return;
    }
    testToneIndex = foundIndex;
    await selectTone(page, testToneIndex);

    // 4. Initialize clean OPFS for drum kit output
    await initializeCleanOPFS(page, LIBRARY_DEVICE);
  });

  test.afterEach(async ({ page }) => {
    await cleanupOPFS(page);
  });

  test('Chop into Drum Kit opens chopper dialog with device tone audio', async ({ page }) => {
    // Click "Chop into Drum Kit" button
    const chopButton = page.locator('[data-testid="chop-tone-button"]');
    await expect(chopButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await chopButton.click();

    // Wait for wave data download and chopper dialog to open
    const dialog = page.locator('[data-slice-editor-open="true"]');
    await expect(dialog).toBeVisible({ timeout: WAVE_DOWNLOAD_TIMEOUT_MS });

    // Verify "Drum Kit Output" config section is rendered
    await expect(dialog.getByText('Drum Kit Output')).toBeVisible({
      timeout: UI_TIMEOUT_MS,
    });

    // Verify kit config fields are present
    await expect(dialog.getByText('Kit Name (max 12 chars)')).toBeVisible();
    await expect(dialog.getByText('Base MIDI Note')).toBeVisible();
  });

  test('chopping device tone and saving creates drum kit in OPFS', async ({ page }) => {
    // Connect to OPFS library
    await connectToOPFS(page);

    // Open chopper on the tone
    const chopButton = page.locator('[data-testid="chop-tone-button"]');
    await expect(chopButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await chopButton.click();

    const dialog = page.locator('[data-slice-editor-open="true"]');
    await expect(dialog).toBeVisible({ timeout: WAVE_DOWNLOAD_TIMEOUT_MS });

    // Switch to Fixed tab and set 4 slices
    await page.getByRole('tab', { name: 'Fixed' }).click();
    const sliceCountInput = dialog.locator('input[type="number"]').first();
    await expect(sliceCountInput).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await sliceCountInput.fill('4');

    // Wait for slices to be computed
    await expect(page.getByText('4 slices')).toBeVisible({
      timeout: UI_TIMEOUT_MS,
    });

    // Click "Create Drum Kit"
    const confirmButton = page.getByRole('button', { name: 'Create Drum Kit' });
    await expect(confirmButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await confirmButton.click();

    // Wait for save to complete
    await page.waitForTimeout(2_000);

    // Verify drum kit was created in OPFS
    const kitDirs = await listDrumKitDirectories(page, LIBRARY_DEVICE);
    expect(kitDirs.length).toBeGreaterThanOrEqual(1);

    // Read the first kit and verify it has the expected structure
    const kitName = kitDirs[0];
    const kitYaml = await readDrumKitYaml(page, LIBRARY_DEVICE, kitName);
    expect(kitYaml).not.toBeNull();
    expect(kitYaml).toContain('format: drum-kit-bundle');
    expect(kitYaml).toContain('version: 2');
    expect(kitYaml).toContain('slices:');
    expect(kitYaml).toContain('source: source.wav');
    console.log(`Drum kit "${kitName}" created in OPFS from device tone`);
  });
});
