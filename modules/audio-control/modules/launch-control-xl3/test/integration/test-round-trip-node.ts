#!/usr/bin/env tsx
/**
 * Node.js Round-Trip Integration Test for Launch Control XL 3
 *
 * INTEGRATION TEST: Uses ONLY PUBLIC API methods
 *
 * Tests the complete label pipeline by:
 * 1. Creating test custom mode using createCustomMode() (PUBLIC API)
 * 2. Adding control names to test label extraction
 * 3. Saving mode using saveCustomMode() (PUBLIC API - extracts labels)
 * 4. Loading mode using loadCustomMode() (PUBLIC API - parses labels)
 * 5. Comparing sent vs received data to ensure labels survive round-trip
 *
 * This validates that the entire custom mode write/read cycle works correctly,
 * including label extraction, SysEx encoding, and label parsing.
 *
 * PUBLIC API FLOW TESTED:
 * - controller.createCustomMode(name) → Creates mode structure
 * - controller.saveCustomMode(slot, mode) → CustomModeManager.writeMode()
 *   → CustomModeManager.convertToDeviceFormat() (extracts labels)
 *   → DeviceManager.writeCustomMode() (passes labels)
 *   → SysExParser.encodeCustomModeData() (encodes labels)
 * - controller.loadCustomMode(slot) → CustomModeManager.readMode()
 *   → DeviceManager.readCustomMode()
 *   → SysExParser.parse() (parses labels)
 *   → CustomModeManager.parseCustomModeResponse() (converts to user format)
 *
 * Usage:
 *   tsx utils/test-round-trip-node.ts [slot]
 *   npm run test:round-trip:node
 *
 * Arguments:
 *   slot - Optional slot number (0-14 for slots 1-15). Default: 0
 *
 * Requirements:
 *   - Launch Control XL 3 device connected via USB
 *   - Device should be powered on and ready
 */

import chalk from 'chalk';
import { LaunchControlXL3 } from '../src';
import { NodeMidiBackend } from '../src/backends/NodeMidiBackend.js';
import type { CustomMode, ControlMapping } from '../src/types/CustomMode.js';

// Console formatting helpers
const log = {
  info: (msg: string) => console.log(chalk.blue('ℹ'), msg),
  success: (msg: string) => console.log(chalk.green('✓'), msg),
  error: (msg: string) => console.log(chalk.red('✗'), msg),
  warning: (msg: string) => console.log(chalk.yellow('⚠'), msg),
  step: (msg: string) => console.log(chalk.cyan('→'), msg),
  title: (msg: string) => console.log(chalk.bold.underline(msg)),
  data: (label: string, value: any) => console.log(chalk.gray(`  ${label}:`), chalk.white(value)),
  section: (msg: string) => console.log(chalk.bgBlue.white(` ${msg} `)),
  comparison: (label: string, sent: any, received: any, match: boolean) => {
    const status = match ? chalk.green('✓') : chalk.red('✗');
    console.log(`${status} ${label}:`);
    console.log(chalk.gray(`    Sent:     ${sent}`));
    console.log(chalk.gray(`    Received: ${received}`));
    if (!match) {
      console.log(chalk.red(`    MISMATCH!`));
    }
  }
};

// Test configuration
const SOURCE_SLOT = 14;  // Physical slot 15 - read baseline from here
const TARGET_SLOT = 0;   // Physical slot 1 - write and verify here

/**
 * Modify a factory mode for testing
 * Changes name and modifies TWO controls only
 */
