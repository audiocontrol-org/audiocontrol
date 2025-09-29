#!/usr/bin/env tsx
/**
 * Use Playwright to perform a write operation in the web editor
 * while capturing all MIDI traffic
 */

import { chromium } from 'playwright';

async function captureWebEditorWrite() {
  console.log('Web Editor Write Capture');
  console.log('========================\n');
  console.log('This will automate the web editor to write a custom mode');
  console.log('Run midi-monitor.ts in another terminal to capture traffic\n');

  const browser = await chromium.launch({
    headless: false,
    args: ['--enable-features=WebMIDI']
  });

  const context = await browser.newContext({
    permissions: ['midi', 'midi-sysex']
  });

  const page = await context.newPage();

  try {
    console.log('→ Navigating to Novation web editor...');
    await page.goto('https://components.novationmusic.com/launch-control-xl-3/custom-modes');

    // Wait for page to load
    await page.waitForLoadState('networkidle');
    console.log('✓ Page loaded\n');

    // Look for and handle any permission prompts
    page.on('dialog', async dialog => {
      console.log(`Dialog: ${dialog.message()}`);
      await dialog.accept();
    });

    // Check if we need to grant MIDI permissions
    console.log('→ Checking for MIDI permission button...');
    const connectButton = await page.locator('button:has-text("Connect")').first();
    if (await connectButton.isVisible()) {
      console.log('→ Clicking Connect button...');
      await connectButton.click();
      await page.waitForTimeout(2000);
    }

    // Wait for device connection
    console.log('→ Waiting for device to be detected...');
    await page.waitForTimeout(3000);

    // Click on Custom Mode 1 (slot 0)
    console.log('\n→ Selecting Custom Mode 1...');
    const customMode1 = await page.locator('text=Custom Mode 1').first();
    if (await customMode1.isVisible()) {
      await customMode1.click();
      await page.waitForTimeout(1000);
    }

    // Find the first encoder control
    console.log('→ Locating first encoder control...');
    const firstEncoder = await page.locator('[data-control-type="encoder"]').first();
    if (await firstEncoder.isVisible()) {
      await firstEncoder.click();
      await page.waitForTimeout(500);
    }

    // Look for name input field
    console.log('→ Setting control name...');
    const nameInput = await page.locator('input[placeholder*="name" i]').first();
    if (await nameInput.isVisible()) {
      await nameInput.fill('');
      await nameInput.type('REV_ENG_1');
      await page.waitForTimeout(500);
    }

    console.log('\n🔴 CRITICAL MONITORING POINT - WATCH MIDI MONITOR NOW! 🔴');
    console.log('→ Clicking "Send to Device" button...\n');

    // Find and click the send button
    const sendButton = await page.locator('button:has-text("Send")').first();
    if (await sendButton.isVisible()) {
      console.log('✓ Found Send button, clicking...');
      await sendButton.click();

      console.log('⏳ Waiting 5 seconds to capture all traffic...');
      await page.waitForTimeout(5000);

      console.log('✓ Write operation completed\n');
    } else {
      console.log('✗ Send button not found');
    }

    // Now try to read it back
    console.log('→ Attempting to trigger a read...');
    const refreshButton = await page.locator('button:has-text("Refresh")').first();
    if (await refreshButton.isVisible()) {
      await refreshButton.click();
      await page.waitForTimeout(2000);
    }

    console.log('\n✓ Capture complete!');
    console.log('\nCheck the MIDI monitor for:');
    console.log('1. Any messages BEFORE the Send button click');
    console.log('2. Messages sent WHEN Send was clicked');
    console.log('3. Any follow-up messages');

    // Keep browser open for manual inspection
    console.log('\nBrowser will stay open for 30 seconds for inspection...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
    console.log('\n✓ Browser closed');
  }
}

// Run the capture
captureWebEditorWrite().catch(console.error);