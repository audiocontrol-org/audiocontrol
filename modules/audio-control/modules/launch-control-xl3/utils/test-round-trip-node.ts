#!/usr/bin/env tsx
/**
 * Node.js Round-Trip Test Script for Launch Control XL 3
 *
 * Tests the MVP.4 round-trip functionality by:
 * 1. Creating test custom mode data with control names
 * 2. Writing the custom mode to a specified device slot
 * 3. Reading the same data back from the device
 * 4. Comparing sent vs received data to ensure they match
 *
 * This validates that the entire custom mode write/read cycle works correctly,
 * including the new control name parsing functionality.
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
 *   - Native MIDI bindings built successfully (node-midi OR jazz-midi)
 *   - Python 3.11 or earlier + build tools (for native bindings)
 *   - Device should be powered on and ready
 *
 * IMPORTANT: All Node.js MIDI libraries require native bindings. There is no pure
 * JavaScript solution for Node.js MIDI access. If native bindings fail to build,
 * use the browser test instead.
 */

import chalk from 'chalk';
import { LaunchControlXL3 } from '../src';
import { EasyMidiBackend } from '../src/core/backends/EasyMidiBackend.js';
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

// Parse command line arguments
const args = process.argv.slice(2);
const targetSlot = args[0] ? parseInt(args[0], 10) : 0;

// Validate slot number
if (isNaN(targetSlot) || targetSlot < 0 || targetSlot > 14) {
  log.error('Invalid slot number. Must be 0-14 (for slots 1-15).');
  process.exit(1);
}

/**
 * Create test custom mode with control names for round-trip testing
 */
function createTestCustomMode(): CustomMode {
  const testMode: CustomMode = {
    name: 'RT Test',  // 8 char limit
    controls: {},
    metadata: {
      name: 'Round-Trip Test Mode',
      description: 'Test mode for validating write/read cycle with control names',
      version: '1.0.0',
      author: 'Launch Control XL3 Test Suite',
      created: new Date().toISOString()
    }
  };

  // Add test controls with names to validate name parsing
  const testControls: Record<string, ControlMapping> = {
    // Faders with custom names
    'fader1': {
      name: 'Vol Trk1',
      midiChannel: 1,
      ccNumber: 77,
      minValue: 0,
      maxValue: 127,
      behavior: 'absolute'
    },
    'fader2': {
      name: 'Vol Trk2',
      midiChannel: 1,
      ccNumber: 78,
      minValue: 0,
      maxValue: 127,
      behavior: 'absolute'
    },
    'fader3': {
      name: 'Vol Trk3',
      midiChannel: 1,
      ccNumber: 79,
      minValue: 0,
      maxValue: 127,
      behavior: 'absolute'
    },

    // Top row knobs with custom names
    'send_a1': {
      name: 'Reverb 1',
      midiChannel: 2,
      ccNumber: 13,
      minValue: 0,
      maxValue: 127,
      behavior: 'absolute'
    },
    'send_a2': {
      name: 'Reverb 2',
      midiChannel: 2,
      ccNumber: 14,
      minValue: 0,
      maxValue: 127,
      behavior: 'absolute'
    },
    'send_a3': {
      name: 'Delay 1',
      midiChannel: 2,
      ccNumber: 15,
      minValue: 0,
      maxValue: 127,
      behavior: 'absolute'
    },

    // Middle row knobs with custom names
    'send_b1': {
      name: 'EQ High',
      midiChannel: 3,
      ccNumber: 29,
      minValue: 0,
      maxValue: 127,
      behavior: 'absolute'
    },
    'send_b2': {
      name: 'EQ Mid',
      midiChannel: 3,
      ccNumber: 30,
      minValue: 0,
      maxValue: 127,
      behavior: 'absolute'
    },

    // Bottom row knobs with custom names
    'pan1': {
      name: 'Pan Tr1',
      midiChannel: 4,
      ccNumber: 49,
      minValue: 0,
      maxValue: 127,
      behavior: 'absolute'
    },
    'pan2': {
      name: 'Pan Tr2',
      midiChannel: 4,
      ccNumber: 50,
      minValue: 0,
      maxValue: 127,
      behavior: 'absolute'
    },

    // Buttons with custom names
    'focus1': {
      name: 'Mute T1',
      midiChannel: 5,
      ccNumber: 104,
      minValue: 0,
      maxValue: 127,
      behavior: 'toggle'
    },
    'focus2': {
      name: 'Solo T1',
      midiChannel: 5,
      ccNumber: 105,
      minValue: 0,
      maxValue: 127,
      behavior: 'toggle'
    }
  };

  testMode.controls = testControls;
  return testMode;
}

/**
 * Compare two custom modes for equality
 */
