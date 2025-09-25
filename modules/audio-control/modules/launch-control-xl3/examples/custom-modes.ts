/**
 * Custom Modes Example
 *
 * Demonstrates how to create, save, and load custom modes
 */

import { LaunchControlXL3, LED_COLOR_VALUES } from '../src';
import { CustomMode } from '../src/types';

async function main() {
  console.log('Launch Control XL 3 - Custom Modes Example');
  console.log('='.repeat(50));

  const controller = new LaunchControlXL3({
    autoConnect: true,
    enableLedControl: true,
    enableCustomModes: true,
  });

  try {
    await controller.initialize();
    console.log('✓ Connected to device\n');

    // Example 1: Create a custom mode
    console.log('1. Creating custom mode...');
    const customMode = controller.createCustomMode('My Custom Mode');

    // Configure knob mappings
    customMode.controls['SEND_A1'] = {
      type: 'knob',
      channel: 0,
      cc: 20,
      min: 0,
      max: 127,
      behaviour: 'absolute',
    };

    customMode.controls['SEND_B1'] = {
      type: 'knob',
      channel: 0,
      cc: 21,
      min: 0,
      max: 127,
      behaviour: 'relative1', // Two's complement
    };

    // Configure fader mappings
    for (let i = 1; i <= 8; i++) {
      customMode.controls[`FADER${i}`] = {
        type: 'fader',
        channel: 0,
        cc: 80 + i,
        min: 0,
        max: 127,
        behaviour: 'absolute',
        transform: {
          type: 'exponential',
          curve: 2, // Exponential curve for volume control
        },
      };
    }

    // Configure LED colors
    customMode.leds = {
      FOCUS1: { color: LED_COLOR_VALUES.GREEN_FULL as any, behaviour: 'static' },
      FOCUS2: { color: LED_COLOR_VALUES.AMBER_FULL as any, behaviour: 'pulse' },
      FOCUS3: { color: LED_COLOR_VALUES.RED_FULL as any, behaviour: 'flash' },
    };

    console.log('  Mode name:', customMode.name);
    console.log('  Controls configured:', Object.keys(customMode.controls).length);
    console.log('  LEDs configured:', Object.keys(customMode.leds || {}).length);

    // Example 2: Save mode to device
    console.log('\n2. Saving mode to slot 0...');
    await controller.saveCustomMode(0, customMode);
    console.log('✓ Mode saved');

    // Example 3: Load mode from device
    console.log('\n3. Loading mode from slot 0...');
    const loadedMode = await controller.loadCustomMode(0);
    console.log('✓ Mode loaded:', loadedMode.name);

    // Example 4: Export current configuration
    console.log('\n4. Exporting current configuration...');
    const exportedMode = controller.exportCurrentAsCustomMode('Exported Mode');
    console.log('  Exported mode:', exportedMode.name);
    console.log('  JSON:', JSON.stringify(exportedMode, null, 2).substring(0, 200) + '...');

    // Example 5: Monitor control changes with custom mapping
    console.log('\n5. Testing custom mappings (move controls to test)...');
    console.log('Press Ctrl+C to exit\n');

    controller.on('control:change', (controlId, value) => {
      const mapping = controller.getControlMapping(controlId);
      if (mapping) {
        console.log(`${controlId}: value=${value}, cc=${mapping.cc}, behaviour=${mapping.behaviour}`);
      }
    });

    // Keep alive for 10 seconds
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log('\n✓ Custom modes demo complete');
    await controller.cleanup();

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the example
main().catch(console.error);