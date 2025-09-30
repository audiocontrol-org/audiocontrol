#!/usr/bin/env npx tsx

/**
 * Test bidirectional DAW port communication using JZZ
 * This version includes the proper handshake sequence
 */

import JZZ from 'jzz';

// Helper to format bytes as hex
function toHex(data: number[]): string {
  return data.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

async function testWithHandshake() {
  console.log('JZZ Test with Handshake and DAW Port');
  console.log('=====================================\n');

  try {
    // Initialize JZZ with SysEx support - use single instance!
    const midi = await JZZ({ sysex: true });
    console.log('✓ JZZ initialized with SysEx support\n');

    // Open ports with SysEx enabled using the same midi instance
    console.log('Opening MIDI ports with SysEx enabled...');

    // Use the same midi instance for all ports
    const midiOut = await midi.openMidiOut('LCXL3 1 MIDI In').or('Cannot open MIDI Out');
    const midiIn = await midi.openMidiIn('LCXL3 1 MIDI Out').or('Cannot open MIDI In');

    const dawOut = await midi.openMidiOut('LCXL3 1 DAW In').or('Cannot open DAW Out');
    const dawIn = await midi.openMidiIn('LCXL3 1 DAW Out').or('Cannot open DAW In');
    console.log('✓ All ports opened with SysEx support\n');

    // Set up listeners
    let midiResponses: number[][] = [];
    let dawResponses: number[][] = [];

    midiIn.connect((msg: any) => {
      const data = Array.from(msg);
      if (data[0] === 0xF0) {
        console.log(`[MIDI IN] SysEx (${data.length} bytes): ${toHex(data.slice(0, 12))}...`);
      } else {
        console.log(`[MIDI IN] ${toHex(data)}`);
      }
      midiResponses.push(data);
    });

    dawIn.connect((msg: any) => {
      const data = Array.from(msg);
      console.log(`[DAW IN] ${toHex(data)}`);
      dawResponses.push(data);
    });

    // Perform handshake
    console.log('=== Performing Handshake ===\n');

    // Step 1: Send Novation SYN
    console.log('Step 1: Sending Novation SYN...');
    midiResponses = [];
    await midiOut.send([0xF0, 0x00, 0x20, 0x29, 0x00, 0x42, 0x02, 0xF7]);

    // Wait for SYN-ACK
    await new Promise(r => setTimeout(r, 200));

    const synAck = midiResponses.find(r => r[0] === 0xF0 && r[5] === 0x42);
    if (synAck) {
      console.log('✓ Received SYN-ACK with serial number');
      const serial = synAck.slice(7, -1).map(c => String.fromCharCode(c)).join('');
      console.log(`  Serial: ${serial}\n`);
    } else {
      console.log(`⚠️ No SYN-ACK received (got ${midiResponses.length} responses)\n`);
    }

    // Step 2: Send Universal Device Inquiry
    console.log('Step 2: Sending Universal Device Inquiry...');
    await midiOut.send([0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7]);

    await new Promise(r => setTimeout(r, 100));

    const deviceInfo = midiResponses.find(r => r[0] === 0xF0 && r[1] === 0x7E);
    if (deviceInfo) {
      console.log('✓ Received device info\n');
    }

    // Step 3: Complete handshake
    console.log('Step 3: Completing handshake...');
    await midiOut.send([0xF0, 0x00, 0x20, 0x29, 0x11, 0x77, 0x00, 0xF7]);
    await new Promise(r => setTimeout(r, 100));
    console.log('✓ Handshake complete\n');

    // Clear response arrays
    midiResponses = [];
    dawResponses = [];

    // Now test slot selection with proper protocol
    console.log('=== Testing Slot Selection Protocol ===\n');

    // Test multiple slots to see the pattern
    for (let slot = 0; slot <= 2; slot++) {
      console.log(`\n--- Testing Slot ${slot} ---`);

      const ccValue = (slot + 1) + 5; // Slot 0 = 6, Slot 1 = 7, etc.

      // Phase 1: Query
      console.log('Phase 1: Query');
      dawResponses = [];

      await dawOut.send([0x9F, 11, 127]); // Note On ch16
      await new Promise(r => setTimeout(r, 10));
      await dawOut.send([0xB7, 30, 0]);   // CC ch8 query
      await new Promise(r => setTimeout(r, 50));

      // Check for response
      const queryResponse = dawResponses.find(r => r[0] === 0xB6 && r[1] === 30);
      if (queryResponse) {
        const currentSlot = queryResponse[2] - 6;
        console.log(`  Device reports: slot ${currentSlot} (CC value ${queryResponse[2]})`);
      }

      await dawOut.send([0x9F, 11, 0]);   // Note Off ch16
      await new Promise(r => setTimeout(r, 50));

      // Phase 2: Set
      console.log(`Phase 2: Set slot ${slot}`);
      dawResponses = [];

      await dawOut.send([0x9F, 11, 127]); // Note On ch16
      await new Promise(r => setTimeout(r, 10));
      await dawOut.send([0xB6, 30, ccValue]); // CC ch7 set
      await new Promise(r => setTimeout(r, 10));
      await dawOut.send([0x9F, 11, 0]);   // Note Off ch16
      await new Promise(r => setTimeout(r, 100));

      // Write test data
      const testName = `SLOT${slot}_JZZ`;
      const nameBytes = Array.from(testName).map(c => c.charCodeAt(0));

      const writeSysEx = [
        0xF0,                  // SysEx start
        0x00, 0x20, 0x29,      // Manufacturer ID (Novation)
        0x02,                  // Device ID
        0x15,                  // Command (Custom mode)
        0x05,                  // Sub-command
        0x00,                  // Reserved
        0x45,                  // Write operation
        0x00,                  // Slot byte (always 0x00)
        slot,                  // Flag byte (actual slot indicator)
        // Minimal custom mode data
        0x01, 0x20, 0x10, 0x2A,  // Header
        ...nameBytes,          // Name
        ...Array(16 - nameBytes.length).fill(0x00), // Pad name
        0xF7                   // SysEx end
      ];

      console.log(`Writing "${testName}" with flag byte ${slot.toString(16).padStart(2, '0')}`);
      midiResponses = [];
      await midiOut.send(writeSysEx);
      await new Promise(r => setTimeout(r, 200));

      // Check for write response
      const writeResponse = midiResponses.find(r =>
        r[0] === 0xF0 && r[8] === 0x15 // Write ACK
      );
      if (writeResponse) {
        console.log(`  ✓ Write acknowledged`);
      }

      // Read back
      const readSysEx = [
        0xF0,
        0x00, 0x20, 0x29,
        0x02,
        0x15,
        0x05,
        0x00,
        0x40,                  // Read operation
        0x00,                  // Slot byte (always 0x00)
        slot,                  // Flag byte (actual slot indicator)
        0xF7
      ];

      console.log(`Reading back with flag byte ${slot.toString(16).padStart(2, '0')}`);
      midiResponses = [];
      await midiOut.send(readSysEx);
      await new Promise(r => setTimeout(r, 500));

      // Check read response
      const readResponse = midiResponses.find(r =>
        r[0] === 0xF0 && r[8] === 0x10 // Read response
      );

      if (readResponse && readResponse.length > 20) {
        // Extract name from response
        const nameStart = 14;
        const nameEnd = nameStart + 16;
        const nameBytes = readResponse.slice(nameStart, nameEnd);
        const name = String.fromCharCode(...nameBytes).replace(/\0/g, '').trim();
        console.log(`  Read back: "${name}"`);

        if (name === testName) {
          console.log(`  ✅ SUCCESS: Slot ${slot} working!`);
        } else {
          console.log(`  ❌ MISMATCH: Expected "${testName}", got "${name}"`);
        }
      } else {
        console.log(`  ⚠️ No valid read response`);
      }
    }

    // Clean up
    console.log('\n\nClosing ports...');
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
testWithHandshake().catch(console.error);