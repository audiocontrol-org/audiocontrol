/**
 * Production-path E2E tests for the loop editor.
 *
 * Exercises the REAL user flow on both surfaces:
 * - sampler-editor: Library page → browse mock samples → "Open in Loop Editor" → dialog
 * - dev-harness: Library panel auto-loads → sample loads into inline editor
 *
 * Uses ?library=mock to auto-connect an in-memory library seeded with test signals.
 * No fixture pages, no bypass routes — tests run against production code paths.
 */

import { test, expect, type Page } from '@playwright/test';

// =========================================================================
// Navigation helpers — each surface has a different path to the loop editor
// =========================================================================

async function openLoopEditorForSample(
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
  // Use exact match to avoid matching "decay-into-sustain" when looking for "sustain"
  // Find the sample in the SAMPLES category section (not CHOPPED SAMPLES).
  // Each category is a TreeSection with a .ac-tree-section-title span.
  // We need the last match since CHOPPED SAMPLES renders the same names as directories.
  const allMatches = page.locator('.ac-tree-node-name', { hasText: new RegExp(`^${sampleName}$`) });
  await expect(allMatches.first()).toBeVisible({ timeout: 10000 });
  // The SAMPLES section renders after CHOPPED SAMPLES, so use .last()
  const nameSpan = allMatches.last();
  await expect(nameSpan).toBeVisible({ timeout: 10000 });

  // Click the tree row (.ac-tree-node handles onClick, not the name span)
  const treeRow = nameSpan.locator('xpath=ancestor::div[contains(@class, "ac-tree-node")]');
  await treeRow.click();

  // The CommonSamplePreviewPanel should show "Open in Loop Editor"
  const openBtn = page.getByRole('button', { name: 'Open in Loop Editor' });
  await expect(openBtn).toBeVisible({ timeout: 5000 });
  await openBtn.click();

  // Wait for the LoopEditorDialog to open
  await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 10000 });
}

async function openInDevHarness(page: Page, sampleName: string): Promise<void> {
  await page.goto('/?library=mock');

  // Wait for mock library to auto-connect, seed, and tree to render.
  // The mock seeder generates WAV files in-memory which takes a moment.
  const treeNode = page.locator('.ac-tree-node-name', { hasText: new RegExp(`^${sampleName}$`) }).first();
  await expect(treeNode).toBeVisible({ timeout: 15000 });

  // Click the tree row (.ac-tree-node handles onClick)
  const treeRow = treeNode.locator('xpath=ancestor::div[contains(@class, "ac-tree-node")]');
  await treeRow.click();

  // Click "Open in Loop Editor" — same action as sampler-editor
  const openBtn = page.getByRole('button', { name: 'Open in Loop Editor' });
  await expect(openBtn).toBeVisible({ timeout: 5000 });
  await openBtn.click();

  // Wait for the LoopEditorDialog to open
  await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 10000 });
  // Wait for React effects to wire keyboard input
  await page.waitForTimeout(500);
}

// =========================================================================
// Feature parity — every shared feature must be present on both surfaces
// =========================================================================

test.describe('Loop Editor — production path feature parity', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await openLoopEditorForSample(page, testInfo.project.name, 'sustain');
  });

  test('waveform canvas renders', async ({ page }) => {
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('auto-detect button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Auto-Detect' })).toBeVisible();
  });

  test('preview button', async ({ page }) => {
    await expect(page.getByTestId('preview-loop-btn')).toBeVisible();
  });

  test('loop point input', async ({ page }) => {
    await expect(page.getByTestId('loop-point-input')).toBeVisible();
  });

  test('end point input', async ({ page }) => {
    await expect(page.getByTestId('end-point-input')).toBeVisible();
  });

  test('playback mode buttons', async ({ page }) => {
    await expect(page.getByTestId('playback-mode-no-loop')).toBeVisible();
    await expect(page.getByTestId('playback-mode-loop')).toBeVisible();
    await expect(page.getByTestId('playback-mode-smoothed-loop')).toBeVisible();
  });

  test('discontinuity indicator', async ({ page }) => {
    await expect(page.getByTestId('discontinuity-indicator')).toBeVisible();
  });

  test('crossfade length slider', async ({ page }) => {
    await expect(page.getByTestId('crossfade-length-slider')).toBeVisible();
    await expect(page.getByTestId('crossfade-length-value')).toBeVisible();
  });

  test('keyboard triggers MIDI voice indicator', async ({ page }) => {
    // The combined input (keyboard + MIDI) may be re-created when MIDI
    // connects async. Retry the keypress until the handler is wired.
    await expect(async () => {
      await page.keyboard.down('z');
      await expect(page.getByText('MIDI: 1 voice')).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 5000 });

    await page.keyboard.up('z');
    await expect(page.getByText(/MIDI:/)).not.toBeVisible();
  });

  test('playback mode toggle works', async ({ page }) => {
    // Default is loop
    await expect(page.getByTestId('playback-mode-loop')).toHaveClass(/ac-btn-primary/);

    // Switch to smoothed
    await page.getByTestId('playback-mode-smoothed-loop').click();
    await expect(page.getByTestId('playback-mode-smoothed-loop')).toHaveClass(/ac-btn-primary/);

    // Switch to no-loop
    await page.getByTestId('playback-mode-no-loop').click();
    await expect(page.getByTestId('playback-mode-no-loop')).toHaveClass(/ac-btn-primary/);
  });
});

