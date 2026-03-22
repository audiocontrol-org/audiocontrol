/**
 * Production-path E2E tests for the sample editor.
 *
 * Exercises the REAL user flow on both surfaces:
 * - sampler-editor: Library page → browse mock samples → "Open in Editor" → dialog
 * - dev-harness: Library panel auto-loads → select sample → "Open in Editor" → dialog
 *
 * Uses ?library=mock to auto-connect an in-memory library seeded with test signals.
 */

import { test, expect, type Page } from '@playwright/test';

// =========================================================================
// Navigation helpers
// =========================================================================

async function openEditorForSample(
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

  const openBtn = page.getByRole('button', { name: 'Open in Editor' });
  await expect(openBtn).toBeVisible({ timeout: 5000 });
  await openBtn.click();

  await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 10000 });
}

async function openInDevHarness(page: Page, sampleName: string): Promise<void> {
  await page.goto('/?library=mock');

  const treeNode = page.locator('.ac-tree-node-name', { hasText: new RegExp(`^${sampleName}$`) }).first();
  await expect(treeNode).toBeVisible({ timeout: 15000 });

  const treeRow = treeNode.locator('xpath=ancestor::div[contains(@class, "ac-tree-node")]');
  await treeRow.click();

  const openBtn = page.getByRole('button', { name: 'Open in Editor' });
  await expect(openBtn).toBeVisible({ timeout: 5000 });
  await openBtn.click();

  await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 10000 });
}

// =========================================================================
// Feature parity
// =========================================================================

test.describe('Sample Editor — feature parity', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await openEditorForSample(page, testInfo.project.name, 'sustain');
  });

  test('dialog opens with waveform canvas', async ({ page }) => {
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('dialog title shows sample name', async ({ page }) => {
    await expect(page.locator('[role="dialog"]')).toContainText('sustain');
  });

  test('operation buttons are visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Normalize' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reverse' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Trim Silence' })).toBeVisible();
  });

  test('undo button is initially disabled', async ({ page }) => {
    await expect(page.getByTitle(/undo/i)).toBeDisabled();
  });

  test('sample info shows duration and sample rate', async ({ page }) => {
    // Status bar should show sample rate and sample count
    await expect(page.locator('[role="dialog"]').getByText(/30000\s*Hz/)).toBeVisible();
  });

  test('close dialog with Escape', async ({ page }) => {
    await page.keyboard.press('Escape');
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5000 });
  });
});

// =========================================================================
// Operations
// =========================================================================

test.describe('Sample Editor — operations', () => {
  test('normalize enables undo', async ({ page }, testInfo) => {
    await openEditorForSample(page, testInfo.project.name, 'sustain');

    await page.getByRole('button', { name: 'Normalize' }).click();

    // Undo should now be enabled
    await expect(page.getByTitle(/undo/i)).toBeEnabled({ timeout: 3000 });
  });

  test('reverse enables undo', async ({ page }, testInfo) => {
    await openEditorForSample(page, testInfo.project.name, 'sustain');

    await page.getByRole('button', { name: 'Reverse' }).click();

    await expect(page.getByTitle(/undo/i)).toBeEnabled({ timeout: 3000 });
  });

  test('trim silence enables undo', async ({ page }, testInfo) => {
    // Use leading-silence signal which has 300ms of silence at the start
    await openEditorForSample(page, testInfo.project.name, 'leading-silence');

    await page.getByRole('button', { name: 'Trim Silence' }).click();

    await expect(page.getByTitle(/undo/i)).toBeEnabled({ timeout: 3000 });
  });

  test('undo after operation restores previous state', async ({ page }, testInfo) => {
    await openEditorForSample(page, testInfo.project.name, 'sustain');

    // Apply reverse
    await page.getByRole('button', { name: 'Reverse' }).click();
    await expect(page.getByTitle(/undo/i)).toBeEnabled({ timeout: 3000 });

    // Undo
    await page.getByTitle(/undo/i).click();

    // Undo should be disabled again (back to initial)
    await expect(page.getByTitle(/undo/i)).toBeDisabled({ timeout: 3000 });
  });

  test('redo after undo re-applies operation', async ({ page }, testInfo) => {
    await openEditorForSample(page, testInfo.project.name, 'sustain');

    await page.getByRole('button', { name: 'Reverse' }).click();
    await page.getByTitle(/undo/i).click();

    // Redo should be enabled
    await expect(page.getByTitle(/redo/i)).toBeEnabled({ timeout: 3000 });
    await page.getByTitle(/redo/i).click();

    // Undo should be enabled again
    await expect(page.getByTitle(/undo/i)).toBeEnabled({ timeout: 3000 });
  });
});

// =========================================================================
// Save
// =========================================================================

test.describe('Sample Editor — save', () => {
  test('save button is visible when library connected', async ({ page }, testInfo) => {
    await openEditorForSample(page, testInfo.project.name, 'sustain');

    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  });
});

// =========================================================================
// Different signals
// =========================================================================

test.describe('Sample Editor — signals', () => {
  test('opens drum-pattern sample', async ({ page }, testInfo) => {
    await openEditorForSample(page, testInfo.project.name, 'drum-pattern');
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('opens leading-silence sample', async ({ page }, testInfo) => {
    await openEditorForSample(page, testInfo.project.name, 'leading-silence');
    await expect(page.locator('canvas').first()).toBeVisible();
  });
});
