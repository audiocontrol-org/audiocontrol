#!/usr/bin/env tsx

/**
 * Test writing a custom mode configuration to Launch Control XL 3
 */

import { LaunchControlXL3 } from './src/LaunchControlXL3';
import { CustomMode, ControlConfig } from './src/types/protocol';

console.log('Testing custom mode writing to Launch Control XL 3...\n');

// Define control configurations using the proper type structure
const controls: ControlConfig[] = [
  // Top row knobs (Send A) - CC 13-20, Channel 1
  ...Array.from({ length: 8 }, (_, i) => ({
    id: { type: 'knob' as const, position: i + 1, row: 1 as const },
    midiChannel: 1 as const,
    ccNumber: (13 + i) as const,
    controlType: { type: 'knob' as const, behavior: 'absolute' as const },
    name: `Send A ${i + 1}`,
    color: { red: 0, green: 127, blue: 0 }
  })),

  // Middle row knobs (Send B) - CC 29-36, Channel 2
  ...Array.from({ length: 8 }, (_, i) => ({
    id: { type: 'knob' as const, position: i + 1, row: 2 as const },
    midiChannel: 2 as const,
    ccNumber: (29 + i) as const,
    controlType: { type: 'knob' as const, behavior: 'absolute' as const },
    name: `Send B ${i + 1}`,
    color: { red: 127, green: 127, blue: 0 }
  })),

  // Bottom row knobs (Pan) - CC 49-56, Channel 3
  ...Array.from({ length: 8 }, (_, i) => ({
    id: { type: 'knob' as const, position: i + 1, row: 3 as const },
    midiChannel: 3 as const,
    ccNumber: (49 + i) as const,
    controlType: { type: 'knob' as const, behavior: 'absolute' as const },
    name: `Pan ${i + 1}`,
    color: { red: 0, green: 0, blue: 127 }
  })),

  // Faders - CC 77-84, Channel 4
  ...Array.from({ length: 8 }, (_, i) => ({
    id: { type: 'fader' as const, position: i + 1 },
    midiChannel: 4 as const,
    ccNumber: (77 + i) as const,
    controlType: { type: 'fader' as const, behavior: 'absolute' as const },
    name: `Fader ${i + 1}`
  })),

  // Buttons - CC 104-111, Channel 5
  ...Array.from({ length: 8 }, (_, i) => ({
    id: { type: 'button' as const, position: i + 1 },
    midiChannel: 5 as const,
    ccNumber: (104 + i) as const,
    controlType: { type: 'button' as const, behavior: 'momentary' as const },
    name: `Button ${i + 1}`,
    color: { red: 127, green: 0, blue: 127 }
  }))
];

// Define a custom mode configuration
const customMode: CustomMode = {
  slot: 0,
  name: 'My Custom Mode',
  description: 'Custom mode with organized CC layout across channels',
  controls,
  globalChannel: 1,
  createdAt: new Date(),
  modifiedAt: new Date()
};

async function main() {
  const controller = new LaunchControlXL3({
    autoConnect: true,
    enableLedControl: true,
    enableCustomModes: true,
    deviceNameFilter: 'LCXL3 1'
  });

  try {
    console.log('Connecting to device...');
    await controller.initialize();

    const status = controller.getStatus();
    console.log('✓ Connected successfully!');
    console.log(`Device state: ${status.state}\n`);

    console.log('Custom Mode Configuration:');
    console.log('─'.repeat(50));
    console.log(`Slot: ${customMode.slot}`);
    console.log(`Name: ${customMode.name}`);
    console.log(`Description: ${customMode.description}`);
    console.log(`Total Controls: ${customMode.controls.length}`);

    // Group controls by type and display
    const knobs = customMode.controls.filter(c => c.id.type === 'knob');
    const faders = customMode.controls.filter(c => c.id.type === 'fader');
    const buttons = customMode.controls.filter(c => c.id.type === 'button');

    console.log(`Knobs (${knobs.length}): CC ${knobs.map(c => c.ccNumber).join(', ')}`);
    console.log(`Faders (${faders.length}): CC ${faders.map(c => c.ccNumber).join(', ')}`);
    console.log(`Buttons (${buttons.length}): CC ${buttons.map(c => c.ccNumber).join(', ')}`);
    console.log('');

    console.log('Writing custom mode to device...');
    try {
      // Use the DeviceManager method directly since the public API might not expose this
      const deviceManager = (controller as any).deviceManager;
      await deviceManager.writeCustomMode(customMode.slot, customMode);

      console.log('✓ Custom mode written successfully!');
      console.log('');
      console.log('Now try switching to User mode on your device and test the controls.');
      console.log('You should see the CC numbers above when you move knobs/faders.');

    } catch (error) {
      console.error('Failed to write custom mode:', (error as Error).message);
    }

    // Keep the connection open for a bit to allow manual testing
    console.log('\nConnection will stay open for 30 seconds for testing...');
    console.log('Move controls to verify the custom configuration is active.');

    controller.on('control:change', (controlId: string, value: number) => {
      console.log(`${controlId}: ${value}`);
    });

    await new Promise(resolve => setTimeout(resolve, 30000));

    // Cleanup
    await controller.cleanup();

  } catch (error) {
    console.error('Error:', (error as Error).message);
  }
}

main().catch(console.error);