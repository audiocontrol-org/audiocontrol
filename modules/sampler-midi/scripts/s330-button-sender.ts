#!/usr/bin/env npx tsx
/**
 * S-330 Button Sender
 *
 * Sends front-panel button SysEx messages to the S-330 to test remote control.
 *
 * Usage:
 *   npx tsx scripts/s330-button-sender.ts <button>
 *
 * Buttons:
 *   Navigation: right, left, up, down, inc, dec
 *   Function: mode, menu, submenu, com, execute
 */

import * as easymidi from 'easymidi';

// Roland S-330 constants
const ROLAND_ID = 0x41;
const S330_MODEL_ID = 0x1E;
const DT1_COMMAND = 0x12;
const UI_ADDRESS = [0x00, 0x04, 0x00, 0x00];

// Button codes
const BUTTONS: Record<string, { category: number; press: number; release?: number }> = {
  // Category 09 - Navigation (press + release)
  right:   { category: 0x09, press: 0x00, release: 0x08 },
  left:    { category: 0x09, press: 0x01, release: 0x09 },
  up:      { category: 0x09, press: 0x02, release: 0x0A },
  down:    { category: 0x09, press: 0x03, release: 0x0B },
  inc:     { category: 0x09, press: 0x04, release: 0x0C },
  dec:     { category: 0x09, press: 0x05, release: 0x0D },

  // Category 01 - Function buttons (single message)
  mode:    { category: 0x01, press: 0x0B },
  menu:    { category: 0x01, press: 0x0C },
  submenu: { category: 0x01, press: 0x0D },
  com:     { category: 0x01, press: 0x0E },
  execute: { category: 0x01, press: 0x0F },
  exe:     { category: 0x01, press: 0x0F },

  // Category 01 - Menu navigation events (mirror category 09 codes)
  'menu-right': { category: 0x01, press: 0x00 },
  'menu-left':  { category: 0x01, press: 0x01 },
  'menu-up':    { category: 0x01, press: 0x02 },
  'menu-down':  { category: 0x01, press: 0x03 },
  'menu-inc':   { category: 0x01, press: 0x04 },
  'menu-dec':   { category: 0x01, press: 0x05 },
};

/**
 * Calculate Roland checksum
 */
function calculateChecksum(data: number[]): number {
  const sum = data.reduce((acc, val) => acc + val, 0);
  return (128 - (sum & 0x7F)) & 0x7F;
}

/**
 * Build a DT1 SysEx message for a button press
 */
function buildButtonMessage(deviceId: number, category: number, code: number): number[] {
  const address = UI_ADDRESS;
  const data = [category, code];
  const checksumData = [...address, ...data];
  const checksum = calculateChecksum(checksumData);

  return [
    0xF0,           // SysEx start
    ROLAND_ID,      // Roland
    deviceId,       // Device ID
    S330_MODEL_ID,  // S-330
    DT1_COMMAND,    // DT1
    ...address,     // Address
    ...data,        // Data (category + code)
    checksum,       // Checksum
    0xF7            // SysEx end
  ];
}

/**
 * Format bytes as hex string
 */
function formatHex(bytes: number[]): string {
  return bytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

/**
 * Main function
 */
async function main() {
  const buttonName = process.argv[2]?.toLowerCase();
  const deviceId = parseInt(process.argv[3] || '0', 10);
  const portPattern = process.argv[4] || 'Volt 4';

  if (!buttonName || buttonName === '--help' || buttonName === '-h') {
    console.log('S-330 Button Sender');
    console.log('');
    console.log('Usage: npx tsx scripts/s330-button-sender.ts <button> [device-id] [port]');
    console.log('');
    console.log('Navigation buttons (press + release):');
    console.log('  right, left, up, down, inc, dec');
    console.log('');
    console.log('Function buttons (single message):');
    console.log('  mode, menu, submenu, com, execute');
    console.log('');
    console.log('Menu navigation events (for use within menus):');
    console.log('  menu-right, menu-left, menu-up, menu-down, menu-inc, menu-dec');
    console.log('');
    console.log('Options:');
    console.log('  device-id  Device ID (default: 0, displays as 1 on S-330)');
    console.log('  port       MIDI port pattern (default: "Volt 4")');
    process.exit(0);
  }

  const button = BUTTONS[buttonName];
  if (!button) {
    console.error(`Unknown button: ${buttonName}`);
    console.error('Available buttons:', Object.keys(BUTTONS).join(', '));
    process.exit(1);
  }

  // Find MIDI output
  const outputs = easymidi.getOutputs();
  console.log('Available MIDI outputs:', outputs);

  const portName = outputs.find(p => p.includes(portPattern));
  if (!portName) {
    console.error(`No port matching "${portPattern}" found.`);
    process.exit(1);
  }

  console.log(`Using port: ${portName}`);
  console.log(`Device ID: ${deviceId} (displays as ${deviceId + 1})`);
  console.log(`Button: ${buttonName}`);
  console.log('');

  const output = new easymidi.Output(portName);

  // Send press message
  const pressMsg = buildButtonMessage(deviceId, button.category, button.press);
  console.log(`Sending PRESS: ${formatHex(pressMsg)}`);
  output.send('sysex', pressMsg as any);

  // If button has release, wait and send release
  if (button.release !== undefined) {
    await new Promise(resolve => setTimeout(resolve, 150));
    const releaseMsg = buildButtonMessage(deviceId, button.category, button.release);
    console.log(`Sending RELEASE: ${formatHex(releaseMsg)}`);
    output.send('sysex', releaseMsg as any);
  }

  console.log('');
  console.log('Done. Check if the S-330 responded to the button press.');

  // Give time for message to send
  await new Promise(resolve => setTimeout(resolve, 100));
  output.close();
}

main().catch(console.error);
