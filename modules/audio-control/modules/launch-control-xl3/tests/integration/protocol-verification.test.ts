#!/usr/bin/env tsx

/**
 * WORKING Launch Control XL 3 Custom Mode Protocol Implementation
 * With the correct ignoreTypes configuration
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const midi = require('midi');

console.log('🎛️ Launch Control XL 3 - WORKING Protocol Implementation\n');

// Create input and output
const input = new midi.Input();
const output = new midi.Output();

// CRITICAL: Disable message filtering to receive SysEx
input.ignoreTypes(false, false, false); // Don't ignore SysEx, timing, active sensing

// Find ports
let inputIndex = -1;
let outputIndex = -1;

const inputCount = input.getPortCount();
const outputCount = output.getPortCount();

for (let i = 0; i < inputCount; i++) {
  const name = input.getPortName(i);
  if (name === 'LCXL3 1 MIDI Out') {
    inputIndex = i;
    console.log(`Found input: ${name} at index ${i}`);
    break;
  }
}

for (let i = 0; i < outputCount; i++) {
  const name = output.getPortName(i);
  if (name === 'LCXL3 1 MIDI In') {
    outputIndex = i;
    console.log(`Found output: ${name} at index ${i}`);
    break;
  }
}

if (inputIndex >= 0 && outputIndex >= 0) {
  console.log('\nOpening MIDI ports...');

  let responseCount = 0;
  const responses: any[] = [];

  // Set up comprehensive message handler
  input.on('message', (deltaTime: number, message: number[]) => {
    responseCount++;
    const timestamp = new Date().toISOString().split('T')[1].substring(0, 12);

    console.log(`\n[${timestamp}] === RESPONSE ${responseCount} ===`);
    console.log(`Length: ${message.length} bytes`);

    if (message[0] === 0xF0) {
      console.log('🎯 SysEx Response Received!');
      console.log(`First 20 bytes: ${message.slice(0, 20).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
      console.log(`Last 10 bytes: ${message.slice(-10).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);

      // Parse Novation custom mode response
      if (message.length >= 10 &&
          message[1] === 0x00 &&
          message[2] === 0x20 &&
          message[3] === 0x29 &&
          message[4] === 0x02 &&
          message[5] === 0x15 &&
          message[6] === 0x05 &&
          message[7] === 0x00) {

        const operation = message[8];
        const slot = message[9];

        console.log(`✅ Novation Custom Mode Response!`);
        console.log(`   Operation: 0x${operation.toString(16).padStart(2, '0')} (${operation === 0x10 ? 'READ' : operation === 0x15 ? 'ACK' : 'OTHER'})`);
        console.log(`   Slot: ${slot}`);

        if (operation === 0x10) {
          console.log(`   🎼 Custom Mode Data Retrieved!`);

          // Parse mode name (after 06 20 0E pattern)
          let nameStart = -1;
          for (let i = 10; i < message.length - 3; i++) {
            if (message[i] === 0x06 && message[i + 1] === 0x20 && message[i + 2] === 0x0E) {
              nameStart = i + 3;
              break;
            }
          }

          if (nameStart > 0) {
            const nameBytes = [];
            for (let i = nameStart; i < message.length - 1; i++) {
              if (message[i] === 0x00 || message[i] === 0x48 || message[i] === 0xF7) break;
              if (message[i] >= 32 && message[i] <= 126) {
                nameBytes.push(message[i]);
              }
            }

            if (nameBytes.length > 0) {
              const modeName = String.fromCharCode(...nameBytes);
              console.log(`   📛 Mode Name: "${modeName}"`);
            }
          }

          // Count and parse first few control definitions
          let controlCount = 0;
          const controls: any[] = [];

          for (let i = 10; i < message.length - 10; i++) {
            if (message[i] === 0x48) { // Control marker
              controlCount++;

              if (controlCount <= 5) { // Show first 5 controls
                const controlId = message[i + 1];
                const defType = message[i + 2];
                const controlType = message[i + 3];
                const channel = message[i + 4];
                const param1 = message[i + 5];
                const param2 = message[i + 6];
                const ccNumber = message[i + 7];
                const maxValue = message[i + 8];

                let controlTypeName = 'Unknown';
                if (controlType === 0x21 || controlType === 0x2D) controlTypeName = 'Encoder';
                else if (controlType === 0x0D) controlTypeName = 'Fader';
                else if (controlType === 0x1A) controlTypeName = 'Button';

                console.log(`   🎛️  Control ${controlCount}: ${controlTypeName} (ID=0x${controlId.toString(16)}, Ch=${channel + 1}, CC=${ccNumber})`);

                controls.push({
                  id: controlId,
                  type: controlTypeName,
                  channel: channel + 1,
                  cc: ccNumber
                });
              }
            }
          }

          console.log(`   📊 Total Controls: ${controlCount}`);

          // Store response for analysis
          responses.push({
            slot,
            modeName: nameBytes.length > 0 ? String.fromCharCode(...nameBytes) : 'Unknown',
            controlCount,
            controls,
            rawData: [...message]
          });
        }
      }
    } else {
      console.log(`📨 MIDI Message: ${message.map(b => '0x' + b.toString(16)).join(' ')}`);
    }
  });

  input.openPort(inputIndex);
  output.openPort(outputIndex);

  console.log('✅ Ports opened with SysEx enabled');
  console.log('📡 Monitoring for responses...\n');

  async function testReadOperations() {
    const slotsToTest = [0, 1, 2, 3]; // Test first 4 slots

    for (const slot of slotsToTest) {
      console.log(`\n🔍 Reading from slot ${slot}...`);

      // Correct read request format (from MIDI capture)
      const readRequest = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x40, slot, 0x00, 0xF7];

      console.log(`Request: ${readRequest.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);

      try {
        output.sendMessage(readRequest);
        console.log('✅ Read request sent');

        // Wait for response
        await new Promise(resolve => setTimeout(resolve, 1500));

      } catch (error) {
        console.error('❌ Failed to send read request:', error);
      }
    }

    // Summary
    console.log(`\n📋 FINAL RESULTS:`);
    console.log(`   Total responses: ${responseCount}`);
    console.log(`   Slots with data: ${responses.length}`);

    if (responses.length > 0) {
      console.log(`\n📊 Custom Modes Found:`);
      responses.forEach((resp, i) => {
        console.log(`   ${i + 1}. Slot ${resp.slot}: "${resp.modeName}" (${resp.controlCount} controls)`);
        resp.controls.forEach((ctrl: any, j: number) => {
          if (j < 3) { // Show first 3 controls
            console.log(`      - ${ctrl.type}: CC${ctrl.cc} on Ch${ctrl.channel}`);
          }
        });
        if (resp.controls.length > 3) {
          console.log(`      - ... and ${resp.controls.length - 3} more`);
        }
      });

      console.log(`\n🎉 SUCCESS! Launch Control XL 3 protocol is now working!`);
      console.log(`The key was: input.ignoreTypes(false, false, false)`);

    } else {
      console.log(`\n⚠️  No custom mode data found in tested slots`);
    }

    // Cleanup
    input.closePort();
    output.closePort();
    console.log('\n✅ Ports closed');
  }

  testReadOperations().catch(console.error);

} else {
  console.log('❌ Required ports not found:');
  if (inputIndex < 0) console.log('  - LCXL3 1 MIDI Out (input)');
  if (outputIndex < 0) console.log('  - LCXL3 1 MIDI In (output)');
}