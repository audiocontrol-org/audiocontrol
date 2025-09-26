#!/usr/bin/env tsx

/**
 * Test complete custom mode functionality with the corrected SysEx implementation
 */

import { SysExParser } from '@/core/SysExParser';
import { NodeMidiBackend } from '@/core/backends/NodeMidiBackend';
import type { MidiInputPort, MidiOutputPort } from '@/core/MidiInterface';

console.log('🎛️ Launch Control XL 3 - Complete Custom Mode Test\n');

async function testCustomModeReadWrite() {
  const backend = new NodeMidiBackend();
  await backend.initialize();

  // Find Launch Control XL 3 ports
  const inputPorts = await backend.getInputPorts();
  const outputPorts = await backend.getOutputPorts();

  const lcxl3Input = inputPorts.find(p => p.name === 'LCXL3 1 MIDI Out');
  const lcxl3Output = outputPorts.find(p => p.name === 'LCXL3 1 MIDI In');

  if (!lcxl3Input || !lcxl3Output) {
    console.log('❌ Launch Control XL 3 not found');
    console.log('Available input ports:', inputPorts.map(p => p.name));
    console.log('Available output ports:', outputPorts.map(p => p.name));
    return;
  }

  console.log(`✅ Found LCXL3 ports:`)
  console.log(`   Input: ${lcxl3Input.name}`)
  console.log(`   Output: ${lcxl3Output.name}\n`)

  // Open ports
  let inputPort: MidiInputPort;
  let outputPort: MidiOutputPort;

  try {
    inputPort = await backend.openInput(lcxl3Input.id);
    outputPort = await backend.openOutput(lcxl3Output.id);
    console.log('🔗 Ports opened successfully\n');
  } catch (error: any) {
    console.error('❌ Failed to open ports:', error.message);
    return;
  }

  // Set up response handler
  let responseReceived = false;
  let responseData: any = null;

  inputPort.onMessage = (message) => {
    console.log(`📨 Received MIDI: ${message.data.length} bytes`);

    if (message.data[0] === 0xF0) {
      console.log(`🎯 SysEx message received!`);
      console.log(`   Length: ${message.data.length} bytes`);
      console.log(`   First 15 bytes: ${message.data.slice(0, 15).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);

      try {
        const parsed = SysExParser.parse(Array.from(message.data));
        console.log(`✅ Parsed SysEx message successfully:`);
        console.log(`   Type: ${parsed.type}`);

        if (parsed.type === 'custom_mode_response') {
          const customMode = parsed as any;
          console.log(`   📛 Mode Name: "${customMode.name || 'Unknown'}"`);
          console.log(`   🎛️  Controls: ${customMode.controls?.length || 0}`);
          console.log(`   🌈 Colors: ${customMode.colors?.length || 0}`);
          console.log(`   📍 Slot: ${customMode.slot}`);

          // Show first few controls
          if (customMode.controls && customMode.controls.length > 0) {
            console.log(`   🎚️  First few controls:`);
            customMode.controls.slice(0, 5).forEach((ctrl: any, i: number) => {
              console.log(`      ${i + 1}. ID=0x${ctrl.controlId.toString(16)} Ch=${ctrl.channel + 1} CC=${ctrl.ccNumber} Max=${ctrl.maxValue}`);
            });
            if (customMode.controls.length > 5) {
              console.log(`      ... and ${customMode.controls.length - 5} more`);
            }
          }

          responseData = customMode;
        }

        responseReceived = true;
      } catch (error: any) {
        console.error(`❌ Failed to parse SysEx:`, error.message);
      }
    }
  };

  console.log('📡 Testing custom mode read operation...\n');

  // Test reading from slot 0
  const slot = 0;
  const readRequest = SysExParser.buildCustomModeReadRequest(slot);

  console.log(`🔍 Reading custom mode from slot ${slot}:`);
  console.log(`   Request: ${readRequest.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);

  try {
    await backend.sendMessage(outputPort, {
      timestamp: Date.now(),
      data: readRequest
    });

    console.log('✅ Read request sent, waiting for response...');

    // Wait for response
    const timeout = 5000;
    const startTime = Date.now();
    while (!responseReceived && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (responseReceived && responseData) {
      console.log(`\n🎉 SUCCESS! Custom mode read operation working!`);
      console.log(`📋 Retrieved custom mode "${responseData.name}" with ${responseData.controls.length} controls\n`);

      // Test if we can build write request (don't actually send it)
      console.log('🔧 Testing write request generation...');
      try {
        const writeRequest = SysExParser.buildCustomModeWriteRequest(slot + 1, responseData);
        console.log(`✅ Write request generated successfully: ${writeRequest.length} bytes`);
        console.log(`   Format: ${writeRequest.slice(0, 12).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')} ... 0xF7`);
      } catch (error: any) {
        console.error(`❌ Failed to generate write request:`, error.message);
      }

    } else {
      console.log(`\n❌ No response received within ${timeout}ms`);
      console.log('This could indicate:');
      console.log('- Device is not in a custom mode');
      console.log('- SysEx filtering still active');
      console.log('- Incorrect protocol format');
    }

  } catch (error: any) {
    console.error('❌ Failed to send read request:', error.message);
  }

  // Cleanup
  try {
    await inputPort.close();
    await outputPort.close();
    await backend.cleanup();
    console.log('\n✅ Cleanup completed');
  } catch (error: any) {
    console.error('❌ Cleanup failed:', error.message);
  }
}

testCustomModeReadWrite().catch(console.error);