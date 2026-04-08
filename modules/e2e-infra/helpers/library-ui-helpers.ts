/**
 * Shared library UI helpers for e2e tests.
 *
 * These functions interact with the PluginLibraryBrowser component that is
 * shared across editors (Roland sxx0, Akai S3K, etc.). Import these from
 * any editor's e2e tests to avoid duplicating library UI interaction logic.
 *
 * These helpers have NO dependency on device test infrastructure (MIDI,
 * device-state, connection-helper). They are safe to use from library-only
 * test specs that run without hardware.
 */

import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

// =========================================================================
// Storage contract paths — these MUST match what the app reads/writes.
// Defined in SAMPLER-LIBRARY.md. If these are wrong, the test is wrong.
// If the app doesn't find items at these paths, the app is wrong.
// =========================================================================

/** Common area: vendor-agnostic samples and programs */
export const COMMON_SAMPLES_PATH = ['library', 'common', 'samples'];

/** Roland S-series device-specific library (all S-series devices share this) */
export const ROLAND_TONES_PATH = ['library', 's330', 'tones'];
export const ROLAND_PATCHES_PATH = ['library', 's330', 'patches'];
export const ROLAND_SETS_PATH = ['library', 's330', 'sets'];
export const ROLAND_DRUM_KITS_PATH = ['library', 's330', 'drum-kits'];

/** Akai S3000XL device-specific library */
export const S3K_PROGRAMS_PATH = ['library', 's3k', 'programs'];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UI_TIMEOUT_MS = 5000;

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

/** Navigate to the library page. Works for all editors. */
export async function navigateToLibrary(page: Page): Promise<void> {
  const libraryLink = page.locator('[data-testid="library-nav-link"]');
  await expect(libraryLink).toBeVisible({ timeout: UI_TIMEOUT_MS });
  await libraryLink.click();
  await page.waitForURL('**/library**', { timeout: UI_TIMEOUT_MS });
}

// ---------------------------------------------------------------------------
// OPFS Connection
// ---------------------------------------------------------------------------

/** Connect to the OPFS storage backend. */
export async function connectToOPFS(
  page: Page,
  timeoutMs = UI_TIMEOUT_MS,
): Promise<void> {
  const opfsButton = page.locator('[data-testid="library-backend-opfs"]');
  await expect(opfsButton).toBeVisible({ timeout: timeoutMs });
  await opfsButton.click();
  await expect(page.locator('.ac-library-connection-status')).toBeVisible({
    timeout: timeoutMs,
  });
}

// ---------------------------------------------------------------------------
// Tree Interaction
// ---------------------------------------------------------------------------

/**
 * Wait for a library tree node with the given name to be visible.
 * Fails with a clear contract-referencing message if the item is not found.
 */
export async function assertLibraryItemVisible(
  page: Page,
  itemName: string,
  timeoutMs = UI_TIMEOUT_MS,
): Promise<void> {
  const item = page.locator('.ac-tree-node').filter({ hasText: itemName }).first();
  await expect(item).toBeVisible({
    timeout: timeoutMs,
  }).catch(() => {
    throw new Error(
      `Library item '${itemName}' not visible in tree after ${timeoutMs}ms. ` +
      `Check that the fixture was written to the correct contract path.`,
    );
  });
}

/** Click a library tree item by its visible text. */
export async function clickLibraryItem(
  page: Page,
  itemName: string,
  timeoutMs = UI_TIMEOUT_MS,
): Promise<void> {
  await assertLibraryItemVisible(page, itemName, timeoutMs);
  const item = page.locator('.ac-tree-node').filter({ hasText: itemName }).first();
  await item.click({ timeout: timeoutMs });
}

// ---------------------------------------------------------------------------
// Preview Panel
// ---------------------------------------------------------------------------

/** Wait for the preview panel to show content (not the empty state). */
export async function waitForPreviewContent(
  page: Page,
  timeoutMs = UI_TIMEOUT_MS,
): Promise<void> {
  await page.locator('[data-testid="library-preview-panel"]')
    .filter({ hasNotText: 'Select an item' })
    .waitFor({ timeout: timeoutMs });
}

/** Check if preview panel is showing the empty state. */
export async function isPreviewEmpty(page: Page): Promise<boolean> {
  const text = await page.locator('[data-testid="library-preview-panel"]').textContent();
  return text?.includes('Select an item') ?? true;
}

