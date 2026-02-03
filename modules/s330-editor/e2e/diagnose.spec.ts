import { test, expect } from '@playwright/test';

test('diagnose MIDI and patch fetching', async ({ page }) => {
  // Collect all console messages
  const consoleLogs: string[] = [];
  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`;
    consoleLogs.push(text);
    console.log(text);
  });

  // Also capture errors
  page.on('pageerror', err => {
    console.log('[PAGE ERROR]', err.message);
  });

  // Go to home page
  await page.goto('/');
  console.log('\n=== HOME PAGE LOADED ===\n');

  // Wait a moment for MIDI initialization
  await page.waitForTimeout(2000);

  // Check what's on the page
  const errorBox = page.locator('.bg-red-500\\/20');
  if (await errorBox.isVisible()) {
    const errorText = await errorBox.textContent();
    console.log('\n=== ERROR DISPLAYED ===');
    console.log(errorText);
  }

  // Check MIDI status
  const statusText = await page.locator('header').textContent();
  console.log('\n=== HEADER STATUS ===');
  console.log(statusText);

  // List available ports (check console logs)
  console.log('\n=== CHECKING FOR MIDI PORTS ===');

  // Try to see port dropdowns
  const inputSelector = page.locator('text=MIDI Input').locator('..').locator('button');
  if (await inputSelector.isVisible()) {
    await inputSelector.click();
    await page.waitForTimeout(500);

    // Get dropdown content
    const dropdownContent = await page.locator('[role="listbox"]').textContent();
    console.log('Input ports:', dropdownContent || 'No dropdown found');

    // Press escape to close
    await page.keyboard.press('Escape');
  }

  // Check output ports
  const outputSelector = page.locator('text=MIDI Output').locator('..').locator('button');
  if (await outputSelector.isVisible()) {
    await outputSelector.click();
    await page.waitForTimeout(500);

    const dropdownContent = await page.locator('[role="listbox"]').textContent();
    console.log('Output ports:', dropdownContent || 'No dropdown found');

    await page.keyboard.press('Escape');
  }

  // Print all console logs collected
  console.log('\n=== ALL CONSOLE LOGS ===');
  consoleLogs.forEach(log => console.log(log));

  // Keep browser open for manual inspection
  console.log('\n=== BROWSER STAYING OPEN FOR 30 SECONDS ===');
  console.log('Check the browser to see the current state');
  await page.waitForTimeout(30000);
});
