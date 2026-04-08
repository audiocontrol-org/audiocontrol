/**
 * E2E tests for library UI operations.
 *
 * These tests exercise bugs found during manual testing and are expected to
 * FAIL with the current code (test-first approach):
 *
 *   Bug #1 -- Selecting a drum kit with missing meta crashes the page
 *   Bug #2 -- Selecting a common-area sample leaves preview panel empty
 *   Bug #3 -- Creating a folder via the "+" button does not persist to OPFS
 *
 * Library-only tests -- no hardware required. Run via:
 *   make test-e2e-roland-library ARGS="--grep 'Library UI Operations'"
 */

import { test, expect } from '@playwright/test';

// Deviation: Using relative imports because e2e/ is outside src/ and the @/
// path alias only applies to src/. This should not be copied to app code.
import {
  cleanupOPFS,
  initializeRolandOPFS,
  writeSampleFixture,
  connectToOPFS,
  clickLibraryItem,
  waitForPreviewContent,
  isPreviewEmpty,
  verifyDirectoryInOPFS,
} from '../../e2e-infra/helpers/library-ui-helpers';

import {
  createMinimalWavBase64,
} from './helpers/library-opfs-helpers';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

test.setTimeout(15_000);

const UI_TIMEOUT_MS = 5_000;

const LIBRARY_URL = '/roland/s330/editor/library?midi=mock';

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

test.describe('Library UI Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(LIBRARY_URL);
    await page.waitForLoadState('networkidle');

    // Clean OPFS and initialize Roland directory structure BEFORE connecting
    await cleanupOPFS(page);
    await initializeRolandOPFS(page);

    // Connect to OPFS backend via UI
    await connectToOPFS(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanupOPFS(page);
  });

  // -------------------------------------------------------------------------
  // Bug #2: Preview stays empty when selecting a common-area sample
  // -------------------------------------------------------------------------

  test('selecting a common-area sample shows preview', async ({ page }) => {
    // Disconnect by navigating away, write fixture, then reconnect.
    // Fixtures must exist BEFORE connection for the tree to pick them up.
    await page.goto(LIBRARY_URL);
    await page.waitForLoadState('networkidle');

    // Write a sample fixture to OPFS
    await writeSampleFixture(page, 'Test Sample');

    // Connect to OPFS so the tree loads with the fixture
    await connectToOPFS(page);

    // Click the sample in the tree
    await clickLibraryItem(page, 'Test Sample');

    // Assert: preview panel should show content (not the empty "Select an item" state)
    await waitForPreviewContent(page);
    const empty = await isPreviewEmpty(page);
    expect(empty, 'Preview panel should NOT be empty after selecting a sample').toBe(false);
  });

  // -------------------------------------------------------------------------
  // Bug #1: Selecting a drum kit with missing/undefined meta crashes the page
  // -------------------------------------------------------------------------

  test('selecting a drum kit item does not crash', async ({ page }) => {
    // Disconnect by navigating away, write drum kit fixture, then reconnect
    await page.goto(LIBRARY_URL);
    await page.waitForLoadState('networkidle');

    // Write a drum kit fixture directly to OPFS with kit.yaml + source WAV
    const wavBase64 = createMinimalWavBase64(30000, 1);
    await page.evaluate(
      async ({ wavBase64 }: { wavBase64: string }) => {
        const root = await navigator.storage.getDirectory();
        const lib = await root.getDirectoryHandle('library', { create: true });
        const s330 = await lib.getDirectoryHandle('s330', { create: true });
        const drumKits = await s330.getDirectoryHandle('drum-kits', { create: true });
        const kitDir = await drumKits.getDirectoryHandle('TestKit', { create: true });

        // Write kit.yaml with minimal content
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

        // Write source.wav from base64
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

    // Connect to OPFS so tree loads
    await connectToOPFS(page);

    // Click the drum kit in the tree
    await clickLibraryItem(page, 'TestKit');

    // Assert: page should not crash -- verify the library tree is still visible
    const treeRoot = page.locator('.ac-tree-node').first();
    await expect(treeRoot).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Additionally, body should have real content (not blank from a crash)
    const bodyText = await page.locator('body').textContent();
    expect(
      bodyText?.length,
      'Page body should have content (not blank from a crash)',
    ).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Bug #3: Creating a folder via "+" button does not persist to OPFS
  // -------------------------------------------------------------------------

  test('create folder in common area persists', async ({ page }) => {
    // Disconnect and reconnect to ensure clean state
    await page.goto(LIBRARY_URL);
    await page.waitForLoadState('networkidle');
    await connectToOPFS(page);

    // Set up dialog handler BEFORE clicking the "+" button.
    // window.prompt will fire when the user clicks "+".
    page.on('dialog', async (dialog) => {
      await dialog.accept('NewFolder');
    });

    // Click the "+" button on the Samples section header using data-testid
    const addButton = page.locator('[data-testid="library-commonSamples-section-actions"] button');
    await expect(addButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await addButton.click();

    // Wait for OPFS write to complete
    await page.waitForTimeout(1_000);

    // Assert: directory exists in OPFS at library/common/samples/NewFolder
    const exists = await verifyDirectoryInOPFS(page, [
      'library', 'common', 'samples', 'NewFolder',
    ]);
    expect(
      exists,
      'NewFolder should exist in OPFS at library/common/samples/NewFolder',
    ).toBe(true);
  });

  test('create folder in tones category persists', async ({ page }) => {
    // Disconnect and reconnect to ensure clean state
    await page.goto(LIBRARY_URL);
    await page.waitForLoadState('networkidle');
    await connectToOPFS(page);

    // Set up dialog handler BEFORE clicking the "+" button
    page.on('dialog', async (dialog) => {
      await dialog.accept('DrumSounds');
    });

    // Click the "+" button on the Tones section header using data-testid
    const addButton = page.locator('[data-testid="library-tones-section-actions"] button');
    await expect(addButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await addButton.click();

    // Wait for OPFS write to complete
    await page.waitForTimeout(1_000);

    // Assert: directory exists in OPFS at library/s330/tones/DrumSounds
    const exists = await verifyDirectoryInOPFS(page, [
      'library', 's330', 'tones', 'DrumSounds',
    ]);
    expect(
      exists,
      'DrumSounds should exist in OPFS at library/s330/tones/DrumSounds',
    ).toBe(true);
  });
});
