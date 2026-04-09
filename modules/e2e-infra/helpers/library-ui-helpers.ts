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
 *
 * Fixture writers live in library-fixtures.ts.
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
// STORAGE VIOLATION (https://github.com/audiocontrol-org/audiocontrol/issues/182):
// Drum kits are common-area objects, not device-specific. This path should be
// COMMON_SAMPLES_PATH once Roland drum kit storage is migrated. Do not copy.
export const ROLAND_DRUM_KITS_PATH = ['library', 's330', 'drum-kits'];

/** Akai S3000XL device-specific library */
export const S3K_PROGRAMS_PATH = ['library', 's3k', 'programs'];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UI_TIMEOUT_MS = 5000;

// ---------------------------------------------------------------------------
// WAV generation
// ---------------------------------------------------------------------------

/**
 * Create a minimal mono PCM WAV file as a base64-encoded string.
 * Shared across all editors for fixture generation.
 */
export function createMinimalWavBase64(
  sampleRate: number,
  durationSeconds: number,
): string {
  const samples = Math.floor(sampleRate * durationSeconds);
  const channels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const byteRate = sampleRate * channels * bytesPerSample;
  const blockAlign = channels * bytesPerSample;
  const dataSize = samples * channels * bytesPerSample;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string): void => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);
  // Data bytes already zeroed (silence)

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

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

// ---------------------------------------------------------------------------
// OPFS Readers (common area)
// ---------------------------------------------------------------------------

/**
 * Read sample.yaml from a common-area sample directory in OPFS.
 * Path: library/common/samples/{sampleName}/sample.yaml
 */
export async function readSampleYaml(
  page: Page,
  sampleName: string,
): Promise<string> {
  return page.evaluate(
    async (name: string) => {
      const root = await navigator.storage.getDirectory();
      const lib = await root.getDirectoryHandle('library');
      const common = await lib.getDirectoryHandle('common');
      const samples = await common.getDirectoryHandle('samples');
      const sampleDir = await samples.getDirectoryHandle(name);
      const handle = await sampleDir.getFileHandle('sample.yaml');
      const file = await handle.getFile();
      return file.text();
    },
    sampleName,
  );
}

/**
 * List sample directory names in the common-area samples directory.
 * Returns directory names under library/common/samples/.
 */
export async function listCommonSamples(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    try {
      const lib = await root.getDirectoryHandle('library');
      const common = await lib.getDirectoryHandle('common');
      const samples = await common.getDirectoryHandle('samples');
      const names: string[] = [];
      for await (const entry of (samples as unknown as { values(): AsyncIterableIterator<FileSystemHandle> }).values()) {
        if (entry.kind === 'directory') {
          names.push(entry.name);
        }
      }
      return names;
    } catch {
      return [];
    }
  });
}

// ---------------------------------------------------------------------------
// OPFS Initialization
// ---------------------------------------------------------------------------

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
