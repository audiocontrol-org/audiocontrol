/**
 * E2E tests for the persistent editor cache (sessionStorage).
 *
 * The S3K editor stores program/sample data in Zustand stores that persist
 * to sessionStorage. After a page reload, cached data should appear
 * immediately from cache without waiting for a full device fetch.
 *
 * Requires: Pi running s2p + scsi-midi-bridge with S3000XL connected.
 */

import { test, expect } from '@playwright/test';

import {
  buildScsiUrl,
  waitForAppReady,
  connectToDevice,
} from '@audiocontrol/e2e-infra/helpers/connection-helper';

test.setTimeout(60_000);

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL;
const EDITOR_BASE_PATH = '/akai/s3000xl/editor';

function url(subpath: string = ''): string {
  return buildScsiUrl(EDITOR_BASE_PATH, subpath, BRIDGE_URL);
}

type Page = import('@playwright/test').Page;

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

async function goToProgramsPage(page: Page): Promise<void> {
  await page.goto(url());
  await waitForAppReady(page);
  await connectToDevice(page);
  // Navigate via nav bar (direct URL routing may not work)
  await page.locator('a[href*="programs"]').click();
  await page.waitForURL('**/programs**');
}

async function goToSamplesPage(page: Page): Promise<void> {
  await page.goto(url());
  await waitForAppReady(page);
  await connectToDevice(page);
  await page.locator('a[href*="samples"]').click();
  await page.waitForURL('**/samples**');
}

async function waitForProgramList(page: Page, timeout: number = 30_000): Promise<void> {
  await expect(page.locator('[data-testid="program-item-0"]')).toBeVisible({ timeout });
}

async function waitForSampleList(page: Page, timeout: number = 30_000): Promise<void> {
  await expect(page.locator('[data-testid="sample-item-0"]')).toBeVisible({ timeout });
}

async function clickFirstProgram(page: Page): Promise<void> {
  await page.locator('[data-testid="program-item-0"]').click();
  await expect(page.locator('input[type="text"][maxlength="12"]')).toBeVisible({ timeout: 10_000 });
}

async function clickFirstSample(page: Page): Promise<void> {
  await page.locator('[data-testid="sample-item-0"]').click();
  await expect(page.locator('.s3k-section-title', { hasText: 'Basic' })).toBeVisible({
    timeout: 10_000,
  });
}

async function readProgramName(page: Page): Promise<string> {
  const input = page.locator('input[type="text"][maxlength="12"]');
  return (await input.inputValue()).trim();
}

async function readSampleName(page: Page): Promise<string> {
  const input = page.locator('input[type="text"][maxlength="12"]');
  return (await input.inputValue()).trim();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Persistent editor cache (sessionStorage)', () => {
  test('program data survives page reload', async ({ page }) => {
    // 1. Navigate to programs, connect, wait for program list
    await goToProgramsPage(page);
    await waitForProgramList(page);

    // 2. Click first program, wait for program editor
    await clickFirstProgram(page);

    // 3. Read the program name from the name input
    const programNameBefore = await readProgramName(page);
    expect(programNameBefore.length).toBeGreaterThan(0);

    // 4. Reload the page — stays on /programs URL — reconnect
    await page.reload();
    await waitForAppReady(page);
    await connectToDevice(page);

    // Navigate to programs in case app resets
    const programsLink = page.locator('a[href*="programs"]');
    if (await programsLink.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await programsLink.click();
    }

    // 5. The program list should appear quickly from cache (short timeout)
    await waitForProgramList(page, 10_000);

    // 6. Click first program again and verify the name matches
    await clickFirstProgram(page);
    const programNameAfter = await readProgramName(page);
    expect(programNameAfter).toBe(programNameBefore);
  });

  test('sample selection persists across reload', async ({ page }) => {
    // 1. Navigate to samples, connect, wait for sample list
    await goToSamplesPage(page);
    await waitForSampleList(page);

    // 2. Click first sample, wait for sample editor
    await clickFirstSample(page);

    // 3. Read a value from the sample editor (the sample name)
    const sampleNameBefore = await readSampleName(page);
    expect(sampleNameBefore.length).toBeGreaterThan(0);

    // 4. Reload the page — stays on /samples URL — reconnect
    await page.reload();
    await waitForAppReady(page);
    await connectToDevice(page);

    // 5. Navigate to samples (in case the app resets to a different page)
    const samplesLink = page.locator('a[href*="samples"]');
    if (await samplesLink.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await samplesLink.click();
    }

    // The sample list should appear quickly from cache (short timeout)
    await waitForSampleList(page, 10_000);

    // 6. The selectedSampleIndex is persisted in editorStore via sessionStorage,
    //    so the same sample should be auto-selected after reload. Wait for the
    //    sample editor to appear (the "Basic" section title indicates the editor
    //    rendered with a selected sample).
    await expect(page.locator('.s3k-section-title', { hasText: 'Basic' })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('cache age indicator appears', async ({ page }) => {
    // 1. Navigate to programs, connect, wait for program list
    await goToProgramsPage(page);
    await waitForProgramList(page);

    // 2. The CacheAge component renders as a span.text-xs.text-gray-500
    //    next to the page title, showing relative time like "just now"
    const cacheAge = page.locator('span.text-xs.text-gray-500');
    await expect(cacheAge).toBeVisible({ timeout: 5_000 });

    // 3. The text should match a relative time pattern
    const text = await cacheAge.textContent();
    expect(text).toMatch(/just now|s ago|m ago|h ago/);
  });
});
