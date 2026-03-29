/**
 * E2E tests for importing tones and patches from library to device.
 *
 * These tests verify the workflow of:
 * 1. Pre-populating the OPFS library with test fixtures
 * 2. Connecting to a Roland S-series device via HTTP MIDI
 * 3. Selecting items in the library
 * 4. Importing them to specific device slots
 *
 * Prerequisites:
 *   - Roland S-330 or S-550 connected via MIDI
 *   - midi-server running (started by run-http-midi-e2e.sh)
 *
 * Run via: ./scripts/run-http-midi-e2e.sh device-library-import.spec.ts
 */

import { test, expect, type Page } from '@playwright/test';

// Short timeouts - fail fast for hardware tests
test.setTimeout(15_000);

// Environment variables set by run-http-midi-e2e.sh
const MIDI_SERVER_PORT = process.env.E2E_MIDI_SERVER_PORT;
const MIDI_INPUT_PORT = process.env.E2E_MIDI_INPUT_PORT;
const MIDI_OUTPUT_PORT = process.env.E2E_MIDI_OUTPUT_PORT;

// Default to S-330 for tests (can be overridden via E2E_DEVICE_TYPE)
const DEVICE_TYPE = process.env.E2E_DEVICE_TYPE ?? 's330';
const EDITOR_BASE_PATH = `/roland/${DEVICE_TYPE}/editor`;

// Timeouts for various operations
const UI_TIMEOUT_MS = 5000;
const CONNECTION_TIMEOUT_MS = 10000;
const IMPORT_TIMEOUT_MS = 10000;

// Test fixture content - based on e2e/fixtures/tones/basic-sine.yaml
const BASIC_TONE_YAML = `format: sampler-tone
device: s330
version: 1
name: E2E Test Tone
wave:
  file: test-sine.wav
  sampleRate: 30000
  loopMode: forward
  startPoint: 0
  endPoint: 1000
  loopPoint: 0
s330:
  originalKey: 60
  outputAssign: 0
  transpose: 0
  fineTune: 0
  lfo:
    rate: 0
    sync: false
    delay: 0
    mode: normal
    polarity: false
    offset: 64
  tvf:
    cutoff: 127
    resonance: 0
    keyFollow: 64
    lfoDepth: 0
    egDepth: 0
    egPolarity: normal
    levelCurve: 0
    keyRateFollow: 64
    velRateFollow: 64
    enabled: false
    envelope:
      levels: [127, 127, 127, 127, 127, 127, 127, 0]
      rates: [127, 127, 127, 127, 127, 127, 127, 127]
      sustainPoint: 3
      endPoint: 8
  tva:
    level: 100
    lfoDepth: 0
    keyRate: 64
    velRate: 64
    levelCurve: 0
    envelope:
      levels: [127, 127, 127, 127, 127, 127, 127, 0]
      rates: [127, 127, 127, 127, 127, 127, 127, 127]
      sustainPoint: 3
      endPoint: 8
  benderEnabled: true
  aftertouchEnabled: true
  pitchFollow: true
`;

// Test fixture content - based on e2e/fixtures/patches/basic-patch.yaml
const BASIC_PATCH_YAML = `format: sampler-patch
device: s330
version: 1
name: E2E Test Patch
level: 100
keyGroups:
  - name: E2E Test Tone
    tone: e2e-test-tone
    keyRange: [0, 127]
    velocityRange: [1, 127]
    level: 100
    pan: center
s330:
  benderRange: 2
  aftertouchSens: 64
  keyMode: normal
  velocityThreshold: 64
  octaveShift: 0
  detune: 0
  velocityMixRatio: 64
  aftertouchAssign: modulation
  keyAssign: rotary
  outputAssign: 0
`;

/**
 * OPFS helper functions to be evaluated in browser context.
 * These are inlined because page.evaluate cannot import modules.
 */
const OPFS_HELPERS = `
  async function getOPFSRoot() {
    return await navigator.storage.getDirectory();
  }

  async function deleteDirectoryContents(dirHandle) {
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'directory') {
        const subDir = await dirHandle.getDirectoryHandle(entry.name);
        await deleteDirectoryContents(subDir);
      }
      await dirHandle.removeEntry(entry.name, { recursive: true });
    }
  }

  async function cleanupOPFS() {
    const root = await getOPFSRoot();
    await deleteDirectoryContents(root);
    return { success: true };
  }

  async function writeFile(pathSegments, fileName, content) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment, { create: true });
    }
    const fileHandle = await current.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    return { success: true };
  }

  async function directoryExists(pathSegments) {
    const root = await getOPFSRoot();
    let current = root;
    try {
      for (const segment of pathSegments) {
        current = await current.getDirectoryHandle(segment);
      }
      return true;
    } catch {
      return false;
    }
  }

  async function listDirectory(pathSegments) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment);
    }
    const entries = [];
    for await (const entry of current.values()) {
      entries.push({ name: entry.name, kind: entry.kind });
    }
    return { success: true, entries };
  }
`;

