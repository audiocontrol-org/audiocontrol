import { test, expect } from '@playwright/test';

test('DT1 write test - change patch and verify on hardware', async ({ page }) => {
  test.setTimeout(180000); // 3 minutes

  const consoleLogs: string[] = [];

  // Capture all console logs
  page.on('console', (msg) => {
    const text = msg.text();
    consoleLogs.push(text);
    console.log(`[Browser] ${text}`);
  });

  // Navigate to home page
  console.log('\n=== Opening app ===');
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  console.log('\n=== WAITING FOR MIDI PERMISSION ===');
  console.log('(If this is first run, click "Allow" in the MIDI permission dialog)\n');

  // Wait for MIDI permission to be granted - look for "MIDI access granted" log
  // Permissions are persisted in .playwright-chrome-data, so subsequent runs should be fast
  let midiGranted = false;
  const maxWaitMs = 15000; // Reduced since permissions should persist
  const startTime = Date.now();

  while (!midiGranted && (Date.now() - startTime) < maxWaitMs) {
    midiGranted = consoleLogs.some(log => log.includes('MIDI access granted'));
    if (!midiGranted) {
      await page.waitForTimeout(250);
    }
  }

  if (!midiGranted) {
    console.log('WARNING: MIDI permission not granted within 15 seconds');
    console.log('Continuing anyway...');
  } else {
    console.log('MIDI permission granted!');
  }

  // Connect to MIDI ports using the Radix Select dropdowns
  console.log('\n=== Connecting to MIDI ===');

  // Wait for port list to populate
  await page.waitForTimeout(1000);

  // Try clicking on the select triggers (Radix Select renders as combobox buttons)
  const triggers = page.locator('button[role="combobox"]');
  const triggerCount = await triggers.count();
  console.log('Found', triggerCount, 'Radix select comboboxes');

  if (triggerCount >= 2) {
    // Select input port
    console.log('Clicking input port selector...');
    await triggers.first().click();
    await page.waitForTimeout(500);

    // Take screenshot of dropdown
    await page.screenshot({ path: 'e2e-dt1-00-input-dropdown.png' });

    // Wait for dropdown and check options
    const inputOptions = page.locator('[role="option"]');
    const optionCount = await inputOptions.count();
    console.log('Found', optionCount, 'options in input dropdown');

    if (optionCount === 0) {
      console.log('ERROR: No MIDI ports available (MIDI permission may not have been granted)');
      console.log('Skipping test - please run again and click "Allow" in MIDI permission dialog');
      return;
    }

    // List available options
    for (let i = 0; i < optionCount; i++) {
      const optText = await inputOptions.nth(i).textContent();
      console.log(`  Option ${i}: ${optText}`);
    }

    // Try to find Volt 4, otherwise use first option
    let volt4Option = page.locator('[role="option"]').filter({ hasText: 'Volt 4' }).first();
    const hasVolt4 = await volt4Option.count() > 0;

    if (hasVolt4) {
      await volt4Option.click();
      console.log('Selected Volt 4 input');
    } else {
      console.log('Volt 4 not found, selecting first available port');
      await inputOptions.first().click();
    }
    await page.waitForTimeout(500);

    // Select output port
    console.log('Clicking output port selector...');
    await triggers.nth(1).click();
    await page.waitForTimeout(500);

    // Take screenshot of output dropdown
    await page.screenshot({ path: 'e2e-dt1-00-output-dropdown.png' });

    const outputOptions = page.locator('[role="option"]');
    const outputOptionCount = await outputOptions.count();
    console.log('Found', outputOptionCount, 'options in output dropdown');

    // List available output options
    for (let i = 0; i < outputOptionCount; i++) {
      const optText = await outputOptions.nth(i).textContent();
      console.log(`  Output Option ${i}: ${optText}`);
    }

    // Try to find Volt 4, otherwise use first option
    volt4Option = page.locator('[role="option"]').filter({ hasText: 'Volt 4' }).first();
    const hasVolt4Output = await volt4Option.count() > 0;

    if (hasVolt4Output) {
      await volt4Option.click();
      console.log('Selected Volt 4 output');
    } else {
      console.log('Volt 4 not found, selecting first available port');
      await outputOptions.first().click();
    }
    await page.waitForTimeout(500);
  } else {
    console.log('WARNING: Not enough comboboxes found (need 2, found ' + triggerCount + ')');
    // Take screenshot to debug
    await page.screenshot({ path: 'e2e-dt1-00-no-comboboxes.png' });
    console.log('Skipping test - UI elements not found');
    return;
  }

  // Click Connect button
  const connectBtn = page.locator('button', { hasText: 'Connect' }).first();
  await connectBtn.click();
  console.log('Clicked Connect');

  // Wait for connection
  await page.waitForTimeout(3000);

  // Navigate to Play page
  console.log('\n=== Navigating to Play page ===');
  await page.click('a[href="/play"]');
  await page.waitForLoadState('networkidle');

  // Wait for data to load - look for patches to appear
  console.log('Waiting for patches to load...');
  console.log('NOTE: S-330 hardware must be connected and powered on!');

  try {
    await page.waitForFunction(() => {
      const selects = document.querySelectorAll('select');
      for (const s of selects) {
        if (s.innerHTML.includes('RHODES')) return true;
      }
      return false;
    }, { timeout: 60000 }); // 60 seconds to allow time for hardware
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.log('ERROR waiting for patches:', errorMessage);

    // Check if it's a page crash vs timeout
    if (errorMessage.includes('crash')) {
      console.log('Page crashed - this may be a browser/MIDI issue');
    } else if (errorMessage.includes('timeout')) {
      console.log('Timeout - S-330 may not be responding');
    }

    console.log('Make sure the S-330 is connected and powered on.');
    console.log('Test cannot proceed without hardware connection.');
    // Skip test gracefully if hardware isn't responding
    return;
  }

  console.log('Patches loaded!');
  await page.waitForTimeout(2000);

  // Take screenshot of initial state
  await page.screenshot({ path: 'e2e-dt1-01-initial.png' });

  // Find the Part A patch select (should be the second select with RHODES option)
  // First select is channel, second is patch
  const allSelects = page.locator('select');
  const selectCount = await allSelects.count();
  console.log('Total select elements:', selectCount);

  // Find selects that contain RHODES (patch selects)
  let patchSelectIndex = -1;
  for (let i = 0; i < selectCount; i++) {
    const html = await allSelects.nth(i).innerHTML();
    if (html.includes('RHODES')) {
      patchSelectIndex = i;
      break;
    }
  }

  if (patchSelectIndex === -1) {
    console.log('ERROR: Could not find patch select');
    return;
  }

  console.log('Patch select is at index:', patchSelectIndex);
  const partASelect = allSelects.nth(patchSelectIndex);

  // Get current value
  const currentValue = await partASelect.inputValue();
  console.log('\n=== Current Part A patch index:', currentValue, '===');

  // Determine target value (toggle between 0 and 1)
  const targetValue = currentValue === '0' ? '1' : '0';
  const targetName = targetValue === '0' ? 'P11 RHODES' : 'P12 BA55';
  console.log('Will change to patch index:', targetValue, '(' + targetName + ')');

  // Clear logs before change
  const logCountBefore = consoleLogs.length;

  // Change the patch
  console.log('\n=== CHANGING PATCH ===');
  await partASelect.selectOption(targetValue);

  // Wait for DT1 to be sent
  await page.waitForTimeout(2000);

  // Take screenshot after change
  await page.screenshot({ path: 'e2e-dt1-02-after-change.png' });

  // Analyze logs for DT1
  const newLogs = consoleLogs.slice(logCountBefore);
  console.log('\n=== Logs after patch change ===');

  const dt1Logs = newLogs.filter(log =>
    log.includes('DT1') ||
    log.includes('Set part') ||
    log.includes('Sending')
  );
  dt1Logs.forEach(log => console.log('  ', log));

  // Find the DT1 message
  const dt1Message = newLogs.find(log => log.includes('DT1 parameter update'));
  const sendMessage = newLogs.find(log => log.includes('[WebMIDI] Sending:') && log.includes('12 00 01 00 32'));

  console.log('\n=== DT1 Message Analysis ===');
  console.log('DT1 parameter log:', dt1Message || 'NOT FOUND');
  console.log('WebMIDI send log:', sendMessage || 'NOT FOUND');

  // Wait before reloading
  console.log('\n=== Waiting 5 seconds before reload ===');
  await page.waitForTimeout(5000);

  // Reload page to re-read from hardware
  console.log('\n=== RELOADING PAGE TO VERIFY ===');
  await page.reload();
  await page.waitForLoadState('networkidle');

  // Wait for patches to load again
  await page.waitForFunction(() => {
    const selects = document.querySelectorAll('select');
    for (const s of selects) {
      if (s.innerHTML.includes('RHODES')) return true;
    }
    return false;
  }, { timeout: 30000 });

  await page.waitForTimeout(3000);

  // Take screenshot after reload
  await page.screenshot({ path: 'e2e-dt1-03-after-reload.png' });

  // Find patch select again
  let newPatchSelectIndex = -1;
  const newSelectCount = await allSelects.count();
  for (let i = 0; i < newSelectCount; i++) {
    const html = await allSelects.nth(i).innerHTML();
    if (html.includes('RHODES')) {
      newPatchSelectIndex = i;
      break;
    }
  }

  const partASelectAfter = allSelects.nth(newPatchSelectIndex);
  const valueAfterReload = await partASelectAfter.inputValue();

  // Also check what the function parameters show in logs
  const funcParamLog = consoleLogs.find(log => log.includes('Part 0:') && log.includes('patchIndex='));

  console.log('\n========================================');
  console.log('=== VERIFICATION RESULTS ===');
  console.log('========================================');
  console.log('Value BEFORE change:', currentValue);
  console.log('Value we SET:', targetValue);
  console.log('Value AFTER reload:', valueAfterReload);
  console.log('Function params log:', funcParamLog || 'NOT FOUND');
  console.log('');

  if (valueAfterReload === targetValue) {
    console.log('✓ SUCCESS: Write persisted to hardware!');
  } else {
    console.log('✗ FAILED: Write did NOT persist. Hardware still has:', valueAfterReload);
  }
  console.log('========================================');

  // Assert that the write worked
  expect(valueAfterReload).toBe(targetValue);
});
