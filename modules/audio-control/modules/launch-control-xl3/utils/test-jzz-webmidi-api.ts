#!/usr/bin/env npx tsx

/**
 * Test JZZ using Web MIDI API interface with requestMIDIAccess
 * This might handle SysEx differently than the native JZZ API
 */

import JZZ from 'jzz';

// Helper to format bytes as hex
function toHex(data: number[]): string {
  return data.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

async function testWebMidiAPI() {
  console.log('JZZ Web MIDI API Test with SysEx');
  console.log('==================================\n');

  try {
    // Use requestMIDIAccess for Web MIDI API compatibility
    console.log('Requesting MIDI access with SysEx...');
    const midiAccess = await JZZ.requestMIDIAccess({ sysex: true });
    console.log('✓ MIDI access granted with SysEx support\n');

    // List available ports
    console.log('Available MIDI Outputs:');
    midiAccess.outputs.forEach((output: any, key: any) => {
      console.log(`  ${key}: ${output.name}`);
    });

    console.log('\nAvailable MIDI Inputs:');
    midiAccess.inputs.forEach((input: any, key: any) => {
      console.log(`  ${key}: ${input.name}`);
    });
    console.log();

    // Find our ports
    let midiOutput: any = null;
    let midiInput: any = null;
    let dawOutput: any = null;
    let dawInput: any = null;

    midiAccess.outputs.forEach((output: any) => {
      if (output.name.includes('LCXL3 1 MIDI In')) midiOutput = output;
      if (output.name.includes('LCXL3 1 DAW In')) dawOutput = output;
    });

    midiAccess.inputs.forEach((input: any) => {
      if (input.name.includes('LCXL3 1 MIDI Out')) midiInput = input;
      if (input.name.includes('LCXL3 1 DAW Out')) dawInput = input;
    });

    if (!midiOutput || !midiInput) {
      console.error('Required MIDI ports not found!');
      return;
    }

    console.log('✓ Found required MIDI ports\n');

    // Set up listeners
    const midiResponses: number[][] = [];
    const dawResponses: number[][] = [];

    // Web MIDI API uses onmidimessage
    midiInput.onmidimessage = (event: any) => {
      const data = Array.from(event.data);
      if (data[0] === 0xF0) {
        console.log(`[MIDI IN] SysEx (${data.length} bytes): ${toHex(data.slice(0, 12))}...`);
      } else {
        console.log(`[MIDI IN] ${toHex(data)}`);
      }
      midiResponses.push(data);
    };

    if (dawInput) {
      dawInput.onmidimessage = (event: any) => {
        const data = Array.from(event.data);
        console.log(`[DAW IN] ${toHex(data)}`);
        dawResponses.push(data);
      };
    }

    // Test handshake
    console.log('=== Testing SysEx with Web MIDI API ===\n');

    // Send Novation SYN - Use regular array, not Uint8Array
    console.log('Sending Novation SYN...');
    const synMessage = [0xF0, 0x00, 0x20, 0x29, 0x00, 0x42, 0x02, 0xF7];
    midiOutput.send(synMessage);

    // Wait for response
    await new Promise(r => setTimeout(r, 500));

    const synAck = midiResponses.find(r => r[0] === 0xF0 && r[5] === 0x42);
    if (synAck) {
      console.log('✅ SUCCESS! Received SYN-ACK via Web MIDI API!');
      const serial = synAck.slice(7, -1).map(c => String.fromCharCode(c)).join('');
      console.log(`  Serial: ${serial}\n`);
    } else {
      console.log(`⚠️ No SYN-ACK received (got ${midiResponses.length} responses)\n`);
    }

    // Send Universal Device Inquiry
    console.log('Sending Universal Device Inquiry...');
    const inquiryMessage = [0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7];
    midiOutput.send(inquiryMessage);

    await new Promise(r => setTimeout(r, 500));

    const deviceInfo = midiResponses.find(r => r[0] === 0xF0 && r[1] === 0x7E);
    if (deviceInfo) {
      console.log('✅ Received device info via Web MIDI API!\n');
    }

    // Test DAW port if available
    if (dawOutput && dawInput) {
      console.log('=== Testing DAW Port ===\n');

      // Clear responses
      dawResponses.length = 0;

      // Send slot query
      console.log('Querying current slot...');
      dawOutput.send([0x9F, 11, 127]); // Note On ch16
      await new Promise(r => setTimeout(r, 10));
      dawOutput.send([0xB7, 30, 0]);   // CC ch8 query
      await new Promise(r => setTimeout(r, 50));

      const queryResponse = dawResponses.find(r => r[0] === 0xB6 && r[1] === 30);
      if (queryResponse) {
        const currentSlot = queryResponse[2] - 6;
        console.log(`✅ Device reports slot ${currentSlot} (CC value ${queryResponse[2]})`);
      }

      dawOutput.send([0x9F, 11, 0]);   // Note Off ch16
    }

    // Test SysEx read
    console.log('\n=== Testing SysEx Read ===\n');
    console.log('Sending read request for slot 0...');
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

    midiOutput.send(readMessage);
    await new Promise(r => setTimeout(r, 1000));

    const readResponse = midiResponses.find(r =>
      r[0] === 0xF0 && r[8] === 0x10 // Read response
    );

    if (readResponse) {
      console.log('✅ SUCCESS! Received SysEx read response via Web MIDI API!');
      console.log(`  Response length: ${readResponse.length} bytes`);
      if (readResponse.length > 20) {
        const nameStart = 14;
        const nameEnd = nameStart + 16;
        const nameBytes = readResponse.slice(nameStart, nameEnd);
        const name = String.fromCharCode(...nameBytes).replace(/\0/g, '').trim();
        console.log(`  Slot name: "${name}"`);
      }
    } else {
      console.log('⚠️ No read response received');
    }

    // Summary
    console.log('\n=== Summary ===');
    console.log(`Total MIDI responses received: ${midiResponses.length}`);
    console.log(`Total DAW responses received: ${dawResponses.length}`);

    if (midiResponses.some(r => r[0] === 0xF0)) {
      console.log('\n🎉 SUCCESS! Web MIDI API interface can receive SysEx with JZZ!');
    } else {
      console.log('\n⚠️ No SysEx messages received via Web MIDI API');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
console.log('Starting Web MIDI API test...\n');
testWebMidiAPI().catch(console.error);