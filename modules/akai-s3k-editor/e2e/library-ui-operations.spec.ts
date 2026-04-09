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
  connectToOPFS,
  clickLibraryItem,
  waitForPreviewContent,
  isPreviewEmpty,
  verifyDirectoryInOPFS,
} from '../../e2e-infra/helpers/library-ui-helpers';

import { writeSampleFixture } from '../../e2e-infra/helpers/library-fixtures';

const port = process.env.E2E_PORT;

if (!port) {
  throw new Error(
    'E2E_PORT must be set. Run via: ./scripts/run-library-e2e.sh',
  );
}

const LIBRARY_URL = `https://localhost:${port}/akai/s3000xl/editor/library`;
const UI_TIMEOUT_MS = 5_000;

test.describe('S3K Library UI Operations', () => {
  test.setTimeout(15_000);

  test.beforeEach(async ({ page }) => {
    await page.goto(LIBRARY_URL);
    await cleanupOPFS(page);
    await initializeCommonAreaOPFS(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanupOPFS(page);
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
    await addButton.click({ timeout: UI_TIMEOUT_MS });

    // Wait for the async folder creation to complete
    await page.waitForTimeout(1_000);

    // Verify the directory was actually created in OPFS
    const exists = await verifyDirectoryInOPFS(page, [
      'library',
      'common',
      'samples',
      'NewFolder',
    ]);
    expect(exists).toBe(true);
  });

  test('sample appears in tree after writing fixture', async ({ page }) => {
    // Write fixture BEFORE connecting so the tree picks it up on first load
    await writeSampleFixture(page, 'Visible Sample');

    // Connect to OPFS to populate the tree
    await connectToOPFS(page);

    // Verify the sample node is visible in the tree
    const sampleNode = page.locator('.ac-tree-node').filter({ hasText: 'Visible Sample' }).first();
    await expect(sampleNode).toBeVisible({ timeout: UI_TIMEOUT_MS });
  });

  test('connect to OPFS loads tree, disconnect clears it', async ({ page }) => {
    // Write fixture so tree has content after connecting
    await writeSampleFixture(page, 'Connection Test Sample');

    // Connect to OPFS
    await connectToOPFS(page);

    // Verify tree has content -- at least one tree node should be visible
    const treeNodes = page.locator('.ac-tree-node');
    await expect(treeNodes.first()).toBeVisible({ timeout: UI_TIMEOUT_MS });
    const countWhileConnected = await treeNodes.count();
    expect(
      countWhileConnected,
      'Tree should have at least one node when connected',
    ).toBeGreaterThan(0);

    // Disconnect by clicking the "Change" button in the connection status area
    const changeButton = page.locator('.ac-library-connection-btn').filter({ hasText: 'Change' });
    await expect(changeButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await changeButton.click();

    // After disconnect, the OPFS connect button should reappear
    const opfsButton = page.locator('[data-testid="library-backend-opfs"]');
    await expect(opfsButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
  });

  test('context menu opens on right-click', async ({ page }) => {
    // Write fixture BEFORE connecting so the tree picks it up on first load
    await writeSampleFixture(page, 'Context Menu Sample');

    // Connect to OPFS to populate the tree
    await connectToOPFS(page);

    // Right-click on the sample node
    const sampleNode = page.locator('.ac-tree-node').filter({ hasText: 'Context Menu Sample' }).first();
    await expect(sampleNode).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await sampleNode.click({ button: 'right' });

    // Verify context menu appears
    const contextMenu = page.locator('.ac-context-menu');
    await expect(contextMenu).toBeVisible({ timeout: UI_TIMEOUT_MS });
  });

  test('delete sample from library', async ({ page }) => {
    // Write fixture BEFORE connecting so the tree picks it up on first load
    await writeSampleFixture(page, 'Delete Me');

    // Connect to OPFS to populate the tree
    await connectToOPFS(page);

    // Verify the sample is visible in the tree
    const sampleNode = page.locator('.ac-tree-node').filter({ hasText: 'Delete Me' }).first();
    await expect(sampleNode).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Set up dialog handler to accept the delete confirmation
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Right-click on the sample node to open context menu
    await sampleNode.click({ button: 'right' });

    // Click "Delete" in the context menu
    const deleteAction = page.locator('.ac-context-menu').getByText('Delete');
    await expect(deleteAction).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await deleteAction.click();

    // Wait for the delete operation to complete
    await page.waitForTimeout(1_000);

    // Verify: sample directory removed from OPFS
    const stillExists = await verifyDirectoryInOPFS(page, [
      'library',
      'common',
      'samples',
      'Delete Me',
    ]);
    expect(
      stillExists,
      'Sample directory should be removed from OPFS after deletion',
    ).toBe(false);
  });
});
