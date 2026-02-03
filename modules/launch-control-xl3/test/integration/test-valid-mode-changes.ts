#!/usr/bin/env tsx
/**
 * Round-trip validation test with VALID CustomMode changes for Issue #36
 *
 * 1. Read custom mode from slot 10 using library API
 * 2. Make VALID changes using CustomMode structure
 * 3. Write modified mode to slot 3
 * 4. Read back from slot 3
 * 5. Verify all changes were preserved
 */

import { LaunchControlXL3 } from '../src/index.js';
import { NodeMidiBackend } from '../src/backends/NodeMidiBackend.js';
import type { CustomMode, ControlMapping } from '../src/types.js';
import { writeFileSync } from 'fs';

interface TestChange {
  description: string;
  originalValue: any;
  newValue: any;
  verified: boolean;
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('Issue #36 - Valid CustomMode Changes Test');
  console.log('═══════════════════════════════════════════════════\n');

  let device: LaunchControlXL3 | null = null;

  try {
    // Initialize backend
    const backend = new NodeMidiBackend();
    await backend.initialize();

    // Create device
    device = new LaunchControlXL3({
      midiBackend: backend,
      enableLedControl: false,
      enableCustomModes: true
    });

    console.log('→ Connecting to device...');
    await device.connect();
    console.log('✓ Connected\n');

    const sourceSlot = 10;
    const targetSlot = 3;

    // Step 1: Read from source slot
    console.log(`Step 1: Reading custom mode from slot ${sourceSlot}...`);
    const originalMode = await device.readCustomMode(sourceSlot);

    if (!originalMode) {
      console.log('✗ Failed to read custom mode');
      process.exit(1);
    }

    console.log('✓ Read successful');
    console.log(`  Name: "${originalMode.name}"`);

    // Get control keys from the controls object
    const controlKeys = Object.keys(originalMode.controls || {});
    console.log(`  Controls: ${controlKeys.length}`);
    console.log(`  Control keys: ${controlKeys.slice(0, 5).join(', ')}${controlKeys.length > 5 ? '...' : ''}`);
    console.log();

    // Ensure controls object exists
    if (!originalMode.controls || typeof originalMode.controls !== 'object') {
      console.log('✗ originalMode.controls is not an object');
      process.exit(1);
    }

    if (controlKeys.length === 0) {
      console.log('✗ No controls found in slot 10');
      console.log('  Try a different source slot that has configured controls');
      process.exit(1);
    }

    // Step 2: Make valid changes to the mode
    console.log('Step 2: Making valid changes to custom mode...\n');

    const changes: TestChange[] = [];

    // Clone the mode - deep copy the controls object
    const modifiedMode: CustomMode = {
      name: 'TESTMOD',
      controls: { ...originalMode.controls },
      colors: originalMode.colors,
      labels: originalMode.labels,
      leds: originalMode.leds
    };

    // Deep clone each control
    for (const key in modifiedMode.controls) {
      modifiedMode.controls[key] = { ...originalMode.controls[key] };
    }

    // Track mode name change
    changes.push({
      description: 'Mode name',
      originalValue: originalMode.name,
      newValue: modifiedMode.name,
      verified: false
    });

    // Modify first 5 controls (if they exist)
    const controlsToModify = Math.min(5, controlKeys.length);

    for (let i = 0; i < controlsToModify; i++) {
      const key = controlKeys[i];
      const control = modifiedMode.controls[key];

      // Change CC number (use ccNumber property, not cc)
      const originalCC = control.ccNumber || control.cc || 0;
      const newCC = (originalCC + 10) % 120; // Stay within valid range
      control.ccNumber = newCC;
      if (control.cc !== undefined) {
        control.cc = newCC; // Update both if cc exists
      }

      changes.push({
        description: `Control ${key} CC`,
        originalValue: originalCC,
        newValue: newCC,
        verified: false
      });

      // Change control name (if it exists)
      if (control.name !== undefined) {
        const originalName = control.name;
        const newName = `TST_${i}`;
        control.name = newName;

        changes.push({
          description: `Control ${key} name`,
          originalValue: originalName,
          newValue: newName,
          verified: false
        });
      }

      // Change channel (use midiChannel property, not channel)
      const originalChannel = control.midiChannel ?? control.channel ?? 0;
      const newChannel = (originalChannel % 16);
      control.midiChannel = newChannel;
      if (control.channel !== undefined) {
        control.channel = newChannel; // Update both if channel exists
      }

      changes.push({
        description: `Control ${key} channel`,
        originalValue: originalChannel,
        newValue: newChannel,
        verified: false
      });
    }

    console.log('Changes to be made:');
    console.log('───────────────────');
    changes.forEach((change, idx) => {
      console.log(`  ${idx + 1}. ${change.description}: ${JSON.stringify(change.originalValue)} → ${JSON.stringify(change.newValue)}`);
    });
    console.log();

    // Step 3: Write modified mode to target slot
    console.log(`Step 3: Writing modified mode to slot ${targetSlot}...`);
    await device.writeCustomMode(targetSlot, modifiedMode);
    console.log('✓ Write completed\n');

    // Wait for device to process
    console.log('Waiting for device to settle...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log();

    // Step 4: Read back from target slot
    console.log(`Step 4: Reading back from slot ${targetSlot}...`);
    const readBackMode = await device.readCustomMode(targetSlot);

    if (!readBackMode) {
      console.log('✗ Failed to read back custom mode');
      process.exit(1);
    }

    console.log('✓ Read-back successful');
    console.log(`  Name: "${readBackMode.name}"`);
    const readBackKeys = Object.keys(readBackMode.controls || {});
    console.log(`  Controls: ${readBackKeys.length}`);
    console.log();

    // Step 5: Verify all changes were preserved
    console.log('Step 5: Verifying changes...\n');

    // Verify mode name
    changes[0].verified = readBackMode.name === modifiedMode.name;

    // Verify control changes
    let changeIdx = 1; // Start after mode name
    for (let i = 0; i < controlsToModify; i++) {
      const key = controlKeys[i];
      const modifiedControl = modifiedMode.controls[key];
      const readBackControl = readBackMode.controls?.[key];

      if (readBackControl) {
        // Verify CC (check both ccNumber and cc properties)
        const modifiedCC = modifiedControl.ccNumber ?? modifiedControl.cc;
        const readBackCC = readBackControl.ccNumber ?? readBackControl.cc;
        changes[changeIdx].verified = readBackCC === modifiedCC;
        changeIdx++;

        // Verify name (if it was changed)
        if (modifiedControl.name !== undefined) {
          changes[changeIdx].verified = readBackControl.name === modifiedControl.name;
          changeIdx++;
        }

        // Verify channel (check both midiChannel and channel properties)
        const modifiedChannel = modifiedControl.midiChannel ?? modifiedControl.channel;
        const readBackChannel = readBackControl.midiChannel ?? readBackControl.channel;
        changes[changeIdx].verified = readBackChannel === modifiedChannel;
        changeIdx++;
      } else {
        // Control doesn't exist in read-back
        console.log(`  ⚠ Control ${key} missing in read-back`);
        changeIdx += (modifiedControl.name !== undefined ? 3 : 2);
      }
    }

    // Display verification results
    console.log('Verification Results:');
    console.log('────────────────────');

    let passCount = 0;
    let failCount = 0;

    changes.forEach((change, idx) => {
      const status = change.verified ? '✓' : '✗';
      console.log(`  ${status} ${change.description}: ${JSON.stringify(change.originalValue)} → ${JSON.stringify(change.newValue)}`);

      if (change.verified) {
        passCount++;
      } else {
        failCount++;
      }
    });

    console.log();
    console.log(`  Passed: ${passCount}/${changes.length}`);
    console.log(`  Failed: ${failCount}/${changes.length}`);

    // Detailed comparison for failures
    if (failCount > 0) {
      console.log('\nDetailed failure analysis:');
      console.log('─────────────────────────');

      // Check mode name
      if (!changes[0].verified) {
        console.log(`  Mode name: expected "${modifiedMode.name}", got "${readBackMode.name}"`);
      }

      // Check controls
      let changeIdx = 1;
      for (let i = 0; i < controlsToModify; i++) {
        const key = controlKeys[i];
        const modifiedControl = modifiedMode.controls[key];
        const readBackControl = readBackMode.controls?.[key];

        if (readBackControl) {
          // CC check
          if (!changes[changeIdx].verified) {
            const modifiedCC = modifiedControl.ccNumber ?? modifiedControl.cc;
            const readBackCC = readBackControl.ccNumber ?? readBackControl.cc;
            console.log(`  Control ${key} CC: expected ${modifiedCC}, got ${readBackCC}`);
          }
          changeIdx++;

          // Name check (if it exists)
          if (modifiedControl.name !== undefined) {
            if (!changes[changeIdx].verified) {
              console.log(`  Control ${key} name: expected "${modifiedControl.name}", got "${readBackControl.name}"`);
            }
            changeIdx++;
          }

          // Channel check
          if (!changes[changeIdx].verified) {
            const modifiedChannel = modifiedControl.midiChannel ?? modifiedControl.channel;
            const readBackChannel = readBackControl.midiChannel ?? readBackControl.channel;
            console.log(`  Control ${key} channel: expected ${modifiedChannel}, got ${readBackChannel}`);
          }
          changeIdx++;
        } else {
          console.log(`  Control ${key}: MISSING in read-back`);
          changeIdx += (modifiedControl.name !== undefined ? 3 : 2);
        }
      }
    }

    // Overall result
    const allPassed = failCount === 0;

    console.log('\n═══════════════════════════════════════════════════');
    console.log('RESULT');
    console.log('═══════════════════════════════════════════════════');

    if (allPassed) {
      console.log('✓ TEST PASSED');
      console.log(`  All ${changes.length} changes were preserved correctly`);
      console.log('  Device firmware accepted and stored valid modifications');
    } else {
      console.log('✗ TEST FAILED');
      console.log(`  ${failCount} out of ${changes.length} changes were NOT preserved`);
      console.log('  Some valid modifications were lost or corrupted');
    }
    console.log('═══════════════════════════════════════════════════\n');

    // Save results
    const results = {
      timestamp: new Date().toISOString(),
      sourceSlot,
      targetSlot,
      totalChanges: changes.length,
      passedChanges: passCount,
      failedChanges: failCount,
      testPassed: allPassed,
      changes: changes.map(c => ({
        description: c.description,
        originalValue: c.originalValue,
        newValue: c.newValue,
        verified: c.verified
      })),
      originalMode: {
        name: originalMode.name,
        controlCount: controlKeys.length
      },
      modifiedMode: {
        name: modifiedMode.name,
        controlCount: Object.keys(modifiedMode.controls).length
      },
      readBackMode: {
        name: readBackMode.name,
        controlCount: readBackKeys.length
      }
    };

    const resultsPath = `/Users/orion/work/ol_dsp/modules/audio-control/tmp/valid-mode-changes-${Date.now()}.json`;
    writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`Results saved to: ${resultsPath}\n`);

  } catch (error) {
    console.error('\n✗ Test failed:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    if (device) {
      console.log('→ Disconnecting...');
      await device.disconnect();
      console.log('✓ Disconnected');
    }
  }
}

main().catch(console.error);
