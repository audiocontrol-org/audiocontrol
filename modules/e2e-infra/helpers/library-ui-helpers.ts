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

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

const UI_TIMEOUT_MS = 5000;

/** Navigate to the library page. Works for both editors. */
export async function navigateToLibrary(page: Page): Promise<void> {
  const libraryLink = page.locator('[data-testid="library-nav-link"]');
  await expect(libraryLink).toBeVisible({ timeout: UI_TIMEOUT_MS });
  await libraryLink.click();
  await page.waitForURL('**/library**', { timeout: UI_TIMEOUT_MS });
}

/** Connect to the OPFS storage backend. */
export async function connectToOPFS(page: Page, timeoutMs = UI_TIMEOUT_MS): Promise<void> {
  const opfsButton = page.locator('[data-testid="library-backend-opfs"]');
  await expect(opfsButton).toBeVisible({ timeout: timeoutMs });
  await opfsButton.click();
  // Wait for connection status to appear
  await expect(page.locator('.ac-library-connection-status')).toBeVisible({
    timeout: timeoutMs,
  });
}

// ---------------------------------------------------------------------------
// Tree Interaction
// ---------------------------------------------------------------------------

/** Click a library tree item by its visible text. */
export async function clickLibraryItem(
  page: Page,
  itemName: string,
  timeoutMs = UI_TIMEOUT_MS,
): Promise<void> {
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

/** Initialize OPFS with common-area directory structure. */
export async function initializeCommonAreaOPFS(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const library = await root.getDirectoryHandle('library', { create: true });
    const common = await library.getDirectoryHandle('common', { create: true });
    await common.getDirectoryHandle('samples', { create: true });
  });
}

/** Initialize OPFS with Roland-specific directory structure. */
export async function initializeRolandOPFS(page: Page): Promise<void> {
  await initializeCommonAreaOPFS(page);
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const library = await root.getDirectoryHandle('library');
    const s330 = await library.getDirectoryHandle('s330', { create: true });
    await s330.getDirectoryHandle('tones', { create: true });
    await s330.getDirectoryHandle('patches', { create: true });
    await s330.getDirectoryHandle('drum-kits', { create: true });
    await s330.getDirectoryHandle('sets', { create: true });
  });
}

// ---------------------------------------------------------------------------
// Fixture Writers
// ---------------------------------------------------------------------------

/** Write a minimal sample fixture to the OPFS common area. */
export async function writeSampleFixture(
  page: Page,
  name: string,
  path: string[] = [],
): Promise<void> {
  await page.evaluate(async ({ name, path }: { name: string; path: string[] }) => {
    const root = await navigator.storage.getDirectory();
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
    // RIFF header
    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 38, true); // file size - 8
    view.setUint32(8, 0x57415645, false); // "WAVE"
    // fmt chunk
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true); // chunk size
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, 44100, true); // sample rate
    view.setUint32(28, 88200, true); // byte rate
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    // data chunk
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, 2, true); // data size
    view.setInt16(44, 0, true); // one silent sample

    const wavHandle = await sampleDir.getFileHandle('sample.wav', { create: true });
    const wavWritable = await wavHandle.createWritable();
    await wavWritable.write(new Uint8Array(wavHeader));
    await wavWritable.close();
  }, { name, path });
}
