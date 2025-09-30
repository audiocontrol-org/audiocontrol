#!/usr/bin/env npx tsx

/**
 * Simple test to send SysEx and monitor response with ReceiveMIDI
 * Run ReceiveMIDI in another terminal: receivemidi dev "LCXL3 1 MIDI Out"
 */

import JZZ from 'jzz';

// Helper to format bytes as hex
function toHex(data: number[]): string {
  return data.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

async function testSysEx() {
  console.log('SysEx Test - Monitor with ReceiveMIDI');
  console.log('======================================\n');
  console.log('Make sure to run in another terminal:');
  console.log('  receivemidi dev "LCXL3 1 MIDI Out"\n');

  try {
    // Initialize JZZ with SysEx support
    await JZZ({ sysex: true });
    console.log('✓ JZZ initialized with SysEx support\n');

    // Open just the MIDI output port
    const midiOut = await JZZ({ sysex: true }).openMidiOut('LCXL3 1 MIDI In').or('Cannot open MIDI Out');
    console.log('✓ MIDI output port opened\n');

    // Send a simple Novation SYN message
    console.log('Sending Novation SYN...');
    const synMessage = [0xF0, 0x00, 0x20, 0x29, 0x00, 0x42, 0x02, 0xF7];
    console.log(`  TX: ${toHex(synMessage)}`);
    await midiOut.send(synMessage);

    // Wait for response
    console.log('  Check ReceiveMIDI output for response...\n');
    await new Promise(r => setTimeout(r, 1000));

    // Send Universal Device Inquiry
    console.log('Sending Universal Device Inquiry...');
    const inquiryMessage = [0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7];
    console.log(`  TX: ${toHex(inquiryMessage)}`);
    await midiOut.send(inquiryMessage);

    console.log('  Check ReceiveMIDI output for response...\n');
    await new Promise(r => setTimeout(r, 1000));

    // Send a read request for slot 0
    console.log('Sending Read request for slot 0...');
    const readMessage = [
      0xF0,
      0x00, 0x20, 0x29,
      0x02,
      0x15,
      0x05,
      0x00,
      0x40,  // Read operation
      0x00,  // Slot byte
      0x00,  // Flag byte (slot 0)
      0xF7
    ];
    console.log(`  TX: ${toHex(readMessage)}`);
    await midiOut.send(readMessage);

    console.log('  Check ReceiveMIDI output for response...\n');
    await new Promise(r => setTimeout(r, 2000));

    // Close port
    console.log('Closing port...');
    await midiOut.close();
    console.log('✓ Port closed');

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
console.log('Starting test...\n');
testSysEx().catch(console.error);