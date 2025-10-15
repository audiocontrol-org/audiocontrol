#!/usr/bin/env node

/**
 * Simple test to see what events node-midi fires
 */

const midi = require('midi');

const input = new midi.Input();

console.log('Input methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(input)));

// Find LCXL3 port
let inputPortIndex = -1;
const inputPortCount = input.getPortCount();
for (let i = 0; i < inputPortCount; i++) {
  const portName = input.getPortName(i);
  console.log(`Port ${i}: ${portName}`);
  if (portName.includes('LCXL3') && portName.includes('MIDI Out')) {
    inputPortIndex = i;
    break;
  }
}

if (inputPortIndex === -1) {
  console.error('LCXL3 not found');
  process.exit(1);
}

console.log(`\nOpening port ${inputPortIndex}...`);
input.openPort(inputPortIndex);

console.log('Waiting for MIDI messages (press Ctrl+C to exit)...\n');

// Set callback directly (node-midi pattern)
input.on('message', (deltaTime, message) => {
  console.log('[RECEIVED] deltaTime:', deltaTime, 'message:', Array.from(message).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
});

// Wait forever
setInterval(() => {}, 1000);