function modifyFactoryMode(factoryMode: CustomMode): { modified: CustomMode; changes: any } {
  // Clone the mode
  const modified: CustomMode = {
    ...factoryMode,
    name: 'RT Test',
    controls: { ...factoryMode.controls },
    metadata: {
      ...factoryMode.metadata,
      name: 'Round-Trip Test Mode',
      description: 'Test mode for validating write/read cycle',
    }
  };

  // Track what we're changing
  const changes = {
    modeName: { old: factoryMode.name, new: 'RT Test' },
    controls: {} as Record<string, any>
  };

  // Modify FADER1 - change MIDI channel, CC, and name
  if (modified.controls['FADER1']) {
    const original = { ...modified.controls['FADER1'] };
    modified.controls['FADER1'] = {
      ...modified.controls['FADER1'],
      name: 'TestVol1',
      midiChannel: 5,
      ccNumber: 77,
    };
    changes.controls['FADER1'] = { original, modified: modified.controls['FADER1'] };
  }

  // Modify SEND_A1 - change MIDI channel, CC, and name
  if (modified.controls['SEND_A1']) {
    const original = { ...modified.controls['SEND_A1'] };
    modified.controls['SEND_A1'] = {
      ...modified.controls['SEND_A1'],
      name: 'TestRev',
      midiChannel: 6,
      ccNumber: 91,
    };
    changes.controls['SEND_A1'] = { original, modified: modified.controls['SEND_A1'] };
  }

  return { modified, changes };
}

/**
 * Compare two control mappings for equality
 */
function compareControlMapping(controlKey: string, sent: ControlMapping, received: ControlMapping): { matches: boolean; details: string[] } {
  const details: string[] = [];
  let matches = true;

  console.log(chalk.cyan(`\n  Comparing control: ${controlKey}`));

  // Compare control name (this is the key feature we're testing)
  const nameMatch = sent.name === received.name;
  log.comparison(`${controlKey} Name`, sent.name || '(none)', received.name || '(none)', nameMatch);
  if (!nameMatch) {
    matches = false;
    details.push(`${controlKey}: name mismatch: sent="${sent.name}", received="${received.name}"`);
  }

  // Compare MIDI channel
  const channelMatch = sent.midiChannel === received.midiChannel;
  log.comparison(`${controlKey} MIDI Channel`, sent.midiChannel, received.midiChannel, channelMatch);
  if (!channelMatch) {
    matches = false;
    details.push(`${controlKey}: MIDI channel mismatch: sent=${sent.midiChannel}, received=${received.midiChannel}`);
  }

  // Compare CC number
  const ccMatch = sent.ccNumber === received.ccNumber;
  log.comparison(`${controlKey} CC Number`, sent.ccNumber, received.ccNumber, ccMatch);
  if (!ccMatch) {
    matches = false;
    details.push(`${controlKey}: CC number mismatch: sent=${sent.ccNumber}, received=${received.ccNumber}`);
  }

  // Compare min/max values
  const minMatch = sent.minValue === received.minValue;
  const maxMatch = sent.maxValue === received.maxValue;
  log.comparison(`${controlKey} Min Value`, sent.minValue, received.minValue, minMatch);
  log.comparison(`${controlKey} Max Value`, sent.maxValue, received.maxValue, maxMatch);

  if (!minMatch) {
    matches = false;
    details.push(`${controlKey}: min value mismatch: sent=${sent.minValue}, received=${received.minValue}`);
  }
  if (!maxMatch) {
    matches = false;
    details.push(`${controlKey}: max value mismatch: sent=${sent.maxValue}, received=${received.maxValue}`);
  }

  // Compare behavior
  const behaviorMatch = sent.behavior === received.behavior;
  log.comparison(`${controlKey} Behavior`, sent.behavior, received.behavior, behaviorMatch);
  if (!behaviorMatch) {
    matches = false;
    details.push(`${controlKey}: behavior mismatch: sent="${sent.behavior}", received="${received.behavior}"`);
  }

  return { matches, details };
}

/**
 * Check if test environment is ready
 */