/**
 * Build URL with HTTP MIDI parameters if configured.
 */
function buildUrl(subpath: string = ''): string {
  const normalized = subpath === '/' ? '' : subpath;
  const fullPath = normalized ? `${EDITOR_BASE_PATH}/${normalized}` : EDITOR_BASE_PATH;
  if (!MIDI_SERVER_PORT) return fullPath;
  const separator = fullPath.includes('?') ? '&' : '?';
  return `${fullPath}${separator}midi=http&midiServerPort=${MIDI_SERVER_PORT}`;
}

/**
 * Wait for the app to be ready (MIDI store initialized)
 */
async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => (window as unknown as Record<string, unknown>).__midiStore !== undefined,
    { timeout: UI_TIMEOUT_MS }
  );
}

/**
 * Get MIDI connection status from the app's store
 */
async function getMidiStatus(page: Page): Promise<string> {
  return page.evaluate(() => {
    const store = (window as unknown as Record<string, unknown>).__midiStore as {
      getState: () => { status: string };
    };
    return store.getState().status;
  });
}

/**
 * Connect to device via the app's UI.
 */
async function connectToDevice(page: Page): Promise<void> {
  const inputSelect = page.locator('[data-testid="midi-input-select"]');
  await inputSelect.waitFor({ state: 'visible', timeout: UI_TIMEOUT_MS });

  await page.waitForFunction(
    () => {
      const select = document.querySelector('[data-testid="midi-input-select"]') as HTMLSelectElement;
      return select && select.options.length > 1;
    },
    { timeout: UI_TIMEOUT_MS }
  );

  // Select input port
  if (MIDI_INPUT_PORT) {
    const options = await inputSelect.locator('option').all();
    for (const option of options) {
      const text = await option.textContent();
      if (text?.includes(MIDI_INPUT_PORT)) {
        const value = await option.getAttribute('value');
        if (value) {
          await inputSelect.selectOption(value);
          break;
        }
      }
    }
  } else {
    const inputOptions = await inputSelect.locator('option:not([value=""])').all();
    if (inputOptions.length > 0) {
      const value = await inputOptions[0].getAttribute('value');
      if (value) await inputSelect.selectOption(value);
    }
  }

  // Select output port
  const outputSelect = page.locator('[data-testid="midi-output-select"]');
  if (MIDI_OUTPUT_PORT) {
    const options = await outputSelect.locator('option').all();
    for (const option of options) {
      const text = await option.textContent();
      if (text?.includes(MIDI_OUTPUT_PORT)) {
        const value = await option.getAttribute('value');
        if (value) {
          await outputSelect.selectOption(value);
          break;
        }
      }
    }
  } else {
    const outputOptions = await outputSelect.locator('option:not([value=""])').all();
    if (outputOptions.length > 0) {
      const value = await outputOptions[0].getAttribute('value');
      if (value) await outputSelect.selectOption(value);
    }
  }

  // Click connect button
  const connectButton = page.locator('[data-testid="connect-button"]');
  await connectButton.click();

  // Wait for connection
  await page.waitForFunction(
    () => {
      const store = (window as unknown as Record<string, unknown>).__midiStore as {
        getState: () => { status: string };
      } | undefined;
      return store?.getState().status === 'connected';
    },
    { timeout: CONNECTION_TIMEOUT_MS }
  );
}

/**
 * Set up the test library with fixture data in OPFS.
 */
async function setupTestLibrary(page: Page): Promise<void> {
  await page.evaluate(`
    ${OPFS_HELPERS}
    (async () => {
      // Clean up any existing data
      await cleanupOPFS();

      // Create library structure
      const root = await getOPFSRoot();
      const library = await root.getDirectoryHandle('library', { create: true });
      await library.getDirectoryHandle('tones', { create: true });
      await library.getDirectoryHandle('patches', { create: true });
      await library.getDirectoryHandle('sets', { create: true });
    })();
  `);

  // Write test tone fixture
  await page.evaluate(`
    ${OPFS_HELPERS}
    (async () => {
      await writeFile(
        ['library', 'tones'],
        'e2e-test-tone.yaml',
        ${JSON.stringify(BASIC_TONE_YAML)}
      );
    })();
  `);

  // Write test patch fixture
  await page.evaluate(`
    ${OPFS_HELPERS}
    (async () => {
      await writeFile(
        ['library', 'patches'],
        'e2e-test-patch.yaml',
        ${JSON.stringify(BASIC_PATCH_YAML)}
      );
    })();
  `);
}

