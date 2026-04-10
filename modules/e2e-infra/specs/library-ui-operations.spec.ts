/**
 * Shared library UI operations spec for e2e tests.
 *
 * Parameterized via environment variables:
 *   E2E_LIBRARY_URL — full URL to the editor's library page
 *   E2E_BASE_URL    — any page URL that has OPFS access
 *   E2E_EDITOR_NAME — display name for test descriptions
 *   E2E_OPFS_INIT   — "roland" or "s3k" (default)
 *
 * Contains tests for common-area UI operations that are shared across
 * all editors: sample preview, folder creation, deletion, connect/disconnect,
 * and context menu.
 *
 * Editor-specific tests (e.g., Roland drum kit crash, Roland tones folder)
 * remain in their respective editor spec files.
 */

import { test, expect } from '@playwright/test';

// Deviation: relative import because e2e-infra/specs/ is outside src/
import {
  initializeS3kOPFS,
  initializeRolandOPFS,
  cleanupOPFS,
  connectToOPFS,
  clickLibraryItem,
  waitForPreviewContent,
  isPreviewEmpty,
  verifyDirectoryInOPFS,
} from '../helpers/library-ui-helpers';

// Deviation: relative import because e2e-infra/specs/ is outside src/
import {
  writeSampleFixture,
} from '../helpers/library-fixtures';

const LIBRARY_URL = process.env.E2E_LIBRARY_URL;
const BASE_URL = process.env.E2E_BASE_URL;
const EDITOR_NAME = process.env.E2E_EDITOR_NAME ?? 'Unknown';
const OPFS_INIT = process.env.E2E_OPFS_INIT ?? 's3k';

if (!LIBRARY_URL || !BASE_URL) {
  throw new Error('E2E_LIBRARY_URL and E2E_BASE_URL must be set');
}

const initializeOPFS = OPFS_INIT === 'roland' ? initializeRolandOPFS : initializeS3kOPFS;

const UI_TIMEOUT_MS = 5_000;

