import { test, expect } from '@playwright/test';

test('gallery page loads without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  expect(errors).toEqual([]);

  const title = await page.title();
  expect(title).toContain('Demo Video Gallery');
});

test('gallery renders video cards when demos exist', async ({ page }) => {
  await page.goto('/');

  // Cards load asynchronously from /api/demos
  const cards = page.locator('.card');
  await cards.first().waitFor({ state: 'attached', timeout: 10_000 });

  const count = await cards.count();
  expect(count).toBeGreaterThanOrEqual(1);

  // Each card should have a title
  for (let i = 0; i < count; i++) {
    const cardTitle = cards.nth(i).locator('.card-title');
    await expect(cardTitle).toBeVisible();
    const text = await cardTitle.textContent();
    expect(text?.length).toBeGreaterThan(0);
  }
});

test('video card shows GIF thumbnail', async ({ page }) => {
  await page.goto('/');

  const cards = page.locator('.card');
  await cards.first().waitFor({ state: 'attached', timeout: 10_000 });

  // At least one card should have an img (GIF thumbnail)
  const cardWithImg = page.locator('.card .card-thumb img');
  const imgCount = await cardWithImg.count();
  expect(imgCount).toBeGreaterThanOrEqual(1);
});

test('video card shows duration', async ({ page }) => {
  await page.goto('/');

  const cards = page.locator('.card');
  await cards.first().waitFor({ state: 'attached', timeout: 10_000 });

  // Find a card with a duration element
  const duration = cards.first().locator('.card-duration');
  await expect(duration).toBeVisible();

  const text = await duration.textContent();
  // Duration should match pattern like "00:05" or "--:--"
  expect(text).toMatch(/^\d{2}:\d{2}$|^--:--$/);
});

test('clicking card title navigates to detail view', async ({ page }) => {
  await page.goto('/');

  const cards = page.locator('.card');
  await cards.first().waitFor({ state: 'attached', timeout: 10_000 });

  const firstTitle = cards.first().locator('.card-title');
  const name = await firstTitle.textContent();

  await firstTitle.click();

  // URL hash should change to #/detail/<name>
  await page.waitForURL(`**/#/detail/${name}`);

  // Wait for the detail view to finish loading (back link only appears
  // after the async fetch completes and the real content renders)
  const backLink = page.locator('.detail-back');
  await expect(backLink).toBeVisible({ timeout: 10_000 });
});

test('detail view shows video player', async ({ page }) => {
  await page.goto('/');

  const cards = page.locator('.card');
  await cards.first().waitFor({ state: 'attached', timeout: 10_000 });

  // Navigate to the first card's detail
  const firstTitle = cards.first().locator('.card-title');
  await firstTitle.click();

  // Wait for detail content to finish loading -- the back link only
  // appears after the async fetch resolves and real content renders
  const backLink = page.locator('.detail-back');
  await backLink.waitFor({ state: 'visible', timeout: 10_000 });

  // Now the detail view has real content
  const detailView = page.locator('.detail-view');

  // Should have a video element or a "Generate Now" button
  const video = detailView.locator('video');
  const generateBtn = detailView.locator('button', { hasText: 'Generate Now' });

  const hasVideo = (await video.count()) > 0;
  const hasGenerateBtn = (await generateBtn.count()) > 0;
  expect(hasVideo || hasGenerateBtn).toBe(true);
});

test('back button returns to gallery grid', async ({ page }) => {
  await page.goto('/');

  const cards = page.locator('.card');
  await cards.first().waitFor({ state: 'attached', timeout: 10_000 });

  // Navigate to detail
  const firstTitle = cards.first().locator('.card-title');
  await firstTitle.click();

  // Wait for detail content to finish loading
  const backLink = page.locator('.detail-back');
  await backLink.waitFor({ state: 'visible', timeout: 10_000 });

  // Click back
  await backLink.click();

  // Hash should be #/ or empty
  await page.waitForFunction(() => {
    const hash = location.hash;
    return hash === '#/' || hash === '' || hash === '#';
  });

  // Cards should be visible again
  const grid = page.locator('#grid');
  await expect(grid).toBeVisible();

  const cardsAfter = page.locator('.card');
  const count = await cardsAfter.count();
  expect(count).toBeGreaterThanOrEqual(1);
});

test('Generate All button is present', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const btn = page.locator('#generate-all-btn');
  await expect(btn).toBeVisible();
  await expect(btn).toHaveText('Generate All');
});