async function checkEnvironment(): Promise<boolean> {
  log.step('Checking test environment...');

  try {
    // Create a temporary NodeMidiBackend to check for LCXL3 device
    const backend = new NodeMidiBackend();
    await backend.initialize();

    const inputPorts = await backend.getInputPorts();
    const outputPorts = await backend.getOutputPorts();

    // Look for Launch Control XL3 in available ports
    const lcxl3Input = inputPorts.find(p =>
      p.name.toLowerCase().includes('launch control xl') ||
      p.name.toLowerCase().includes('lcxl3')
    );

    const lcxl3Output = outputPorts.find(p =>
      p.name.toLowerCase().includes('launch control xl') ||
      p.name.toLowerCase().includes('lcxl3')
    );

    await backend.cleanup();

    if (lcxl3Input && lcxl3Output) {
      log.success('Launch Control XL3 device found');
      log.data('Input Port', lcxl3Input.name);
      log.data('Output Port', lcxl3Output.name);
      return true;
    } else {
      log.error('Launch Control XL3 device not found!');
      console.log();
      log.warning('═'.repeat(60));
      log.warning('Integration Test Environment Not Ready');
      log.warning('═'.repeat(60));
      console.log();
      log.info('Required setup:');
      log.info('  1. Connect Launch Control XL3 via USB');
      log.info('  2. Power on the device');
      console.log();
      log.info('Available MIDI ports:');
      if (inputPorts.length === 0) {
        log.warning('  No MIDI input ports found');
      } else {
        log.info('  Input ports:');
        inputPorts.forEach(p => console.log(chalk.gray(`    - ${p.name}`)));
      }
      if (outputPorts.length === 0) {
        log.warning('  No MIDI output ports found');
      } else {
        log.info('  Output ports:');
        outputPorts.forEach(p => console.log(chalk.gray(`    - ${p.name}`)));
      }
      console.log();
      return false;
    }
  } catch (error: any) {
    log.error('Failed to enumerate MIDI ports!');
    console.log();
    log.warning('═'.repeat(60));
    log.warning('MIDI System Error');
    log.warning('═'.repeat(60));
    console.log();
    log.error(`Error: ${error.message}`);
    console.log();
    log.info('Troubleshooting:');
    log.info('  1. Ensure MIDI drivers are installed');
    log.info('  2. Check system MIDI settings');
    log.info('  3. Verify device permissions');
    console.log();
    return false;
  }
}

/**
 * Main round-trip test function
 */