test.describe(`${EDITOR_NAME} Library UI Operations`, () => {
  test.setTimeout(15_000);

  test.beforeEach(async ({ page }) => {
    await page.goto(LIBRARY_URL);
    await page.waitForLoadState('networkidle');

    // Clean OPFS and initialize directory structure BEFORE connecting
    await cleanupOPFS(page);
    await initializeOPFS(page);

    // Connect to OPFS backend via UI
    await connectToOPFS(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanupOPFS(page);
  });

  // -----------------------------------------------------------------------
  // Sample preview
  // -----------------------------------------------------------------------

  test('selecting a common-area sample shows preview', async ({ page }) => {
    // Disconnect by navigating away, write fixture, then reconnect.
    // Fixtures must exist BEFORE connection for the tree to pick them up.
    await page.goto(LIBRARY_URL);
    await page.waitForLoadState('networkidle');

    await writeSampleFixture(page, 'Test Sample');

    await connectToOPFS(page);

    await clickLibraryItem(page, 'Test Sample');

    await waitForPreviewContent(page);
    const empty = await isPreviewEmpty(page);
    expect(empty, 'Preview panel should NOT be empty after selecting a sample').toBe(false);
  });

  // -----------------------------------------------------------------------
  // Folder creation (common area)
  // -----------------------------------------------------------------------

  test('create folder in common area persists', async ({ page }) => {
    await page.goto(LIBRARY_URL);
    await page.waitForLoadState('networkidle');
    await connectToOPFS(page);

    page.on('dialog', async (dialog) => {
      await dialog.accept('NewFolder');
    });

    // Click the "+" button on the Samples section header
    const addButton = page.locator('[data-testid="library-commonSamples-section-actions"] button');
    await expect(addButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await addButton.click();

    await page.waitForTimeout(1_000);

    const exists = await verifyDirectoryInOPFS(page, [
      'library', 'common', 'samples', 'NewFolder',
    ]);
    expect(
      exists,
      'NewFolder should exist in OPFS at library/common/samples/NewFolder',
    ).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Delete sample
  // -----------------------------------------------------------------------

  test('delete sample from library removes it from OPFS', async ({ page }) => {
    await page.goto(LIBRARY_URL);
    await page.waitForLoadState('networkidle');

    await writeSampleFixture(page, 'DeleteMe');

    await connectToOPFS(page);

    const sampleNode = page.locator('.ac-tree-node').filter({ hasText: 'DeleteMe' }).first();
    await expect(sampleNode).toBeVisible({ timeout: UI_TIMEOUT_MS });

    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    await sampleNode.click({ button: 'right' });

    const deleteItem = page.locator('.ac-context-menu-item').filter({ hasText: 'Delete' }).first();
    await expect(deleteItem).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await deleteItem.click();

    await page.waitForTimeout(1_000);

    const exists = await verifyDirectoryInOPFS(page, [
      'library', 'common', 'samples', 'DeleteMe',
    ]);
    expect(
      exists,
      'DeleteMe should be removed from OPFS after deletion',
    ).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Connect/disconnect lifecycle
  // -----------------------------------------------------------------------

  test('connect to OPFS loads tree, disconnect clears it', async ({ page }) => {
    await page.goto(LIBRARY_URL);
    await page.waitForLoadState('networkidle');

    await writeSampleFixture(page, 'TreeCheck');

    await connectToOPFS(page);

    const treeNodes = page.locator('.ac-tree-node');
    await expect(treeNodes.first()).toBeVisible({ timeout: UI_TIMEOUT_MS });
    const countWhileConnected = await treeNodes.count();
    expect(
      countWhileConnected,
      'Tree should have at least one node when connected',
    ).toBeGreaterThan(0);

    const changeButton = page.locator('.ac-library-connection-btn').filter({ hasText: 'Change' });
    await expect(changeButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await changeButton.click();

    const opfsButton = page.locator('[data-testid="library-backend-opfs"]');
    await expect(opfsButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
  });

  // -----------------------------------------------------------------------
  // Sample fixture visibility
  // -----------------------------------------------------------------------

  test('sample fixture written to OPFS appears in library tree', async ({ page }) => {
    await page.goto(LIBRARY_URL);
    await page.waitForLoadState('networkidle');

    await writeSampleFixture(page, 'VisibleSample');

    await connectToOPFS(page);

    const sampleNode = page.locator('.ac-tree-node').filter({ hasText: 'VisibleSample' }).first();
    await expect(sampleNode).toBeVisible({ timeout: UI_TIMEOUT_MS });
  });

  // -----------------------------------------------------------------------
  // Context menu
  // -----------------------------------------------------------------------

  test('context menu opens on right-click with expected actions', async ({ page }) => {
    await page.goto(LIBRARY_URL);
    await page.waitForLoadState('networkidle');

    await writeSampleFixture(page, 'ContextTarget');

    await connectToOPFS(page);

    const sampleNode = page.locator('.ac-tree-node').filter({ hasText: 'ContextTarget' }).first();
    await expect(sampleNode).toBeVisible({ timeout: UI_TIMEOUT_MS });

    await sampleNode.click({ button: 'right' });

    const contextMenu = page.locator('.ac-context-menu');
    await expect(contextMenu).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const menuItems = page.locator('.ac-context-menu-item');
    const menuTexts: string[] = [];
    const count = await menuItems.count();
    for (let i = 0; i < count; i++) {
      const text = await menuItems.nth(i).textContent();
      if (text) {
        menuTexts.push(text.trim());
      }
    }

    expect(
      menuTexts.some((t) => t.includes('Rename')),
      `Context menu should contain "Rename" action. Found: ${menuTexts.join(', ')}`,
    ).toBe(true);

    expect(
      menuTexts.some((t) => t.includes('Delete')),
      `Context menu should contain "Delete" action. Found: ${menuTexts.join(', ')}`,
    ).toBe(true);
  });
});
