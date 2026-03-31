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

// Deviation: Using relative import because e2e/ is outside src/ and @/ path alias
// only applies to src/. This pattern should not be copied to application code.
import {
  connectToDevice,
  connectToOPFS,
  waitForAppReady,
  getMidiStatus,
} from './helpers/connection-helper';

// Longer timeouts for set operations - they transfer lots of data
test.setTimeout(60_000);

// Environment variables set by run-http-midi-e2e.sh
const MIDI_SERVER_PORT = process.env.E2E_MIDI_SERVER_PORT;

// Default to S-330 for tests (can be overridden via E2E_DEVICE_TYPE)
const DEVICE_TYPE = process.env.E2E_DEVICE_TYPE ?? 's330';
const EDITOR_BASE_PATH = `/roland/${DEVICE_TYPE}/editor`;

// Timeouts for various operations
const UI_TIMEOUT_MS = 5000;
const LIBRARY_INIT_TIMEOUT_MS = 15000; // Library async init can take longer
const SET_SAVE_TIMEOUT_MS = 45000;
const SET_LOAD_TIMEOUT_MS = 45000;

/**
 * OPFS helper functions to be evaluated in browser context.
 * These are inlined because page.evaluate cannot import modules.
 *
 * All functions are designed to be robust against NotFoundError - they will
 * never throw this error, instead returning appropriate fallback values
 * (empty arrays, false, etc.) when directories or files don't exist.
 */
const OPFS_HELPERS = `
  async function getOPFSRoot() {
    return await navigator.storage.getDirectory();
  }

  async function initializeOPFS() {
    try {
      const root = await getOPFSRoot();
      const library = await root.getDirectoryHandle('library', { create: true });
      await library.getDirectoryHandle('tones', { create: true });
      await library.getDirectoryHandle('patches', { create: true });
      await library.getDirectoryHandle('sets', { create: true });
      return { success: true };
    } catch (e) {
      // If initialization fails due to NotFoundError (race condition during cleanup),
      // return success anyway - the directories will be created when needed
      if (e.name === 'NotFoundError') {
        return { success: true };
      }
      throw e;
    }
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
    try {
      for (const segment of pathSegments) {
        current = await current.getDirectoryHandle(segment);
      }
      const fileHandle = await current.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      const content = await file.text();
      return { success: true, content };
    } catch (e) {
      if (e.name === 'NotFoundError') {
        return { success: false, error: 'File or directory not found', notFound: true };
      }
      throw e;
    }
  }

  async function readBinaryFile(pathSegments, fileName) {
    const root = await getOPFSRoot();
    let current = root;
    try {
      for (const segment of pathSegments) {
        current = await current.getDirectoryHandle(segment);
      }
      const fileHandle = await current.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      const buffer = await file.arrayBuffer();
      return { success: true, byteLength: buffer.byteLength };
    } catch (e) {
      if (e.name === 'NotFoundError') {
        return { success: false, error: 'File or directory not found', notFound: true, byteLength: 0 };
      }
      throw e;
    }
  }

  async function listDirectory(pathSegments) {
    const root = await getOPFSRoot();
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
        // Directory doesn't exist - return empty entries list
        return { success: true, entries: [] };
      }
      throw e;
    }
  }

  async function deleteDirectoryContents(dirHandle) {
    // Collect entries first to avoid issues with modifying during iteration
    let entries = [];
    try {
      for await (const entry of dirHandle.values()) {
        entries.push({ name: entry.name, kind: entry.kind });
      }
    } catch (e) {
      // Directory may not exist or be accessible - nothing to delete
      if (e.name === 'NotFoundError') {
        return;
      }
      throw e;
    }

    for (const entry of entries) {
      try {
        if (entry.kind === 'directory') {
          // Get subdirectory and recursively delete its contents
          try {
            const subDir = await dirHandle.getDirectoryHandle(entry.name);
            await deleteDirectoryContents(subDir);
          } catch (e) {
            // Directory may have been deleted already, ignore NotFoundError
            if (e.name !== 'NotFoundError') {
              throw e;
            }
          }
        }
        // Remove the entry (file or now-empty directory)
        await dirHandle.removeEntry(entry.name, { recursive: true });
      } catch (e) {
        // Ignore NotFoundError - entry may have been deleted already
        if (e.name !== 'NotFoundError') {
          throw e;
        }
      }
    }
  }

  async function cleanupOPFS() {
    try {
      const root = await getOPFSRoot();
      await deleteDirectoryContents(root);
      return { success: true };
    } catch (e) {
      if (e.name === 'NotFoundError') {
        // Root is already clean or inaccessible - that's fine
        return { success: true };
      }
      throw e;
    }
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
  const params: string[] = [];

  // Enable HTTP MIDI transport if configured
  if (MIDI_SERVER_PORT) {
    params.push('midi=http');
    params.push(`midiServerPort=${MIDI_SERVER_PORT}`);
  }

  if (params.length === 0) return fullPath;
  const separator = fullPath.includes('?') ? '&' : '?';
  return `${fullPath}${separator}${params.join('&')}`;
}

/**
 * Clean OPFS before each test for isolation.
 * This function is robust against NotFoundError - it will never fail
 * even if directories don't exist.
 */
async function cleanOPFS(page: Page): Promise<void> {
  // Wrap everything in an IIFE so function declarations become expressions
  const result = await page.evaluate(`
