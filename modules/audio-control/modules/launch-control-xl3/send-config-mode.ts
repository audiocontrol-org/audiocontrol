#!/usr/bin/env tsx

/**
 * Load custom mode from config file and send to Launch Control XL 3
 */

import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const midi = require('midi');

// Color mapping
const colorMap: Record<string, number> = {
  off: 0x0C,
  red: 0x0F,
  amber: 0x3F,
  yellow: 0x3E,
  green: 0x3C,
  blue: 0x3D,  // Closest approximation
};

interface ControlMapping {
  position: number;
  channel: number;
  cc: number;
  name: string;
  color: string;
  behavior?: string;
}

interface CustomModeConfig {
  name: string;
  slot: number;
  description: string;
  controls: {
    faders?: ControlMapping[];
    knobs_top?: ControlMapping[];
    knobs_middle?: ControlMapping[];
    knobs_bottom?: ControlMapping[];
    buttons?: ControlMapping[];
  };
  global?: {
    base_channel: number;
    velocity_curve: string;
    led_brightness: string;
  };
  metadata?: any;
}

console.log('Loading custom mode configuration...\n');

// Load config file
const configPath = process.argv[2] || './custom-mode-config.yaml';

if (!fs.existsSync(configPath)) {
  console.error(`Config file not found: ${configPath}`);
  console.error('Usage: tsx send-config-mode.ts [config.yaml]');
  process.exit(1);
}

const configContent = fs.readFileSync(configPath, 'utf8');
const config = yaml.load(configContent) as CustomModeConfig;

console.log('Custom Mode Configuration:');
console.log('─'.repeat(50));
console.log(`Name: ${config.name}`);
console.log(`Slot: ${config.slot}`);
console.log(`Description: ${config.description}`);
console.log('');

// Count controls
const controlCounts = {
  faders: config.controls.faders?.length || 0,
  knobs_top: config.controls.knobs_top?.length || 0,
  knobs_middle: config.controls.knobs_middle?.length || 0,
  knobs_bottom: config.controls.knobs_bottom?.length || 0,
  buttons: config.controls.buttons?.length || 0,
};

const totalControls = Object.values(controlCounts).reduce((a, b) => a + b, 0);

console.log('Control Summary:');
Object.entries(controlCounts).forEach(([type, count]) => {
  if (count > 0) {
    console.log(`  ${type}: ${count} controls`);
  }
});
console.log(`  Total: ${totalControls} controls`);
console.log('');

// Convert config to SysEx data
function buildCustomModeData(config: CustomModeConfig): number[] {
  const data: number[] = [];

  // Mode name (8 bytes, padded with zeros)
  const nameBytes = Buffer.from(config.name.slice(0, 8), 'ascii');
  data.push(...nameBytes);
  // Pad to 8 bytes
  while (data.length < 8) {
    data.push(0x00);
  }

  // Add control mappings
  const addControls = (controls: ControlMapping[], controlType: number) => {
    controls?.forEach(control => {
      data.push(
        controlType,                              // Control type (1=fader, 2=knob, 3=button)
        control.position,                         // Position (1-8)
        control.channel,                          // MIDI channel
        control.cc,                              // CC number
        colorMap[control.color.toLowerCase()] || colorMap.green  // LED color
      );
    });
  };

  // Add all controls
  addControls(config.controls.faders || [], 0x01);          // Faders
  addControls(config.controls.knobs_top || [], 0x02);       // Knobs (top row)
  addControls(config.controls.knobs_middle || [], 0x02);    // Knobs (middle row)
  addControls(config.controls.knobs_bottom || [], 0x02);    // Knobs (bottom row)
  addControls(config.controls.buttons || [], 0x03);        // Buttons

  return data;
}

// Send to device
const output = new midi.Output();
const outputCount = output.getPortCount();
let outputIndex = -1;

console.log('Finding MIDI output port...');
for (let i = 0; i < outputCount; i++) {
  const name = output.getPortName(i);
  if (name === 'LCXL3 1 MIDI In') {
    outputIndex = i;
    console.log(`Found LCXL3 1 MIDI In at port ${i}`);
    break;
  }
}

if (outputIndex >= 0) {
  output.openPort(outputIndex);

  // Build SysEx message
  const MANUFACTURER_ID = [0x00, 0x20, 0x29];
  const DEVICE_ID = 0x11;
  const CUSTOM_MODE_WRITE = 0x63;

  const customModeData = buildCustomModeData(config);
  const sysexMessage = [
    0xF0,                    // SysEx start
    ...MANUFACTURER_ID,      // 00 20 29
    DEVICE_ID,              // 11
    CUSTOM_MODE_WRITE,      // 63
    config.slot,            // Slot number
    ...customModeData,      // Mode data
    0xF7                    // SysEx end
  ];

  console.log(`\nSending ${sysexMessage.length} byte SysEx message to device...`);
  console.log('Message preview:', sysexMessage.slice(0, 20).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ') + '...');

  try {
    output.sendMessage(sysexMessage);
    console.log('✓ Custom mode sent successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Switch your Launch Control XL 3 to User mode');
    console.log(`2. Select slot ${config.slot} if it\'s not already active`);
    console.log('3. Test the controls to verify the mappings work');
    console.log('');
    console.log('Expected control mappings:');

    // Show expected mappings
    Object.entries(config.controls).forEach(([type, controls]) => {
      if (controls && controls.length > 0) {
        console.log(`  ${type}:`);
        controls.forEach(control => {
          console.log(`    ${control.name}: CC${control.cc} on Channel ${control.channel} (${control.color})`);
        });
      }
    });

  } catch (error) {
    console.error('Failed to send SysEx:', error);
  }

  // Clean up
  setTimeout(() => {
    output.closePort();
  }, 500);

} else {
  console.error('LCXL3 1 MIDI In port not found');
  console.error('Make sure the device is connected.');
}