function compareCustomModes(sent: CustomMode, received: CustomMode): { matches: boolean; details: string[] } {
  const details: string[] = [];
  let matches = true;

  // Compare mode name
  const nameMatch = sent.name === received.name;
  log.comparison('Mode Name', sent.name, received.name, nameMatch);
  if (!nameMatch) {
    matches = false;
    details.push(`Mode name mismatch: sent="${sent.name}", received="${received.name}"`);
  }

  // Compare control count
  const sentControlKeys = Object.keys(sent.controls);
  const receivedControlKeys = Object.keys(received.controls);
  const controlCountMatch = sentControlKeys.length === receivedControlKeys.length;
  log.comparison('Control Count', sentControlKeys.length, receivedControlKeys.length, controlCountMatch);

  if (!controlCountMatch) {
    matches = false;
    details.push(`Control count mismatch: sent=${sentControlKeys.length}, received=${receivedControlKeys.length}`);
  }

  // Compare individual controls
  for (const controlKey of sentControlKeys) {
    const sentControl = sent.controls[controlKey];
    const receivedControl = received.controls[controlKey];

    if (!receivedControl) {
      matches = false;
      details.push(`Missing control in received data: ${controlKey}`);
      log.error(`Missing control: ${controlKey}`);
      continue;
    }

    // Compare control properties
    const controlMatches = compareControlMapping(controlKey, sentControl, receivedControl);
    if (!controlMatches.matches) {
      matches = false;
      details.push(...controlMatches.details);
    }
  }

  return { matches, details };
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
 * Main round-trip test function
 */
async function testRoundTrip(): Promise<void> {
  log.title('Launch Control XL 3 - MVP.4 Round-Trip Test');
  console.log('='.repeat(60));

  log.info(`Testing write/read cycle for custom mode with control names`);
  log.data('Target Slot', `${targetSlot} (slot ${targetSlot + 1})`);
  console.log();

  let controller: LaunchControlXL3 | null = null;
  let backend: EasyMidiBackend | null = null;
  let testPassed = false;

  try {
    // Step 1: Create and initialize EasyMidiBackend
    log.step('Creating EasyMidiBackend instance...');
    backend = new EasyMidiBackend();

    log.step('Initializing EasyMidiBackend...');
    await backend.initialize();
    log.success('EasyMidiBackend initialized successfully!');

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

    // Step 5: Create test custom mode
    log.section(' STEP 1: CREATE TEST DATA ');
    log.step('Creating test custom mode with control names...');

    const testMode = createTestCustomMode();

    log.success('Test custom mode created!');
    log.data('Mode Name', testMode.name);
    log.data('Control Count', Object.keys(testMode.controls).length);

    // Display test controls
    console.log(chalk.gray('\n  Test Controls:'));
    for (const [key, control] of Object.entries(testMode.controls)) {
      console.log(chalk.gray(`    ${key}: "${control.name}" (CH${control.midiChannel}, CC${control.ccNumber})`));
    }

    console.log();

    // Step 6: Write custom mode to device
    log.section(' STEP 2: WRITE TO DEVICE ');
    log.step(`Writing test mode to slot ${targetSlot}...`);

    // Convert controls object to array format for writing
    const controlsArray = Object.values(testMode.controls);
    const colorsArray = testMode.colors ? Array.from(testMode.colors.entries()).map(([controlId, color]) => ({
      controlId,
      color,
      behaviour: 'static'
    })) : [];

    const modeToWrite = {
      ...testMode,
      controls: controlsArray,
      colors: colorsArray
    };

    await controller.writeCustomMode(targetSlot, modeToWrite as any);
    log.success(`Custom mode written to slot ${targetSlot}!`);

    // Small delay to ensure write is complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 7: Read custom mode back from device
    log.section(' STEP 3: READ FROM DEVICE ');
    log.step(`Reading custom mode from slot ${targetSlot}...`);

    const readMode = await controller.readCustomMode(targetSlot);

    if (!readMode) {
      throw new Error(`Failed to read custom mode from slot ${targetSlot}`);
    }

    log.success(`Custom mode read from slot ${targetSlot}!`);
    log.data('Read Mode Name', readMode.name);
    log.data('Read Control Count', Object.keys(readMode.controls).length);

    // Display read controls
    console.log(chalk.gray('\n  Read Controls:'));
    for (const [key, control] of Object.entries(readMode.controls)) {
      console.log(chalk.gray(`    ${key}: "${control.name || '(no name)'}" (CH${control.midiChannel}, CC${control.ccNumber})`));
    }

    console.log();

    // Step 8: Compare sent vs received data
    log.section(' STEP 4: COMPARE DATA ');
    log.step('Comparing sent vs received data...');

    const comparison = compareCustomModes(testMode, readMode);

    console.log();

    if (comparison.matches) {
      log.success('🎉 ROUND-TRIP TEST PASSED! 🎉');
      log.success('All data matches between sent and received modes!');
      log.success('Control names are preserved correctly!');
      testPassed = true;
    } else {
      log.error('❌ ROUND-TRIP TEST FAILED! ❌');
      log.error('Data mismatch detected between sent and received modes:');
      comparison.details.forEach(detail => {
        log.error(`  • ${detail}`);
      });
    }

  } catch (error: any) {
    log.error('Test failed with error:');
    log.error(error.message);

    if (error.message.includes('Cannot find MIDI devices')) {
      log.warning('');
      log.warning('TROUBLESHOOTING:');
      log.warning('• Ensure Launch Control XL 3 is connected via USB');
      log.warning('• Check that the device is powered on');
      log.warning('• Verify MIDI drivers are installed');
      log.warning('• Try disconnecting and reconnecting the device');
    } else if (error.message.includes('native bindings')) {
      log.warning('');
      log.warning('TROUBLESHOOTING:');
      log.warning('• Install Python 3.11 or earlier');
      log.warning('• Install build tools: npm install -g node-gyp');
      log.warning('• Try: npm rebuild');
      log.warning('• Use browser test if native bindings fail');
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
      // EasyMidiBackend doesn't have explicit cleanup, but connections should close
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