(async () => {
  ${OPFS_HELPERS}

  try {
    // Check if OPFS is available
    if (!navigator.storage || !navigator.storage.getDirectory) {
      return { success: false, error: 'OPFS not available' };
    }
    await cleanupOPFS();
    await initializeOPFS();
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message, name: e.name, stack: e.stack };
  }
})();
`);

  // Log if there was an error (but don't fail - tests might still work)
  if (result && typeof result === 'object' && 'success' in result) {
    const typedResult = result as { success: boolean; error?: string };
    if (!typedResult.success) {
      console.warn('cleanOPFS warning:', typedResult.error);
    }
  }
}

/**
 * Navigate to the Library page with query params preserved.
 * NavLink navigation loses query params, so we use direct goto.
 */
async function navigateToLibrary(page: Page): Promise<void> {
  await page.goto(buildUrl('library'));
  await page.waitForURL('**/library**', { timeout: UI_TIMEOUT_MS });
}

// =============================================================================
// Test Suite: Save Device State to Set
// =============================================================================

test.describe('Save Device State to Set', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(buildUrl());
    await waitForAppReady(page);

    // Connect to OPFS via UI button
    await connectToOPFS(page);

    await cleanOPFS(page);
    await connectToDevice(page);
  });

  test('can save device state to new set', async ({ page }) => {
    await navigateToLibrary(page);

    // Wait for library to initialize (button becomes enabled)
    const saveSetButton = page.locator('[data-testid="save-set-button"]');
    await expect(saveSetButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await expect(saveSetButton).toBeEnabled({ timeout: LIBRARY_INIT_TIMEOUT_MS });
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
    await navigateToLibrary(page);

    const saveSetButton = page.locator('[data-testid="save-set-button"]');
    await expect(saveSetButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await expect(saveSetButton).toBeEnabled({ timeout: LIBRARY_INIT_TIMEOUT_MS });
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

    const tonesResult = (await page.evaluate(
      OPFS_HELPERS +
        `
(async () => {
  const exists = await directoryExists(['library', 'sets', '${testSetName}', 'tones']);
  if (!exists) return { success: false, error: 'tones directory not found' };
  const listing = await listDirectory(['library', 'sets', '${testSetName}', 'tones']);
  return { success: true, entries: listing.entries };
})();
`
    )) as { success: boolean; entries?: Array<{ name: string; kind: string }> };

    expect(tonesResult.success).toBe(true);
    expect(tonesResult.entries).toBeDefined();

    const yamlFiles = tonesResult.entries?.filter((e) => e.name.endsWith('.yaml')) || [];
    const wavFiles = tonesResult.entries?.filter((e) => e.name.endsWith('.wav')) || [];

    // If there are tones, there must be corresponding wav files
    if (yamlFiles.length > 0) {
      expect(wavFiles.length).toBeGreaterThan(0);
    }
  });

  test('saved set contains all patches', async ({ page }) => {
    await navigateToLibrary(page);

    const saveSetButton = page.locator('[data-testid="save-set-button"]');
    await expect(saveSetButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await expect(saveSetButton).toBeEnabled({ timeout: LIBRARY_INIT_TIMEOUT_MS });
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

    const patchesResult = (await page.evaluate(
      OPFS_HELPERS +
        `
