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

      async initializeOPFS() {
        const root = await this.getOPFSRoot();
        const library = await root.getDirectoryHandle('library', { create: true });
        const deviceDir = await library.getDirectoryHandle(this.deviceType, { create: true });
        await deviceDir.getDirectoryHandle('tones', { create: true });
        await deviceDir.getDirectoryHandle('patches', { create: true });
        await deviceDir.getDirectoryHandle('sets', { create: true });
        return { success: true };
      },

      async fileExists(pathSegments, fileName) {
        const root = await this.getOPFSRoot();
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
      },

      async readFile(pathSegments, fileName) {
        const root = await this.getOPFSRoot();
        let current = root;
        for (const segment of pathSegments) {
          current = await current.getDirectoryHandle(segment);
        }
        const fileHandle = await current.getFileHandle(fileName);
        const file = await fileHandle.getFile();
        const content = await file.text();
        return { success: true, content };
      },

      async getFileSize(pathSegments, fileName) {
        const root = await this.getOPFSRoot();
        let current = root;
        for (const segment of pathSegments) {
          current = await current.getDirectoryHandle(segment);
        }
        const fileHandle = await current.getFileHandle(fileName);
        const file = await fileHandle.getFile();
        return { success: true, size: file.size };
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

      async listTones(pathSegments) {
        const root = await this.getOPFSRoot();
        let current = root;
        try {
          for (const segment of pathSegments) {
            current = await current.getDirectoryHandle(segment);
          }

          const files = [];
          for await (const entry of current.values()) {
            if (entry.kind === 'file') {
              files.push(entry.name);
            }
          }

          const yamlFiles = files.filter(f => f.endsWith('.yaml')).map(f => f.slice(0, -5));
          const wavFiles = files.filter(f => f.endsWith('.wav')).map(f => f.slice(0, -4));

          const tones = yamlFiles.filter(name => wavFiles.includes(name));

          return { success: true, tones };
        } catch (e) {
          if (e.name === 'NotFoundError') {
            return { success: false, error: 'Directory not found', tones: [] };
          }
          throw e;
        }
      },

      async listPatches(pathSegments) {
        const root = await this.getOPFSRoot();
        let current = root;
        try {
          for (const segment of pathSegments) {
            current = await current.getDirectoryHandle(segment);
          }

          // Patches are directories containing patch.yaml
          const patches = [];
          for await (const entry of current.values()) {
            if (entry.kind === 'directory') {
              // Check if this directory contains a patch.yaml file
              try {
                const patchDir = await current.getDirectoryHandle(entry.name);
                await patchDir.getFileHandle('patch.yaml');
                patches.push(entry.name);
              } catch {
                // Directory doesn't contain patch.yaml, skip it
              }
            }
          }

          return { success: true, patches };
        } catch (e) {
          if (e.name === 'NotFoundError') {
            return { success: false, error: 'Directory not found', patches: [] };
          }
          throw e;
        }
      },

      async readToneMetadata(pathSegments, toneName) {
        const root = await this.getOPFSRoot();
        let current = root;
        for (const segment of pathSegments) {
          current = await current.getDirectoryHandle(segment);
        }

        const fileHandle = await current.getFileHandle(toneName + '.yaml');
        const file = await fileHandle.getFile();
        const content = await file.text();

        const metadata = {};
        const lines = content.split('\\n');
        for (const line of lines) {
          const match = line.match(/^(\\w+):\\s*"?([^"]*)"?$/);
          if (match) {
            const key = match[1];
            let value = match[2];
            if (/^-?\\d+(\\.\\d+)?$/.test(value)) {
              value = parseFloat(value);
            }
            metadata[key] = value;
          }
        }

        return { success: true, metadata, rawContent: content };
      },

      async readPatchContent(pathSegments, patchName) {
        const root = await this.getOPFSRoot();
        let current = root;
        for (const segment of pathSegments) {
          current = await current.getDirectoryHandle(segment);
        }
        // Patches are directories containing patch.yaml
        const patchDir = await current.getDirectoryHandle(patchName);
        const fileHandle = await patchDir.getFileHandle('patch.yaml');
        const file = await fileHandle.getFile();
        const content = await file.text();
        return { success: true, content };
      }
    };
  `;
}

/**
 * Initialize OPFS with clean library structure.
 * For export tests, we want an empty library to export INTO.
 * This should be called BEFORE connectToOPFS so the app sees the structure.
 */
async function initializeCleanOPFS(page: Page): Promise<void> {
  await page.evaluate(`
    (async () => {
      ${createOPFSHelpers(DEVICE_TYPE)}
      await opfsHelpers.cleanupOPFS();
      await opfsHelpers.initializeOPFS();
    })()
  `);
}

/**
 * Clean up OPFS storage.
 */
async function cleanupOPFS(page: Page): Promise<void> {
  await page.evaluate(`
    (async () => {
      ${createOPFSHelpers(DEVICE_TYPE)}
      await opfsHelpers.cleanupOPFS();
    })()
  `);
}

// =============================================================================
// Test Suite: Export Tone from Device to Library
// =============================================================================

test.describe('Device Library Export - Tones', () => {
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

    // Navigate to Library page
    await navigateToLibrary(page);

    // For export tests: initialize clean OPFS BEFORE connecting
    // The app loads library contents when connecting, and we want it empty
    await initializeCleanOPFS(page);

    // Now connect to OPFS - app will see empty library structure
    await connectToOPFS(page);
  });

  test.afterEach(async ({ page }) => {
    // Clean up OPFS after each test
    await cleanupOPFS(page);
  });

  test('can export tone from device to library', async ({ page }) => {
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

    // Verify tone appears in library (device-specific folder)
    const libraryTones = (await page.evaluate(`
      (async () => {
        ${createOPFSHelpers(DEVICE_TYPE)}
        return await opfsHelpers.listTones(['library', '${DEVICE_TYPE}', 'tones']);
      })()
    `)) as { success: boolean; tones: string[] };

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

  test('exported tone has yaml and wav files', async ({ page }) => {
    // Navigate to tones page
    const tonesLink = page.locator('a[href$="/tones"]');
    await expect(tonesLink).toBeVisible({ timeout: UI_TIMEOUT_MS });

    await tonesLink.click();
    await page.waitForURL('**/tones**');

    // Wait for tones to load from device
    const toneItems = page.locator('[data-testid^="tone-item-"]');
    await expect(toneItems.first()).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });

    // Get the first tone's name to construct exported filename
    const firstToneItem = toneItems.first();
    const toneName = await firstToneItem.locator('[data-testid="tone-name"]').textContent();
    expect(toneName).toBeTruthy();

    // Export the tone
    const exportButton = firstToneItem.locator('[data-testid="export-tone-button"]');
    await expect(exportButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await exportButton.click();

    const exportDialog = page.locator('[data-testid="export-dialog"]');
    await expect(exportDialog).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const confirmButton = exportDialog.locator('[data-testid="export-confirm"]');
    await expect(confirmButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await confirmButton.click();

    await expect(exportDialog).not.toBeVisible({ timeout: EXPORT_TIMEOUT_MS });

    // Construct expected filename (tone names are normalized to kebab-case)
    const exportedToneName = toneName!.trim().toLowerCase().replace(/\s+/g, '-');

    // Verify both yaml and wav files exist (in device-specific folder)
    const yamlExists = await page.evaluate(`
      (async () => {
        ${createOPFSHelpers(DEVICE_TYPE)}
        return await opfsHelpers.fileExists(['library', '${DEVICE_TYPE}', 'tones'], '${exportedToneName}.yaml');
      })()
    `);
    expect(yamlExists).toBe(true);

    const wavExists = await page.evaluate(`
      (async () => {
        ${createOPFSHelpers(DEVICE_TYPE)}
        return await opfsHelpers.fileExists(['library', '${DEVICE_TYPE}', 'tones'], '${exportedToneName}.wav');
      })()
    `);
    expect(wavExists).toBe(true);
  });

  test('exported tone yaml contains device metadata', async ({ page }) => {
    // Navigate to tones page
    const tonesLink = page.locator('a[href$="/tones"]');
    await expect(tonesLink).toBeVisible({ timeout: UI_TIMEOUT_MS });

    await tonesLink.click();
    await page.waitForURL('**/tones**');

    // Wait for tones to load from device
    const toneItems = page.locator('[data-testid^="tone-item-"]');
    await expect(toneItems.first()).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });

    // Get the first tone's name
    const firstToneItem = toneItems.first();
    const toneName = await firstToneItem.locator('[data-testid="tone-name"]').textContent();
    expect(toneName).toBeTruthy();

    // Export the tone
    const exportButton = firstToneItem.locator('[data-testid="export-tone-button"]');
    await expect(exportButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await exportButton.click();

    const exportDialog = page.locator('[data-testid="export-dialog"]');
    await expect(exportDialog).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const confirmButton = exportDialog.locator('[data-testid="export-confirm"]');
    await expect(confirmButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await confirmButton.click();

    await expect(exportDialog).not.toBeVisible({ timeout: EXPORT_TIMEOUT_MS });

    // Read and verify yaml content (from device-specific folder)
    const exportedToneName = toneName!.trim().toLowerCase().replace(/\s+/g, '-');
    const toneMetadata = (await page.evaluate(`
      (async () => {
        ${createOPFSHelpers(DEVICE_TYPE)}
        return await opfsHelpers.readToneMetadata(['library', '${DEVICE_TYPE}', 'tones'], '${exportedToneName}');
      })()
    `)) as { success: boolean; metadata: Record<string, unknown>; rawContent: string };

    expect(toneMetadata.success).toBe(true);

    // Verify essential fields are present
    expect(toneMetadata.rawContent).toContain('format:');
    expect(toneMetadata.rawContent).toContain('device:');
    expect(toneMetadata.rawContent).toContain('name:');
  });
});

// =============================================================================
// Test Suite: Export Patch from Device to Library
// =============================================================================

test.describe('Device Library Export - Patches', () => {
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

    // Navigate to Library page
    await navigateToLibrary(page);

    // For export tests: initialize clean OPFS BEFORE connecting
    await initializeCleanOPFS(page);

    // Now connect to OPFS - app will see empty library structure
    await connectToOPFS(page);
  });

  test.afterEach(async ({ page }) => {
    // Clean up OPFS after each test
    await cleanupOPFS(page);
  });

  test('can export patch from device to library', async ({ page }) => {
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

    // Verify patch appears in library (device-specific folder)
    const libraryPatches = (await page.evaluate(`
      (async () => {
        ${createOPFSHelpers(DEVICE_TYPE)}
        return await opfsHelpers.listPatches(['library', '${DEVICE_TYPE}', 'patches']);
      })()
    `)) as { success: boolean; patches: string[] };

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
    // Navigate to patches page
    const patchesLink = page.locator('a[href$="/patches"]');
    await expect(patchesLink).toBeVisible({ timeout: UI_TIMEOUT_MS });

    await patchesLink.click();
    await page.waitForURL('**/patches**');

    // Wait for patches to load from device
    const patchItems = page.locator('[data-testid^="patch-item-"]');
    await expect(patchItems.first()).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });

    // Get the first patch's name
    const firstPatchItem = patchItems.first();
    const patchName = await firstPatchItem.locator('[data-testid="patch-name"]').textContent();
    expect(patchName).toBeTruthy();

    // Export the patch
    const exportButton = firstPatchItem.locator('[data-testid="export-patch-button"]');
    await expect(exportButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await exportButton.click();

    const exportDialog = page.locator('[data-testid="export-dialog"]');
    await expect(exportDialog).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const confirmButton = exportDialog.locator('[data-testid="export-confirm"]');
    await expect(confirmButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await confirmButton.click();

    await expect(exportDialog).not.toBeVisible({ timeout: EXPORT_TIMEOUT_MS });

    // Read patch yaml content (from device-specific folder, patches are directories)
    const exportedPatchName = patchName!.trim().toLowerCase().replace(/\s+/g, '-');
    const patchContent = (await page.evaluate(`
      (async () => {
        ${createOPFSHelpers(DEVICE_TYPE)}
        return await opfsHelpers.readPatchContent(['library', '${DEVICE_TYPE}', 'patches'], '${exportedPatchName}');
      })()
    `)) as { success: boolean; content: string };

    expect(patchContent.success).toBe(true);

    // Verify yaml contains keyGroups (which reference tones)
    expect(patchContent.content).toContain('keyGroups:');
  });

  test('can export multiple patches', async ({ page }) => {
    // Navigate to patches page
    const patchesLink = page.locator('a[href$="/patches"]');
    await expect(patchesLink).toBeVisible({ timeout: UI_TIMEOUT_MS });

    await patchesLink.click();
    await page.waitForURL('**/patches**');

    // Wait for patches to load from device
    const patchItems = page.locator('[data-testid^="patch-item-"]');
    await expect(patchItems.first()).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });

    // Export first patch
    const firstPatchItem = patchItems.first();
    let exportButton = firstPatchItem.locator('[data-testid="export-patch-button"]');
    await expect(exportButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await exportButton.click();

    let exportDialog = page.locator('[data-testid="export-dialog"]');
    await expect(exportDialog).toBeVisible({ timeout: UI_TIMEOUT_MS });

    let confirmButton = exportDialog.locator('[data-testid="export-confirm"]');
    await expect(confirmButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await confirmButton.click();
    await expect(exportDialog).not.toBeVisible({ timeout: EXPORT_TIMEOUT_MS });

    // Export second patch if available
    const patchCount = await patchItems.count();
    if (patchCount >= 2) {
      const secondPatchItem = patchItems.nth(1);
      exportButton = secondPatchItem.locator('[data-testid="export-patch-button"]');
      await expect(exportButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
      await exportButton.click();

      exportDialog = page.locator('[data-testid="export-dialog"]');
      await expect(exportDialog).toBeVisible({ timeout: UI_TIMEOUT_MS });

      confirmButton = exportDialog.locator('[data-testid="export-confirm"]');
      await expect(confirmButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
      await confirmButton.click();
      await expect(exportDialog).not.toBeVisible({ timeout: EXPORT_TIMEOUT_MS });
    }

    // Verify library has the patches (in device-specific folder)
    const libraryPatches = (await page.evaluate(`
      (async () => {
        ${createOPFSHelpers(DEVICE_TYPE)}
        return await opfsHelpers.listPatches(['library', '${DEVICE_TYPE}', 'patches']);
      })()
    `)) as { success: boolean; patches: string[] };

    expect(libraryPatches.success).toBe(true);
    expect(libraryPatches.patches.length).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// Test Suite: Export Edge Cases
// =============================================================================

test.describe('Device Library Export - Edge Cases', () => {
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
  });

  test.afterEach(async ({ page }) => {
    await cleanupOPFS(page);
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
    // Connect to device first
    await connectToDevice(page);

    // Navigate to Library page, initialize OPFS, then connect
    await navigateToLibrary(page);
    await initializeCleanOPFS(page);
    await connectToOPFS(page);

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

    // Library should remain empty (device-specific folder)
    const libraryTones = (await page.evaluate(`
      (async () => {
        ${createOPFSHelpers(DEVICE_TYPE)}
        return await opfsHelpers.listTones(['library', '${DEVICE_TYPE}', 'tones']);
      })()
    `)) as { success: boolean; tones: string[] };

    expect(libraryTones.success).toBe(true);
    expect(libraryTones.tones.length).toBe(0);
  });

  test('handles export when library already has item with same name', async ({ page }) => {
    // Connect to device first
    await connectToDevice(page);

    // Navigate to Library page, initialize OPFS, then connect
    await navigateToLibrary(page);
    await initializeCleanOPFS(page);
    await connectToOPFS(page);

    // Navigate to tones page
    const tonesLink = page.locator('a[href$="/tones"]');
    await expect(tonesLink).toBeVisible({ timeout: UI_TIMEOUT_MS });

    await tonesLink.click();
    await page.waitForURL('**/tones**');

    // Wait for tones to load
    const toneItems = page.locator('[data-testid^="tone-item-"]');
    await expect(toneItems.first()).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });

    // Export the tone twice - first export
    const exportButton = toneItems.first().locator('[data-testid="export-tone-button"]');
    await expect(exportButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await exportButton.click();

    let exportDialog = page.locator('[data-testid="export-dialog"]');
    await expect(exportDialog).toBeVisible({ timeout: UI_TIMEOUT_MS });

    let confirmButton = exportDialog.locator('[data-testid="export-confirm"]');
    await expect(confirmButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await confirmButton.click();
    await expect(exportDialog).not.toBeVisible({ timeout: EXPORT_TIMEOUT_MS });

    // Second export of the same tone
    await exportButton.click();

    exportDialog = page.locator('[data-testid="export-dialog"]');
    await expect(exportDialog).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Either shows overwrite confirmation or a warning - just confirm
    confirmButton = exportDialog.locator('[data-testid="export-confirm"]');
    await expect(confirmButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await confirmButton.click();

    // Should complete without error
    await expect(exportDialog).not.toBeVisible({ timeout: EXPORT_TIMEOUT_MS });

    // Library should have exactly one copy (overwritten) - device-specific folder
    const libraryTones = (await page.evaluate(`
      (async () => {
        ${createOPFSHelpers(DEVICE_TYPE)}
        return await opfsHelpers.listTones(['library', '${DEVICE_TYPE}', 'tones']);
      })()
    `)) as { success: boolean; tones: string[] };

    expect(libraryTones.success).toBe(true);
    expect(libraryTones.tones.length).toBe(1);
  });
});
