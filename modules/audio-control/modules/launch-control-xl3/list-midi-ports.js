#!/usr/bin/env node

const midi = require('midi');

// Create input and output
const input = new midi.Input();
const output = new midi.Output();

console.log('Available MIDI Ports:\n');

// List input ports
const inputCount = input.getPortCount();
console.log(`Input Ports (${inputCount}):`);
for (let i = 0; i < inputCount; i++) {
  console.log(`  ${i}: ${input.getPortName(i)}`);
}

// List output ports
console.log('');
const outputCount = output.getPortCount();
console.log(`Output Ports (${outputCount}):`);
for (let i = 0; i < outputCount; i++) {
  console.log(`  ${i}: ${output.getPortName(i)}`);
}

// Close ports
input.closePort();
output.closePort();