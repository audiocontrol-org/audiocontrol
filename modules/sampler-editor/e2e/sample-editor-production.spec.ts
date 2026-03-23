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
  await expect(nameSpan).toBeVisible({ timeout: 15000 });

  const treeRow = nameSpan.locator('xpath=ancestor::div[contains(@class, "ac-tree-node")]');
  await treeRow.click();

  const openBtn = page.getByRole('button', { name: 'Open in Editor' });
  await expect(openBtn).toBeVisible({ timeout: 5000 });
  await openBtn.click();

  await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
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

  await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
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
    await expect(page.getByTitle(/undo/i)).toBeEnabled({ timeout: 500 });
  });

  test('reverse enables undo', async ({ page }, testInfo) => {
    await openEditorForSample(page, testInfo.project.name, 'sustain');

    await page.getByRole('button', { name: 'Reverse' }).click();

    await expect(page.getByTitle(/undo/i)).toBeEnabled({ timeout: 500 });
  });

  test('trim silence enables undo', async ({ page }, testInfo) => {
    // Use leading-silence signal which has 300ms of silence at the start
    await openEditorForSample(page, testInfo.project.name, 'leading-silence');

    await page.getByRole('button', { name: 'Trim Silence' }).click();

    await expect(page.getByTitle(/undo/i)).toBeEnabled({ timeout: 500 });
  });

  test('undo after operation restores previous state', async ({ page }, testInfo) => {
    await openEditorForSample(page, testInfo.project.name, 'sustain');

    // Apply reverse
    await page.getByRole('button', { name: 'Reverse' }).click();
    await expect(page.getByTitle(/undo/i)).toBeEnabled({ timeout: 500 });

    // Undo
    await page.getByTitle(/undo/i).click();

    // Undo should be disabled again (back to initial)
    await expect(page.getByTitle(/undo/i)).toBeDisabled({ timeout: 500 });
  });

  test('redo after undo re-applies operation', async ({ page }, testInfo) => {
    await openEditorForSample(page, testInfo.project.name, 'sustain');

    await page.getByRole('button', { name: 'Reverse' }).click();
    await page.getByTitle(/undo/i).click();

    // Redo should be enabled
    await expect(page.getByTitle(/redo/i)).toBeEnabled({ timeout: 500 });
    await page.getByTitle(/redo/i).click();

    // Undo should be enabled again
    await expect(page.getByTitle(/undo/i)).toBeEnabled({ timeout: 500 });
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
// Zoom
// =========================================================================

test.describe('Sample Editor — zoom', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await openEditorForSample(page, testInfo.project.name, 'sustain');
    // Switch to Trim tab so trim handles are active
    await page.getByRole('tab', { name: 'Trim' }).click();
  });

  test('zoom in button increases zoom level', async ({ page }) => {
    // Initially at 1x — single canvas
    const canvasesBefore = await page.locator('[role="dialog"] canvas').count();
    expect(canvasesBefore).toBe(1);

    // Click zoom in
    await page.getByTitle('Zoom in (+)').click();
    // Should now show 2x and split into two canvases
    await expect(page.getByText('2x')).toBeVisible({ timeout: 500 });
    const canvasesAfter = await page.locator('[role="dialog"] canvas').count();
    expect(canvasesAfter).toBe(2);
  });

  test('zoom out button decreases zoom level', async ({ page }) => {
    // Zoom in first
    await page.getByTitle('Zoom in (+)').click();
    await expect(page.getByText('2x')).toBeVisible({ timeout: 500 });

    // Zoom back out
    await page.getByTitle('Zoom out (-)').click();
    await expect(page.getByText('1x')).toBeVisible({ timeout: 500 });

    // Should be back to single canvas
    const canvases = await page.locator('[role="dialog"] canvas').count();
    expect(canvases).toBe(1);
  });

  test('zoom reset returns to 1x', async ({ page }) => {
    // Zoom in twice
    await page.getByTitle('Zoom in (+)').click();
    await page.getByTitle('Zoom in (+)').click();
    await expect(page.getByText('4x')).toBeVisible({ timeout: 500 });

    // Click the zoom level button to reset
    await page.getByText('4x').click();
    await expect(page.getByText('1x')).toBeVisible({ timeout: 500 });
  });

  test('split pane shows start and end labels', async ({ page }) => {
    await page.getByTitle('Zoom in (+)').click();
    await expect(page.locator('[role="dialog"] canvas')).toHaveCount(2, { timeout: 500 });

    // Canvas should render start/end labels (we can't read canvas text,
    // but we can verify two canvases are present and visible)
    const canvases = page.locator('[role="dialog"] canvas');
    await expect(canvases.first()).toBeVisible();
    await expect(canvases.last()).toBeVisible();
  });

  test('keyboard + zooms in', async ({ page }) => {
    await page.keyboard.press('+');
    await expect(page.getByText('2x')).toBeVisible({ timeout: 500 });
  });

  test('keyboard - zooms out after zoom in', async ({ page }) => {
    await page.keyboard.press('+');
    await expect(page.getByText('2x')).toBeVisible({ timeout: 500 });
    await page.keyboard.press('-');
    await expect(page.getByText('1x')).toBeVisible({ timeout: 500 });
  });

  test('keyboard 0 resets zoom', async ({ page }) => {
    await page.keyboard.press('+');
    await page.keyboard.press('+');
    await expect(page.getByText('4x')).toBeVisible({ timeout: 500 });
    await page.keyboard.press('0');
    await expect(page.getByText('1x')).toBeVisible({ timeout: 500 });
  });
});

