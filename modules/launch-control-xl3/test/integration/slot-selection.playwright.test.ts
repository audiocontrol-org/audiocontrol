/**
 * Playwright Integration Test for Issue #36 Fix
 *
 * Tests that the slot selection fix (device ID 0x02 instead of 0x11)
 * works correctly with a real Launch Control XL 3 device using WebMIDI API.
 *
 * This test validates:
 * 1. Device can be connected via WebMIDI
 * 2. Mode can be read from active slot (slot 0)
 * 3. Slot can be selected with device ID 0x02
 * 4. Inactive slot can be read without status 0x9 error
 *
 * Expected completion time: < 30 seconds
 *
 * Approach: Serves a static HTML file with WebMIDI test logic (same approach as xl3-web tests)
 */

import { test, expect } from '@playwright/test';

const testPageUrl = 'http://localhost:8888/webmidi-test.html';

test.describe('Issue #36 Fix - Slot Selection with Device ID 0x02', () => {
  test('should write to inactive slot without status 0x9 error', async ({ page, context }) => {
    test.setTimeout(5000); // 5 second timeout

    console.log('[Test] Step 1: Granting MIDI permissions...');
    await context.grantPermissions(['midi', 'midi-sysex']);

    console.log('[Test] Step 2: Navigating to test page...');

    // Listen to console messages from the page
    page.on('console', msg => console.log(`[Page Console] ${msg.text()}`));
    page.on('pageerror', error => console.error(`[Page Error] ${error.message}`));

    await page.goto(testPageUrl);

    // Check if page loaded
    const title = await page.title();
    console.log(`[Test] Page loaded: "${title}"`);

    console.log('[Test] Step 3: Waiting for test to complete...');

    // Wait for test to complete (window.testResults.complete === true)
    await page.waitForFunction(
      () => (window as any).testResults.complete === true,
      { timeout: 4000 }
    );

    // Get test results
    const results = await page.evaluate(() => (window as any).testResults);

    console.log('[Test] Results:', JSON.stringify(results, null, 2));

    // Verify no error occurred
    if (results.error) {
      console.error(`[Test] ✗ Test failed: ${results.error}`);
    }
    expect(results.error).toBeNull();

    // Verify MIDI access succeeded
    expect(results.midiAccess).not.toBeNull();
    expect(results.midiAccess.success).toBe(true);
    console.log(`[Test] ✓ MIDI access: ${results.midiAccess.deviceName}`);

    // Verify slot 0 read succeeded
    expect(results.slot0Result).not.toBeNull();
    expect(results.slot0Result.success).toBe(true);
    console.log(`[Test] ✓ Slot 0 read: "${results.slot0Result.name}"`);

    // Verify slot 1 operation succeeded without status 0x9
    expect(results.slot1Result).not.toBeNull();
    expect(results.slot1Result.success).toBe(true);
    expect(results.slot1Result.noStatus9).toBe(true);
    console.log(`[Test] ✓ Slot 1 read: "${results.slot1Result.name}"`);
    console.log('[Test] ✓ No status 0x9 error - Issue #36 fix validated!');

    console.log('\n=== TEST PASSED ===');
    console.log('Device: Launch Control XL 3');
    console.log(`Slot 0: ✓ ${results.slot0Result.name}`);
    console.log('Slot 1 select: ✓ (device ID 0x02)');
    console.log(`Slot 1 verify: ✓ ${results.slot1Result.name}`);
    console.log('Status 0x9: ✗ (not received - GOOD)');
  });
});
