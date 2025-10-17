#!/usr/bin/env npx tsx
/**
 * Test: Copy from slot 0 to slot 7 and verify
 *
 * 1. Read from slot 0 (first slot)
 * 2. Write to slot 7 (8th slot)
 * 3. Read back from slot 7
 * 4. Verify they match
 */

import { LaunchControlXL3 } from '../src';
import { NodeMidiBackend } from '../src/backends/NodeMidiBackend';

async function checkEnvironment(): Promise<boolean> {
  console.log('🔍 Checking test environment...');

  try {
    const backend = new NodeMidiBackend();
    await backend.initialize();

    const inputPorts = await backend.getInputPorts();
    const outputPorts = await backend.getOutputPorts();

    const hasDevice = inputPorts.some(p => p.name.includes('LCXL3')) &&
                     outputPorts.some(p => p.name.includes('LCXL3'));

    await backend.cleanup();

    if (hasDevice) {
      console.log('✓ Launch Control XL3 device detected');
      return true;
    } else {
      console.log('✗ Launch Control XL3 device not found!');
      console.log('\nPlease connect the Launch Control XL3 device via USB\n');
      return false;
    }
  } catch (error) {
    console.log('✗ Error checking environment:', error);
    return false;
  }
}

async function testSlotCopy() {
  console.log('Launch Control XL3 - Slot Copy Test');
  console.log('═══════════════════════════════════\n');

  // Check environment
  const envReady = await checkEnvironment();
  if (!envReady) {
    process.exit(1);
  }

  console.log();

  const sourceSlot = 0; // First slot
  const targetSlot = 7; // 8th slot

  const backend = new NodeMidiBackend();
  await backend.initialize();
  const device = new LaunchControlXL3({ midiBackend: backend });

  try {
    // Connect
    console.log('🔌 Connecting to device...');
    await device.connect();
    console.log('✓ Connected\n');

    // Step 1: Read from slot 0
    console.log(`📖 Step 1: Reading from slot ${sourceSlot} (physical slot ${sourceSlot + 1})...`);
    const sourceMode = await device.readCustomMode(sourceSlot);

    if (!sourceMode) {
      console.log(`❌ No mode found in slot ${sourceSlot}`);
      process.exit(1);
    }

    console.log(`✓ Read mode: "${sourceMode.name}"`);
    console.log(`  Controls: ${Object.keys(sourceMode.controls).length}`);
    console.log();

    // Step 2: Write to slot 7
    console.log(`📝 Step 2: Writing to slot ${targetSlot} (physical slot ${targetSlot + 1})...`);
    await device.writeCustomMode(targetSlot, sourceMode);
    console.log('✓ Write completed');
    console.log();

    // Wait for device to process
    console.log('⏱️  Waiting 1 second for device to process...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log();

    // Step 3: Read back from slot 7
    console.log(`📖 Step 3: Reading back from slot ${targetSlot}...`);
    const targetMode = await device.readCustomMode(targetSlot);

    if (!targetMode) {
      console.log(`❌ No mode found in slot ${targetSlot}`);
      process.exit(1);
    }

    console.log(`✓ Read mode: "${targetMode.name}"`);
    console.log(`  Controls: ${Object.keys(targetMode.controls).length}`);
    console.log();

    // Step 4: Verify they match
    console.log('🔍 Step 4: Verifying data integrity...');
    console.log('─'.repeat(50));

    const errors: string[] = [];

    // Check name
    if (sourceMode.name !== targetMode.name) {
      errors.push(`Name mismatch: "${sourceMode.name}" != "${targetMode.name}"`);
    } else {
      console.log(`✓ Name matches: "${sourceMode.name}"`);
    }

    // Check control count
    const sourceControlCount = Object.keys(sourceMode.controls).length;
    const targetControlCount = Object.keys(targetMode.controls).length;

    if (sourceControlCount !== targetControlCount) {
      errors.push(`Control count mismatch: ${sourceControlCount} != ${targetControlCount}`);
    } else {
      console.log(`✓ Control count matches: ${sourceControlCount}`);
    }

    // Check individual controls
    let controlMatches = 0;
    let controlMismatches = 0;

    for (const [controlId, sourceControl] of Object.entries(sourceMode.controls)) {
      const targetControl = targetMode.controls[controlId];

      if (!targetControl) {
        controlMismatches++;
        errors.push(`Control ${controlId} missing in target`);
        continue;
      }

      // Compare control properties
      const sourceCtrl = sourceControl as any;
      const targetCtrl = targetControl as any;

      if (sourceCtrl.midiChannel !== targetCtrl.midiChannel ||
          sourceCtrl.ccNumber !== targetCtrl.ccNumber ||
          sourceCtrl.behavior !== targetCtrl.behavior) {
        controlMismatches++;
        errors.push(`Control ${controlId} data mismatch`);
      } else {
        controlMatches++;
      }
    }

    console.log(`✓ Matching controls: ${controlMatches}/${sourceControlCount}`);

    if (controlMismatches > 0) {
      console.log(`✗ Mismatched controls: ${controlMismatches}`);
    }

    console.log();

    // Final result
    if (errors.length === 0) {
      console.log('╔═══════════════════════════════════════════════╗');
      console.log('║                                               ║');
      console.log('║            ✅ TEST PASSED                     ║');
      console.log('║                                               ║');
      console.log('║  Slot copy and verification successful!      ║');
      console.log('║                                               ║');
      console.log('╚═══════════════════════════════════════════════╝');
      console.log();
      console.log(`Slot ${sourceSlot} successfully copied to slot ${targetSlot}`);
      console.log('Data integrity verified - all controls match!');
    } else {
      console.log('╔═══════════════════════════════════════════════╗');
      console.log('║                                               ║');
      console.log('║            ❌ TEST FAILED                     ║');
      console.log('║                                               ║');
      console.log('╚═══════════════════════════════════════════════╝');
      console.log();
      console.log('Errors found:');
      errors.forEach(error => console.log(`  ✗ ${error}`));
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error instanceof Error ? error.message : String(error));
    throw error;
  } finally {
    console.log('\n🧹 Cleaning up...');
    await device.disconnect();
    await backend.close();
    console.log('✓ Done');
  }
}

// Run the test
testSlotCopy().catch(console.error);
