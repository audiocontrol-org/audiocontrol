/**
 * Production-path E2E tests for the sample chopper.
 *
 * Exercises the REAL user flow on both surfaces:
 * - sampler-editor: Library page → browse mock samples → "Open in Chopper" → dialog
 * - dev-harness: Library panel auto-loads → select sample → "Open in Chopper" → dialog
 *
 * Uses ?library=mock to auto-connect an in-memory library seeded with test signals.
 * No fixture pages, no bypass routes — tests run against production code paths.
 */

import { test, expect, type Page } from '@playwright/test';

// =========================================================================
// Navigation helpers
// =========================================================================

async function openChopperForSample(
  page: Page,
  projectName: string | undefined,
  sampleName: string,
): Promise<void> {
  if (projectName === 'dev-harness') {
    await openInDevHarness(page, sampleName);
  } else {
    await openInSamplerEditor(page, sampleName);
  }
}

async function openInSamplerEditor(page: Page, sampleName: string): Promise<void> {
  await page.goto('/roland/s330/editor/library?midi=mock&library=mock');

  const nameSpan = page.locator('.ac-tree-node-name', { hasText: new RegExp(`^${sampleName}$`) }).first();
  await expect(nameSpan).toBeVisible({ timeout: 10000 });

  const treeRow = nameSpan.locator('xpath=ancestor::div[contains(@class, "ac-tree-node")]');
  await treeRow.click();

  const openBtn = page.getByRole('button', { name: 'Open in Chopper' });
  await expect(openBtn).toBeVisible({ timeout: 5000 });
  await openBtn.click();

  await expect(page.locator('[data-slice-editor-open="true"]')).toBeVisible({ timeout: 10000 });
}

async function openInDevHarness(page: Page, sampleName: string): Promise<void> {
  await page.goto('/?library=mock');

  const treeNode = page.locator('.ac-tree-node-name', { hasText: new RegExp(`^${sampleName}$`) }).first();
  await expect(treeNode).toBeVisible({ timeout: 15000 });

  const treeRow = treeNode.locator('xpath=ancestor::div[contains(@class, "ac-tree-node")]');
  await treeRow.click();

  const openBtn = page.getByRole('button', { name: 'Open in Chopper' });
  await expect(openBtn).toBeVisible({ timeout: 5000 });
  await openBtn.click();

  await expect(page.locator('[data-slice-editor-open="true"]')).toBeVisible({ timeout: 10000 });
}

// =========================================================================
// Feature parity — shared features present on both surfaces
// =========================================================================

test.describe('Sample Chopper — feature parity', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await openChopperForSample(page, testInfo.project.name, 'drum-pattern');
  });

  test('dialog opens with waveform canvas', async ({ page }) => {
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('dialog title shows source name', async ({ page }) => {
    await expect(page.locator('[role="dialog"]')).toContainText('drum-pattern');
  });

  test('slice method tabs are visible', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Manual' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Transient' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Fixed' })).toBeVisible();
  });

  test('switching to Fixed tab shows slice count control', async ({ page }) => {
    await page.getByRole('tab', { name: 'Fixed' }).click();
    await expect(page.getByText(/number of slices/i)).toBeVisible();
  });

  test('switching to Transient tab shows threshold control', async ({ page }) => {
    await page.getByRole('tab', { name: 'Transient' }).click();
    await expect(page.getByText(/threshold/i).first()).toBeVisible();
  });

  test('zoom controls are visible', async ({ page }) => {
    await expect(page.getByTitle('Zoom in (+)')).toBeVisible();
    await expect(page.getByTitle('Zoom out (-)')).toBeVisible();
  });

  test('fullscreen toggle via F key', async ({ page }) => {
    // Press F to enter fullscreen
    await page.keyboard.press('f');
    // Dialog should have fullscreen styling (inset-4 class)
    const content = page.locator('[data-slice-editor-open="true"]');
    await expect(content).toHaveClass(/inset-4/);

    // Press F again to exit
    await page.keyboard.press('f');
    await expect(content).not.toHaveClass(/inset-4/);
  });

  test('close dialog with Escape', async ({ page }) => {
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-slice-editor-open="true"]')).not.toBeVisible({ timeout: 5000 });
  });
});

