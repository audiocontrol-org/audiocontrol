import { test } from '@playwright/test';

test('connect and fetch patches', async ({ page }) => {
  // Collect all console messages
  page.on('console', msg => {
    console.log(`[${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.log('[PAGE ERROR]', err.message);
  });

  // Go to home page
  await page.goto('/');
  await page.waitForTimeout(2000);

  console.log('\n=== SELECTING MIDI PORTS ===\n');

  // Select Volt 4 input
  const inputTrigger = page.locator('text=MIDI Input').locator('..').locator('button');
  await inputTrigger.click();
  await page.waitForTimeout(300);
  await page.locator('[role="option"]').filter({ hasText: 'Volt 4' }).first().click();
  await page.waitForTimeout(300);

  // Select Volt 4 output
  const outputTrigger = page.locator('text=MIDI Output').locator('..').locator('button');
  await outputTrigger.click();
  await page.waitForTimeout(300);
  await page.locator('[role="option"]').filter({ hasText: 'Volt 4' }).first().click();
  await page.waitForTimeout(300);

  // Set device ID to 1 (display value, which maps to protocol value 0)
  // The S-330 shows "Device ID = 1" on screen, but uses 0x00 in SysEx protocol
  const deviceIdInput = page.locator('input[type="number"]');
  await deviceIdInput.fill('1');
  await page.waitForTimeout(300);

  console.log('\n=== CONNECTING ===\n');

  // Click Connect
  await page.click('button:has-text("Connect")');
  await page.waitForTimeout(1000);

  // Check status
  const headerText = await page.locator('header').textContent();
  console.log('Header after connect:', headerText);

  console.log('\n=== NAVIGATING TO PATCHES ===\n');

  // Click Continue to Patches or navigate directly
  const continueBtn = page.locator('button:has-text("Continue to Patches")');
  if (await continueBtn.isVisible()) {
    await continueBtn.click();
  } else {
    await page.click('nav >> text=Patches');
  }

  await page.waitForTimeout(500);

  console.log('\n=== WAITING FOR FETCH (15 seconds) ===\n');

  // Wait and watch console for the RQD request and any responses
  await page.waitForTimeout(15000);

  // Check for error message
  const errorBox = page.locator('.bg-red-500\\/20');
  if (await errorBox.isVisible()) {
    const errorText = await errorBox.textContent();
    console.log('\n=== ERROR DISPLAYED ===');
    console.log(errorText);
  }

  // Check if still loading
  const loadingSpinner = page.locator('.animate-spin');
  if (await loadingSpinner.isVisible()) {
    console.log('\n=== STILL LOADING (spinner visible) ===');
  }

  // Check page content
  const pageContent = await page.locator('main').textContent();
  console.log('\n=== PAGE CONTENT ===');
  console.log(pageContent?.substring(0, 500));

  console.log('\n=== KEEPING BROWSER OPEN 30s FOR INSPECTION ===\n');
  await page.waitForTimeout(30000);
});
