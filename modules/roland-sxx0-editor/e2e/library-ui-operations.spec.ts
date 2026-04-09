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
  verifyDirectoryInOPFS,
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