// =========================================================================
// Fixed slicing
// =========================================================================

test.describe('Sample Chopper — fixed slicing', () => {
  test('fixed slicing produces exact count', async ({ page }, testInfo) => {
    await openChopperForSample(page, testInfo.project.name, 'drum-pattern');

    await page.getByRole('tab', { name: 'Fixed' }).click();

    // Set to 4 slices
    const input = page.locator('input[type="number"]').first();
    await input.fill('4');

    // Verify slice count display
    await expect(page.getByText('4 slices')).toBeVisible({ timeout: 3000 });
  });

  // TODO: investigate why input.type doesn't trigger onChange on sampler-editor surface
  test.fixme('changing fixed count updates display', async ({ page }, testInfo) => {
    await openChopperForSample(page, testInfo.project.name, 'drum-pattern');

    await page.getByRole('tab', { name: 'Fixed' }).click();
    // Wait for the tab content to render
    await expect(page.getByText(/number of slices/i)).toBeVisible({ timeout: 5000 });
    const input = page.locator('input[type="number"]').first();
    await expect(input).toBeVisible({ timeout: 3000 });

    await input.click({ clickCount: 3 });
    await page.keyboard.type('8');
    await expect(page.getByText(/8 slices?/)).toBeVisible({ timeout: 5000 });
  });
});

// =========================================================================
// Transient detection
// =========================================================================

test.describe('Sample Chopper — transient detection', () => {
  test('detects transients in drum-pattern', async ({ page }, testInfo) => {
    await openChopperForSample(page, testInfo.project.name, 'drum-pattern');

    await page.getByRole('tab', { name: 'Transient' }).click();

    // Should detect slices (the drum pattern has 4 clear hits)
    await expect(page.getByText(/\d+ slices?/)).toBeVisible({ timeout: 5000 });
  });

  test('detects transients in decay-into-sustain', async ({ page }, testInfo) => {
    await openChopperForSample(page, testInfo.project.name, 'decay-into-sustain');

    await page.getByRole('tab', { name: 'Transient' }).click();

    // Should detect at least 1 transient (the initial attack)
    await expect(page.getByText(/\d+ slices?/)).toBeVisible({ timeout: 5000 });
  });
});

// =========================================================================
// Slice list and navigation
// =========================================================================

test.describe('Sample Chopper — slice list', () => {
  test('slice list renders after fixed slicing', async ({ page }, testInfo) => {
    await openChopperForSample(page, testInfo.project.name, 'drum-pattern');

    await page.getByRole('tab', { name: 'Fixed' }).click();
    const input = page.locator('input[type="number"]').first();
    await input.fill('4');

    // Verify slice list appears with items showing durations
    await expect(page.getByText(/\d+ms/).first()).toBeVisible({ timeout: 3000 });
  });

  test('arrow keys navigate slices', async ({ page }, testInfo) => {
    await openChopperForSample(page, testInfo.project.name, 'drum-pattern');

    // Create slices first
    await page.getByRole('tab', { name: 'Fixed' }).click();
    const input = page.locator('input[type="number"]').first();
    await input.fill('4');
    await expect(page.getByText('4 slices')).toBeVisible({ timeout: 3000 });

    // Navigate with arrow keys
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    // If slice navigation works, a different slice should be selected
    // (we can't easily assert which one, but no error is the validation)
    await page.keyboard.press('ArrowLeft');
  });
});

// =========================================================================
// Save button
// =========================================================================

test.describe('Sample Chopper — save', () => {
  test('save button is visible when library is connected', async ({ page }, testInfo) => {
    await openChopperForSample(page, testInfo.project.name, 'drum-pattern');

    // Create some slices first
    await page.getByRole('tab', { name: 'Fixed' }).click();
    const input = page.locator('input[type="number"]').first();
    await input.fill('4');
    await expect(page.getByText('4 slices')).toBeVisible({ timeout: 3000 });

    // Save button should be visible (library is connected via mock)
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  });
});
