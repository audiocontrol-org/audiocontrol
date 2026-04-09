/**
 * Roland-specific library UI operations e2e tests.
 *
 * Common-area tests have been moved to e2e-infra/specs/library-ui-operations.spec.ts.
 * This file contains only Roland-specific tests (drum kit crash, tones folder).
 */

import { test, expect } from '@playwright/test';

// Deviation: relative imports because e2e/ is outside src/ and @/ only applies to src/
import {
  cleanupOPFS,
  initializeRolandOPFS,
  connectToOPFS,
  clickLibraryItem,
  verifyDirectoryInOPFS,
  createMinimalWavBase64,
} from '../../e2e-infra/helpers/library-ui-helpers';

// ---------------------------------------------------------------------------
// Roland-specific tests
// ---------------------------------------------------------------------------

const LIBRARY_URL = '/roland/s330/editor/library?midi=mock';
const UI_TIMEOUT_MS = 5_000;

test.describe('Roland-Specific Library UI Operations', () => {
  test.setTimeout(15_000);

  test.beforeEach(async ({ page }) => {
    await page.goto(LIBRARY_URL);
    await page.waitForLoadState('networkidle');

    await cleanupOPFS(page);
    await initializeRolandOPFS(page);

    await connectToOPFS(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanupOPFS(page);
  });

  // -------------------------------------------------------------------------
  // Bug #1: Selecting a drum kit with missing/undefined meta crashes the page
  // -------------------------------------------------------------------------

  test('selecting a drum kit item does not crash', async ({ page }) => {
    await page.goto(LIBRARY_URL);
    await page.waitForLoadState('networkidle');

    const wavBase64 = createMinimalWavBase64(30000, 1);
    await page.evaluate(
      async ({ wavBase64 }: { wavBase64: string }) => {
        const root = await navigator.storage.getDirectory();
        const lib = await root.getDirectoryHandle('library', { create: true });
        const s330 = await lib.getDirectoryHandle('s330', { create: true });
        const drumKits = await s330.getDirectoryHandle('drum-kits', { create: true });
        const kitDir = await drumKits.getDirectoryHandle('TestKit', { create: true });

        const yaml = [
          'format: drum-kit-bundle',
          'version: 2',
          'name: TESTKIT',
          'slices:',
          '  - label: S1',
          '    startSample: 0',
          '    endSample: 14999',
          '    source: source.wav',
        ].join('\n');

        const yamlHandle = await kitDir.getFileHandle('kit.yaml', { create: true });
        const yamlWriter = await yamlHandle.createWritable();
        await yamlWriter.write(yaml);
        await yamlWriter.close();

        const binaryString = atob(wavBase64);
        const wavBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          wavBytes[i] = binaryString.charCodeAt(i);
        }
        const wavHandle = await kitDir.getFileHandle('source.wav', { create: true });
        const wavWriter = await wavHandle.createWritable();
        await wavWriter.write(wavBytes);
        await wavWriter.close();
      },
      { wavBase64 },
    );

    await connectToOPFS(page);

    await clickLibraryItem(page, 'TestKit');

    const treeRoot = page.locator('.ac-tree-node').first();
    await expect(treeRoot).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const bodyText = await page.locator('body').textContent();
    expect(
      bodyText?.length,
      'Page body should have content (not blank from a crash)',
    ).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Roland-specific: Create folder in tones category
  // -------------------------------------------------------------------------

  test('create folder in tones category persists', async ({ page }) => {
    await page.goto(LIBRARY_URL);
    await page.waitForLoadState('networkidle');
    await connectToOPFS(page);

    page.on('dialog', async (dialog) => {
      await dialog.accept('DrumSounds');
    });

    const addButton = page.locator('[data-testid="library-tones-section-actions"] button');
    await expect(addButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await addButton.click();

    await page.waitForTimeout(1_000);

    const exists = await verifyDirectoryInOPFS(page, [
      'library', 's330', 'tones', 'DrumSounds',
    ]);
    expect(
      exists,
      'DrumSounds should exist in OPFS at library/s330/tones/DrumSounds',
    ).toBe(true);
  });
});
