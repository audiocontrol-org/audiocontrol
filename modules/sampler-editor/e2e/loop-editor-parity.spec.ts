/**
 * Feature parity test for the loop editor.
 *
 * Verifies that every shared UI feature is present on BOTH surfaces
 * (sampler-editor and dev-harness). This is a checklist test — when a
 * new feature is added to the loop editor, add an assertion here.
 *
 * If this test fails on one surface but passes on the other, there is
 * a wiring divergence that needs to be fixed.
 */

import { test, expect } from '@playwright/test';

function getBaseUrl(projectName: string | undefined): string {
  if (projectName === 'dev-harness') return '/';
  return '/roland/s330/editor/test/loop-editor';
}

async function waitForReady(page: import('@playwright/test').Page) {
  await expect(page.getByTestId('keyboard-input-status')).toContainText('active');
  await expect(page.getByTestId('loop-editor-test-page')).toBeVisible();
}

test.describe('Loop Editor — feature parity', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await page.goto(getBaseUrl(testInfo.project.name));
    await waitForReady(page);
  });

  // -----------------------------------------------------------------------
  // Waveform display
  // -----------------------------------------------------------------------

  test('waveform canvas renders', async ({ page }) => {
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // Loop point controls
  // -----------------------------------------------------------------------

  test('end point input is visible', async ({ page }) => {
    await expect(page.getByTestId('end-point-input')).toBeVisible();
  });

  test('loop point input is visible', async ({ page }) => {
    await expect(page.getByTestId('loop-point-input')).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // Auto-detect
  // -----------------------------------------------------------------------

  test('auto-detect button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Auto-Detect' })).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // Preview controls
  // -----------------------------------------------------------------------

  test('preview button is visible', async ({ page }) => {
    await expect(page.getByTestId('preview-loop-btn')).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // Playback mode toggle
  // -----------------------------------------------------------------------

  test('playback mode: no-loop button', async ({ page }) => {
    await expect(page.getByTestId('playback-mode-no-loop')).toBeVisible();
  });

  test('playback mode: loop button', async ({ page }) => {
    await expect(page.getByTestId('playback-mode-loop')).toBeVisible();
  });

  test('playback mode: smoothed-loop button', async ({ page }) => {
    await expect(page.getByTestId('playback-mode-smoothed-loop')).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // Discontinuity indicator
  // -----------------------------------------------------------------------

  test('discontinuity indicator is visible', async ({ page }) => {
    await expect(page.getByTestId('discontinuity-indicator')).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // Crossfade length control
  // -----------------------------------------------------------------------

  test('crossfade length slider is visible', async ({ page }) => {
    await expect(page.getByTestId('crossfade-length-slider')).toBeVisible();
  });

  test('crossfade length value is displayed', async ({ page }) => {
    await expect(page.getByTestId('crossfade-length-value')).toBeVisible();
    await expect(page.getByTestId('crossfade-length-value')).toContainText('64');
  });

  // -----------------------------------------------------------------------
  // MIDI / keyboard playback
  // -----------------------------------------------------------------------

  test('keyboard triggers MIDI voice indicator', async ({ page }) => {
    await page.keyboard.down('z');
    await expect(page.getByText('MIDI: 1 voice')).toBeVisible();
    await page.keyboard.up('z');
    await expect(page.getByText(/MIDI:/)).not.toBeVisible();
  });
});