// =========================================================================
// Auto-detect — through production path
// =========================================================================

test.describe('Loop Editor — production path auto-detect', () => {
  test('auto-detect finds candidates for sustain signal', async ({ page }, testInfo) => {
    await openLoopEditorForSample(page, testInfo.project.name, 'sustain');

    await page.getByRole('button', { name: 'Auto-Detect' }).click();
    await expect(page.getByText('Searching...')).toBeVisible({ timeout: 2000 });
    await expect(page.getByText('Searching...')).not.toBeVisible({ timeout: 15000 });

    await expect(page.getByText(/Loop Candidates \(\d+\)/)).toBeVisible();
  });

  test('auto-detect auto-selects first candidate', async ({ page }, testInfo) => {
    await openLoopEditorForSample(page, testInfo.project.name, 'sustain');

    // Record the loop point value before auto-detect
    const loopPointBefore = await page.getByTestId('loop-point-input').inputValue();

    await page.getByRole('button', { name: 'Auto-Detect' }).click();
    await expect(page.getByText('Searching...')).toBeVisible({ timeout: 2000 });
    await expect(page.getByText('Searching...')).not.toBeVisible({ timeout: 15000 });

    // Candidates should appear
    await expect(page.getByText(/Loop Candidates \(\d+\)/)).toBeVisible();

    // The first candidate should be highlighted (selected state)
    const firstCandidate = page.locator('button:has-text("→")').first();
    await expect(firstCandidate).toHaveClass(/highlight|selected|ac-btn-primary/i);

    // The loop point input should have changed from the initial value
    const loopPointAfter = await page.getByTestId('loop-point-input').inputValue();
    expect(loopPointAfter).not.toBe(loopPointBefore);
  });

  test('auto-detect finds candidates for decay-into-sustain', async ({ page }, testInfo) => {
    await openLoopEditorForSample(page, testInfo.project.name, 'decay-into-sustain');

    await page.getByRole('button', { name: 'Auto-Detect' }).click();
    await expect(page.getByText('Searching...')).toBeVisible({ timeout: 2000 });
    await expect(page.getByText('Searching...')).not.toBeVisible({ timeout: 15000 });

    await expect(page.getByText(/Loop Candidates \(\d+\)/)).toBeVisible();
  });

  test('constant decay: no candidates (graceful)', async ({ page }, testInfo) => {
    await openLoopEditorForSample(page, testInfo.project.name, 'constant-decay');

    await page.getByRole('button', { name: 'Auto-Detect' }).click();
    await expect(page.getByText('Searching...')).toBeVisible({ timeout: 2000 });
    await expect(page.getByText('Searching...')).not.toBeVisible({ timeout: 15000 });

    await expect(page.getByText(/Loop Candidates/)).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Auto-Detect' })).toBeVisible();
  });
});

// =========================================================================
// Smoothing — through production path
// =========================================================================

test.describe('Loop Editor — production path smoothing', () => {
  test('keyboard playback works in all three modes', async ({ page }, testInfo) => {
    await openLoopEditorForSample(page, testInfo.project.name, 'sustain');

    // Loop mode — retry until keyboard input is wired
    await expect(async () => {
      await page.keyboard.down('z');
      await expect(page.getByText('MIDI: 1 voice')).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 5000 });
    await page.keyboard.up('z');

    // Smoothed mode
    await page.getByTestId('playback-mode-smoothed-loop').click();
    await page.keyboard.down('z');
    await expect(page.getByText('MIDI: 1 voice')).toBeVisible();
    await page.keyboard.up('z');

    // No-loop mode
    await page.getByTestId('playback-mode-no-loop').click();
    await page.keyboard.down('z');
    await expect(page.getByText('MIDI: 1 voice')).toBeVisible();
    await page.keyboard.up('z');
  });

  test('discontinuity indicator shows for discontinuity signal', async ({ page }, testInfo) => {
    await openLoopEditorForSample(page, testInfo.project.name, 'discontinuity');

    const indicator = page.getByTestId('discontinuity-indicator');
    await expect(indicator).toBeVisible();
    await expect(indicator).toContainText('%');
  });
});
