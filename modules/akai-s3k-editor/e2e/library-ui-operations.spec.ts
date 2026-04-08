/**
 * S3K Library UI Operations E2E Tests
 *
 * These tests exercise library browser bugs found during manual testing.
 * They are written test-first and are expected to FAIL against the current
 * implementation until the underlying bugs are fixed.
 *
 * No MIDI or hardware required -- these tests only interact with the OPFS
 * storage backend and the library browser UI.
 */

import { test, expect } from '@playwright/test';
import {
  cleanupOPFS,
  initializeCommonAreaOPFS,
  writeSampleFixture,
  connectToOPFS,
  clickLibraryItem,
  waitForPreviewContent,
  isPreviewEmpty,
  verifyDirectoryInOPFS,
} from '../../e2e-infra/helpers/library-ui-helpers';

const port = process.env.E2E_PORT;

if (!port) {
  throw new Error(
    'E2E_PORT must be set. Run via: ./scripts/run-library-e2e.sh',
  );
}

const LIBRARY_URL = `https://localhost:${port}/akai/s3000xl/editor/library`;

test.describe('S3K Library UI Operations', () => {
  test.setTimeout(15_000);

  test.beforeEach(async ({ page }) => {
    await page.goto(LIBRARY_URL);
    await cleanupOPFS(page);
    await initializeCommonAreaOPFS(page);
  });

  test('selecting a common-area sample shows preview', async ({ page }) => {
    // Write fixture BEFORE connecting so the tree picks it up on first load
    await writeSampleFixture(page, 'Test Sample');

    // Connect to OPFS to populate the tree
    await connectToOPFS(page);

    // Click the sample in the tree
    await clickLibraryItem(page, 'Test Sample');

    // The preview panel should show content (not the empty "Select an item" state)
    await waitForPreviewContent(page);
    const empty = await isPreviewEmpty(page);
    expect(empty).toBe(false);
  });

  test('create folder in samples category persists', async ({ page }) => {
    // Connect to OPFS first so the tree is visible
    await connectToOPFS(page);

    // Set up dialog handler BEFORE triggering the action
    page.on('dialog', (dialog) => dialog.accept('NewFolder'));

    // Click the "+" button on the Samples section header using data-testid
    const addButton = page.locator('[data-testid="library-samples-section-actions"] button');
    await addButton.click({ timeout: 5_000 });

    // Verify the directory was actually created in OPFS
    const exists = await verifyDirectoryInOPFS(page, [
      'library',
      'common',
      'samples',
      'NewFolder',
    ]);
    expect(exists).toBe(true);
  });
});
