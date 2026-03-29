/**
 * E2E tests for exporting tones and patches from a connected device to the library.
 *
 * These tests require actual Roland S-series hardware (S-330 or S-550)
 * connected via MIDI. They verify the complete flow of:
 * 1. Connecting to device via HTTP MIDI transport
 * 2. Loading device state (tones/patches)
 * 3. Exporting to browser OPFS library
 * 4. Verifying exported data integrity
 *
 * Run via: ./scripts/run-http-midi-e2e.sh --grep "Device Library Export"
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
const DATA_LOAD_TIMEOUT_MS = 15000;
const EXPORT_TIMEOUT_MS = 10000;

/**
 * Build URL with HTTP MIDI parameters if configured.
 * Empty path or '/' goes to the editor root, other paths are appended.
 */
function buildUrl(subpath: string = ''): string {
  // Normalize: empty string or '/' means editor root
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
 * Selects the discovered port pair (from device validation) or first available.
 */
async function connectToDevice(page: Page): Promise<void> {
  // Wait for port selectors to have options loaded
  const inputSelect = page.locator('[data-testid="midi-input-select"]');
  await inputSelect.waitFor({ state: 'visible', timeout: UI_TIMEOUT_MS });

  // Wait for options to be populated (more than just the placeholder)
  await page.waitForFunction(
    () => {
      const select = document.querySelector('[data-testid="midi-input-select"]') as HTMLSelectElement;
      return select && select.options.length > 1;
    },
    { timeout: UI_TIMEOUT_MS }
  );

  // Select input port - prefer the discovered port from validation
  if (MIDI_INPUT_PORT) {
    // Try to select the discovered port
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
    // Fall back to first available
    const inputOptions = await inputSelect.locator('option:not([value=""])').all();
    if (inputOptions.length > 0) {
      const value = await inputOptions[0].getAttribute('value');
      if (value) await inputSelect.selectOption(value);
    }
  }

  // Select output port - prefer the discovered port from validation
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

  // Wait for connection to complete
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
 * OPFS helper functions to be evaluated in browser context.
 * These are inlined because page.evaluate cannot import modules.
 */
const OPFS_HELPERS = `
  /**
   * Get the OPFS root directory handle.
   */
  async function getOPFSRoot() {
    return await navigator.storage.getDirectory();
  }

  /**
   * Initialize the library directory structure.
   * Creates: library/tones, library/patches, library/sets
   */
  async function initializeOPFS() {
    const root = await getOPFSRoot();
    const library = await root.getDirectoryHandle('library', { create: true });
    await library.getDirectoryHandle('tones', { create: true });
    await library.getDirectoryHandle('patches', { create: true });
    await library.getDirectoryHandle('sets', { create: true });
    return { success: true };
  }

  /**
   * Check if a file exists at the given path.
   */
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

  /**
   * Read a text file from OPFS at the given path.
   */
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

  /**
   * Get file size at the given path.
   */
  async function getFileSize(pathSegments, fileName) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment);
    }
    const fileHandle = await current.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    return { success: true, size: file.size };
  }

  /**
   * List directory contents at the given path.
   */
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

  /**
   * Recursively delete all contents of a directory.
   */
  async function deleteDirectoryContents(dirHandle) {
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'directory') {
        const subDir = await dirHandle.getDirectoryHandle(entry.name);
        await deleteDirectoryContents(subDir);
      }
      await dirHandle.removeEntry(entry.name, { recursive: true });
    }
  }

  /**
   * Clean up OPFS - remove all files and directories.
   */
  async function cleanupOPFS() {
    const root = await getOPFSRoot();
    await deleteDirectoryContents(root);
    return { success: true };
  }

  /**
   * List tones in a directory.
   * A tone is identified by having both .yaml and .wav files with the same base name.
   * Returns an array of tone names (without extensions).
   */
  async function listTones(pathSegments) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment);
    }

    const files = [];
    for await (const entry of current.values()) {
      if (entry.kind === 'file') {
        files.push(entry.name);
      }
    }

    // Find pairs of .yaml and .wav files
    const yamlFiles = files.filter(f => f.endsWith('.yaml')).map(f => f.slice(0, -5));
    const wavFiles = files.filter(f => f.endsWith('.wav')).map(f => f.slice(0, -4));

    // Return only tones that have both files
    const tones = yamlFiles.filter(name => wavFiles.includes(name));

    return { success: true, tones };
  }

  /**
   * List patches in a directory.
   * A patch is identified by a .yaml file in the patches directory.
   * Returns an array of patch names (without extensions).
   */
  async function listPatches(pathSegments) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment);
    }

    const patches = [];
    for await (const entry of current.values()) {
      if (entry.kind === 'file' && entry.name.endsWith('.yaml')) {
        patches.push(entry.name.slice(0, -5));
      }
    }

    return { success: true, patches };
  }

  /**
   * Read and parse tone YAML metadata.
   */
  async function readToneMetadata(pathSegments, toneName) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment);
    }

    const fileHandle = await current.getFileHandle(toneName + '.yaml');
    const file = await fileHandle.getFile();
    const content = await file.text();

    // Simple YAML parsing for key-value pairs
    const metadata = {};
    const lines = content.split('\\n');
    for (const line of lines) {
      const match = line.match(/^(\\w+):\\s*"?([^"]*)"?$/);
      if (match) {
        const key = match[1];
        let value = match[2];
        // Try to parse numbers
        if (/^-?\\d+(\\.\\d+)?$/.test(value)) {
          value = parseFloat(value);
        }
        metadata[key] = value;
      }
    }

    return { success: true, metadata, rawContent: content };
  }

  /**
   * Read and parse patch YAML metadata.
   */
  async function readPatchMetadata(pathSegments, patchName) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment);
    }

    const fileHandle = await current.getFileHandle(patchName + '.yaml');
    const file = await fileHandle.getFile();
    const content = await file.text();

    return { success: true, rawContent: content };
  }
`;

// =============================================================================
// Test Suite: Device Library Export - Tones
// =============================================================================

test.describe('Device Library Export - Tones', () => {
  test.beforeAll(async () => {
    // Fail fast if hardware is not configured
    if (!MIDI_SERVER_PORT) {
      throw new Error(
        'E2E_MIDI_SERVER_PORT must be set. Run via: ./scripts/run-http-midi-e2e.sh'
      );
    }
  });

  test.beforeEach(async ({ page }) => {
    // Initialize OPFS library structure
    await page.goto(buildUrl());
    await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        await cleanupOPFS();
        await initializeOPFS();
      })();
    `);
    await waitForAppReady(page);
  });

  test.afterEach(async ({ page }) => {
    // Clean up OPFS after each test
    await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        await cleanupOPFS();
      })();
    `);
  });

  test('can export tone from device to library', async ({ page }) => {
    // Connect to device
    await connectToDevice(page);
    expect(await getMidiStatus(page)).toBe('connected');

    // Navigate to tones page
    const tonesLink = page.locator('a[href$="/tones"]');
    await expect(tonesLink).toBeVisible({ timeout: UI_TIMEOUT_MS });

    await tonesLink.click();
    await page.waitForURL('**/tones**');

    // Wait for tones to load from device
    const toneItems = page.locator('[data-testid^="tone-item-"]');
    await expect(toneItems.first()).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });

    // Get the first tone's name for verification later
    const firstToneItem = toneItems.first();
    const toneName = await firstToneItem.locator('[data-testid="tone-name"]').textContent();

    // Click export button on first tone - must exist
    const exportButton = firstToneItem.locator('[data-testid="export-tone-button"]');
    await expect(exportButton).toBeVisible({ timeout: UI_TIMEOUT_MS });

    await exportButton.click();

    // Export dialog must appear
    const exportDialog = page.locator('[data-testid="export-dialog"]');
    await expect(exportDialog).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Click confirm button
    const confirmButton = exportDialog.locator('[data-testid="export-confirm"]');
    await expect(confirmButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await confirmButton.click();

    // Wait for dialog to close (indicates export complete)
    await expect(exportDialog).not.toBeVisible({ timeout: EXPORT_TIMEOUT_MS });

    // Verify tone appears in library
    const libraryTones = await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        return await listTones(['library', 'tones']);
      })();
    `) as { success: boolean; tones: string[] };

    expect(libraryTones.success).toBe(true);
    expect(libraryTones.tones.length).toBeGreaterThan(0);

    // If we captured the tone name, verify it's in the library
    if (toneName) {
      const normalizedName = toneName.trim().toLowerCase().replace(/\s+/g, '-');
      const foundTone = libraryTones.tones.some(
        (t) => t.toLowerCase().includes(normalizedName) || normalizedName.includes(t.toLowerCase())
      );
      expect(foundTone).toBe(true);
    }
  });

  test('exported tone includes wave data', async ({ page }) => {
    // Connect to device
    await connectToDevice(page);

    // Navigate to tones page
    const tonesLink = page.locator('a[href$="/tones"]');
    await expect(tonesLink).toBeVisible({ timeout: UI_TIMEOUT_MS });

    await tonesLink.click();
    await page.waitForURL('**/tones**');

    // Wait for tones to load
    const toneItems = page.locator('[data-testid^="tone-item-"]');
    await expect(toneItems.first()).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });

    // Export first tone
    const firstToneItem = toneItems.first();
    const exportButton = firstToneItem.locator('[data-testid="export-tone-button"]');
    await expect(exportButton).toBeVisible({ timeout: UI_TIMEOUT_MS });

    await exportButton.click();

    // Complete export dialog
    const exportDialog = page.locator('[data-testid="export-dialog"]');
    await expect(exportDialog).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const confirmButton = exportDialog.locator('[data-testid="export-confirm"]');
    await expect(confirmButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await confirmButton.click();

    // Wait for export to complete
    await expect(exportDialog).not.toBeVisible({ timeout: EXPORT_TIMEOUT_MS });

    // Get list of tones in library
    const libraryTones = await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        return await listTones(['library', 'tones']);
      })();
    `) as { success: boolean; tones: string[] };

    expect(libraryTones.success).toBe(true);
    expect(libraryTones.tones.length).toBeGreaterThan(0);

    // Verify the exported tone has both .yaml and .wav files
    const toneName = libraryTones.tones[0];

    const yamlExists = await page.evaluate(
      `(async () => {
        ${OPFS_HELPERS}
        return await fileExists(['library', 'tones'], '${toneName}.yaml');
      })()`
    );
    expect(yamlExists).toBe(true);

    const wavExists = await page.evaluate(
      `(async () => {
        ${OPFS_HELPERS}
        return await fileExists(['library', 'tones'], '${toneName}.wav');
      })()`
    );
    expect(wavExists).toBe(true);

    // Verify WAV file has content (not empty)
    const wavSize = await page.evaluate(
      `(async () => {
        ${OPFS_HELPERS}
        return await getFileSize(['library', 'tones'], '${toneName}.wav');
      })()`
    ) as { success: boolean; size: number };

    expect(wavSize.success).toBe(true);
    expect(wavSize.size).toBeGreaterThan(44); // WAV header is 44 bytes minimum
  });

  test('exported tone preserves parameters', async ({ page }) => {
    // Connect to device
    await connectToDevice(page);

    // Navigate to tones page
    const tonesLink = page.locator('a[href$="/tones"]');
    await expect(tonesLink).toBeVisible({ timeout: UI_TIMEOUT_MS });

    await tonesLink.click();
    await page.waitForURL('**/tones**');

    // Wait for tones to load
    const toneItems = page.locator('[data-testid^="tone-item-"]');
    await expect(toneItems.first()).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });

    // Get device tone parameters before export (if displayed)
    const firstToneItem = toneItems.first();
    const deviceToneName = await firstToneItem.locator('[data-testid="tone-name"]').textContent();

    // Export first tone
    const exportButton = firstToneItem.locator('[data-testid="export-tone-button"]');
    await expect(exportButton).toBeVisible({ timeout: UI_TIMEOUT_MS });

    await exportButton.click();

    // Complete export dialog
    const exportDialog = page.locator('[data-testid="export-dialog"]');
    await expect(exportDialog).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const confirmButton = exportDialog.locator('[data-testid="export-confirm"]');
    await expect(confirmButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await confirmButton.click();

    // Wait for export to complete
    await expect(exportDialog).not.toBeVisible({ timeout: EXPORT_TIMEOUT_MS });

    // Get exported tone metadata
    const libraryTones = await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        return await listTones(['library', 'tones']);
      })();
    `) as { success: boolean; tones: string[] };

    expect(libraryTones.tones.length).toBeGreaterThan(0);

    const toneName = libraryTones.tones[0];
    const metadata = await page.evaluate(
      `(async () => {
        ${OPFS_HELPERS}
        return await readToneMetadata(['library', 'tones'], '${toneName}');
      })()`
    ) as { success: boolean; metadata: Record<string, unknown>; rawContent: string };

    expect(metadata.success).toBe(true);

    // Verify essential tone parameters are present
    expect(metadata.rawContent.length).toBeGreaterThan(0);

    // Check for expected tone properties (device-dependent)
    // At minimum, should have name and sample rate
    if (deviceToneName) {
      expect(metadata.rawContent).toContain('name');
    }

    // Sample rate should be present (Roland S-series uses 30000 Hz)
    expect(metadata.rawContent).toMatch(/sampleRate|sample_rate/i);
  });
});

// =============================================================================
// Test Suite: Device Library Export - Patches
// =============================================================================

test.describe('Device Library Export - Patches', () => {
  test.beforeAll(async () => {
    // Fail fast if hardware is not configured
    if (!MIDI_SERVER_PORT) {
      throw new Error(
        'E2E_MIDI_SERVER_PORT must be set. Run via: ./scripts/run-http-midi-e2e.sh'
      );
    }
  });

  test.beforeEach(async ({ page }) => {
    // Initialize OPFS library structure
    await page.goto(buildUrl());
    await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        await cleanupOPFS();
        await initializeOPFS();
      })();
    `);
    await waitForAppReady(page);
  });

  test.afterEach(async ({ page }) => {
    // Clean up OPFS after each test
    await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        await cleanupOPFS();
      })();
    `);
  });

  test('can export patch from device to library', async ({ page }) => {
    // Connect to device
    await connectToDevice(page);
    expect(await getMidiStatus(page)).toBe('connected');

    // Navigate to patches page
    const patchesLink = page.locator('a[href$="/patches"]');
    await expect(patchesLink).toBeVisible({ timeout: UI_TIMEOUT_MS });

    await patchesLink.click();
    await page.waitForURL('**/patches**');

    // Wait for patches to load from device
    const patchItems = page.locator('[data-testid^="patch-item-"]');
    await expect(patchItems.first()).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });

    // Get the first patch's name for verification later
    const firstPatchItem = patchItems.first();
    const patchName = await firstPatchItem.locator('[data-testid="patch-name"]').textContent();

    // Click export button on first patch - must exist
    const exportButton = firstPatchItem.locator('[data-testid="export-patch-button"]');
    await expect(exportButton).toBeVisible({ timeout: UI_TIMEOUT_MS });

    await exportButton.click();

    // Export dialog must appear
    const exportDialog = page.locator('[data-testid="export-dialog"]');
    await expect(exportDialog).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Click confirm button
    const confirmButton = exportDialog.locator('[data-testid="export-confirm"]');
    await expect(confirmButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await confirmButton.click();

    // Wait for dialog to close (indicates export complete)
    await expect(exportDialog).not.toBeVisible({ timeout: EXPORT_TIMEOUT_MS });

    // Verify patch appears in library
    const libraryPatches = await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        return await listPatches(['library', 'patches']);
      })();
    `) as { success: boolean; patches: string[] };

    expect(libraryPatches.success).toBe(true);
    expect(libraryPatches.patches.length).toBeGreaterThan(0);

    // If we captured the patch name, verify it's in the library
    if (patchName) {
      const normalizedName = patchName.trim().toLowerCase().replace(/\s+/g, '-');
      const foundPatch = libraryPatches.patches.some(
        (p) => p.toLowerCase().includes(normalizedName) || normalizedName.includes(p.toLowerCase())
      );
      expect(foundPatch).toBe(true);
    }
  });

  test('exported patch preserves tone references', async ({ page }) => {
    // Connect to device
    await connectToDevice(page);

    // Navigate to patches page
    const patchesLink = page.locator('a[href$="/patches"]');
    await expect(patchesLink).toBeVisible({ timeout: UI_TIMEOUT_MS });

    await patchesLink.click();
    await page.waitForURL('**/patches**');

    // Wait for patches to load
    const patchItems = page.locator('[data-testid^="patch-item-"]');
    await expect(patchItems.first()).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });

    // Export first patch
    const firstPatchItem = patchItems.first();
    const exportButton = firstPatchItem.locator('[data-testid="export-patch-button"]');
    await expect(exportButton).toBeVisible({ timeout: UI_TIMEOUT_MS });

    await exportButton.click();

    // Complete export dialog
    const exportDialog = page.locator('[data-testid="export-dialog"]');
    await expect(exportDialog).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const confirmButton = exportDialog.locator('[data-testid="export-confirm"]');
    await expect(confirmButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await confirmButton.click();

    // Wait for export to complete
    await expect(exportDialog).not.toBeVisible({ timeout: EXPORT_TIMEOUT_MS });

    // Get exported patch metadata
    const libraryPatches = await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        return await listPatches(['library', 'patches']);
      })();
    `) as { success: boolean; patches: string[] };

    expect(libraryPatches.patches.length).toBeGreaterThan(0);

    const patchName = libraryPatches.patches[0];
    const metadata = await page.evaluate(
      `(async () => {
        ${OPFS_HELPERS}
        return await readPatchMetadata(['library', 'patches'], '${patchName}');
      })()`
    ) as { success: boolean; rawContent: string };

    expect(metadata.success).toBe(true);
    expect(metadata.rawContent.length).toBeGreaterThan(0);

    // Verify patch contains tone slot references
    // Roland S-series patches have tone slots (upper/lower or key groups)
    const hasToneReferences =
      metadata.rawContent.includes('tone') ||
      metadata.rawContent.includes('keyGroup') ||
      metadata.rawContent.includes('key_group') ||
      metadata.rawContent.includes('upper') ||
      metadata.rawContent.includes('lower');

    expect(hasToneReferences).toBe(true);
  });

  test('can export multiple patches sequentially', async ({ page }) => {
    // Connect to device
    await connectToDevice(page);

    // Navigate to patches page
    const patchesLink = page.locator('a[href$="/patches"]');
    await expect(patchesLink).toBeVisible({ timeout: UI_TIMEOUT_MS });

    await patchesLink.click();
    await page.waitForURL('**/patches**');

    // Wait for patches to load
    const patchItems = page.locator('[data-testid^="patch-item-"]');
    await expect(patchItems.first()).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });

    const patchCount = await patchItems.count();
    expect(patchCount).toBeGreaterThanOrEqual(2);

    // Export first two patches
    for (let i = 0; i < 2; i++) {
      const patchItem = patchItems.nth(i);
      const exportButton = patchItem.locator('[data-testid="export-patch-button"]');
      await expect(exportButton).toBeVisible({ timeout: UI_TIMEOUT_MS });

      await exportButton.click();

      // Complete export dialog
      const exportDialog = page.locator('[data-testid="export-dialog"]');
      await expect(exportDialog).toBeVisible({ timeout: UI_TIMEOUT_MS });

      const confirmButton = exportDialog.locator('[data-testid="export-confirm"]');
      await expect(confirmButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
      await confirmButton.click();

      // Wait for dialog to close
      await expect(exportDialog).not.toBeVisible({ timeout: EXPORT_TIMEOUT_MS });
    }

    // Verify both patches are in library
    const libraryPatches = await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        return await listPatches(['library', 'patches']);
      })();
    `) as { success: boolean; patches: string[] };

    expect(libraryPatches.success).toBe(true);
    expect(libraryPatches.patches.length).toBeGreaterThanOrEqual(2);
  });
});