// =========================================================================
// Trim handles
// =========================================================================

test.describe('Sample Editor — trim handles', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await openEditorForSample(page, testInfo.project.name, 'leading-silence');
    await page.getByRole('tab', { name: 'Trim' }).click();
  });

  test('trim silence auto-positions handles', async ({ page }) => {
    // The leading-silence sample has 300ms of silence at the start
    // Adjusting the silence threshold should move the trim handles
    // and show updated region info
    await expect(page.getByText(/Keep/)).toBeVisible({ timeout: 5000 });
  });

  test('trim silence threshold slider is interactive', async ({ page }) => {
    const slider = page.locator('input[type="range"]').first();
    await expect(slider).toBeVisible({ timeout: 500 });

    // Get initial region text
    const regionText = page.getByText(/Keep \d+/);
    await expect(regionText).toBeVisible({ timeout: 5000 });
    const initialText = await regionText.textContent();

    // Change slider value
    await slider.fill('-20');

    // Region text should update (different threshold = different trim points)
    await expect(async () => {
      const newText = await regionText.textContent();
      expect(newText).not.toBe(initialText);
    }).toPass({ timeout: 5000 });
  });

  test('apply trim commits and enables undo', async ({ page }) => {
    await expect(page.getByText(/Keep/)).toBeVisible({ timeout: 5000 });

    // Apply trim
    await page.getByRole('button', { name: 'Apply Trim' }).click();

    // Undo should now be enabled
    await expect(page.getByTitle(/undo/i)).toBeEnabled({ timeout: 500 });
  });

  test('drag start handle in single-pane mode', async ({ page }) => {
    // Get region info before drag
    await expect(page.getByText(/Keep/)).toBeVisible({ timeout: 5000 });
    const regionText = page.getByText(/Keep \d+/);
    const initialText = await regionText.textContent();

    // Get the canvas and drag from the left handle area
    const canvas = page.locator('[role="dialog"] canvas').first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // Drag from near the left edge (where start handle is at sample 0)
    // to a point further right
    await canvas.dispatchEvent('mousedown', { clientX: box.x + 5, clientY: box.y + box.height / 2 });
    await canvas.dispatchEvent('mousemove', { clientX: box.x + 100, clientY: box.y + box.height / 2 });
    await canvas.dispatchEvent('mouseup', { clientX: box.x + 100, clientY: box.y + box.height / 2 });

    // Region info should have changed
    await expect(async () => {
      const newText = await regionText.textContent();
      expect(newText).not.toBe(initialText);
    }).toPass({ timeout: 5000 });
  });

  test('drag handle in split-pane mode', async ({ page }) => {
    // Zoom in to get split pane
    await page.getByTitle('Zoom in (+)').click();
    await expect(page.locator('[role="dialog"] canvas')).toHaveCount(2, { timeout: 500 });

    // Get region info before drag
    const regionText = page.getByText(/Keep \d+/);
    await expect(regionText).toBeVisible({ timeout: 5000 });
    const initialText = await regionText.textContent();

    // Drag on the left canvas (start handle)
    const leftCanvas = page.locator('[role="dialog"] canvas').first();
    const box = await leftCanvas.boundingBox();
    if (!box) throw new Error('Left canvas not found');

    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    await leftCanvas.dispatchEvent('mousedown', { clientX: centerX, clientY: centerY });

    // Move right by 50px
    await page.mouse.move(centerX + 50, centerY);
    await page.mouse.up();

    // Region info should have changed
    await expect(async () => {
      const newText = await regionText.textContent();
      expect(newText).not.toBe(initialText);
    }).toPass({ timeout: 5000 });
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
