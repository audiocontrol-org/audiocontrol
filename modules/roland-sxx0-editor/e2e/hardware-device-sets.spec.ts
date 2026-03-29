/**
 * Hardware e2e tests for device set save/load operations.
 *
 * These tests require actual Roland S-series hardware (S-330 or S-550)
 * connected via MIDI. Tests verify that:
 * - Device state can be saved to the library as a "set"
 * - Sets can be loaded back to the device
 * - Set manifests contain valid structure
 *
 * Test categories:
 * 1. Save Device State to Set
 * 2. Load Set to Device
 * 3. Set Validation
 */

import { test, expect, type Page } from '@playwright/test';

// Longer timeouts for set operations - they transfer lots of data
test.setTimeout(60_000);

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
const SET_SAVE_TIMEOUT_MS = 45000;
const SET_LOAD_TIMEOUT_MS = 45000;

/**
 * OPFS helper functions to be evaluated in browser context.
 * These are inlined because page.evaluate cannot import modules.
 */
const OPFS_HELPERS = `
  async function getOPFSRoot() {
    return await navigator.storage.getDirectory();
  }

  async function initializeOPFS() {
    const root = await getOPFSRoot();
    const library = await root.getDirectoryHandle('library', { create: true });
    await library.getDirectoryHandle('tones', { create: true });
    await library.getDirectoryHandle('patches', { create: true });
    await library.getDirectoryHandle('sets', { create: true });
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

  async function fileExists(pathSegments, fileName) {
    const root = await getOPFSRoot();
    let current = root;
    try {
      for (const segment of pathSegments) {
        current = await current.getDirectoryHandle(segment);
      }
      await current.getFileHandle(fileName);
      return true;
    } catch {
      return false;
    }
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

  async function readFile(pathSegments, fileName) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment);
    }
    const fileHandle = await current.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    const content = await file.text();
    return { success: true, content };
  }

  async function readBinaryFile(pathSegments, fileName) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment);
    }
    const fileHandle = await current.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    const buffer = await file.arrayBuffer();
    return { success: true, byteLength: buffer.byteLength };
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

  async function createTestSet(setName, manifest, tones, patches) {
    const root = await getOPFSRoot();
    const library = await root.getDirectoryHandle('library', { create: true });
    const sets = await library.getDirectoryHandle('sets', { create: true });
    const setDir = await sets.getDirectoryHandle(setName, { create: true });

    const manifestHandle = await setDir.getFileHandle('set.yaml', { create: true });
    const manifestWritable = await manifestHandle.createWritable();
    await manifestWritable.write(manifest);
    await manifestWritable.close();

    const tonesDir = await setDir.getDirectoryHandle('tones', { create: true });
    for (const tone of tones) {
      const yamlHandle = await tonesDir.getFileHandle(tone.yamlName, { create: true });
      const yamlWritable = await yamlHandle.createWritable();
      await yamlWritable.write(tone.yaml);
      await yamlWritable.close();

      if (tone.wav) {
        const wavHandle = await tonesDir.getFileHandle(tone.wavName, { create: true });
        const wavWritable = await wavHandle.createWritable();
        await wavWritable.write(tone.wav);
        await wavWritable.close();
      }
    }

    const patchesDir = await setDir.getDirectoryHandle('patches', { create: true });
    for (const patch of patches) {
      const yamlHandle = await patchesDir.getFileHandle(patch.yamlName, { create: true });
      const yamlWritable = await yamlHandle.createWritable();
      await yamlWritable.write(patch.yaml);
      await yamlWritable.close();
    }

    return { success: true };
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
 * Helper to wait for the app to be ready (MIDI store initialized)
 */
async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => (window as unknown as Record<string, unknown>).__midiStore !== undefined,
    { timeout: UI_TIMEOUT_MS }
  );
}

/**
 * Helper to get MIDI connection status from the app's store
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
 * Helper to connect to device via the app's UI.
 */
async function connectToDevice(page: Page): Promise<void> {
  const inputSelect = page.locator('[data-testid="midi-input-select"]');
  await inputSelect.waitFor({ state: 'visible', timeout: UI_TIMEOUT_MS });

  await page.waitForFunction(
    () => {
      const select = document.querySelector(
        '[data-testid="midi-input-select"]'
      ) as HTMLSelectElement;
      return select && select.options.length > 1;
    },
    { timeout: UI_TIMEOUT_MS }
  );

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

  const connectButton = page.locator('[data-testid="connect-button"]');
  await connectButton.click();

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
 * Clean OPFS before each test for isolation
 */
async function cleanOPFS(page: Page): Promise<void> {
  await page.evaluate(`
    ${OPFS_HELPERS}
    (async () => {
      await cleanupOPFS();
      await initializeOPFS();
    })();
  `);
}

// =============================================================================
// Test Suite: Save Device State to Set
// =============================================================================

test.describe('Save Device State to Set', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(buildUrl());
    await waitForAppReady(page);
    await cleanOPFS(page);
    await connectToDevice(page);
  });

  test('can save device state to new set', async ({ page }) => {
    const libraryLink = page.locator('[data-testid="library-nav-link"]');
    await expect(libraryLink).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await libraryLink.click();
    await page.waitForURL('**/library**', { timeout: UI_TIMEOUT_MS });

    const saveSetButton = page.locator('[data-testid="save-set-button"]');
    await expect(saveSetButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await saveSetButton.click();

    const setNameInput = page.locator('[data-testid="set-name-input"]');
    await expect(setNameInput).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const testSetName = `test-set-${Date.now()}`;
    await setNameInput.fill(testSetName);

    const confirmButton = page.locator('[data-testid="confirm-save-set"]');
    await expect(confirmButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await confirmButton.click();

    await page.waitForFunction(
      () => {
        const progress = document.querySelector('[data-testid="save-progress"]');
        const success = document.querySelector('[data-testid="save-success"]');
        return !progress || success;
      },
      { timeout: SET_SAVE_TIMEOUT_MS }
    );

    const setItem = page.locator(`[data-testid="set-item-${testSetName}"]`);
    await expect(setItem).toBeVisible({ timeout: UI_TIMEOUT_MS });
  });

  test('saved set contains all tones', async ({ page }) => {
    const libraryLink = page.locator('[data-testid="library-nav-link"]');
    await expect(libraryLink).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await libraryLink.click();
    await page.waitForURL('**/library**', { timeout: UI_TIMEOUT_MS });

    const saveSetButton = page.locator('[data-testid="save-set-button"]');
    await expect(saveSetButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await saveSetButton.click();

    const setNameInput = page.locator('[data-testid="set-name-input"]');
    await expect(setNameInput).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const testSetName = `tone-test-${Date.now()}`;
    await setNameInput.fill(testSetName);

    const confirmButton = page.locator('[data-testid="confirm-save-set"]');
    await expect(confirmButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await confirmButton.click();

    await page.waitForFunction(
      () => !document.querySelector('[data-testid="save-progress"]'),
      { timeout: SET_SAVE_TIMEOUT_MS }
    );

    const tonesResult = await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        const exists = await directoryExists(['library', 'sets', '${testSetName}', 'tones']);
        if (!exists) return { success: false, error: 'tones directory not found' };
        const listing = await listDirectory(['library', 'sets', '${testSetName}', 'tones']);
        return { success: true, entries: listing.entries };
      })();
    `) as { success: boolean; entries?: Array<{ name: string; kind: string }> };

    expect(tonesResult.success).toBe(true);
    expect(tonesResult.entries).toBeDefined();

    const yamlFiles = tonesResult.entries?.filter(e => e.name.endsWith('.yaml')) || [];
    const wavFiles = tonesResult.entries?.filter(e => e.name.endsWith('.wav')) || [];

    // If there are tones, there must be corresponding wav files
    if (yamlFiles.length > 0) {
      expect(wavFiles.length).toBeGreaterThan(0);
    }
  });

  test('saved set contains all patches', async ({ page }) => {
    const libraryLink = page.locator('[data-testid="library-nav-link"]');
    await expect(libraryLink).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await libraryLink.click();
    await page.waitForURL('**/library**', { timeout: UI_TIMEOUT_MS });

    const saveSetButton = page.locator('[data-testid="save-set-button"]');
    await expect(saveSetButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await saveSetButton.click();

    const setNameInput = page.locator('[data-testid="set-name-input"]');
    await expect(setNameInput).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const testSetName = `patch-test-${Date.now()}`;
    await setNameInput.fill(testSetName);

    const confirmButton = page.locator('[data-testid="confirm-save-set"]');
    await expect(confirmButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await confirmButton.click();

    await page.waitForFunction(
      () => !document.querySelector('[data-testid="save-progress"]'),
      { timeout: SET_SAVE_TIMEOUT_MS }
    );

    const patchesResult = await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        const exists = await directoryExists(['library', 'sets', '${testSetName}', 'patches']);
        if (!exists) return { success: false, error: 'patches directory not found' };
        const listing = await listDirectory(['library', 'sets', '${testSetName}', 'patches']);
        return { success: true, entries: listing.entries };
      })();
    `) as { success: boolean; entries?: Array<{ name: string; kind: string }> };

    expect(patchesResult.success).toBe(true);
    expect(patchesResult.entries).toBeDefined();

    // Patches directory should only contain yaml files
    const nonYamlFiles = patchesResult.entries?.filter(e =>
      e.kind === 'file' && !e.name.endsWith('.yaml')
    ) || [];
    expect(nonYamlFiles.length).toBe(0);
  });

  test('saved set has valid manifest', async ({ page }) => {
    const libraryLink = page.locator('[data-testid="library-nav-link"]');
    await expect(libraryLink).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await libraryLink.click();
    await page.waitForURL('**/library**', { timeout: UI_TIMEOUT_MS });

    const saveSetButton = page.locator('[data-testid="save-set-button"]');
    await expect(saveSetButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await saveSetButton.click();

    const setNameInput = page.locator('[data-testid="set-name-input"]');
    await expect(setNameInput).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const testSetName = `manifest-test-${Date.now()}`;
    await setNameInput.fill(testSetName);

    const confirmButton = page.locator('[data-testid="confirm-save-set"]');
    await expect(confirmButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await confirmButton.click();

    await page.waitForFunction(
      () => !document.querySelector('[data-testid="save-progress"]'),
      { timeout: SET_SAVE_TIMEOUT_MS }
    );

    const manifestResult = await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        try {
          const result = await readFile(['library', 'sets', '${testSetName}'], 'set.yaml');
          return { success: true, content: result.content };
        } catch (e) {
          return { success: false, error: String(e) };
        }
      })();
    `) as { success: boolean; content?: string; error?: string };

    expect(manifestResult.success).toBe(true);
    expect(manifestResult.content).toBeDefined();

    const content = manifestResult.content!;
    expect(content).toContain('format: sampler-set');
    expect(content).toContain(`device: ${DEVICE_TYPE}`);
    expect(content).toContain('version:');
    expect(content).toContain('tones:');
    expect(content).toContain('patches:');
  });
});

