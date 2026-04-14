import { test, expect } from '@playwright/test';

const HARNESS_URL = '/akai/s3000xl/editor/test/keygroups';

test.describe('Zone Overview Test Harness', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HARNESS_URL);
    await page.waitForLoadState('networkidle');
  });

  // --- Rendering ---

  test('page loads with heading', async ({ page }) => {
    await expect(page.getByText('Keygroup Zone Test Harness')).toBeVisible();
  });

  test('shows keygroup count in overview heading', async ({ page }) => {
    await expect(
      page.getByText('ZoneOverview (4 keygroups)'),
    ).toBeVisible();
  });

  test('shows per-keygroup editor cards', async ({ page }) => {
    await expect(page.getByText('Keygroup 1 -- Notes 36-59')).toBeVisible();
    await expect(page.getByText('Keygroup 2 -- Notes 60-72')).toBeVisible();
    await expect(page.getByText('Keygroup 3 -- Notes 48-84')).toBeVisible();
    await expect(page.getByText('Keygroup 4 -- Notes 24-48')).toBeVisible();
  });

  test('zoom toolbar is visible with all buttons', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: '+ Zoom In' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: '- Zoom Out' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fit' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible();
  });

  test('default range is full MIDI range 0-127', async ({ page }) => {
    // The toolbar displays the range as "{min}-{max}" in a font-mono span
    const rangeDisplay = page.locator('.font-mono').filter({ hasText: '0-127' });
    await expect(rangeDisplay.first()).toBeVisible();
  });

  test('zone rectangles are rendered in overview', async ({ page }) => {
    // Each velocity zone renders as a role="button" element with a title.
    // KG1 has 2 velocity zones (Bass Soft, Bass Hard).
    const kg1Zone = page.locator('[role="button"][title*="KG 1"]');
    await expect(kg1Zone.first()).toBeVisible();

    const kg2Zone = page.locator('[role="button"][title*="KG 2"]');
    await expect(kg2Zone.first()).toBeVisible();
  });

  // --- Zoom interactions ---

  test('Fit button narrows range to keygroup data extent', async ({ page }) => {
    await page.getByRole('button', { name: 'Fit' }).click();

    // After fit, range should be tighter than 0-127.
    // KG4 starts at 24, KG3 ends at 84, so with padding roughly ~20-88.
    const fullRangeDisplay = page.locator('.font-mono').filter({ hasText: '0-127' });
    await expect(fullRangeDisplay).toHaveCount(0);
  });

  test('Zoom In narrows the visible range', async ({ page }) => {
    // Start from Fit so the range is known
    await page.getByRole('button', { name: 'Fit' }).click();

    const rangeSpan = page.locator('.font-mono').last();
    const initialText = await rangeSpan.textContent();

    await page.getByRole('button', { name: '+ Zoom In' }).click();

    const afterText = await rangeSpan.textContent();
    expect(afterText).not.toBe(initialText);
  });

  test('Zoom Out widens the visible range', async ({ page }) => {
    // Zoom in first to have room to zoom out
    await page.getByRole('button', { name: 'Fit' }).click();
    await page.getByRole('button', { name: '+ Zoom In' }).click();

    const rangeSpan = page.locator('.font-mono').last();
    const zoomedText = await rangeSpan.textContent();

    await page.getByRole('button', { name: '- Zoom Out' }).click();
    const afterText = await rangeSpan.textContent();
    expect(afterText).not.toBe(zoomedText);
  });

  test('Reset returns to full 0-127 range', async ({ page }) => {
    // Zoom in first
    await page.getByRole('button', { name: 'Fit' }).click();
    await page.getByRole('button', { name: '+ Zoom In' }).click();

    // Reset
    await page.getByRole('button', { name: 'Reset' }).click();

    const fullRangeDisplay = page.locator('.font-mono').filter({ hasText: '0-127' });
    await expect(fullRangeDisplay.first()).toBeVisible();
  });

  test('Zoom Out is disabled when at full range', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: '- Zoom Out' }),
    ).toBeDisabled();
  });

  test('Reset is disabled when at full range', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: 'Reset' }),
    ).toBeDisabled();
  });

  // --- Selection ---

  test('clicking a keygroup card selects it', async ({ page }) => {
    // Click keygroup 2 card text
    await page.getByText('Keygroup 2 -- Notes 60-72').click();

    // The card container should now have the selected border color (#3b82f6)
    const card = page
      .getByText('Keygroup 2 -- Notes 60-72')
      .locator('..');
    await expect(card).toHaveCSS('border-color', 'rgb(59, 130, 246)');
  });

  test('clicking a different card changes selection', async ({ page }) => {
    // Keygroup 1 is selected by default (selectedIndex starts at 0)
    const kg1Card = page
      .getByText('Keygroup 1 -- Notes 36-59')
      .locator('..');
    await expect(kg1Card).toHaveCSS('border-color', 'rgb(59, 130, 246)');

    // Select keygroup 3
    await page.getByText('Keygroup 3 -- Notes 48-84').click();

    const kg3Card = page
      .getByText('Keygroup 3 -- Notes 48-84')
      .locator('..');
    await expect(kg3Card).toHaveCSS('border-color', 'rgb(59, 130, 246)');

    // Keygroup 1 should no longer be selected
    await expect(kg1Card).toHaveCSS('border-color', 'rgb(55, 65, 81)');
  });

  // --- KeyRangeEditor slider drag ---

  test('dragging the high note slider handle changes high note value', async ({
    page,
  }) => {
    // Find the first keygroup's High note slider (aria-label="High note")
    const highHandle = page
      .locator('[aria-label="High note"]')
      .first();
    await expect(highHandle).toBeVisible();

    // Read initial value from aria-valuenow
    const initialValue = await highHandle.getAttribute('aria-valuenow');
    expect(initialValue).toBe('59'); // KG1 HINOTE

    const handleBox = await highHandle.boundingBox();
    if (!handleBox) throw new Error('High handle bounding box not found');

    // Drag right by 40px
    const startX = handleBox.x + handleBox.width / 2;
    const startY = handleBox.y + handleBox.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 40, startY, { steps: 5 });
    await page.mouse.up();

    // The card text should now reflect a higher note value
    // The card heading updates reactively: "Keygroup 1 -- Notes 36-{new}"
    const cardText = page
      .getByText(/^Keygroup 1 -- Notes 36-/)
      .first();
    const text = await cardText.textContent();
    // Extract the high note value from the card text
    const match = text?.match(/Notes 36-(\d+)/);
    expect(match).not.toBeNull();
    const newHighNote = Number(match![1]);
    expect(newHighNote).toBeGreaterThan(59);
  });

  test('dragging the low note slider handle changes low note value', async ({
    page,
  }) => {
    const lowHandle = page
      .locator('[aria-label="Low note"]')
      .first();
    await expect(lowHandle).toBeVisible();

    const initialValue = await lowHandle.getAttribute('aria-valuenow');
    expect(initialValue).toBe('36'); // KG1 LONOTE

    const handleBox = await lowHandle.boundingBox();
    if (!handleBox) throw new Error('Low handle bounding box not found');

    // Drag left by 40px
    const startX = handleBox.x + handleBox.width / 2;
    const startY = handleBox.y + handleBox.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX - 40, startY, { steps: 5 });
    await page.mouse.up();

    // Card text should now reflect a lower low-note value
    const cardText = page
      .getByText(/^Keygroup 1 -- Notes \d+-/)
      .first();
    const text = await cardText.textContent();
    const match = text?.match(/Notes (\d+)-/);
    expect(match).not.toBeNull();
    const newLowNote = Number(match![1]);
    expect(newLowNote).toBeLessThan(36);
  });

  // --- Zone creation via drag in empty space ---

  test('dragging in empty overview space creates a new keygroup', async ({
    page,
  }) => {
    // Count initial keygroup cards
    const initialCards = await page
      .getByText(/^Keygroup \d+ -- Notes/)
      .count();
    expect(initialCards).toBe(4);

    // Already at full range (default state), so notes 85-127 are empty space.

    // The viz area is the div that contains the zone rects.
    // It is inside the overview container (bg-gray-900/70) and positioned after
    // the left label area. We find the zone rects' parent container.
    const vizArea = page
      .locator('.bg-gray-900\\/70')
      .first()
      .locator('> div')
      .nth(1); // second child is the viz area (first is velocity labels)

    const box = await vizArea.boundingBox();
    if (!box) throw new Error('Viz area bounding box not found');

    // Drag a small region in the far right area (high notes, empty space).
    // Use a narrow drag to avoid accidentally creating multiple zones.
    const startX = box.x + box.width * 0.90;
    const startY = box.y + box.height * 0.4;
    const endX = box.x + box.width * 0.94;
    const endY = box.y + box.height * 0.6;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 5 });
    await page.mouse.up();

    // At least one new keygroup should have been created
    const newCards = await page
      .getByText(/^Keygroup \d+ -- Notes/)
      .count();
    expect(newCards).toBeGreaterThan(initialCards);

    // A new keygroup card should be visible
    await expect(page.getByText(/^Keygroup 5 -- Notes/)).toBeVisible();
  });

  // --- Velocity zones ---

  test('velocity zone bars are rendered for multi-zone keygroups', async ({
    page,
  }) => {
    // KG1 has 2 velocity zones (Bass Soft and Bass Hard)
    await expect(page.getByText('Velocity Zones').first()).toBeVisible();

    // KG4 has 4 velocity zones in the overview (Sub Bass, Mid Layer,
    // Top Layer, plus zone 4 which has default HIVEL4=127 from the factory)
    const kg4Zones = page.locator(
      '[role="button"][title*="KG 4 Zone"]',
    );
    await expect(kg4Zones).toHaveCount(4);
  });

  // --- Overview zone drag (drag zone edge in overview) ---

  test('dragging a zone in the overview translates its position', async ({
    page,
  }) => {
    // Select KG2 first via the card (gives KG2 z-index 10 in the overview)
    await page.getByText('Keygroup 2 -- Notes 60-72').click();

    // Scroll to top so the overview is visible for mouse interactions
    await page.evaluate(() => window.scrollTo(0, 0));

    // KG2 zone rect in the overview (now selected, so z-index 10)
    const kg2Zone = page
      .locator('[role="button"][title*="KG 2"]')
      .first();
    await expect(kg2Zone).toBeVisible();

    const zoneBox = await kg2Zone.boundingBox();
    if (!zoneBox) throw new Error('KG2 zone bounding box not found');

    // Drag the center of KG2's zone body to the right.
    // This triggers a translate drag (moves both LONOTE and HINOTE together).
    const centerX = zoneBox.x + zoneBox.width / 2;
    const centerY = zoneBox.y + zoneBox.height / 2;

    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 80, centerY, { steps: 10 });
    await page.mouse.up();

    // The card should now show shifted note values.
    // Original was 60-72; after dragging right, both should increase.
    const cardText = page
      .getByText(/^Keygroup 2 -- Notes \d+-\d+/)
      .first();
    const text = await cardText.textContent();
    const match = text?.match(/Notes (\d+)-(\d+)/);
    expect(match).not.toBeNull();
    const newLow = Number(match![1]);
    const newHigh = Number(match![2]);
    // The range size should be preserved (12 notes)
    expect(newHigh - newLow).toBe(12);
    // Both values should have increased
    expect(newLow).toBeGreaterThan(60);
    expect(newHigh).toBeGreaterThan(72);
  });
});
