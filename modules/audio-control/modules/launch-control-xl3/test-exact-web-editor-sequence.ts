#!/usr/bin/env tsx

/**
 * Test the EXACT sequence from web editor MIDI capture
 * Including the DAW port activity that happens before SysEx
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const midi = require('midi');

console.log('Testing EXACT web editor sequence including DAW port activity...\n');

// Create input and output for both MIDI and DAW ports
const midiInput = new midi.Input();
const midiOutput = new midi.Output();
const dawInput = new midi.Input();
const dawOutput = new midi.Output();

// Find all ports
let midiInputIndex = -1;
let midiOutputIndex = -1;
let dawInputIndex = -1;
let dawOutputIndex = -1;

console.log('Finding all required ports...');

const inputCount = midiInput.getPortCount();
const outputCount = midiOutput.getPortCount();

for (let i = 0; i < inputCount; i++) {
  const name = midiInput.getPortName(i);
  if (name === 'LCXL3 1 MIDI Out') {
    midiInputIndex = i;
    console.log(`Found MIDI input: ${name} at index ${i}`);
  } else if (name === 'LCXL3 1 DAW Out') {
    dawInputIndex = i;
    console.log(`Found DAW input: ${name} at index ${i}`);
  }
}

for (let i = 0; i < outputCount; i++) {
  const name = midiOutput.getPortName(i);
  if (name === 'LCXL3 1 MIDI In') {
    midiOutputIndex = i;
    console.log(`Found MIDI output: ${name} at index ${i}`);
  } else if (name === 'LCXL3 1 DAW In') {
    dawOutputIndex = i;
    console.log(`Found DAW output: ${name} at index ${i}`);
  }
}

if (midiInputIndex >= 0 && midiOutputIndex >= 0 && dawInputIndex >= 0 && dawOutputIndex >= 0) {
  console.log('\n✓ All ports found, opening connections...');

  let responseReceived = false;
  const responses: any[] = [];

  // Monitor both MIDI and DAW inputs
  midiInput.on('message', (deltaTime: number, message: number[]) => {
    responseReceived = true;
    const timestamp = new Date().toISOString().split('T')[1].substring(0, 12);
    console.log(`[${timestamp}] MIDI Response:`,
      message.slice(0, 20).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '),
      message.length > 20 ? `... (${message.length} total bytes)` : '');
    responses.push({port: 'MIDI', data: message, timestamp});
  });

  dawInput.on('message', (deltaTime: number, message: number[]) => {
    const timestamp = new Date().toISOString().split('T')[1].substring(0, 12);
    console.log(`[${timestamp}] DAW Response:`,
      message.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
    responses.push({port: 'DAW', data: message, timestamp});
  });

  // Open all ports
  midiInput.openPort(midiInputIndex);
  midiOutput.openPort(midiOutputIndex);
  dawInput.openPort(dawInputIndex);
  dawOutput.openPort(dawOutputIndex);

  console.log('✓ All ports opened, starting exact web editor sequence...\n');

  // Replicate EXACT sequence from MIDI capture:
  // 19:11:03.172	To LCXL3 1 MIDI In	SysEx		Focusrite / Novation 12 bytes	F0 00 20 29 02 15 05 00 40 00 00 F7

  console.log('Step 1: Sending exact read request from capture...');
  const readRequest = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x40, 0x00, 0x00, 0xF7];

  console.log('Read request:', readRequest.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));

  try {
    midiOutput.sendMessage(readRequest);
    console.log('✓ Read request sent to MIDI port');
  } catch (error) {
    console.error('Failed to send read request:', error);
  }

  // Wait for response
  setTimeout(() => {
    if (responseReceived) {
      console.log('\n✅ Device responded!');
      console.log(`Received ${responses.length} responses:`);
      responses.forEach((resp, i) => {
        console.log(`  ${i + 1}. ${resp.port} port: ${resp.data.length} bytes`);
      });
    } else {
      console.log('\n❌ No response - trying with DAW port pre-sequence...');

      // From capture, there's DAW port activity before SysEx:
      // 19:10:54.681	To LCXL3 1 DAW In	Note On	16	B-2	127
      // 19:10:54.686	To LCXL3 1 DAW In	Control	8	30	0
      // Let's try that first

      console.log('Step 2: Sending DAW port pre-sequence...');

      // Note On Channel 16, B-2 (note 47), velocity 127
      // Channel 16 = status byte 0x9F (0x90 + 15)
      const noteOn = [0x9F, 47, 127];
      console.log('DAW Note On:', noteOn.map(b => '0x' + b.toString(16)).join(' '));

      // Control Change Channel 8, CC 30, value 0
      // Channel 8 = status byte 0xB7 (0xB0 + 7)
      const controlChange = [0xB7, 30, 0];
      console.log('DAW Control Change:', controlChange.map(b => '0x' + b.toString(16)).join(' '));

      try {
        dawOutput.sendMessage(noteOn);
        dawOutput.sendMessage(controlChange);
        console.log('✓ DAW pre-sequence sent');

        // Wait a bit, then try the SysEx again
        setTimeout(() => {
          console.log('Step 3: Retry SysEx after DAW pre-sequence...');
          midiOutput.sendMessage(readRequest);
          console.log('✓ SysEx retry sent');

          // Final wait
          setTimeout(() => {
            if (responseReceived) {
              console.log('\n✅ Got response after DAW pre-sequence!');
            } else {
              console.log('\n❌ Still no response - device may need to be in specific mode');
              console.log('Suggestions:');
              console.log('  - Make sure device is in User mode (not Mixer mode)');
              console.log('  - Try different slot numbers');
              console.log('  - Check if custom modes exist on device');
            }

            // Cleanup
            midiInput.closePort();
            midiOutput.closePort();
            dawInput.closePort();
            dawOutput.closePort();
            console.log('✓ All ports closed');
          }, 3000);

        }, 500);

      } catch (error) {
        console.error('Failed to send DAW pre-sequence:', error);
      }
    }
  }, 3000);

} else {
  console.log('❌ Could not find all required ports:');
  if (midiInputIndex < 0) console.log('  - Missing: LCXL3 1 MIDI Out (input)');
  if (midiOutputIndex < 0) console.log('  - Missing: LCXL3 1 MIDI In (output)');
  if (dawInputIndex < 0) console.log('  - Missing: LCXL3 1 DAW Out (input)');
  if (dawOutputIndex < 0) console.log('  - Missing: LCXL3 1 DAW In (output)');

  console.log('\nAvailable ports:');
  for (let i = 0; i < inputCount; i++) {
    console.log(`  Input ${i}: ${midiInput.getPortName(i)}`);
  }
  for (let i = 0; i < outputCount; i++) {
    console.log(`  Output ${i}: ${midiOutput.getPortName(i)}`);
  }
}