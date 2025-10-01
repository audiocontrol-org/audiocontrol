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
 *   - JUCE MIDI server running on http://localhost:7777
 *   - Device should be powered on and ready
 *
 * To start the JUCE MIDI server:
 *   cd ../../../modules/juce/midi-server
 *   make run
 *   # Server will run on http://localhost:7777
 */

import chalk from 'chalk';
import { LaunchControlXL3 } from '../src';
import { JuceMidiBackend } from '../src/backends/JuceMidiBackend.js';
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
    const response = await fetch('http://localhost:7777/health', { signal: AbortSignal.timeout(2000) });
    const data = await response.json();

    if (data.status === 'ok') {
      log.success('JUCE MIDI server is running');
      return true;
    }
  } catch (error) {
    log.error('JUCE MIDI server not running!');
    console.log();
    log.warning('═'.repeat(60));
    log.warning('Integration Test Environment Not Ready');
    log.warning('═'.repeat(60));
    console.log();
    log.info('Required setup:');
    log.info('  1. Start JUCE MIDI server:');
    console.log(chalk.white('     pnpm env:juce-server'));
    console.log();
    log.info('  2. Connect Launch Control XL3 via USB');
    log.info('  3. Power on the device');
    console.log();
    log.info('Quick check environment:');
    console.log(chalk.white('     pnpm env:check'));
    console.log();
    log.info('For more help:');
    console.log(chalk.white('     pnpm env:help'));
    console.log();
    return false;
  }

  return false;
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
  let backend: JuceMidiBackend | null = null;
  let testPassed = false;

  try {
    // Step 1: Create and initialize JuceMidiBackend
    log.step('Creating JuceMidiBackend instance...');
    backend = new JuceMidiBackend();

    log.step('Initializing JuceMidiBackend...');
    await backend.initialize();
    log.success('JuceMidiBackend initialized successfully!');

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

    // Step 6: Compare ONLY the modified controls
    log.section(' STEP 6: VERIFY CHANGES ');
    log.step('Comparing modified controls...');

    const errors: string[] = [];

    // Check mode name
    if (testMode.name !== readMode.name) {
      errors.push(`Mode name mismatch: sent="${testMode.name}", received="${readMode.name}"`);
      log.comparison('Mode Name', testMode.name, readMode.name, false);
    } else {
      log.comparison('Mode Name', testMode.name, readMode.name, true);
    }

    // Check FADER1
    const fader1Sent = testMode.controls['FADER1'];
    const fader1Received = readMode.controls['FADER1'];
    if (fader1Sent && fader1Received) {
      const fader1Match = compareControlMapping('FADER1', fader1Sent, fader1Received);
      if (!fader1Match.matches) {
        errors.push(...fader1Match.details);
      }
    }

    // Check SEND_A1
    const sendA1Sent = testMode.controls['SEND_A1'];
    const sendA1Received = readMode.controls['SEND_A1'];
    if (sendA1Sent && sendA1Received) {
      const sendA1Match = compareControlMapping('SEND_A1', sendA1Sent, sendA1Received);
      if (!sendA1Match.matches) {
        errors.push(...sendA1Match.details);
      }
    }

    console.log();

    if (errors.length === 0) {
      log.success('🎉 ROUND-TRIP TEST PASSED! 🎉');
      log.success('All modified data matches!');
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

    if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
      log.warning('');
      log.warning('TROUBLESHOOTING:');
      log.warning('• Start the JUCE MIDI server:');
      log.warning('  cd ../../../modules/juce/midi-server');
      log.warning('  make run');
      log.warning('• Server should be running on http://localhost:7777');
    } else if (error.message.includes('Cannot find MIDI devices')) {
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
      // JuceMidiBackend cleanup handled by server
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