// ---------------------------------------------------------------------------
// OPFS Management
// ---------------------------------------------------------------------------

/** Clean up all OPFS content for test isolation. */
export async function cleanupOPFS(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const entries: string[] = [];
    for await (const name of (
      root as unknown as { keys(): AsyncIterableIterator<string> }
    ).keys()) {
      entries.push(name);
    }
    for (const name of entries) {
      try {
        await root.removeEntry(name, { recursive: true });
      } catch {
        // ignore - entry may have been removed concurrently
      }
    }
  });
}

/** Verify a directory exists in OPFS at the given path. */
export async function verifyDirectoryInOPFS(
  page: Page,
  pathSegments: string[],
): Promise<boolean> {
  return page.evaluate(async (segments: string[]) => {
    let current = await navigator.storage.getDirectory();
    try {
      for (const segment of segments) {
        current = await current.getDirectoryHandle(segment);
      }
      return true;
    } catch {
      return false;
    }
  }, pathSegments);
}

/** Verify a file exists at a path in OPFS. */
export async function verifyFileInOPFS(
  page: Page,
  pathSegments: string[],
  fileName: string,
): Promise<boolean> {
  return page.evaluate(async ({ segments, fileName }: { segments: string[]; fileName: string }) => {
    let current = await navigator.storage.getDirectory();
    try {
      for (const segment of segments) {
        current = await current.getDirectoryHandle(segment);
      }
      await current.getFileHandle(fileName);
      return true;
    } catch {
      return false;
    }
  }, { segments: pathSegments, fileName });
}

/** Initialize OPFS with common-area directory structure: library/common/samples/ */
export async function initializeCommonAreaOPFS(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const library = await root.getDirectoryHandle('library', { create: true });
    const common = await library.getDirectoryHandle('common', { create: true });
    await common.getDirectoryHandle('samples', { create: true });
  });
}

/**
 * Initialize OPFS with Roland S-series directory structure.
 * Creates: library/common/samples/, library/s330/{tones,patches,sets,drum-kits}
 * No device parameter — always s330 per the storage contract.
 */
export async function initializeRolandOPFS(page: Page): Promise<void> {
  await initializeCommonAreaOPFS(page);
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const library = await root.getDirectoryHandle('library');
    const s330 = await library.getDirectoryHandle('s330', { create: true });
    await s330.getDirectoryHandle('tones', { create: true });
    await s330.getDirectoryHandle('patches', { create: true });
    await s330.getDirectoryHandle('sets', { create: true });
    await s330.getDirectoryHandle('drum-kits', { create: true });
  });
}

/**
 * Initialize OPFS with Akai S3000XL directory structure.
 * Creates: library/common/samples/, library/s3k/programs/
 * No device parameter — always s3k per the storage contract.
 */
export async function initializeS3kOPFS(page: Page): Promise<void> {
  await initializeCommonAreaOPFS(page);
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const library = await root.getDirectoryHandle('library');
    const s3k = await library.getDirectoryHandle('s3k', { create: true });
    await s3k.getDirectoryHandle('programs', { create: true });
  });
}

// ---------------------------------------------------------------------------
// Fixture Writers
// ---------------------------------------------------------------------------

/**
 * Write a minimal sample fixture to OPFS common area.
 * Writes to: library/common/samples/{path...}/{name}/sample.yaml + sample.wav
 */
export async function writeSampleFixture(
  page: Page,
  name: string,
  path: string[] = [],
): Promise<void> {
  await page.evaluate(async ({ name, path }: { name: string; path: string[] }) => {
    const root = await navigator.storage.getDirectory();
    // Contract path: library/common/samples/
    let dir = root;
    for (const segment of ['library', 'common', 'samples', ...path]) {
      dir = await dir.getDirectoryHandle(segment, { create: true });
    }
    const sampleDir = await dir.getDirectoryHandle(name, { create: true });

    // Write sample.yaml
    const yaml = `format: sample\nversion: 1\nname: ${name}\nfile: sample.wav\nsampleRate: 44100\n`;
    const yamlHandle = await sampleDir.getFileHandle('sample.yaml', { create: true });
    const yamlWritable = await yamlHandle.createWritable();
    await yamlWritable.write(yaml);
    await yamlWritable.close();

    // Write minimal WAV (44 bytes header + 2 bytes data)
    const wavHeader = new ArrayBuffer(46);
    const view = new DataView(wavHeader);
    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 38, true);          // file size - 8
    view.setUint32(8, 0x57415645, false); // "WAVE"
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true);          // chunk size
    view.setUint16(20, 1, true);           // PCM
    view.setUint16(22, 1, true);           // mono
    view.setUint32(24, 44100, true);       // sample rate
    view.setUint32(28, 88200, true);       // byte rate
    view.setUint16(32, 2, true);           // block align
    view.setUint16(34, 16, true);          // bits per sample
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, 2, true);           // data size
    view.setInt16(44, 0, true);            // one silent sample

    const wavHandle = await sampleDir.getFileHandle('sample.wav', { create: true });
    const wavWritable = await wavHandle.createWritable();
    await wavWritable.write(new Uint8Array(wavHeader));
    await wavWritable.close();
  }, { name, path });
}

