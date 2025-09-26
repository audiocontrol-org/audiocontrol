#!/usr/bin/env tsx

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const midi = require('midi');

console.log('Testing LED control on LCXL3...\n');

// Create output
const output = new midi.Output();

// Find the LCXL3 DAW port (for SysEx)
const outputCount = output.getPortCount();
let dawIndex = -1;

for (let i = 0; i < outputCount; i++) {
  const name = output.getPortName(i);
  if (name === 'LCXL3 1 DAW In') {
    dawIndex = i;
    console.log(`Found LCXL3 DAW port at index ${i}`);
    break;
  }
}

if (dawIndex >= 0) {
  console.log(`Opening port ${dawIndex}...`);
  output.openPort(dawIndex);

  // Novation Launch Control XL 3 LED control SysEx
  // F0 00 20 29 11 0C <control_id> <color> F7
  const MANUFACTURER_ID = [0x00, 0x20, 0x29];
  const DEVICE_ID = 0x11;
  const LED_CONTROL = 0x0C;

  // Control IDs for Focus buttons
  const FOCUS_BUTTONS = [0x29, 0x2A, 0x2B, 0x2C, 0x39, 0x3A, 0x3B, 0x3C];

  // LED colors
  const GREEN_FULL = 0x3C;
  const RED_FULL = 0x0F;
  const AMBER_FULL = 0x3F;
  const OFF = 0x00;

  async function setLed(controlId: number, color: number) {
    const message = [
      0xF0,
      ...MANUFACTURER_ID,
      DEVICE_ID,
      LED_CONTROL,
      controlId,
      color,
      0xF7
    ];
    output.sendMessage(message);
  }

  async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function runLedTest() {
    console.log('Turning off all LEDs...');
    for (const id of FOCUS_BUTTONS) {
      await setLed(id, OFF);
    }
    await sleep(500);

    console.log('Setting FOCUS1-4 to GREEN...');
    for (let i = 0; i < 4; i++) {
      await setLed(FOCUS_BUTTONS[i], GREEN_FULL);
      await sleep(100);
    }

    console.log('Setting FOCUS5-8 to RED...');
    for (let i = 4; i < 8; i++) {
      await setLed(FOCUS_BUTTONS[i], RED_FULL);
      await sleep(100);
    }

    await sleep(1000);

    console.log('Cycling through AMBER...');
    for (const id of FOCUS_BUTTONS) {
      await setLed(id, AMBER_FULL);
      await sleep(100);
    }

    await sleep(1000);

    console.log('Turning off all LEDs...');
    for (const id of FOCUS_BUTTONS) {
      await setLed(id, OFF);
    }
  }

  await runLedTest();

  // Close port
  output.closePort();
  console.log('\nDone!');
} else {
  console.log('LCXL3 DAW port not found');
}