#!/usr/bin/env tsx
/**
 * Integration Test: Custom Mode Write and Verify
 *
 * Purpose:
 *   Validates that CustomMode API changes are correctly written to the device
 *   and can be read back with all modifications preserved.
 *
 * Test Flow:
 *   1. Read custom mode from slot 10 using library API
 *   2. Make VALID changes using CustomMode structure
 *   3. Write modified mode to slot 3
 *   4. Read back from slot 3
 *   5. Verify all changes were preserved
 *
 * Prerequisites:
 *   - Launch Control XL3 connected via USB
 *   - Slot 10 must contain a configured custom mode
 *
 * Validates:
 *   - CustomMode read/write API
 *   - Device firmware accepts valid modifications
 *   - Data integrity through write/read cycle
 *   - Control property changes (CC, channel, name)
 *   - 18-character mode names (new in protocol v2)
 *
 * Related Issues: #36
 *
 * @module test/integration
 */

import { LaunchControlXL3 } from '../../src/index.js';
import { NodeMidiBackend } from '../../src/backends/NodeMidiBackend.js';
import type { CustomMode, ControlMapping } from '../../src/types.js';
import { writeFileSync } from 'fs';

interface TestChange {
  description: string;
  originalValue: any;
  newValue: any;
  verified: boolean;
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('Custom Mode Write and Verify Integration Test');
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

    // Run both test suites
    let allTestsPassed = true;

    // Test Suite 1: Standard property changes (original test)
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║          TEST SUITE 1: STANDARD PROPERTY CHANGES               ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    const suite1Passed = await testStandardPropertyChanges(device);
    if (!suite1Passed) allTestsPassed = false;

    console.log('\n');

    // Test Suite 2: 18-character mode names
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║          TEST SUITE 2: 18-CHARACTER MODE NAMES                 ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    const suite2Passed = await test18CharacterModeNames(device);
    if (!suite2Passed) allTestsPassed = false;

