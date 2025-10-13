#!/usr/bin/env tsx
/**
 * Issue #36 Validation Script
 * Tests that writing to inactive slots now works after the fix
 */

import { DeviceManager } from '../package/src/device/DeviceManager.js';
import { EasyMidiBackend } from '../package/src/core/backends/EasyMidiBackend.js';

async function testIssue36Fix(): Promise<void> {
  console.log('=== Issue #36 Validation Test ===\n');
  console.log('Testing: Writing to inactive slot should now work\n');

  const backend = new EasyMidiBackend();
  await backend.initialize();

  const deviceManager = new DeviceManager({
    midiBackend: backend,
    autoConnect: false
  });

  try {
    // Connect
    console.log('1. Connecting to device...');
    await deviceManager.initialize();
    await deviceManager.connect();
    console.log('   ✓ Connected\n');

    // Read from slot 0
    console.log('2. Reading mode from slot 0 (active)...');
    const mode = await deviceManager.readCustomMode(0);
    console.log(`   ✓ Read mode: "${mode.name}"\n`);

    // Write to slot 5 (inactive) - this should now work with the fix
    console.log('3. Writing to slot 5 (inactive) - CRITICAL TEST...');
    console.log('   (Fix automatically calls selectTemplate before write)');
    await deviceManager.writeCustomMode(5, mode);
    console.log('   ✓ Write succeeded - NO STATUS 0x9 ERROR!\n');

    // Verify
    console.log('4. Verifying by reading back slot 5...');
    const verify = await deviceManager.readCustomMode(5);
    console.log(`   ✓ Verified: "${verify.name}"\n`);

    // Cleanup
    await deviceManager.disconnect();

    console.log('=== TEST PASSED ===');
    console.log('✓ No status 0x9 error');
    console.log('✓ Write to inactive slot succeeded');
    console.log('✓ Issue #36 fix validated\n');

  } catch (error) {
    console.error('\n=== TEST FAILED ===');
    console.error(error);

    if (error instanceof Error && error.message.includes('0x9')) {
      console.error('\n⚠️  STATUS 0x9 DETECTED - Fix not working!\n');
    }

    await deviceManager.disconnect();
    process.exit(1);
  }
}

testIssue36Fix().catch(console.error);
