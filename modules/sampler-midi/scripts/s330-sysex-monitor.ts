#!/usr/bin/env npx tsx
/**
 * S-330 SysEx Monitor
 *
 * Monitors incoming SysEx messages from the S-330 via Volt 4.
 * Used to discover undocumented messages sent when front-panel buttons are pressed.
 *
 * Usage:
 *   npx tsx scripts/s330-sysex-monitor.ts
 *   npx tsx scripts/s330-sysex-monitor.ts "Custom Port Name"
 */

import * as easymidi from 'easymidi';

// Roland S-330 constants
const ROLAND_ID = 0x41;
const S330_MODEL_ID = 0x1E;

// Command names for Roland SysEx
const COMMAND_NAMES: Record<number, string> = {
  0x11: 'RQ1 (Data Request)',
  0x12: 'DT1 (Data Set)',
  0x40: 'WSD (Want to Send)',
  0x41: 'RQD (Request Data)',
  0x42: 'DAT (Data)',
  0x43: 'ACK (Acknowledge)',
  0x45: 'EOD (End of Data)',
  0x4E: 'ERR (Error)',
  0x4F: 'RJC (Reject)',
};

/**
 * Format bytes as hex string
 */
function formatHex(bytes: number[]): string {
  return bytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

/**
 * Parse Roland SysEx message structure
 */
function parseRolandSysEx(bytes: number[]): string {
  if (bytes.length < 6) return 'Too short';
  if (bytes[0] !== 0xF0) return 'Not SysEx';
  if (bytes[1] !== ROLAND_ID) return `Non-Roland (Manufacturer: ${formatHex([bytes[1]])})`;

  const deviceId = bytes[2];
  const modelId = bytes[3];
  const command = bytes[4];

  const commandName = COMMAND_NAMES[command] || `Unknown (${formatHex([command])})`;

  let details = `Device ID: ${deviceId} (displays as ${deviceId + 1}), Model: ${formatHex([modelId])}`;

  if (modelId === S330_MODEL_ID) {
    details += ' (S-330/S-550)';
  }

  details += `, Command: ${commandName}`;

  // Parse address if present (for commands that have addresses)
  if (bytes.length >= 9 && [0x11, 0x12, 0x40, 0x41, 0x42].includes(command)) {
    const address = bytes.slice(5, 9);
    details += `, Address: ${formatHex(address)}`;

    // Try to identify the address space
    if (address[0] === 0x00 && address[1] === 0x00) {
      const patchIndex = Math.floor(address[2] / 4);
      details += ` (Patch ${patchIndex} area)`;
    } else if (address[0] === 0x00 && address[1] === 0x01) {
      details += ' (Function params)';
    } else if (address[0] === 0x00 && address[1] === 0x02) {
      details += ' (Tone/MIDI params)';
    } else if (address[0] === 0x01) {
      details += ' (Wave data)';
    }
  }

  // For DAT packets, show data preview
  if (command === 0x42 && bytes.length > 9) {
    const dataStart = 9;
    const dataEnd = bytes.length - 2; // Exclude checksum and F7
    const dataLength = dataEnd - dataStart;
    const preview = bytes.slice(dataStart, Math.min(dataStart + 16, dataEnd));
    details += `, Data: ${dataLength} bytes, Preview: ${formatHex(preview)}${dataLength > 16 ? '...' : ''}`;
  }

  return details;
}

/**
 * Main monitor function
 */
function main() {
  const portPattern = process.argv[2] || 'Volt 4';

  console.log('='.repeat(70));
  console.log('S-330 SysEx Monitor');
  console.log('='.repeat(70));
  console.log();

  // List available ports
  const inputs = easymidi.getInputs();
  console.log('Available MIDI inputs:');
  inputs.forEach((name, i) => console.log(`  ${i}: ${name}`));
  console.log();

  // Find matching port
  const portName = inputs.find(p => p.includes(portPattern));
  if (!portName) {
    console.error(`ERROR: No port matching "${portPattern}" found.`);
    console.error('Available ports:', inputs.join(', '));
    process.exit(1);
  }

  console.log(`Connecting to: ${portName}`);
  console.log();

  const input = new easymidi.Input(portName);

  let messageCount = 0;

  // Listen for SysEx messages
  input.on('sysex', (msg: { bytes: number[] }) => {
    messageCount++;
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);

    console.log('-'.repeat(70));
    console.log(`[${timestamp}] Message #${messageCount}`);
    console.log(`Raw (${msg.bytes.length} bytes): ${formatHex(msg.bytes)}`);
    console.log(`Parsed: ${parseRolandSysEx(msg.bytes)}`);
    console.log();
  });

  // Also listen for other MIDI messages to see if buttons send non-SysEx
  input.on('noteon', (msg) => {
    console.log(`[NOTE ON] Channel: ${msg.channel}, Note: ${msg.note}, Velocity: ${msg.velocity}`);
  });

  input.on('noteoff', (msg) => {
    console.log(`[NOTE OFF] Channel: ${msg.channel}, Note: ${msg.note}, Velocity: ${msg.velocity}`);
  });

  input.on('cc', (msg) => {
    console.log(`[CC] Channel: ${msg.channel}, Controller: ${msg.controller}, Value: ${msg.value}`);
  });

  input.on('program', (msg) => {
    console.log(`[PROGRAM CHANGE] Channel: ${msg.channel}, Program: ${msg.number}`);
  });

  console.log('Monitoring for MIDI messages...');
  console.log('Press front-panel buttons on the S-330 to see what it sends.');
  console.log('Press Ctrl+C to exit.');
  console.log();
  console.log('Waiting for messages...');
  console.log();

  // Handle clean exit
  process.on('SIGINT', () => {
    console.log();
    console.log('='.repeat(70));
    console.log(`Total messages received: ${messageCount}`);
    console.log('Closing MIDI port...');
    input.close();
    process.exit(0);
  });
}

main();