    // Overall Summary
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('OVERALL TEST RESULTS');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Test Suite 1 (Standard Properties): ${suite1Passed ? '✓ PASSED' : '✗ FAILED'}`);
    console.log(`Test Suite 2 (18-char Mode Names): ${suite2Passed ? '✓ PASSED' : '✗ FAILED'}`);
    console.log('═══════════════════════════════════════════════════════════════');

    if (allTestsPassed) {
      console.log('✓ ALL TESTS PASSED');
    } else {
      console.log('✗ SOME TESTS FAILED');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n✗ Test failed:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    if (device) {
      console.log('\n→ Disconnecting...');
      await device.disconnect();
      console.log('✓ Disconnected');
    }
  }
}

/**
 * Test Suite 1: Standard Property Changes (Original Test)
 */
async function testStandardPropertyChanges(device: LaunchControlXL3): Promise<boolean> {
  const sourceSlot = 10;
  const targetSlot = 3;

  // Step 1: Read from source slot
  console.log(`Step 1: Reading custom mode from slot ${sourceSlot}...`);
  const originalMode = await device.readCustomMode(sourceSlot);

  if (!originalMode) {
    console.log('✗ Failed to read custom mode');
    return false;
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
    return false;
  }

  if (controlKeys.length === 0) {
    console.log('✗ No controls found in slot 10');
    console.log('  Try a different source slot that has configured controls');
    return false;
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
    return false;
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
  console.log('SUITE 1 RESULT');
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
    testSuite: 'standard-property-changes',
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

  const resultsPath = `/Users/orion/work/ol_dsp/modules/audio-control/tmp/custom-mode-write-verify-standard-${Date.now()}.json`;
  writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`Results saved to: ${resultsPath}\n`);

  return allPassed;
}

/**
 * Test Suite 2: 18-Character Mode Names
 * Tests the new protocol support for extended mode names (up to 18 characters)
 */
async function test18CharacterModeNames(device: LaunchControlXL3): Promise<boolean> {
  const sourceSlot = 10;
  const targetSlot = 3;

  console.log('Testing 18-character mode name support...\n');
  console.log('This validates the protocol change from 8 to 18 character limit.\n');

  // Read baseline mode
  console.log(`Step 1: Reading baseline from slot ${sourceSlot}...`);
  const baselineMode = await device.readCustomMode(sourceSlot);

  if (!baselineMode) {
    console.log('✗ Failed to read baseline mode');
    return false;
  }

  console.log('✓ Read successful\n');

  // Test cases for 18-character names
  const testCases = [
    {
      name: '17CharacterMode1',
      description: '17 characters (under limit)',
      expectedLength: 17,
      shouldSucceed: true
    },
    {
      name: 'EXACTLY18CHARSLONG',
      description: 'Exactly 18 characters (at limit)',
      expectedLength: 18,
      shouldSucceed: true
    },
    {
      name: '18CharModeName123',
      description: '18 characters with mixed case',
      expectedLength: 18,
      shouldSucceed: true
    },
    {
      name: 'ShortName',
      description: 'Short name (9 characters, over old limit)',
      expectedLength: 9,
      shouldSucceed: true
    }
  ];

  const results: Array<{
    testCase: typeof testCases[0];
    written: boolean;
    readBack: string | null;
    verified: boolean;
    error?: string;
  }> = [];

  // Run each test case
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n───────────────────────────────────────────────────────────`);
    console.log(`Test Case ${i + 1}/${testCases.length}: ${testCase.description}`);
    console.log(`───────────────────────────────────────────────────────────`);
    console.log(`  Name: "${testCase.name}"`);
    console.log(`  Length: ${testCase.name.length} characters`);
    console.log(`  Expected: ${testCase.expectedLength} characters`);
    console.log();

    let written = false;
    let readBack: string | null = null;
    let verified = false;
    let error: string | undefined;

    try {
      // Create mode with test name
      const testMode: CustomMode = {
        ...baselineMode,
        name: testCase.name,
        controls: { ...baselineMode.controls }
      };

      // Deep clone controls
      for (const key in testMode.controls) {
        testMode.controls[key] = { ...baselineMode.controls[key] };
      }

      // Write to device
      console.log(`  → Writing to slot ${targetSlot}...`);
      await device.writeCustomMode(targetSlot, testMode);
      written = true;
      console.log(`  ✓ Write successful`);

      // Wait for device to settle
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Read back
      console.log(`  → Reading back from slot ${targetSlot}...`);
      const readBackMode = await device.readCustomMode(targetSlot);

      if (!readBackMode) {
        throw new Error('Failed to read back mode');
      }

      readBack = readBackMode.name;
      console.log(`  ✓ Read successful`);
      console.log(`  Read name: "${readBack}"`);
      console.log(`  Read length: ${readBack.length} characters`);

      // Verify
      if (readBack === testCase.name) {
        verified = true;
        console.log(`  ✓ VERIFIED: Name matches exactly`);
      } else {
        verified = false;
        console.log(`  ✗ MISMATCH:`);
        console.log(`    Expected: "${testCase.name}"`);
        console.log(`    Got:      "${readBack}"`);

        // Detailed comparison
        if (readBack.length !== testCase.name.length) {
          console.log(`    Length mismatch: expected ${testCase.name.length}, got ${readBack.length}`);
        }

        // Character-by-character comparison
        for (let j = 0; j < Math.max(testCase.name.length, readBack.length); j++) {
          const expected = testCase.name[j] || '(none)';
          const actual = readBack[j] || '(none)';
          if (expected !== actual) {
            console.log(`    Position ${j}: expected '${expected}', got '${actual}'`);
          }
        }
      }

    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      console.log(`  ✗ ERROR: ${error}`);
    }

    results.push({
      testCase,
      written,
      readBack,
      verified,
      error
    });

    // Small delay between test cases
    if (i < testCases.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════');
  console.log('SUITE 2 RESULTS SUMMARY');
  console.log('═══════════════════════════════════════════════════\n');

  let passCount = 0;
  let failCount = 0;

  results.forEach((result, idx) => {
    const status = result.verified ? '✓ PASS' : '✗ FAIL';
    console.log(`${status} Test ${idx + 1}: ${result.testCase.description}`);
    console.log(`     Name: "${result.testCase.name}" (${result.testCase.name.length} chars)`);

    if (result.verified) {
      console.log(`     Result: Successfully written and verified`);
      passCount++;
    } else if (result.error) {
      console.log(`     Result: Error - ${result.error}`);
      failCount++;
    } else {
      console.log(`     Result: Written but mismatch on read-back`);
      console.log(`     Read back: "${result.readBack}"`);
      failCount++;
    }
    console.log();
  });

  console.log('───────────────────────────────────────────────────');
  console.log(`Total: ${results.length} tests`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  console.log('───────────────────────────────────────────────────\n');

  const allPassed = failCount === 0;

  if (allPassed) {
    console.log('✓ ALL 18-CHARACTER MODE NAME TESTS PASSED');
    console.log('  Device correctly supports mode names up to 18 characters');
    console.log('  Protocol change validated successfully');
  } else {
    console.log('✗ SOME 18-CHARACTER MODE NAME TESTS FAILED');
    console.log(`  ${failCount} out of ${results.length} tests did not pass`);
    console.log('  Device may not fully support 18-character names');
  }

  console.log('═══════════════════════════════════════════════════\n');

  // Save detailed results
  const detailedResults = {
    timestamp: new Date().toISOString(),
    testSuite: '18-character-mode-names',
    sourceSlot,
    targetSlot,
    totalTests: results.length,
    passedTests: passCount,
    failedTests: failCount,
    testPassed: allPassed,
    testCases: results.map(r => ({
      description: r.testCase.description,
      name: r.testCase.name,
      nameLength: r.testCase.name.length,
      expectedLength: r.testCase.expectedLength,
      shouldSucceed: r.testCase.shouldSucceed,
      written: r.written,
      readBack: r.readBack,
      readBackLength: r.readBack?.length ?? null,
      verified: r.verified,
      error: r.error
    }))
  };

  const resultsPath = `/Users/orion/work/ol_dsp/modules/audio-control/tmp/custom-mode-write-verify-18char-${Date.now()}.json`;
  writeFileSync(resultsPath, JSON.stringify(detailedResults, null, 2));
  console.log(`Detailed results saved to: ${resultsPath}\n`);

  return allPassed;
}

main().catch(console.error);
