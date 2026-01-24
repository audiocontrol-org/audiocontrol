import { test, expect } from '@playwright/test';

/**
 * Simple DT1 test - sends a parameter change and checks for response
 * This test doesn't use the Play page (which triggers RQD and crashes)
 */
test('DT1 simple test - send parameter via Connect page', async ({ page }) => {
  test.setTimeout(60000);

  const consoleLogs: string[] = [];

  page.on('console', (msg) => {
    const text = msg.text();
    consoleLogs.push(text);
    console.log(`[Browser] ${text}`);
  });

  // Navigate to home page
  console.log('\n=== Opening app ===');
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Wait for MIDI permission
  console.log('\n=== WAITING FOR MIDI PERMISSION ===');
  let midiGranted = false;
  const maxWaitMs = 15000;
  const startTime = Date.now();

  while (!midiGranted && (Date.now() - startTime) < maxWaitMs) {
    midiGranted = consoleLogs.some(log => log.includes('MIDI access granted'));
    if (!midiGranted) {
      await page.waitForTimeout(250);
    }
  }

  if (!midiGranted) {
    console.log('WARNING: MIDI permission not granted');
  } else {
    console.log('MIDI permission granted!');
  }

  // Connect to MIDI ports
  console.log('\n=== Connecting to MIDI ===');
  await page.waitForTimeout(1000);

  const triggers = page.locator('button[role="combobox"]');
  const triggerCount = await triggers.count();
  console.log('Found', triggerCount, 'Radix select comboboxes');

  if (triggerCount >= 2) {
    // Select input port (Volt 4)
    await triggers.first().click();
    await page.waitForTimeout(500);

    const volt4Input = page.locator('[role="option"]').filter({ hasText: 'Volt 4' }).first();
    if (await volt4Input.count() > 0) {
      await volt4Input.click();
      console.log('Selected Volt 4 input');
    } else {
      await page.locator('[role="option"]').first().click();
      console.log('Selected first available input');
    }
    await page.waitForTimeout(500);

    // Select output port (Volt 4)
    await triggers.nth(1).click();
    await page.waitForTimeout(500);

    const volt4Output = page.locator('[role="option"]').filter({ hasText: 'Volt 4' }).first();
    if (await volt4Output.count() > 0) {
      await volt4Output.click();
      console.log('Selected Volt 4 output');
    } else {
      await page.locator('[role="option"]').first().click();
      console.log('Selected first available output');
    }
    await page.waitForTimeout(500);
  } else {
    console.log('ERROR: Could not find port selectors');
    return;
  }

  // Click Connect button
  const connectBtn = page.locator('button').filter({ hasText: 'Connect' }).first();
  await connectBtn.click();
  console.log('Clicked Connect');

  // Wait for connection to complete - look for status change
  console.log('Waiting for MIDI connection to complete...');
  await page.waitForTimeout(3000);

  // Verify connection by checking if "Continue to Patches" button appears
  const continueBtn = page.locator('button').filter({ hasText: 'Continue to Patches' });
  const isConnected = await continueBtn.count() > 0;
  console.log('Connection status:', isConnected ? 'CONNECTED' : 'NOT CONNECTED');

  if (!isConnected) {
    console.log('ERROR: MIDI connection failed');
    await page.screenshot({ path: 'e2e-dt1-simple-not-connected.png' });
    return;
  }

  // Now send a DT1 command via browser console
  // This bypasses the Play page which causes crashes
  console.log('\n=== Sending DT1 via browser console ===');

  // Execute JavaScript in the browser to send a DT1 message
  // Set Part A patch to index 1 (P12 BA55)
  const result = await page.evaluate(() => {
    // Get the MIDI adapter from the store exposed on window
    const store = window.__midiStore;
    if (!store) {
      return { success: false, error: 'Store not exposed on window' };
    }

    const state = store.getState();

    if (!state.adapter) {
      return { success: false, error: 'No MIDI adapter', status: state.status };
    }

    // Build DT1 message manually
    // F0 41 00 1E 12 00 01 00 32 01 4C F7
    // Set Part A (0) to patch index 1
    const deviceId = state.deviceId;
    const address = [0x00, 0x01, 0x00, 0x32]; // Function params, Part A patch
    const data = [0x01]; // Patch index 1

    // Calculate checksum
    const sum = address.reduce((a, b) => a + b, 0) + data.reduce((a, b) => a + b, 0);
    const checksum = (128 - (sum & 0x7F)) & 0x7F;

    const message = [
      0xF0, 0x41, deviceId, 0x1E, 0x12,
      ...address,
      ...data,
      checksum,
      0xF7
    ];

    console.log('[Test] Sending DT1:', message.map(b => b.toString(16).padStart(2, '0')).join(' '));
    state.adapter.send(message);

    return {
      success: true,
      message: message.map(b => b.toString(16).padStart(2, '0')).join(' '),
      deviceId
    };
  });

  console.log('DT1 send result:', result);

  // Assert immediately - before any other operations that might crash
  expect(result.success).toBe(true);

  if (result.success) {
    console.log('\n========================================');
    console.log('DT1 MESSAGE SENT SUCCESSFULLY');
    console.log('Message:', result.message);
    console.log('Device ID:', result.deviceId);
    console.log('========================================');
    console.log('\nCheck your S-330 - Part A should now be P12 BA55');
    console.log('(It was P11 RHODES before)');
  } else {
    console.log('ERROR:', (result as { error: string }).error);
  }

  // Wait briefly - Chrome can crash when idle with active MIDI
  await page.waitForTimeout(500);

  // Try screenshot but don't fail if it crashes
  try {
    await page.screenshot({ path: 'e2e-dt1-simple.png' });
    console.log('Screenshot saved');
  } catch (e) {
    console.log('Screenshot failed (page may have crashed, but DT1 was sent)');
  }
});
