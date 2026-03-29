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

// Deviation: Using relative import because e2e/ is outside src/ and @/ path alias
// only applies to src/. This pattern should not be copied to application code.
import {
  connectToDevice,
  connectToOPFS,
  navigateToLibrary,
  waitForAppReady,
  getMidiStatus,
} from './helpers/connection-helper';

// Short timeouts - fail fast for hardware tests
test.setTimeout(15_000);

// Environment variables set by run-http-midi-e2e.sh
const MIDI_SERVER_PORT = process.env.E2E_MIDI_SERVER_PORT;

// Default to S-330 for tests (can be overridden via E2E_DEVICE_TYPE)
const DEVICE_TYPE = process.env.E2E_DEVICE_TYPE ?? 's330';
const EDITOR_BASE_PATH = `/roland/${DEVICE_TYPE}/editor`;

// Timeouts for various operations
const UI_TIMEOUT_MS = 5000;
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
name: E2E Patch
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
 * These are wrapped in an object to avoid issues with async function declarations.
 */
function createOPFSHelpers(deviceType: string): string {
  return `
    const opfsHelpers = {
      deviceType: '${deviceType}',

      async getOPFSRoot() {
        return await navigator.storage.getDirectory();
      },

      async deleteDirectoryContents(dirHandle) {
        const entries = [];
        for await (const entry of dirHandle.values()) {
          entries.push({ name: entry.name, kind: entry.kind });
        }

        for (const entry of entries) {
          try {
            if (entry.kind === 'directory') {
              try {
                const subDir = await dirHandle.getDirectoryHandle(entry.name);
                await this.deleteDirectoryContents(subDir);
              } catch (e) {
                if (e.name !== 'NotFoundError') {
                  throw e;
                }
              }
            }
            await dirHandle.removeEntry(entry.name, { recursive: true });
          } catch (e) {
            if (e.name !== 'NotFoundError') {
              throw e;
            }
          }
        }
      },

      async cleanupOPFS() {
        const root = await this.getOPFSRoot();
        await this.deleteDirectoryContents(root);
        return { success: true };
      },

      async initializeOPFS() {
        const root = await this.getOPFSRoot();
        const library = await root.getDirectoryHandle('library', { create: true });
        const deviceDir = await library.getDirectoryHandle(this.deviceType, { create: true });
        await deviceDir.getDirectoryHandle('tones', { create: true });
        await deviceDir.getDirectoryHandle('patches', { create: true });
        await deviceDir.getDirectoryHandle('sets', { create: true });
        return { success: true };
      },

      async writeFile(pathSegments, fileName, content) {
        const root = await this.getOPFSRoot();
        let current = root;
        for (const segment of pathSegments) {
          current = await current.getDirectoryHandle(segment, { create: true });
        }
        const fileHandle = await current.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
        return { success: true };
      },

      async directoryExists(pathSegments) {
        const root = await this.getOPFSRoot();
        let current = root;
        try {
          for (const segment of pathSegments) {
            current = await current.getDirectoryHandle(segment);
          }
          return true;
        } catch {
          return false;
        }
      },

      async listDirectory(pathSegments) {
        const root = await this.getOPFSRoot();
        let current = root;
        try {
          for (const segment of pathSegments) {
            current = await current.getDirectoryHandle(segment);
          }
          const entries = [];
          for await (const entry of current.values()) {
            entries.push({ name: entry.name, kind: entry.kind });
          }
          return { success: true, entries };
        } catch (e) {
          if (e.name === 'NotFoundError') {
            return { success: false, error: 'Directory not found', entries: [] };
          }
          throw e;
        }
      }
    };
  `;
}

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
 * Set up the test library with fixture data in OPFS.
 * This must be called BEFORE connectToOPFS() so the app sees the data when loading.
 */