async function testRoundTrip(): Promise<void> {
  log.title('Launch Control XL 3 - Round-Trip Test');
  console.log('='.repeat(60));

  log.info('Testing write/read cycle with baseline modification');
  log.data('Source Slot', `${SOURCE_SLOT} (physical slot ${SOURCE_SLOT + 1})`);
  log.data('Target Slot', `${TARGET_SLOT} (physical slot ${TARGET_SLOT + 1})`);
  console.log();

  // Check environment first
  const envReady = await checkEnvironment();
  if (!envReady) {
    process.exit(1);
  }

  console.log();

  let controller: LaunchControlXL3 | null = null;
  let backend: NodeMidiBackend | null = null;
  let testPassed = false;

  try {
    // Step 1: Create and initialize NodeMidiBackend
    log.step('Creating NodeMidiBackend instance...');
    backend = new NodeMidiBackend();

    log.step('Initializing NodeMidiBackend...');
    await backend.initialize();
    log.success('NodeMidiBackend initialized successfully!');

    // Step 2: Create LaunchControlXL3 instance
    log.step('Creating LaunchControlXL3 instance...');
    controller = new LaunchControlXL3({
      midiBackend: backend,
      enableLedControl: true,
      enableCustomModes: true,
    });

    // Step 3: Setup event handlers
    log.step('Setting up event handlers...');

    controller.on('device:connected', (device) => {
      log.success('Device connected successfully!');
      log.data('Manufacturer ID', device.manufacturerId);
      log.data('Family Code', device.familyCode);
      log.data('Model Number', device.modelNumber);
      log.data('Firmware Version', device.firmwareVersion);
    });

    controller.on('device:disconnected', (reason) => {
      log.warning(`Device disconnected: ${reason || 'Unknown reason'}`);
    });

    controller.on('device:error', (error) => {
      log.error(`Device error: ${error.message}`);
    });

    // Step 4: Connect to device
    log.step('Attempting to connect to Launch Control XL 3...');

    // Wait for device to be ready with timeout
    const connectPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Failed to connect to device within timeout period'));
      }, 10000);

      controller.once('device:ready', () => {
        clearTimeout(timeout);
        resolve();
      });

      controller.once('device:error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    await controller.connect();
    await connectPromise;

    log.success('Connected to Launch Control XL 3!');
    console.log();

    // Step 1: Read baseline mode
    log.section(' STEP 1: READ BASELINE MODE ');
    log.step(`Reading baseline from slot ${SOURCE_SLOT}...`);

    const sourceMode = await controller.loadCustomMode(SOURCE_SLOT);

    if (!sourceMode) {
      throw new Error(`Failed to read mode from slot ${SOURCE_SLOT}`);
    }

    log.success(`Mode read from slot ${SOURCE_SLOT}!`);
    log.data('Source Mode Name', sourceMode.name);
    log.data('Source Control Count', Object.keys(sourceMode.controls).length);

    // CRITICAL: Validate factory defaults are complete
    console.log(chalk.gray('\n  Validating factory defaults...'));

    const expectedControlCount = 48; // Device has 48 controls
    const actualControlCount = Object.keys(sourceMode.controls).length;

    if (actualControlCount !== expectedControlCount) {
      throw new Error(
        `❌ INVALID FACTORY DATA: Expected ${expectedControlCount} controls, got ${actualControlCount}.\n` +
        `Factory default slot must contain ALL controls with valid MIDI parameters.\n` +
        `This slot appears to have incomplete data.`
      );
    }

    // Validate each control has valid MIDI parameters (not CH0/CC0 which is non-functional)
    const invalidControls: string[] = [];
    for (const [id, control] of Object.entries(sourceMode.controls)) {
      // CH0/CC0 means the control is not configured (non-functional)
      if (control.midiChannel === 0 && control.ccNumber === 0) {
        invalidControls.push(`${id} (CH0/CC0)`);
      }
    }

    if (invalidControls.length > 0) {
      console.log(chalk.red('\n  Invalid controls found:'));
      invalidControls.forEach(ctrl => console.log(chalk.red(`    ${ctrl}`)));
      throw new Error(
        `❌ INVALID FACTORY DATA: ${invalidControls.length} controls have CH0/CC0 (non-functional).\n` +
        `Factory defaults must have valid MIDI channel and CC numbers for all controls.\n` +
        `This slot does not contain proper factory defaults.`
      );
    }

    log.success('Factory defaults validated: All 48 controls present with valid MIDI parameters');

    console.log();

    // Step 2: Modify mode (only 2 controls)
    log.section(' STEP 2: MODIFY MODE (2 CONTROLS) ');
    log.step('Modifying source mode...');
    log.info('Changes: mode name + FADER1 + SEND_A1');

    const { modified: testMode, changes } = modifyFactoryMode(sourceMode);

    log.success('Mode modified!');
    log.data('New Mode Name', testMode.name);
    console.log(chalk.gray('\n  Modified Controls:'));
    console.log(chalk.gray(`    FADER1: "${testMode.controls['FADER1']?.name}" (CH${testMode.controls['FADER1']?.midiChannel}, CC${testMode.controls['FADER1']?.ccNumber})`));
    console.log(chalk.gray(`    SEND_A1: "${testMode.controls['SEND_A1']?.name}" (CH${testMode.controls['SEND_A1']?.midiChannel}, CC${testMode.controls['SEND_A1']?.ccNumber})`));

    console.log();

    // Step 4: Write modified mode to target slot
    log.section(' STEP 4: WRITE TO DEVICE ');
    log.step(`Writing modified mode to slot ${TARGET_SLOT}...`);

    await controller.saveCustomMode(TARGET_SLOT, testMode);
    log.success(`Mode saved to slot ${TARGET_SLOT}!`);

    // Small delay to ensure write is complete
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log();

    // Step 5: Read back from target slot
    log.section(' STEP 5: READ FROM DEVICE ');
    log.step(`Reading mode back from slot ${TARGET_SLOT}...`);

    const readMode = await controller.loadCustomMode(TARGET_SLOT);

    if (!readMode) {
      throw new Error(`Failed to read mode from slot ${TARGET_SLOT}`);
    }

    log.success(`Mode read from slot ${TARGET_SLOT}!`);
    log.data('Read Mode Name', readMode.name);
    console.log(chalk.gray('\n  Read Controls (modified ones):'));
    console.log(chalk.gray(`    FADER1: "${readMode.controls['FADER1']?.name || '(no name)'}" (CH${readMode.controls['FADER1']?.midiChannel}, CC${readMode.controls['FADER1']?.ccNumber})`));
    console.log(chalk.gray(`    SEND_A1: "${readMode.controls['SEND_A1']?.name || '(no name)'}" (CH${readMode.controls['SEND_A1']?.midiChannel}, CC${readMode.controls['SEND_A1']?.ccNumber})`));

    console.log();

    // Step 6: Compare ALL controls from the source mode
    log.section(' STEP 6: VERIFY CHANGES ');
    log.step('Comparing ALL controls from baseline...');

    const errors: string[] = [];

    // Check mode name
    if (testMode.name !== readMode.name) {
      errors.push(`Mode name mismatch: sent="${testMode.name}", received="${readMode.name}"`);
      log.comparison('Mode Name', testMode.name, readMode.name, false);
    } else {
      log.comparison('Mode Name', testMode.name, readMode.name, true);
    }

    // Check control count
    const sentControlCount = Object.keys(testMode.controls).length;
    const receivedControlCount = Object.keys(readMode.controls).length;

    if (sentControlCount !== receivedControlCount) {
      errors.push(`Control count mismatch: sent=${sentControlCount}, received=${receivedControlCount}`);
      log.comparison('Control Count', sentControlCount.toString(), receivedControlCount.toString(), false);
    } else {
      log.comparison('Control Count', sentControlCount.toString(), receivedControlCount.toString(), true);
    }

    // Check ALL controls that were sent
    console.log();
    console.log(chalk.gray('  Verifying all controls:'));

    for (const [controlId, sentControl] of Object.entries(testMode.controls)) {
      const receivedControl = readMode.controls[controlId];

      if (!receivedControl) {
        errors.push(`Control ${controlId} missing from device`);
        console.log(chalk.red(`    ✗ ${controlId}: MISSING`));
      } else {
        const match = compareControlMapping(controlId, sentControl, receivedControl);
        if (!match.matches) {
          errors.push(...match.details);
        }
      }
    }

    console.log();

    if (errors.length === 0) {
      log.success('🎉 ROUND-TRIP TEST PASSED! 🎉');
      log.success('All controls match!');
      testPassed = true;
    } else {
      log.error('❌ ROUND-TRIP TEST FAILED! ❌');
      log.error('Data mismatch detected:');
      errors.forEach(detail => {
        log.error(`  • ${detail}`);
      });
    }

    // Summary
    console.log('');
    log.section(' SUMMARY ');
    console.log('This test verifies:');
    console.log('  1. loadCustomMode() reads factory default correctly');
    console.log('  2. Mode modifications (name + 2 controls)');
    console.log('  3. saveCustomMode() writes changes to device');
    console.log('  4. loadCustomMode() reads changes back');
    console.log('  5. Changes survive complete round-trip');
    console.log('');
    console.log('Pipeline tested:');
    console.log('  Read Factory → Modify → Write → Read → Compare');
    console.log('');

  } catch (error: any) {
    log.error('Test failed with error:');
    log.error(error.message);

    if (error.message.includes('Cannot find MIDI devices') || error.message.includes('not found')) {
      log.warning('');
      log.warning('TROUBLESHOOTING:');
      log.warning('• Ensure Launch Control XL 3 is connected via USB');
      log.warning('• Check that the device is powered on');
      log.warning('• Verify MIDI drivers are installed');
      log.warning('• Try disconnecting and reconnecting the device');
    }
  } finally {
    // Cleanup
    if (controller) {
      log.step('Disconnecting from device...');
      try {
        await controller.disconnect();
        log.success('Disconnected successfully');
      } catch (error) {
        log.warning('Error during disconnect (this is usually harmless)');
      }
    }

    if (backend) {
      log.step('Cleaning up MIDI backend...');
      await backend.cleanup();
    }
  }

  // Exit with appropriate code
  process.exit(testPassed ? 0 : 1);
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  log.warning('\nTest interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  log.warning('\nTest terminated');
  process.exit(1);
});

// Run the test
testRoundTrip().catch((error: any) => {
  log.error('Unhandled error:', error.message);
  process.exit(1);
});