// =============================================================================
// Test Suite: Load Set to Device
// =============================================================================

test.describe('Load Set to Device', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(buildUrl());
    await waitForAppReady(page);
    await cleanOPFS(page);
  });

  test('can load set from library to device', async ({ page }) => {
    const testSetName = 'test-load-set';
    const testManifest = `format: sampler-set
device: ${DEVICE_TYPE}
version: 1
name: ${testSetName}
description: Test set for loading
createdAt: "2024-01-01T00:00:00Z"
tones:
  - slot: 0
    file: T01
    waveAllocation:
      bank: 0
      segmentTop: 0
      segmentLength: 2
patches:
  - slot: 0
    file: P01
`;

    const testToneYaml = `format: tone
device: ${DEVICE_TYPE}
version: 1
name: Test Tone 01
wave:
  sampleRate: 30000
  loopMode: forward
  loopStart: 0
  loopEnd: 1000
`;

    const testPatchYaml = `format: patch
device: ${DEVICE_TYPE}
version: 1
name: Test Patch 01
keyGroups: []
`;

    const minimalWavBytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00,
      0x57, 0x41, 0x56, 0x45, 0x66, 0x6D, 0x74, 0x20,
      0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
      0x30, 0x75, 0x00, 0x00, 0x60, 0xEA, 0x00, 0x00,
      0x02, 0x00, 0x10, 0x00, 0x64, 0x61, 0x74, 0x61,
      0x00, 0x00, 0x00, 0x00,
    ]);

    await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        const tones = [{
          yamlName: 'T01.yaml',
          yaml: ${JSON.stringify(testToneYaml)},
          wavName: 'T01.wav',
          wav: new Uint8Array([${minimalWavBytes.join(',')}])
        }];
        const patches = [{
          yamlName: 'P01.yaml',
          yaml: ${JSON.stringify(testPatchYaml)}
        }];
        await createTestSet(
          '${testSetName}',
          ${JSON.stringify(testManifest)},
          tones,
          patches
        );
      })();
    `);

    await connectToDevice(page);
    expect(await getMidiStatus(page)).toBe('connected');

    const libraryLink = page.locator('[data-testid="library-nav-link"]');
    await expect(libraryLink).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await libraryLink.click();
    await page.waitForURL('**/library**', { timeout: UI_TIMEOUT_MS });

    const setItem = page.locator(`[data-testid="set-item-${testSetName}"]`);
    await expect(setItem).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await setItem.click();

    const loadSetButton = page.locator('[data-testid="load-set-button"]');
    await expect(loadSetButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await loadSetButton.click();

    const confirmLoadButton = page.locator('[data-testid="confirm-load-set"]');
    await expect(confirmLoadButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await confirmLoadButton.click();

    await page.waitForFunction(
      () => {
        const progress = document.querySelector('[data-testid="load-progress"]');
        const success = document.querySelector('[data-testid="load-success"]');
        return !progress || success;
      },
      { timeout: SET_LOAD_TIMEOUT_MS }
    );

    expect(await getMidiStatus(page)).toBe('connected');
  });

  test('load set shows progress', async ({ page }) => {
    const testSetName = 'test-progress-set';
    const testManifest = `format: sampler-set
