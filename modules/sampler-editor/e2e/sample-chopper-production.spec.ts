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
// Navigation helpers — each surface has a different path to the chopper
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

  // Wait for mock library to auto-connect and tree to load
  const nameSpan = page.locator('.ac-tree-node-name', { hasText: new RegExp(`^${sampleName}$`) }).first();
  await expect(nameSpan).toBeVisible({ timeout: 10000 });

  // Click the tree row (.ac-tree-node handles onClick, not the name span)
  const treeRow = nameSpan.locator('xpath=ancestor::div[contains(@class, "ac-tree-node")]');
  await treeRow.click();

  // The CommonSamplePreviewPanel should show "Open in Chopper"
  const openBtn = page.getByRole('button', { name: 'Open in Chopper' });
  await expect(openBtn).toBeVisible({ timeout: 5000 });
  await openBtn.click();

  // Wait for the SampleChopperDialog to open
  await expect(page.locator('[data-slice-editor-open="true"]')).toBeVisible({ timeout: 10000 });
}

async function openInDevHarness(page: Page, sampleName: string): Promise<void> {
  await page.goto('/?library=mock');

  // Wait for mock library to auto-connect and tree to render
  const treeNode = page.locator('.ac-tree-node-name', { hasText: new RegExp(`^${sampleName}$`) }).first();
  await expect(treeNode).toBeVisible({ timeout: 15000 });

  // Click the tree row
  const treeRow = treeNode.locator('xpath=ancestor::div[contains(@class, "ac-tree-node")]');
  await treeRow.click();

  // Click "Open in Chopper"
  const openBtn = page.getByRole('button', { name: 'Open in Chopper' });
  await expect(openBtn).toBeVisible({ timeout: 5000 });
  await openBtn.click();

  // Wait for the SampleChopperDialog to open
  await expect(page.locator('[data-slice-editor-open="true"]')).toBeVisible({ timeout: 10000 });
}

// =========================================================================
// Feature parity — every shared feature must be present on both surfaces
// =========================================================================

test.describe('Sample Chopper — production path feature parity', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await openChopperForSample(page, testInfo.project.name, 'sustain');
  });

  test('dialog opens with waveform canvas', async ({ page }) => {
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('dialog title shows source name', async ({ page }) => {
    await expect(page.locator('[role="dialog"]')).toContainText('sustain');
  });

  test('close button dismisses dialog', async ({ page }) => {
    // Find and click the close button (X)
    const closeBtn = page.locator('[role="dialog"] button').filter({ hasText: /close|×/i }).first();
    // If no labeled close button, try the dialog's built-in close
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
    } else {
      // Press Escape to close
      await page.keyboard.press('Escape');
    }
    await expect(page.locator('[data-slice-editor-open="true"]')).not.toBeVisible({ timeout: 5000 });
  });
});

// =========================================================================
// Auto-detect — slicing on a test signal
// =========================================================================

test.describe('Sample Chopper — production path auto-detect', () => {
  test('can open chopper for decay-into-sustain signal', async ({ page }, testInfo) => {
    await openChopperForSample(page, testInfo.project.name, 'decay-into-sustain');
    await expect(page.locator('canvas').first()).toBeVisible();
  });
});
