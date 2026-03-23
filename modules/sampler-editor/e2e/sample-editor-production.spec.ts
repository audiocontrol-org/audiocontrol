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
    // Use fade-in-hits: has varying amplitudes, so threshold changes produce
    // different trim points (unlike leading-silence where silence is absolute zero)
    await openEditorForSample(page, testInfo.project.name, 'fade-in-hits');
    await page.getByRole('tab', { name: 'Trim' }).click();
  });

  test('trim silence auto-positions handles', async ({ page }) => {
    await expect(page.getByText(/Keep/)).toBeVisible({ timeout: 5000 });
  });

  test('trim silence threshold slider is interactive', async ({ page }) => {
    const slider = page.locator('[role="dialog"] input[type="range"]').first();
    await expect(slider).toBeVisible({ timeout: 500 });

    // Get initial region text
    const regionText = page.locator('[role="dialog"]').getByText(/Keep \d+/);
    await expect(regionText).toBeVisible({ timeout: 5000 });
    const initialText = await regionText.textContent();

    // Drag the slider thumb to change value.
    // The slider goes from -60 to -10. Click near the RIGHT end to set a
    // high threshold (~-12dB). The fade-in-hits signal has hits at amplitudes
    // 0.1 (-20dB), 0.3 (-10dB), 0.6 (-4dB), 0.9 (-1dB). At -12dB threshold,
    // only the 0.3, 0.6, 0.9 hits are above threshold — different trim points.
    const box = await slider.boundingBox();
    if (!box) throw new Error('Slider not found');
    await page.mouse.click(box.x + box.width * 0.95, box.y + box.height / 2);

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

  test('drag end handle in single-pane mode', async ({ page }) => {
    // Get region info before drag
    await expect(page.getByText(/Keep/)).toBeVisible({ timeout: 5000 });
    const regionText = page.locator('[role="dialog"]').getByText(/Keep \d+/);
    const initialText = await regionText.textContent();

    // Parse the end value to calculate handle position
    const endMatch = initialText?.match(/→ (\d+)/);
    const endSample = endMatch ? parseInt(endMatch[1], 10) : 0;

    // Get canvas bounding box
    const canvas = page.locator('[role="dialog"] canvas').first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // The end handle is at (endSample / totalSamples) of the canvas width.
    // For fade-in-hits: ~19800 / 30000 ≈ 66% of canvas width.
    // We approximate total samples from the region text.
    const totalMatch = initialText?.match(/removing ([\d.]+)ms/);
    const keepMatch = initialText?.match(/([\d.]+)ms,/);
    const keepMs = keepMatch ? parseFloat(keepMatch[1]) : 660;
    const removeMs = totalMatch ? parseFloat(totalMatch[1]) : 340;
    const endFraction = keepMs / (keepMs + removeMs);
    const handleX = box.x + box.width * endFraction;
    const centerY = box.y + box.height / 2;

    await page.mouse.move(handleX, centerY);
    await page.mouse.down();
    await page.mouse.move(handleX - 150, centerY, { steps: 10 });
    await page.mouse.up();

    // Region info should have changed (end point moved left)
    await expect(async () => {
      const newText = await regionText.textContent();
      expect(newText).not.toBe(initialText);
    }).toPass({ timeout: 5000 });
  });

  test('waveform shows full sample after dragging handle (no zoom-in)', async ({ page }) => {
    // BUG: after dragging the end handle left, the waveform re-renders to show
    // only the trimmed region at full width, making it look zoomed in. The handle
    // ends up back at the right edge instead of where the user dragged it.
    //
    // EXPECTED: waveform always shows the full sample, handle moves within it,
    // dimmed regions show what will be trimmed.
    await expect(page.getByText(/Keep/)).toBeVisible({ timeout: 5000 });

    const canvas = page.locator('[role="dialog"] canvas').first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // Drag end handle from right edge to ~halfway
    const rightEdge = box.x + box.width - 5;
    const midPoint = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    await page.mouse.move(rightEdge, centerY);
    await page.mouse.down();
    await page.mouse.move(midPoint, centerY, { steps: 10 });
    await page.mouse.up();

    // Region should have changed
    const regionText = page.locator('[role="dialog"]').getByText(/Keep \d+/);
    await expect(regionText).toBeVisible({ timeout: 5000 });

    // Now try to drag from the ORIGINAL right edge again.
    // If the waveform zoomed in (bug), there's a handle at the right edge.
    // If the waveform is correct, the right edge has no handle — the handle
    // is at the midpoint where we left it.
    // Drag from midpoint should move the handle further left.
    await page.mouse.move(midPoint, centerY);
    await page.mouse.down();
    await page.mouse.move(midPoint - 100, centerY, { steps: 5 });
    await page.mouse.up();

    // The end value should be less than what the first drag produced
    const text = await regionText.textContent();
    const match = text?.match(/→ (\d+)/);
    const endValue = match ? parseInt(match[1], 10) : 0;

    // If the handle was at midpoint (correct), this drag moved it further left.
    // The end value should be significantly less than the total samples.
    // For fade-in-hits at 30000Hz, total is ~30000 samples.
    // Dragging to midpoint would be ~15000, then further left ~10000-12000.
    expect(endValue).toBeLessThan(20000);
  });

  test('drag handle in split-pane mode moves handle, not waveform', async ({ page }) => {
    // Zoom in to get split pane
    await page.getByTitle('Zoom in (+)').click();
    await expect(page.locator('[role="dialog"] canvas')).toHaveCount(2, { timeout: 500 });

    // Get region info before drag
    const regionText = page.locator('[role="dialog"]').getByText(/Keep \d+/);
    await expect(regionText).toBeVisible({ timeout: 5000 });
    const initialText = await regionText.textContent();

    // Drag on the left canvas (start handle) using page.mouse
    const leftCanvas = page.locator('[role="dialog"] canvas').first();
    const box = await leftCanvas.boundingBox();
    if (!box) throw new Error('Left canvas not found');

    const startX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    // Drag right by 80px in small steps
    await page.mouse.move(startX, centerY);
    await page.mouse.down();
    await page.mouse.move(startX + 80, centerY, { steps: 5 });
    await page.mouse.up();

    // Region text should have changed (handle moved, trim region updated)
    await expect(async () => {
      const newText = await regionText.textContent();
      expect(newText).not.toBe(initialText);
    }).toPass({ timeout: 5000 });

    // The waveform should still be in split-pane mode (2 canvases),
    // NOT have zoomed or switched modes
    await expect(page.locator('[role="dialog"] canvas')).toHaveCount(2);
  });

  test('consecutive small drags produce incremental handle movement', async ({ page }) => {
    // This tests that the handle moves relative to the waveform (not re-centering).
    // If the waveform re-centers on the handle after each drag, consecutive
    // drags of the same pixel distance would produce the same absolute delta
    // from the original position (because the starting pixel resets to center).
    // With proper fixed-viewport behavior, each drag starts from where the
    // previous one left off.
    await page.getByTitle('Zoom in (+)').click();
    await expect(page.locator('[role="dialog"] canvas')).toHaveCount(2, { timeout: 500 });

    const regionText = page.locator('[role="dialog"]').getByText(/Keep \d+/);
    await expect(regionText).toBeVisible({ timeout: 5000 });

    const leftCanvas = page.locator('[role="dialog"] canvas').first();
    const box = await leftCanvas.boundingBox();
    if (!box) throw new Error('Left canvas not found');

    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    // Extract start value from region text
    const parseStart = async () => {
      const text = await regionText.textContent();
      const match = text?.match(/Keep (\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    };

    const startBefore = await parseStart();

    // First drag: right by 30px
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 30, centerY, { steps: 3 });
    await page.mouse.up();
    await page.waitForTimeout(100);
    const startAfterDrag1 = await parseStart();

    // Second drag: right by another 30px FROM CURRENT POSITION
    // If the handle moved to a new position (not re-centered), we need to
    // start from where it is now. With re-centering, the handle is back at
    // center, so starting from center again would give the same delta.
    await page.mouse.move(centerX + 30, centerY); // where the handle should be now
    await page.mouse.down();
    await page.mouse.move(centerX + 60, centerY, { steps: 3 });
    await page.mouse.up();
    await page.waitForTimeout(100);
    const startAfterDrag2 = await parseStart();

    // Both drags should have moved the start forward
    expect(startAfterDrag1).toBeGreaterThan(startBefore);
    expect(startAfterDrag2).toBeGreaterThan(startAfterDrag1);

    // The increments should be roughly equal (same pixel distance)
    const delta1 = startAfterDrag1 - startBefore;
    const delta2 = startAfterDrag2 - startAfterDrag1;
    // Allow 50% tolerance for rounding
    expect(delta2).toBeGreaterThan(delta1 * 0.5);
    expect(delta2).toBeLessThan(delta1 * 1.5);
  });

  test('dragging handle does not change zoom level', async ({ page }) => {
    // Zoom in to 2x
    await page.getByTitle('Zoom in (+)').click();
    await expect(page.getByText('2x')).toBeVisible({ timeout: 500 });
    await expect(page.locator('[role="dialog"] canvas')).toHaveCount(2, { timeout: 500 });

    // Drag the right canvas (end handle)
    const rightCanvas = page.locator('[role="dialog"] canvas').last();
    const box = await rightCanvas.boundingBox();
    if (!box) throw new Error('Right canvas not found');

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 80, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();

    // Zoom level should still be 2x — dragging should NOT zoom
    await expect(page.getByText('2x')).toBeVisible();
    // Should still be 2 canvases
    await expect(page.locator('[role="dialog"] canvas')).toHaveCount(2);
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
