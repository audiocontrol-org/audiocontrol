#!/usr/bin/env tsx

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const midi = require('midi');

console.log('Available MIDI Ports:\n');

// List input ports
const input = new midi.Input();
const inputCount = input.getPortCount();
console.log(`Input Ports (${inputCount}):`);
for (let i = 0; i < inputCount; i++) {
  const name = input.getPortName(i);
  console.log(`  ${i}: "${name}"`);
}

// List output ports
console.log('');
const output = new midi.Output();
const outputCount = output.getPortCount();
console.log(`Output Ports (${outputCount}):`);
for (let i = 0; i < outputCount; i++) {
  const name = output.getPortName(i);
  console.log(`  ${i}: "${name}"`);
}

// Close ports
input.closePort();
output.closePort();