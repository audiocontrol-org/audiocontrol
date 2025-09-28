#!/usr/bin/env tsx

import * as easymidi from 'easymidi';
import { Sysex } from 'easymidi';

const MIDI_PORT = 'LCXL3 1 MIDI Out';

console.log(`Listening to MIDI port: ${MIDI_PORT}\n`);

try {
  const input = new easymidi.Input(MIDI_PORT);

  input.on('sysex', (sysex: Sysex) => {
    console.log('SysEx:', sysex.bytes.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
  });

  input.on('cc', (msg: any) => {
    console.log('CC:', msg);
  });

  input.on('noteon', (msg: any) => {
    console.log('Note On:', msg);
  });

  input.on('noteoff', (msg: any) => {
    console.log('Note Off:', msg);
  });

  input.on('program', (msg: any) => {
    console.log('Program Change:', msg);
  });

  console.log('Listening for MIDI messages... (Press Ctrl+C to exit)\n');

  process.on('SIGINT', () => {
    console.log('\nClosing MIDI port...');
    input.close();
    process.exit(0);
  });

} catch (error: any) {
  console.error('Error:', error.message);
  console.error('\nAvailable MIDI input ports:');
  easymidi.getInputs().forEach((port, i) => {
    console.error(`  ${i + 1}. ${port}`);
  });
  process.exit(1);
}