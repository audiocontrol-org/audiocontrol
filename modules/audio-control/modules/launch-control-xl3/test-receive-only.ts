#!/usr/bin/env tsx

/**
 * Minimal test to verify MIDI input is being received by the library
 * No LED operations, just pure input monitoring
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Import the library components directly
import { MidiInterface } from './src/core/MidiInterface';
import { NodeMidiBackend } from './src/core/backends/NodeMidiBackend';

async function main() {
  console.log('Testing MIDI input reception...\n');

  // Create MIDI interface with node-midi backend
  const backend = new NodeMidiBackend();
  const midi = new MidiInterface(backend);

  try {
    // Initialize
    await midi.initialize();

    // List available ports
    const inputPorts = await midi.getInputPorts();
    console.log('Available input ports:');
    for (const port of inputPorts) {
      console.log(`  ${port.id}: ${port.name}`);
    }

    // Find LCXL3 MIDI port
    const lcxlPort = inputPorts.find(p => p.name === 'LCXL3 1 MIDI Out');
    if (!lcxlPort) {
      console.error('LCXL3 1 MIDI Out port not found');
      process.exit(1);
    }

    console.log(`\nOpening ${lcxlPort.name}...`);
    await midi.openInput(lcxlPort.id);

    console.log('✓ Connected! Listening for control changes...\n');
    console.log('Move knobs, faders, or press buttons on the device.\n');

    // Listen for control change messages
    midi.on('controlchange', (message: any) => {
      const controller = message.controller;
      const value = message.value;
      const channel = message.channel;

      const bar = '█'.repeat(Math.round((value / 127) * 30));
      const empty = '░'.repeat(30 - bar.length);

      console.log(`CC${controller.toString().padEnd(3)} [${bar}${empty}] ${value.toString().padStart(3)} (ch ${channel + 1})`);
    });

    // Also listen for raw messages for debugging
    midi.on('message', (message: any) => {
      if (!message.data || message.data.length === 0) return;
      const statusByte = message.data[0];
      const messageType = statusByte & 0xF0;

      // Only log non-control-change messages for debugging
      if (messageType !== 0xB0) {
        console.log('Other message:', message.data.map((b: number) => '0x' + b.toString(16).padStart(2, '0')).join(' '));
      }
    });

    // Handle Ctrl+C
    process.on('SIGINT', async () => {
      console.log('\n\nShutting down...');
      await midi.cleanup();
      process.exit(0);
    });

    // Keep alive
    await new Promise(() => {});

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main().catch(console.error);