async function setupTestLibrary(page: Page): Promise<void> {
  // Clean up and create library structure with device-specific folders
  await page.evaluate(`
    (async () => {
      ${createOPFSHelpers(DEVICE_TYPE)}
      await opfsHelpers.cleanupOPFS();
      await opfsHelpers.initializeOPFS();
    })()
  `);

  // Write test tone fixture to device-specific folder
  await page.evaluate(`
    (async () => {
      ${createOPFSHelpers(DEVICE_TYPE)}
      await opfsHelpers.writeFile(
        ['library', '${DEVICE_TYPE}', 'tones'],
        'e2e-test-tone.yaml',
        ${JSON.stringify(BASIC_TONE_YAML)}
      );
    })()
  `);

  // Write test patch fixture to device-specific folder
  // Patches are directories containing patch.yaml, not flat files
  await page.evaluate(`
    (async () => {
      ${createOPFSHelpers(DEVICE_TYPE)}
      await opfsHelpers.writeFile(
        ['library', '${DEVICE_TYPE}', 'patches', 'e2e-test-patch'],
        'patch.yaml',
        ${JSON.stringify(BASIC_PATCH_YAML)}
      );
    })()
  `);
}

/**
 * Clean up OPFS after tests.
 */
async function cleanupTestLibrary(page: Page): Promise<void> {
  await page.evaluate(`
    (async () => {
      ${createOPFSHelpers(DEVICE_TYPE)}
      await opfsHelpers.cleanupOPFS();
    })()
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
    // Navigate to app (starts on Connect page)
    await page.goto(buildUrl(), { timeout: UI_TIMEOUT_MS });
    await waitForAppReady(page);

    // Connect to MIDI device first (on Connect page)
    await connectToDevice(page);
    expect(await getMidiStatus(page)).toBe('connected');

    // Navigate to Library page (but don't connect to OPFS yet)
    await navigateToLibrary(page);

    // Set up test library with fixtures BEFORE connecting to OPFS
    // This is critical: the app loads library contents when connecting,
    // so data must exist before we click the connect button.
    await setupTestLibrary(page);

    // Now connect to OPFS - app will load the pre-populated library
    await connectToOPFS(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanupTestLibrary(page);
  });

  test('can import tone from library to device', async ({ page }) => {
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
    // Wait for library to load and show tones
    const tonesList = page.locator('[data-testid="library-tones-list"]');
    await expect(tonesList).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Select tone and start import
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
    // Wait for library to load
    const tonesList = page.locator('[data-testid="library-tones-list"]');
    await expect(tonesList).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Select tone
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
    // Navigate to app (starts on Connect page)
    await page.goto(buildUrl(), { timeout: UI_TIMEOUT_MS });
    await waitForAppReady(page);

    // Connect to MIDI device first (on Connect page)
    await connectToDevice(page);
    expect(await getMidiStatus(page)).toBe('connected');

    // Navigate to Library page (but don't connect to OPFS yet)
    await navigateToLibrary(page);

    // Set up test library with fixtures BEFORE connecting to OPFS
    await setupTestLibrary(page);

    // Now connect to OPFS - app will load the pre-populated library
    await connectToOPFS(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanupTestLibrary(page);
  });

  test('can import patch from library to device', async ({ page }) => {
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
      hasText: 'E2E Patch',
    });
    await expect(importedPatch.first()).toBeVisible({ timeout: UI_TIMEOUT_MS });
  });

  test('import patch with missing tone references', async ({ page }) => {
    // First, remove the tone from the library so patch references a missing tone
    await page.evaluate(`
      (async () => {
        ${createOPFSHelpers(DEVICE_TYPE)}
        const root = await opfsHelpers.getOPFSRoot();
        const library = await root.getDirectoryHandle('library');
        const deviceDir = await library.getDirectoryHandle('${DEVICE_TYPE}');
        const tones = await deviceDir.getDirectoryHandle('tones');
        try {
          await tones.removeEntry('e2e-test-tone.yaml');
        } catch {
          // Ignore if file doesn't exist
        }
      })()
    `);

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
