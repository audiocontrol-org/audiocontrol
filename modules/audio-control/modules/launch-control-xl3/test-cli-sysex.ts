#!/usr/bin/env tsx

/**
 * Test SysEx via our existing CLI infrastructure to debug response capture
 * Using the DeviceManager and MidiInterface that we know work for basic communication
 */

import { DeviceManager } from './src/device/DeviceManager.js';
import { NodeMidiBackend } from './src/core/backends/NodeMidiBackend.js';
import type { MidiMessage } from './src/core/types.js';

console.log('Testing SysEx via CLI Infrastructure...\n');

const backend = new NodeMidiBackend();
const deviceManager = new DeviceManager(backend);

let responseReceived = false;

// Set up event handlers
deviceManager.on('sysex:received', (message: number[]) => {
  responseReceived = true;
  const timestamp = new Date().toISOString().split('T')[1].substring(0, 12);

  console.log(`\n[${timestamp}] === INCOMING MESSAGE ===`);
  console.log(`Data (${message.length} bytes):`,
    message.slice(0, 20).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '),
    message.length > 20 ? '...' : '');

  // Check for SysEx
  if (message.length >= 6 && message[0] === 0xF0) {
    console.log(`✅ SysEx Message Detected!`);

    // Check for Novation header
    if (message.length >= 10 &&
        message[1] === 0x00 &&
        message[2] === 0x20 &&
        message[3] === 0x29 &&
        message[4] === 0x02 &&
        message[5] === 0x15) {

      const operation = message[8];
      const slot = message[9];

      console.log(`🎯 Novation Custom Mode Response!`);
      console.log(`   Operation: 0x${operation.toString(16)}`);
      console.log(`   Slot: ${slot}`);

      if (operation === 0x10) {
        console.log(`   -> READ response confirmed`);
      }
    }
  }
});

async function testSysEx() {
  try {
    console.log('Connecting to device...');
    await deviceManager.connect();
    console.log('✓ Connected successfully');

    console.log('\nSending SysEx read request...');

    // Use the exact read request from your capture
    const readRequest = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x40, 0x00, 0x00, 0xF7];

    console.log('Request:', readRequest.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));

    await deviceManager.sendRawMidiData(readRequest);
    console.log('✓ SysEx request sent');
    console.log('⏳ Waiting for response...');

    // Wait for response
    await new Promise((resolve) => {
      setTimeout(() => {
        console.log(`\n📊 Results:`);
        console.log(`   Response received: ${responseReceived ? '✅ YES' : '❌ NO'}`);

        if (!responseReceived) {
          console.log(`\n🔍 Debugging Info:`);
          console.log(`   - Using same infrastructure as working CLI`);
          console.log(`   - Exact protocol from your MIDI capture`);
          console.log(`   - Device is confirmed responding (per your monitor)`);
          console.log(`   - Issue may be in Node.js MIDI input handling`);
        }

        resolve(void 0);
      }, 5000);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    console.log('\nDisconnecting...');
    await deviceManager.disconnect();
    console.log('✓ Disconnected');
  }
}

testSysEx().catch(console.error);