/**
 * Clean up OPFS after tests.
 */
async function cleanupTestLibrary(page: Page): Promise<void> {
  await page.evaluate(`
    ${OPFS_HELPERS}
    (async () => {
      await cleanupOPFS();
    })();
  `);
}

// =============================================================================
// Test Suite: Import Tone from Library to Device
// =============================================================================

test.describe('Import Tone from Library to Device', () => {
  test.beforeAll(async () => {
    // Fail fast if MIDI server is not configured
    if (!MIDI_SERVER_PORT) {
      throw new Error(
        'E2E_MIDI_SERVER_PORT must be set. Run via: ./scripts/run-http-midi-e2e.sh'
      );
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(buildUrl(), { timeout: UI_TIMEOUT_MS });
    await waitForAppReady(page);
    await setupTestLibrary(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanupTestLibrary(page);
  });

  test('can import tone from library to device', async ({ page }) => {
    // Connect to device first
    await connectToDevice(page);
    expect(await getMidiStatus(page)).toBe('connected');

    // Navigate to library page
    const libraryLink = page.locator('[data-testid="library-nav-link"]');
    await expect(libraryLink).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await libraryLink.click();
    await page.waitForURL('**/library**');

    // Wait for library to load and show tones
    const tonesList = page.locator('[data-testid="library-tones-list"]');
    await expect(tonesList).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Select the test tone in the library
    const testTone = page.locator('[data-testid="library-tone-e2e-test-tone"]');
    await expect(testTone).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await testTone.click();

    // Click import button
    const importButton = page.locator('[data-testid="import-to-device-button"]');
    await expect(importButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await importButton.click();

    // Select target slot (slot 0)
    const slotSelector = page.locator('[data-testid="target-slot-select"]');
    await expect(slotSelector).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await slotSelector.selectOption('0');

    // Confirm import
    const confirmButton = page.locator('[data-testid="confirm-import-button"]');
    await expect(confirmButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await confirmButton.click();

    // Wait for import to complete
    const successIndicator = page.locator('[data-testid="import-success"]');
    await expect(successIndicator).toBeVisible({ timeout: IMPORT_TIMEOUT_MS });

    // Verify tone appears on device by navigating to device tones
    const deviceTonesLink = page.locator('[data-testid="device-tones-nav-link"]');
    await expect(deviceTonesLink).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await deviceTonesLink.click();
    await page.waitForURL('**/tones**');

    // Look for the imported tone
    const importedTone = page.locator('[data-testid^="tone-item-"]').filter({
      hasText: 'E2E Test Tone',
    });
    await expect(importedTone.first()).toBeVisible({ timeout: UI_TIMEOUT_MS });
  });

  test('import shows progress indicator', async ({ page }) => {
    await connectToDevice(page);

    // Navigate to library
    const libraryLink = page.locator('[data-testid="library-nav-link"]');
    await expect(libraryLink).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await libraryLink.click();
    await page.waitForURL('**/library**');

    // Select tone and start import
    const tonesList = page.locator('[data-testid="library-tones-list"]');
    await expect(tonesList).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const toneItem = page.locator('[data-testid="library-tone-e2e-test-tone"]');
    await expect(toneItem).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await toneItem.click();

    const importButton = page.locator('[data-testid="import-to-device-button"]');
    await expect(importButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await importButton.click();

    // Verify progress indicator appears
    const progressIndicator = page.locator('[data-testid="import-progress"]');
    await expect(progressIndicator).toBeVisible({ timeout: UI_TIMEOUT_MS });
  });

  test('import handles slot already in use', async ({ page }) => {
    await connectToDevice(page);

    // Navigate to library
    const libraryLink = page.locator('[data-testid="library-nav-link"]');
    await expect(libraryLink).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await libraryLink.click();
    await page.waitForURL('**/library**');

    // Select tone
    const tonesList = page.locator('[data-testid="library-tones-list"]');
    await expect(tonesList).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const toneItem = page.locator('[data-testid="library-tone-e2e-test-tone"]');
    await expect(toneItem).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await toneItem.click();

    const importButton = page.locator('[data-testid="import-to-device-button"]');
    await expect(importButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await importButton.click();

    // Select an occupied slot
    const slotSelector = page.locator('[data-testid="target-slot-select"]');
    await expect(slotSelector).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Look for an option marked as occupied
    const occupiedSlot = slotSelector.locator('option[data-occupied="true"]').first();
    await expect(occupiedSlot).toBeAttached({ timeout: UI_TIMEOUT_MS });
    const value = await occupiedSlot.getAttribute('value');
    expect(value).not.toBeNull();
    await slotSelector.selectOption(value!);

    // Verify confirmation dialog or warning appears
    const overwriteWarning = page.locator('[data-testid="overwrite-confirm-dialog"], [data-testid="slot-occupied-warning"]');
    await expect(overwriteWarning).toBeVisible({ timeout: UI_TIMEOUT_MS });
  });
});

// =============================================================================
// Test Suite: Import Patch from Library to Device
// =============================================================================

test.describe('Import Patch from Library to Device', () => {
  test.beforeAll(async () => {
    if (!MIDI_SERVER_PORT) {
      throw new Error(
        'E2E_MIDI_SERVER_PORT must be set. Run via: ./scripts/run-http-midi-e2e.sh'
      );
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(buildUrl(), { timeout: UI_TIMEOUT_MS });
    await waitForAppReady(page);
    await setupTestLibrary(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanupTestLibrary(page);
  });

  test('can import patch from library to device', async ({ page }) => {
    await connectToDevice(page);
    expect(await getMidiStatus(page)).toBe('connected');

    // Navigate to library page
    const libraryLink = page.locator('[data-testid="library-nav-link"]');
    await expect(libraryLink).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await libraryLink.click();
    await page.waitForURL('**/library**');

    // Switch to patches tab/view
    const patchesTab = page.locator('[data-testid="library-patches-tab"]');
    await expect(patchesTab).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await patchesTab.click();

    // Wait for patches list
    const patchesList = page.locator('[data-testid="library-patches-list"]');
    await expect(patchesList).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Select the test patch
    const testPatch = page.locator('[data-testid="library-patch-e2e-test-patch"]');
    await expect(testPatch).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await testPatch.click();

    // Click import button
    const importButton = page.locator('[data-testid="import-to-device-button"]');
    await expect(importButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await importButton.click();

    // Select target slot
    const slotSelector = page.locator('[data-testid="target-slot-select"]');
    await expect(slotSelector).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await slotSelector.selectOption('0');

    // Confirm import
    const confirmButton = page.locator('[data-testid="confirm-import-button"]');
    await expect(confirmButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await confirmButton.click();

    // Wait for import to complete
    const successIndicator = page.locator('[data-testid="import-success"]');
    await expect(successIndicator).toBeVisible({ timeout: IMPORT_TIMEOUT_MS });

    // Verify patch appears on device
    const devicePatchesLink = page.locator('[data-testid="device-patches-nav-link"]');
    await expect(devicePatchesLink).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await devicePatchesLink.click();
    await page.waitForURL('**/patches**');

    const importedPatch = page.locator('[data-testid^="patch-item-"]').filter({
      hasText: 'E2E Test Patch',
    });
    await expect(importedPatch.first()).toBeVisible({ timeout: UI_TIMEOUT_MS });
  });

  test('import patch with missing tone references', async ({ page }) => {
    await connectToDevice(page);

    // First, remove the tone from the library so patch references a missing tone
    await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        const root = await getOPFSRoot();
        const library = await root.getDirectoryHandle('library');
        const tones = await library.getDirectoryHandle('tones');
        try {
          await tones.removeEntry('e2e-test-tone.yaml');
        } catch {
          // Ignore if file doesn't exist
        }
      })();
    `);

    // Navigate to library
    const libraryLink = page.locator('[data-testid="library-nav-link"]');
    await expect(libraryLink).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await libraryLink.click();
    await page.waitForURL('**/library**');

    // Switch to patches
    const patchesTab = page.locator('[data-testid="library-patches-tab"]');
    await expect(patchesTab).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await patchesTab.click();

    // Select patch
    const patchesList = page.locator('[data-testid="library-patches-list"]');
    await expect(patchesList).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const patchItem = page.locator('[data-testid="library-patch-e2e-test-patch"]');
    await expect(patchItem).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await patchItem.click();

    // Try to import
    const importButton = page.locator('[data-testid="import-to-device-button"]');
    await expect(importButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await importButton.click();

    // Verify warning about missing tones appears
    const missingToneWarning = page.locator('[data-testid="missing-tone-warning"], [data-testid="import-error"]');
    await expect(missingToneWarning).toBeVisible({ timeout: UI_TIMEOUT_MS });
  });
});
