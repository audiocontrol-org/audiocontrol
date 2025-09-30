#!/usr/bin/env npx tsx
/**
 * Minimal test to send SysEx and capture garbage messages
 */

import { JuceMidiBackend } from '../src/backends/JuceMidiBackend.js';
import { MidiInterface } from '../src/core/MidiInterface.js';

async function test() {
  console.log('Testing minimal SysEx send to identify garbage messages...\n');

  const backend = new JuceMidiBackend({ host: 'localhost', port: 7777 });
  const midi = new MidiInterface(backend);

  await midi.initialize();
  await midi.openOutput('LCXL3 1 MIDI In');

  // Send a simple, valid SysEx message
  const testSysEx = [
    0xF0,  // Start
    0x00, 0x20, 0x29, // Novation manufacturer ID
    0x02, 0x15,       // Device/model
    0x01,             // Simple test byte
    0xF7              // End
  ];

  console.log('Sending test SysEx:', testSysEx.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));

  try {
    await midi.sendMessage(testSysEx);
    console.log('✅ SysEx sent successfully');
  } catch (error) {
    console.error('❌ Error sending SysEx:', error);
  }

  // Wait a moment to ensure message is sent
  await new Promise(resolve => setTimeout(resolve, 100));

  await midi.close();
  console.log('\nDone. Check MIDI monitor for any garbage messages.');
}

test().catch(console.error);