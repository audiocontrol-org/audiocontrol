#!/usr/bin/env npx tsx

/**
 * Test bidirectional DAW port communication using JZZ
 * This should handle multiple MIDI ports without crashing
 */

import JZZ from 'jzz';

// Helper to format bytes as hex
function toHex(data: number[]): string {
  return data.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

async function testBidirectionalDAW() {
  console.log('JZZ Bidirectional DAW Port Test');
  console.log('================================\n');

  try {
    // Initialize JZZ
    await JZZ();
    console.log('✓ JZZ initialized\n');

    // List available ports
    const inputs = await JZZ().info().inputs;
    const outputs = await JZZ().info().outputs;

    console.log('Available MIDI Inputs:');
    inputs.forEach((port: any) => console.log(`  - ${port.name}`));

    console.log('\nAvailable MIDI Outputs:');
    outputs.forEach((port: any) => console.log(`  - ${port.name}`));
    console.log();

    // Open ports
    console.log('Opening MIDI ports...');
    const midiOut = await JZZ().openMidiOut('LCXL3 1 MIDI In');
    const midiIn = await JZZ().openMidiIn('LCXL3 1 MIDI Out');
    console.log('✓ MIDI ports opened');

    const dawOut = await JZZ().openMidiOut('LCXL3 1 DAW In');
    const dawIn = await JZZ().openMidiIn('LCXL3 1 DAW Out');
    console.log('✓ DAW ports opened\n');

    // Set up listeners
    let dawResponses: number[][] = [];
    let midiResponses: number[][] = [];

    dawIn.connect((msg: any) => {
      const data = Array.from(msg);
      console.log(`[DAW IN] ${toHex(data)}`);
      dawResponses.push(data);
    });

    midiIn.connect((msg: any) => {
      const data = Array.from(msg);
      if (data[0] === 0xF0) { // SysEx
        console.log(`[MIDI IN] SysEx: ${toHex(data.slice(0, 10))}...${toHex(data.slice(-3))}`);
      } else {
        console.log(`[MIDI IN] ${toHex(data)}`);
      }
      midiResponses.push(data);
    });

    // Test the two-phase slot selection protocol
    console.log('=== Testing Slot 0 Selection Protocol ===\n');

    // Phase 1: Query current slot
    console.log('Phase 1: Query current slot');
    console.log('  → Note On ch16');
    await dawOut.send([0x9F, 11, 127]);
    await new Promise(r => setTimeout(r, 10));

    console.log('  → CC ch8, controller 30, value 0 (query)');
    await dawOut.send([0xB7, 30, 0]);

    // Wait for response
    await new Promise(r => setTimeout(r, 100));

    console.log('  → Note Off ch16');
    await dawOut.send([0x9F, 11, 0]);

    await new Promise(r => setTimeout(r, 100));

    // Check if we got a response
    if (dawResponses.length > 0) {
      const lastResponse = dawResponses[dawResponses.length - 1];
      if (lastResponse[0] === 0xB6 && lastResponse[1] === 30) {
        const currentSlot = lastResponse[2] - 5;
        console.log(`  ← Device reports current slot: ${currentSlot} (CC value ${lastResponse[2]})`);
      }
    }

    // Phase 2: Set slot 0
    console.log('\nPhase 2: Set slot 0');
    console.log('  → Note On ch16');
    await dawOut.send([0x9F, 11, 127]);
    await new Promise(r => setTimeout(r, 10));

    console.log('  → CC ch7, controller 30, value 6 (slot 0)');
    await dawOut.send([0xB6, 30, 6]);
    await new Promise(r => setTimeout(r, 10));

    console.log('  → Note Off ch16');
    await dawOut.send([0x9F, 11, 0]);

    await new Promise(r => setTimeout(r, 100));

    // Now test SysEx write with proper encoding
    console.log('\n=== Testing SysEx Write to Slot 0 ===\n');

    const testName = 'JZZ_TEST';
    const nameBytes = Array.from(testName).map(c => c.charCodeAt(0));

    // Build a minimal test SysEx
    const writeSysEx = [
      0xF0,                  // SysEx start
      0x00, 0x20, 0x29,      // Manufacturer ID (Novation)
      0x02,                  // Device ID
      0x15,                  // Command (Custom mode)
      0x05,                  // Sub-command
      0x00,                  // Reserved
      0x45,                  // Write operation
      0x00,                  // Slot byte (always 0x00)
      0x00,                  // Flag byte (0x00 for slot 0)
      // Minimal custom mode data
      0x01, 0x20, 0x10, 0x2A,  // Header
      ...nameBytes,          // Name
      ...Array(16 - nameBytes.length).fill(0x00), // Pad name to 16 bytes
      // Add some test control data
      0x49, 0x10, 0x02, 0x05, 0x00, 0x01, 0x40, 0x00, 0x0D, 0x7F, 0x00,
      0xF7                   // SysEx end
    ];

    console.log(`Sending write SysEx (${writeSysEx.length} bytes)`);
    console.log(`  Header: ${toHex(writeSysEx.slice(0, 11))}`);
    console.log(`  Name: "${testName}"`);

    await midiOut.send(writeSysEx);

    // Wait for response
    await new Promise(r => setTimeout(r, 500));

    // Try reading back
    console.log('\n=== Reading Back from Slot 0 ===\n');

    const readSysEx = [
      0xF0,
      0x00, 0x20, 0x29,
      0x02,
      0x15,
      0x05,
      0x00,
      0x40,                  // Read operation
      0x00,                  // Slot byte (always 0x00)
      0x00,                  // Flag byte (0x00 for slot 0)
      0xF7
    ];

    console.log(`Sending read SysEx: ${toHex(readSysEx)}`);
    await midiOut.send(readSysEx);

    // Wait for response
    await new Promise(r => setTimeout(r, 1000));

    // Check results
    console.log('\n=== Test Results ===\n');
    console.log(`DAW port responses received: ${dawResponses.length}`);
    console.log(`MIDI port responses received: ${midiResponses.length}`);

    // Look for the read response
    const readResponse = midiResponses.find(r =>
      r[0] === 0xF0 && r[8] === 0x10 // Read response
    );

    if (readResponse) {
      console.log('\n✓ Received read response!');
      // Try to extract the name
      if (readResponse.length > 20) {
        const nameStart = 14;
        const nameEnd = nameStart + 16;
        const nameBytes = readResponse.slice(nameStart, nameEnd);
        const name = String.fromCharCode(...nameBytes).replace(/\0/g, '').trim();
        console.log(`  Name from device: "${name}"`);

        if (name === testName) {
          console.log('  ✅ SUCCESS: Name matches! Slot selection is working!');
        } else {
          console.log('  ⚠️ Name mismatch - slot selection may not be working');
        }
      }
    } else {
      console.log('\n⚠️ No read response received');
    }

    // Clean up
    console.log('\nClosing ports...');
    await midiIn.close();
    await midiOut.close();
    await dawIn.close();
    await dawOut.close();
    console.log('✓ Ports closed');

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
console.log('Starting test...\n');
testBidirectionalDAW().catch(console.error);