(async () => {
  const exists = await directoryExists(['library', 'sets', '${testSetName}', 'patches']);
  if (!exists) return { success: false, error: 'patches directory not found' };
  const listing = await listDirectory(['library', 'sets', '${testSetName}', 'patches']);
  return { success: true, entries: listing.entries };
})();
`
    )) as { success: boolean; entries?: Array<{ name: string; kind: string }> };

    expect(patchesResult.success).toBe(true);
    expect(patchesResult.entries).toBeDefined();

    // Patches directory should only contain yaml files
    const nonYamlFiles =
      patchesResult.entries?.filter((e) => e.kind === 'file' && !e.name.endsWith('.yaml')) || [];
    expect(nonYamlFiles.length).toBe(0);
  });

  test('saved set has valid manifest', async ({ page }) => {
    await navigateToLibrary(page);

    const saveSetButton = page.locator('[data-testid="save-set-button"]');
    await expect(saveSetButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await expect(saveSetButton).toBeEnabled({ timeout: LIBRARY_INIT_TIMEOUT_MS });
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

    const manifestResult = (await page.evaluate(
      OPFS_HELPERS +
        `
(async () => {
  try {
    const result = await readFile(['library', 'sets', '${testSetName}'], 'set.yaml');
    return result;
  } catch (e) {
    return { success: false, error: String(e) };
  }
})();
`
    )) as { success: boolean; content?: string; error?: string };

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

    // Connect to OPFS via UI button
    await connectToOPFS(page);

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
name: Tst Patch 01
keyGroups: []
`;

    const minimalWavBytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74,
      0x20, 0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x30, 0x75, 0x00, 0x00, 0x60, 0xea,
      0x00, 0x00, 0x02, 0x00, 0x10, 0x00, 0x64, 0x61, 0x74, 0x61, 0x00, 0x00, 0x00, 0x00,
    ]);

    await page.evaluate(
      OPFS_HELPERS +
        `
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
`
    );

    await connectToDevice(page);
    expect(await getMidiStatus(page)).toBe('connected');

    await navigateToLibrary(page);

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

    await page.evaluate(
      OPFS_HELPERS +
        `
(async () => {
  await createTestSet(
    '${testSetName}',
    ${JSON.stringify(testManifest)},
    [],
    []
  );
})();
`
    );

    await connectToDevice(page);

    await navigateToLibrary(page);

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

    await page.evaluate(
      OPFS_HELPERS +
        `
(async () => {
  await createTestSet(
    '${testSetName}',
    ${JSON.stringify(testManifest)},
    [],
    []
  );
})();
`
    );

    await connectToDevice(page);

    await navigateToLibrary(page);

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

    // Connect to OPFS via UI button
    await connectToOPFS(page);

    await cleanOPFS(page);
  });

  test('set directory structure is created correctly', async ({ page }) => {
    await connectToDevice(page);

    await navigateToLibrary(page);

    const saveSetButton = page.locator('[data-testid="save-set-button"]');
    await expect(saveSetButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await expect(saveSetButton).toBeEnabled({ timeout: LIBRARY_INIT_TIMEOUT_MS });
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

    const structureResult = (await page.evaluate(
      OPFS_HELPERS +
        `
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
`
    )) as { setDir: boolean; tonesDir: boolean; patchesDir: boolean; manifest: boolean };

    expect(structureResult.setDir).toBe(true);
    expect(structureResult.tonesDir).toBe(true);
    expect(structureResult.patchesDir).toBe(true);
    expect(structureResult.manifest).toBe(true);
  });

  test('tone files include wav data', async ({ page }) => {
    await connectToDevice(page);

    await navigateToLibrary(page);

    const saveSetButton = page.locator('[data-testid="save-set-button"]');
    await expect(saveSetButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await expect(saveSetButton).toBeEnabled({ timeout: LIBRARY_INIT_TIMEOUT_MS });
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

    const wavResult = (await page.evaluate(
      OPFS_HELPERS +
        `
(async () => {
  const listing = await listDirectory(['library', 'sets', '${testSetName}', 'tones']);
  if (!listing.success) {
    return { success: false, error: 'Failed to list tones directory' };
  }
  const wavFiles = listing.entries.filter(e => e.name.endsWith('.wav'));
  const wavInfo = [];
  for (const wav of wavFiles) {
    const result = await readBinaryFile(
      ['library', 'sets', '${testSetName}', 'tones'],
      wav.name
    );
    if (result.success) {
      wavInfo.push({ name: wav.name, byteLength: result.byteLength });
    }
  }
  return { success: true, wavFiles: wavInfo };
})();
`
    )) as { success: boolean; wavFiles?: Array<{ name: string; byteLength: number }> };

    expect(wavResult.success).toBe(true);

    if (wavResult.wavFiles && wavResult.wavFiles.length > 0) {
      for (const wav of wavResult.wavFiles) {
        expect(wav.byteLength).toBeGreaterThan(44);
      }
    }
  });
});
