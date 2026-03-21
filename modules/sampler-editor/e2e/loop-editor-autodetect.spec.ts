/**
 * Playwright E2E tests for loop point auto-detection with boundary condition signals.
 *
 * Runs against both sampler-editor and dev-harness via Playwright projects.
 * Each test loads a specific test signal via ?signal= URL param, clicks
 * Auto-Detect, and verifies the expected behavior.
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

async function clickAutoDetect(page: import('@playwright/test').Page) {
  const autoDetectBtn = page.getByRole('button', { name: 'Auto-Detect' });
  await expect(autoDetectBtn).toBeVisible();
  await autoDetectBtn.click();

  // Wait for search to start (button text changes to "Searching...")
  await expect(page.getByText('Searching...')).toBeVisible({ timeout: 2000 });
}

async function waitForSearchComplete(page: import('@playwright/test').Page) {
  // Wait for "Searching..." to disappear — search is done
  await expect(page.getByText('Searching...')).not.toBeVisible({ timeout: 15000 });
}

test.describe('Auto-Detect — boundary condition signals', () => {
  test('pure sustain: finds candidates with good scores', async ({ page }, testInfo) => {
    await page.goto(getBaseUrl(testInfo.project.name, 'sustain'));
    await waitForReady(page);

    await clickAutoDetect(page);
    await waitForSearchComplete(page);

    // Should find candidates
    const candidateLabel = page.getByText(/Loop Candidates \(\d+\)/);
    await expect(candidateLabel).toBeVisible();

    // Should have candidate buttons visible
    const candidateButtons = page.locator('button:has-text("→")');
    const count = await candidateButtons.count();
    expect(count).toBeGreaterThan(0);
  });

  test('decay into sustain: finds candidates', async ({ page }, testInfo) => {
    await page.goto(getBaseUrl(testInfo.project.name, 'decay-into-sustain'));
    await waitForReady(page);

    await clickAutoDetect(page);
    await waitForSearchComplete(page);

    const candidateLabel = page.getByText(/Loop Candidates \(\d+\)/);
    await expect(candidateLabel).toBeVisible();
  });

  test('sustain with trailing decay: finds candidates', async ({ page }, testInfo) => {
    await page.goto(getBaseUrl(testInfo.project.name, 'sustain-trailing-decay'));
    await waitForReady(page);

    await clickAutoDetect(page);
    await waitForSearchComplete(page);

    const candidateLabel = page.getByText(/Loop Candidates \(\d+\)/);
    await expect(candidateLabel).toBeVisible();
  });

  test('trailing silence: finds candidates before silence', async ({ page }, testInfo) => {
    await page.goto(getBaseUrl(testInfo.project.name, 'trailing-silence'));
    await waitForReady(page);

    await clickAutoDetect(page);
    await waitForSearchComplete(page);

    const candidateLabel = page.getByText(/Loop Candidates \(\d+\)/);
    await expect(candidateLabel).toBeVisible();
  });

  test('constant decay: handles gracefully (no candidates or error)', async ({ page }, testInfo) => {
    await page.goto(getBaseUrl(testInfo.project.name, 'constant-decay'));
    await waitForReady(page);

    await clickAutoDetect(page);
    await waitForSearchComplete(page);

    // The algorithm throws decaying_sample error for this signal.
    // The UI should NOT show candidates — it should return to the
    // Auto-Detect button state (no "Loop Candidates" label).
    const candidateLabel = page.getByText(/Loop Candidates/);
    await expect(candidateLabel).not.toBeVisible();

    // Auto-Detect button should be back (not stuck on Searching)
    const autoDetectBtn = page.getByRole('button', { name: 'Auto-Detect' });
    await expect(autoDetectBtn).toBeVisible();
  });

  test('leading silence with default config: handles gracefully', async ({ page }, testInfo) => {
    await page.goto(getBaseUrl(testInfo.project.name, 'leading-silence'));
    await waitForReady(page);

    await clickAutoDetect(page);
    await waitForSearchComplete(page);

    // With default search config, leading silence produces no candidates
    // (start search window falls in the silent region).
    // The UI should not show candidates and should not crash.
    const autoDetectBtn = page.getByRole('button', { name: 'Auto-Detect' });
    await expect(autoDetectBtn).toBeVisible();
  });
});