// =============================================================================
// Test Suite: Export Error Handling
// =============================================================================

test.describe('Export Error Handling', () => {
  test.beforeAll(async () => {
    // Fail fast if hardware is not configured
    if (!MIDI_SERVER_PORT) {
      throw new Error(
        'E2E_MIDI_SERVER_PORT must be set. Run via: ./scripts/run-http-midi-e2e.sh'
      );
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(buildUrl());
    await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        await cleanupOPFS();
        await initializeOPFS();
      })();
    `);
    await waitForAppReady(page);
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        await cleanupOPFS();
      })();
    `);
  });

  test('export button is disabled when not connected', async ({ page }) => {
    // Ensure we are NOT connected
    const status = await getMidiStatus(page);
    expect(status).toBe('disconnected');

    // Navigate to tones page
    const tonesLink = page.locator('a[href$="/tones"]');
    await expect(tonesLink).toBeVisible({ timeout: UI_TIMEOUT_MS });

    await tonesLink.click();
    await page.waitForURL('**/tones**');

    // Export button should exist but be disabled when not connected
    const exportButton = page.locator('[data-testid="export-tone-button"]').first();

    // Either button doesn't exist (no tones loaded) or it's disabled
    const buttonCount = await exportButton.count();
    if (buttonCount > 0) {
      const isDisabled = await exportButton.isDisabled();
      expect(isDisabled).toBe(true);
    }
    // If no button visible, that's correct behavior for disconnected state
  });

  test('handles export cancellation gracefully', async ({ page }) => {
    // Connect to device
    await connectToDevice(page);

    // Navigate to tones page
    const tonesLink = page.locator('a[href$="/tones"]');
    await expect(tonesLink).toBeVisible({ timeout: UI_TIMEOUT_MS });

    await tonesLink.click();
    await page.waitForURL('**/tones**');

    // Wait for tones to load
    const toneItems = page.locator('[data-testid^="tone-item-"]');
    await expect(toneItems.first()).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });

    // Click export button
    const exportButton = toneItems.first().locator('[data-testid="export-tone-button"]');
    await expect(exportButton).toBeVisible({ timeout: UI_TIMEOUT_MS });

    await exportButton.click();

    // Export dialog must appear
    const exportDialog = page.locator('[data-testid="export-dialog"]');
    await expect(exportDialog).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Cancel button must exist
    const cancelButton = exportDialog.locator('[data-testid="export-cancel"]');
    await expect(cancelButton).toBeVisible({ timeout: UI_TIMEOUT_MS });

    await cancelButton.click();

    // Dialog should close
    await expect(exportDialog).not.toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Library should remain empty
    const libraryTones = await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        return await listTones(['library', 'tones']);
      })();
    `) as { success: boolean; tones: string[] };

    expect(libraryTones.tones.length).toBe(0);
  });
});