/**
 * Write a tone fixture (YAML + WAV) to OPFS.
 * Writes to: library/s330/tones/{name}.yaml + {name}.wav
 * No device parameter — always s330 per the storage contract.
 */
export async function writeToneFixture(
  page: Page,
  name: string,
  yaml: string,
  wavBase64: string,
): Promise<void> {
  await page.evaluate(
    async ({ name, yaml, wavBase64 }: { name: string; yaml: string; wavBase64: string }) => {
      // Contract path: library/s330/tones/
      const root = await navigator.storage.getDirectory();
      const lib = await root.getDirectoryHandle('library', { create: true });
      const s330 = await lib.getDirectoryHandle('s330', { create: true });
      const tones = await s330.getDirectoryHandle('tones', { create: true });

      const yamlHandle = await tones.getFileHandle(`${name}.yaml`, { create: true });
      const yamlWriter = await yamlHandle.createWritable();
      await yamlWriter.write(yaml);
      await yamlWriter.close();

      const binaryString = atob(wavBase64);
      const wavBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        wavBytes[i] = binaryString.charCodeAt(i);
      }
      const wavHandle = await tones.getFileHandle(`${name}.wav`, { create: true });
      const wavWriter = await wavHandle.createWritable();
      await wavWriter.write(wavBytes);
      await wavWriter.close();
    },
    { name, yaml, wavBase64 },
  );
}

/**
 * Write a patch fixture (YAML) to OPFS.
 * Writes to: library/s330/patches/{name}/ (directory with patch files)
 * No device parameter — always s330 per the storage contract.
 */
export async function writePatchFixture(
  page: Page,
  name: string,
  yaml: string,
): Promise<void> {
  await page.evaluate(
    async ({ name, yaml }: { name: string; yaml: string }) => {
      // Contract path: library/s330/patches/
      const root = await navigator.storage.getDirectory();
      const lib = await root.getDirectoryHandle('library', { create: true });
      const s330 = await lib.getDirectoryHandle('s330', { create: true });
      const patches = await s330.getDirectoryHandle('patches', { create: true });
      const patchDir = await patches.getDirectoryHandle(name, { create: true });

      const yamlHandle = await patchDir.getFileHandle(`${name}.yaml`, { create: true });
      const yamlWriter = await yamlHandle.createWritable();
      await yamlWriter.write(yaml);
      await yamlWriter.close();
    },
    { name, yaml },
  );
}

/**
 * Write an S3K program fixture (YAML) to OPFS.
 * Writes to: library/s3k/programs/{name}/program.s3k.yaml
 * No device parameter — always s3k per the storage contract.
 */
export async function writeS3kProgramFixture(
  page: Page,
  name: string,
  yaml: string,
): Promise<void> {
  await page.evaluate(
    async ({ name, yaml }: { name: string; yaml: string }) => {
      // Contract path: library/s3k/programs/
      const root = await navigator.storage.getDirectory();
      const lib = await root.getDirectoryHandle('library', { create: true });
      const s3k = await lib.getDirectoryHandle('s3k', { create: true });
      const programs = await s3k.getDirectoryHandle('programs', { create: true });
      const programDir = await programs.getDirectoryHandle(name, { create: true });

      const yamlHandle = await programDir.getFileHandle('program.s3k.yaml', { create: true });
      const yamlWriter = await yamlHandle.createWritable();
      await yamlWriter.write(yaml);
      await yamlWriter.close();
    },
    { name, yaml },
  );
}