device: ${DEVICE_TYPE}
version: 1
name: ${testSetName}
tones: []
patches: []
`;

    await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        await createTestSet(
          '${testSetName}',
          ${JSON.stringify(testManifest)},
          [],
          []
        );
      })();
    `);

    await connectToDevice(page);

    const libraryLink = page.locator('[data-testid="library-nav-link"]');
    await expect(libraryLink).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await libraryLink.click();
    await page.waitForURL('**/library**', { timeout: UI_TIMEOUT_MS });

    const setItem = page.locator(`[data-testid="set-item-${testSetName}"]`);
    await expect(setItem).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await setItem.click();

    const loadSetButton = page.locator('[data-testid="load-set-button"]');
    await expect(loadSetButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await loadSetButton.click();

    // Verify progress indicator appears
    const progressIndicator = page.locator('[data-testid="load-progress"]');
    await expect(progressIndicator).toBeVisible({ timeout: UI_TIMEOUT_MS });
  });

  test('load set handles missing files with error', async ({ page }) => {
    const testSetName = 'test-missing-files';
    const testManifest = `format: sampler-set
device: ${DEVICE_TYPE}
version: 1
name: ${testSetName}
tones:
  - slot: 0
    file: MISSING_TONE
    waveAllocation:
      bank: 0
      segmentTop: 0
      segmentLength: 1
patches:
  - slot: 0
    file: MISSING_PATCH
`;

    await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        await createTestSet(
          '${testSetName}',
          ${JSON.stringify(testManifest)},
          [],
          []
        );
      })();
    `);

    await connectToDevice(page);

    const libraryLink = page.locator('[data-testid="library-nav-link"]');
    await expect(libraryLink).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await libraryLink.click();
    await page.waitForURL('**/library**', { timeout: UI_TIMEOUT_MS });

    const setItem = page.locator(`[data-testid="set-item-${testSetName}"]`);
    await expect(setItem).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await setItem.click();

    const loadSetButton = page.locator('[data-testid="load-set-button"]');
    await expect(loadSetButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await loadSetButton.click();

    const confirmLoadButton = page.locator('[data-testid="confirm-load-set"]');
    await expect(confirmLoadButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await confirmLoadButton.click();

    // Verify error message appears for missing files
    const loadError = page.locator('[data-testid="load-error"]');
    await expect(loadError).toBeVisible({ timeout: SET_LOAD_TIMEOUT_MS });

    // Device should still be connected after error
    expect(await getMidiStatus(page)).toBe('connected');
  });
});

// =============================================================================
// Test Suite: Set Validation
// =============================================================================

test.describe('Set Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(buildUrl());
    await waitForAppReady(page);
    await cleanOPFS(page);
  });

  test('set directory structure is created correctly', async ({ page }) => {
    await connectToDevice(page);

    const libraryLink = page.locator('[data-testid="library-nav-link"]');
    await expect(libraryLink).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await libraryLink.click();
    await page.waitForURL('**/library**', { timeout: UI_TIMEOUT_MS });

    const saveSetButton = page.locator('[data-testid="save-set-button"]');
    await expect(saveSetButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await saveSetButton.click();

    const setNameInput = page.locator('[data-testid="set-name-input"]');
    await expect(setNameInput).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const testSetName = `structure-test-${Date.now()}`;
    await setNameInput.fill(testSetName);

    const confirmButton = page.locator('[data-testid="confirm-save-set"]');
    await expect(confirmButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await confirmButton.click();

    await page.waitForFunction(
      () => !document.querySelector('[data-testid="save-progress"]'),
      { timeout: SET_SAVE_TIMEOUT_MS }
    );

    const structureResult = await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        const setDirExists = await directoryExists(['library', 'sets', '${testSetName}']);
        const tonesDirExists = await directoryExists(['library', 'sets', '${testSetName}', 'tones']);
        const patchesDirExists = await directoryExists(['library', 'sets', '${testSetName}', 'patches']);
        const manifestExists = await fileExists(['library', 'sets', '${testSetName}'], 'set.yaml');
        return {
          setDir: setDirExists,
          tonesDir: tonesDirExists,
          patchesDir: patchesDirExists,
          manifest: manifestExists
        };
      })();
    `) as { setDir: boolean; tonesDir: boolean; patchesDir: boolean; manifest: boolean };

    expect(structureResult.setDir).toBe(true);
    expect(structureResult.tonesDir).toBe(true);
    expect(structureResult.patchesDir).toBe(true);
    expect(structureResult.manifest).toBe(true);
  });

  test('tone files include wav data', async ({ page }) => {
    await connectToDevice(page);

    const libraryLink = page.locator('[data-testid="library-nav-link"]');
    await expect(libraryLink).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await libraryLink.click();
    await page.waitForURL('**/library**', { timeout: UI_TIMEOUT_MS });

    const saveSetButton = page.locator('[data-testid="save-set-button"]');
    await expect(saveSetButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await saveSetButton.click();

    const setNameInput = page.locator('[data-testid="set-name-input"]');
    await expect(setNameInput).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const testSetName = `wav-test-${Date.now()}`;
    await setNameInput.fill(testSetName);

    const confirmButton = page.locator('[data-testid="confirm-save-set"]');
    await expect(confirmButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await confirmButton.click();

    await page.waitForFunction(
      () => !document.querySelector('[data-testid="save-progress"]'),
      { timeout: SET_SAVE_TIMEOUT_MS }
    );

    const wavResult = await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        try {
          const listing = await listDirectory(['library', 'sets', '${testSetName}', 'tones']);
          const wavFiles = listing.entries.filter(e => e.name.endsWith('.wav'));
          const wavInfo = [];
          for (const wav of wavFiles) {
            const result = await readBinaryFile(
              ['library', 'sets', '${testSetName}', 'tones'],
              wav.name
            );
            wavInfo.push({ name: wav.name, byteLength: result.byteLength });
          }
          return { success: true, wavFiles: wavInfo };
        } catch (e) {
          return { success: false, error: String(e) };
        }
      })();
    `) as { success: boolean; wavFiles?: Array<{ name: string; byteLength: number }> };

    expect(wavResult.success).toBe(true);

    if (wavResult.wavFiles && wavResult.wavFiles.length > 0) {
      for (const wav of wavResult.wavFiles) {
        expect(wav.byteLength).toBeGreaterThan(44);
      }
    }
  });
});
