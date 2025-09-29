#!/usr/bin/env npx tsx
/**
 * Comprehensive Slot 1 Round-Trip Verification Test
 *
 * This test performs a complete read->write->read cycle on slot 1 to verify:
 * 1. Can we read existing data from slot 1?
 * 2. Can we write new custom mode data to slot 1?
 * 3. Does the written data match what we read back?
 * 4. Are control names and mode names preserved correctly?
 */

import { LaunchControlXL3 } from '../src/LaunchControlXL3.js';
import { CustomMode } from '../src/types/CustomMode.js';
import { Color } from '../src/types/index.js';

// Color map for better readability
const COLOR_MAP: { [key: number]: string } = {
  0x0C: 'RED',
  0x0D: 'RED_BLINK',
  0x0E: 'RED_PULSE',
  0x3C: 'GREEN',
  0x3D: 'GREEN_BLINK',
  0x3E: 'GREEN_PULSE',
  0x3F: 'YELLOW',
  0x00: 'OFF'
};

function colorToString(color: number): string {
  return COLOR_MAP[color] || `0x${color.toString(16).padStart(2, '0').toUpperCase()}`;
}

async function testSlot1RoundTrip() {
  console.log('=' .repeat(80));
  console.log('SLOT 1 COMPREHENSIVE ROUND-TRIP VERIFICATION TEST');
  console.log('=' .repeat(80));
  console.log();

  const device = new LaunchControlXL3();

  try {
    // Step 1: Connect to device
    console.log('📡 Connecting to Launch Control XL3...');
    await device.connect();
    console.log('✅ Connected successfully\n');

    // Step 2: Read existing data from slot 1
    console.log('━'.repeat(60));
    console.log('PHASE 1: READ EXISTING SLOT 1 DATA');
    console.log('━'.repeat(60));

    let originalMode: CustomMode | null = null;

    try {
      console.log('→ Reading current slot 1 configuration...');
      originalMode = await device.readCustomMode(1);

      if (originalMode) {
        console.log('✅ Successfully read existing slot 1 data:');
        console.log(`   Mode Name: "${originalMode.name}"`);
        console.log(`   Name Length: ${originalMode.name.length} characters`);
        console.log(`   Total Controls: ${originalMode.controls.length}`);

        // Display first 5 controls as sample
        console.log('\n   Sample Controls (first 5):');
        for (let i = 0; i < Math.min(5, originalMode.controls.length); i++) {
          const ctrl = originalMode.controls[i];
          console.log(`     ${i + 1}. ${ctrl.name || 'unnamed'} - Type: ${ctrl.type}, CC: ${ctrl.cc}, Ch: ${ctrl.channel}`);
        }

        // Check for truncated names
        const truncatedControls = originalMode.controls.filter(c =>
          c.name && (c.name.endsWith('...') || c.name.length === 0)
        );

        if (truncatedControls.length > 0) {
          console.log(`\n   ⚠️ WARNING: ${truncatedControls.length} controls have truncated/missing names`);
        }
      } else {
        console.log('ℹ️ Slot 1 is empty or uninitialized');
      }
    } catch (readError: any) {
      console.log(`❌ Failed to read slot 1: ${readError.message}`);
      console.log('   (This is normal if the slot has never been written to)');
    }

    // Step 3: Create test data with specific patterns
    console.log('\n' + '━'.repeat(60));
    console.log('PHASE 2: WRITE TEST DATA TO SLOT 1');
    console.log('━'.repeat(60));

    const testMode: CustomMode = {
      name: 'SLOT1_TEST_MODE',  // 15 chars, easy to verify
      controls: [],
      colors: []
    };

    // Create comprehensive test controls
    // We'll use patterns that are easy to verify:
    // - Encoders: CC 20-43 (24 encoders)
    // - Faders: CC 50-57 (8 faders)
    // - Buttons: CC 60-75 (16 buttons)

    console.log('→ Creating test mode with comprehensive controls...');

    // Add 24 encoders (3 rows of 8)
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 8; col++) {
        const index = row * 8 + col;
        testMode.controls.push({
          type: 'encoder',
          index: index,
          name: `ENC${row + 1}_${col + 1}`, // ENC1_1, ENC1_2, etc.
          cc: 20 + index,
          channel: 1,
          minValue: 0,
          maxValue: 127,
          color: row === 0 ? 0x3C : row === 1 ? 0x3F : 0x0C // Green, Yellow, Red by row
        });
        testMode.colors.push(testMode.controls[index].color!);
      }
    }

    // Add 8 faders
    for (let i = 0; i < 8; i++) {
      const index = 24 + i;
      testMode.controls.push({
        type: 'fader',
        index: i,
        name: `FADER_${i + 1}`,
        cc: 50 + i,
        channel: 1,
        minValue: 0,
        maxValue: 127,
        color: 0x3F // Yellow for all faders
      });
      testMode.colors.push(0x3F);
    }

    // Add 16 buttons (2 rows of 8)
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 8; col++) {
        const index = 32 + (row * 8 + col);
        const buttonIndex = row * 8 + col;
        testMode.controls.push({
          type: 'button',
          index: buttonIndex,
          name: `BTN${row + 1}_${col + 1}`,
          cc: 60 + buttonIndex,
          channel: 1,
          minValue: 0,
          maxValue: 127,
          color: row === 0 ? 0x0C : 0x3C // Red for row 1, Green for row 2
        });
        testMode.colors.push(testMode.controls[index].color!);
      }
    }

    console.log(`✅ Created test mode:`);
    console.log(`   Name: "${testMode.name}"`);
    console.log(`   Controls: ${testMode.controls.length} (24 encoders + 8 faders + 16 buttons)`);
    console.log(`   Colors: ${testMode.colors.length}`);
    console.log(`   CC Range: 20-75`);

    // Step 4: Write the test mode
    console.log('\n→ Writing test mode to slot 1...');
    try {
      await device.writeCustomMode(1, testMode);
      console.log('✅ Write operation completed successfully');
    } catch (writeError: any) {
      console.error(`❌ Write failed: ${writeError.message}`);
      throw writeError;
    }

    // Step 5: Wait for device to process
    console.log('→ Waiting 2 seconds for device to process...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 6: Read back and verify
    console.log('\n' + '━'.repeat(60));
    console.log('PHASE 3: READ BACK AND VERIFY');
    console.log('━'.repeat(60));

    console.log('→ Reading back from slot 1...');
    let readBackMode: CustomMode | null = null;

    try {
      readBackMode = await device.readCustomMode(1);
      console.log('✅ Read operation completed');
    } catch (readError: any) {
      console.error(`❌ Read-back failed: ${readError.message}`);
      throw readError;
    }

    // Step 7: Detailed verification
    console.log('\n' + '━'.repeat(60));
    console.log('VERIFICATION RESULTS');
    console.log('━'.repeat(60));

    if (!readBackMode) {
      console.error('❌ FAIL: No data returned from slot 1');
      return false;
    }

    let verificationPassed = true;
    const issues: string[] = [];

    // Verify mode name
    console.log('\n📝 Mode Name Verification:');
    console.log(`   Written: "${testMode.name}" (${testMode.name.length} chars)`);
    console.log(`   Read:    "${readBackMode.name}" (${readBackMode.name.length} chars)`);

    if (readBackMode.name !== testMode.name) {
      if (readBackMode.name.startsWith(testMode.name.substring(0, 3))) {
        issues.push(`Mode name truncated: "${readBackMode.name}" vs "${testMode.name}"`);
        console.log('   ⚠️ TRUNCATED - Name was cut short');
      } else {
        issues.push(`Mode name mismatch: "${readBackMode.name}" vs "${testMode.name}"`);
        console.log('   ❌ MISMATCH - Completely different name');
      }
      verificationPassed = false;
    } else {
      console.log('   ✅ PASS - Name matches exactly');
    }

    // Verify control count
    console.log('\n📊 Control Count:');
    console.log(`   Written: ${testMode.controls.length} controls`);
    console.log(`   Read:    ${readBackMode.controls.length} controls`);

    if (readBackMode.controls.length !== testMode.controls.length) {
      issues.push(`Control count mismatch: ${readBackMode.controls.length} vs ${testMode.controls.length}`);
      console.log('   ❌ MISMATCH - Different number of controls');
      verificationPassed = false;
    } else {
      console.log('   ✅ PASS - Control count matches');
    }

    // Verify individual controls
    console.log('\n🎛️ Control Data Verification:');
    const maxToCheck = Math.min(testMode.controls.length, readBackMode.controls.length);
    let controlMismatches = 0;
    let nameTruncations = 0;
    let ccMismatches = 0;
    let inactiveControls = 0;

    for (let i = 0; i < maxToCheck; i++) {
      const written = testMode.controls[i];
      const read = readBackMode.controls[i];

      // Check if control appears inactive (all zeros or undefined values)
      if (!read.cc || read.cc === 0 || !read.name) {
        inactiveControls++;
        console.log(`   Control ${i + 1}: ⚠️ INACTIVE - Missing CC or name`);
        continue;
      }

      // Check name
      if (read.name !== written.name) {
        if (read.name && written.name && read.name.startsWith(written.name.substring(0, 2))) {
          nameTruncations++;
        } else {
          controlMismatches++;
        }
      }

      // Check CC
      if (read.cc !== written.cc) {
        ccMismatches++;
      }
    }

    console.log(`   Name truncations: ${nameTruncations}`);
    console.log(`   CC mismatches: ${ccMismatches}`);
    console.log(`   Inactive controls: ${inactiveControls}`);
    console.log(`   Total issues: ${controlMismatches + nameTruncations + ccMismatches + inactiveControls}`);

    if (nameTruncations > 0) {
      issues.push(`${nameTruncations} control names truncated`);
      console.log('   ⚠️ Control names are being truncated');
    }

    if (inactiveControls > 0) {
      issues.push(`${inactiveControls} controls appear inactive`);
      console.log('   ⚠️ Some controls are not active/configured');
    }

    if (ccMismatches > 0) {
      issues.push(`${ccMismatches} CC values don't match`);
      console.log('   ❌ CC assignments not preserved');
    }

    // Display sample of problematic controls
    if (controlMismatches + nameTruncations + inactiveControls > 0) {
      console.log('\n   Sample Problem Controls:');
      let shown = 0;
      for (let i = 0; i < maxToCheck && shown < 5; i++) {
        const written = testMode.controls[i];
        const read = readBackMode.controls[i];

        if (read.name !== written.name || read.cc !== written.cc || !read.cc) {
          console.log(`     ${i + 1}. Written: "${written.name}" CC:${written.cc}`);
          console.log(`        Read:    "${read.name || 'MISSING'}" CC:${read.cc || 'NONE'}`);
          shown++;
        }
      }
    }

    // Final summary
    console.log('\n' + '═'.repeat(60));
    console.log('FINAL SUMMARY');
    console.log('═'.repeat(60));

    if (verificationPassed && issues.length === 0) {
      console.log('✅ SUCCESS: Round-trip verification PASSED');
      console.log('   The library is working correctly!');
    } else {
      console.log('❌ ISSUES FOUND:');
      issues.forEach(issue => console.log(`   • ${issue}`));

      console.log('\n📋 DIAGNOSIS:');
      if (nameTruncations > 0 || readBackMode.name !== testMode.name) {
        console.log('   • String truncation suggests encoding/parsing issues');
        console.log('   • The library may not be handling text fields correctly');
      }
      if (inactiveControls > 0) {
        console.log('   • Inactive controls suggest incomplete data writes');
        console.log('   • The SysEx format may not match device expectations');
      }
      if (ccMismatches > 0) {
        console.log('   • CC mismatches indicate data corruption');
        console.log('   • Binary data encoding may be incorrect');
      }
    }

    return verificationPassed && issues.length === 0;

  } catch (error: any) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error(error.stack);
    return false;
  } finally {
    // Cleanup
    console.log('\n→ Disconnecting...');
    try {
      await device.disconnect();
      console.log('✅ Disconnected');
    } catch (e) {
      console.log('⚠️ Disconnect failed (device may already be disconnected)');
    }
  }
}

// Run the test
console.log('Launch Control XL3 - Slot 1 Round-Trip Verification\n');

testSlot1RoundTrip().then(success => {
  console.log('\n' + '='.repeat(60));
  if (success) {
    console.log('✅ TEST RESULT: LIBRARY IS WORKING CORRECTLY');
    console.log('   The issue is likely in your client code');
    process.exit(0);
  } else {
    console.log('⚠️ TEST RESULT: LIBRARY HAS ISSUES');
    console.log('   The problems you\'re seeing are in the library');
    process.exit(1);
  }
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});