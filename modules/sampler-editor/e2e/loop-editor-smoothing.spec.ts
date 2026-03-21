/**
 * Playwright E2E tests for the loop smoothing three-way toggle.
 *
 * Runs against both sampler-editor and dev-harness via Playwright projects.
 * Tests the playback mode toggle (No Loop / Loop / Smoothed) and
 * discontinuity indicator with a signal that has a deliberate splice
 * point discontinuity.
 */

import { test, expect } from '@playwright/test';

function getBaseUrl(projectName: string | undefined, signal: string): string {
  if (projectName === 'dev-harness') return `/?signal=${signal}`;
  return `/roland/s330/editor/test/loop-editor?signal=${signal}`;
}

async function waitForReady(page: import('@playwright/test').Page) {
  await expect(page.getByTestId('keyboard-input-status')).toContainText('active');
  await expect(page.getByTestId('loop-editor-test-page')).toBeVisible();
}

test.describe('Loop Smoothing — playback mode toggle', () => {
  test('shows three playback mode buttons', async ({ page }, testInfo) => {
    await page.goto(getBaseUrl(testInfo.project.name, 'sustain'));
    await waitForReady(page);

    await expect(page.getByTestId('playback-mode-no-loop')).toBeVisible();
    await expect(page.getByTestId('playback-mode-loop')).toBeVisible();
    await expect(page.getByTestId('playback-mode-smoothed-loop')).toBeVisible();
  });

  test('loop mode is selected by default', async ({ page }, testInfo) => {
    await page.goto(getBaseUrl(testInfo.project.name, 'sustain'));
    await waitForReady(page);

    // The "Loop" button should have the primary style (selected)
    const loopBtn = page.getByTestId('playback-mode-loop');
    await expect(loopBtn).toHaveClass(/ac-btn-primary/);
  });

  test('can switch to no-loop mode', async ({ page }, testInfo) => {
    await page.goto(getBaseUrl(testInfo.project.name, 'sustain'));
    await waitForReady(page);

    await page.getByTestId('playback-mode-no-loop').click();

    const noLoopBtn = page.getByTestId('playback-mode-no-loop');
    await expect(noLoopBtn).toHaveClass(/ac-btn-primary/);

    // Loop button should no longer be primary
    const loopBtn = page.getByTestId('playback-mode-loop');
    await expect(loopBtn).not.toHaveClass(/ac-btn-primary/);
  });

  test('can switch to smoothed-loop mode', async ({ page }, testInfo) => {
    await page.goto(getBaseUrl(testInfo.project.name, 'sustain'));
    await waitForReady(page);

    await page.getByTestId('playback-mode-smoothed-loop').click();

    const smoothedBtn = page.getByTestId('playback-mode-smoothed-loop');
    await expect(smoothedBtn).toHaveClass(/ac-btn-primary/);
  });

  test('can toggle between all three modes', async ({ page }, testInfo) => {
    await page.goto(getBaseUrl(testInfo.project.name, 'sustain'));
    await waitForReady(page);

    // Start in loop mode
    await expect(page.getByTestId('playback-mode-loop')).toHaveClass(/ac-btn-primary/);

    // Switch to smoothed
    await page.getByTestId('playback-mode-smoothed-loop').click();
    await expect(page.getByTestId('playback-mode-smoothed-loop')).toHaveClass(/ac-btn-primary/);

    // Switch to no-loop
    await page.getByTestId('playback-mode-no-loop').click();
    await expect(page.getByTestId('playback-mode-no-loop')).toHaveClass(/ac-btn-primary/);

    // Back to loop
    await page.getByTestId('playback-mode-loop').click();
    await expect(page.getByTestId('playback-mode-loop')).toHaveClass(/ac-btn-primary/);
  });

  test('keyboard playback works in all three modes', async ({ page }, testInfo) => {
    await page.goto(getBaseUrl(testInfo.project.name, 'sustain'));
    await waitForReady(page);

    // Loop mode — keyboard triggers voice
    await page.keyboard.down('z');
    await expect(page.getByText('MIDI: 1 voice')).toBeVisible();
    await page.keyboard.up('z');

    // Smoothed mode — keyboard still triggers voice
    await page.getByTestId('playback-mode-smoothed-loop').click();
    await page.keyboard.down('z');
    await expect(page.getByText('MIDI: 1 voice')).toBeVisible();
    await page.keyboard.up('z');

    // No-loop mode — keyboard still triggers voice
    await page.getByTestId('playback-mode-no-loop').click();
    await page.keyboard.down('z');
    await expect(page.getByText('MIDI: 1 voice')).toBeVisible();
    await page.keyboard.up('z');
  });
});

test.describe('Loop Smoothing — discontinuity indicator', () => {
  test('shows discontinuity indicator for signal with splice mismatch', async ({ page }, testInfo) => {
    await page.goto(getBaseUrl(testInfo.project.name, 'discontinuity'));
    await waitForReady(page);

    // The discontinuity indicator should be visible and show a warning
    const indicator = page.getByTestId('discontinuity-indicator');
    await expect(indicator).toBeVisible();
  });

  test('discontinuity indicator shows percentage', async ({ page }, testInfo) => {
    await page.goto(getBaseUrl(testInfo.project.name, 'discontinuity'));
    await waitForReady(page);

    const indicator = page.getByTestId('discontinuity-indicator');
    // Should show a percentage value
    await expect(indicator).toContainText('%');
  });

  test('discontinuity indicator shows either warning or checkmark', async ({ page }, testInfo) => {
    await page.goto(getBaseUrl(testInfo.project.name, 'sustain'));
    await waitForReady(page);

    const indicator = page.getByTestId('discontinuity-indicator');
    await expect(indicator).toBeVisible();
    // Should show either ⚠ (needs smoothing) or ✓ (clean splice)
    // depending on whether loop points fall on matching zero crossings
    const text = await indicator.textContent();
    expect(text).toMatch(/[⚠✓]/);
    expect(text).toContain('%');
  });
});
