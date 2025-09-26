#!/usr/bin/env tsx

/**
 * Send CHANNEV custom mode to Launch Control XL 3
 * Based on the analog-obsession-channev.yaml mapping
 */

import { SysExParser } from '@/core/SysExParser';
import { NodeMidiBackend } from '@/core/backends/NodeMidiBackend';
import type { MidiInputPort, MidiOutputPort } from '@/core/MidiInterface';
import type { CustomModeMessage, ControlMapping, ColorMapping } from '@/core/types/SysEx';
console.log('🎛️ Sending CHANNEV Custom Mode to Launch Control XL 3\n');

async function sendChannevMode() {
  // Hardcoded CHANNEV control mappings based on the analog-obsession-channev.yaml
  const controls: ControlMapping[] = [];
  const colors: ColorMapping[] = [];

  // FADERS (8 controls) - IDs 0x00-0x07
  const faderMappings = [
    { id: 0x00, cc: 10 }, // Comp Threshold
    { id: 0x01, cc: 11 }, // Limit Threshold
    { id: 0x02, cc: 74 }, // Comp Soft/Hard
    { id: 0x03, cc: 77 }, // Limit Soft/Hard
    { id: 0x04, cc: 80 }, // Comp Ratio
    { id: 0x05, cc: 83 }, // Limit Ratio
    { id: 0x06, cc: 86 }, // Comp Release
    { id: 0x07, cc: 89 }, // Limit Release
  ];

  for (const fader of faderMappings) {
    controls.push({
      controlId: fader.id,
      channel: 0, // Channel 1 (0-based)
      ccNumber: fader.cc,
      minValue: 0,
      maxValue: 127,
      behaviour: 'absolute'
    });

    colors.push({
      controlId: fader.id,
      color: 0x0F, // Red for faders
      behaviour: 'static'
    });
  }

  // TOP ROW ENCODERS (8 controls) - IDs 0x10-0x17
  const topRowMappings = [
    { id: 0x10, cc: 13 }, // High Pass
    { id: 0x11, cc: 14 }, // EQ High Pass
    { id: 0x12, cc: 15 }, // Mic Pre Gain
    { id: 0x13, cc: 16 }, // Line Amp
    { id: 0x14, cc: 17 }, // Drive
    { id: 0x15, cc: 18 }, // Low Pass
    { id: 0x16, cc: 19 }, // High Shelf
    { id: 0x17, cc: 20 }, // High Shelf Freq
  ];

  for (const encoder of topRowMappings) {
    controls.push({
      controlId: encoder.id,
      channel: 0,
      ccNumber: encoder.cc,
      minValue: 0,
      maxValue: 127,
      behaviour: 'absolute'
    });

    colors.push({
      controlId: encoder.id,
      color: 0x60, // Blue for top row
      behaviour: 'static'
    });
  }

  // MIDDLE ROW ENCODERS (8 controls) - IDs 0x18-0x1F
  const middleRowMappings = [
    { id: 0x18, cc: 53 }, // High Shelf
    { id: 0x19, cc: 22 }, // Low Freq
    { id: 0x1A, cc: 23 }, // Low Mid Freq
    { id: 0x1B, cc: 24 }, // High Mid Freq
    { id: 0x1C, cc: 25 }, // High Freq
    { id: 0x1D, cc: 26 }, // Air Band
    { id: 0x1E, cc: 27 }, // Low Shelf
    { id: 0x1F, cc: 28 }, // Low Shelf Gain
  ];

  for (const encoder of middleRowMappings) {
    controls.push({
      controlId: encoder.id,
      channel: 0,
      ccNumber: encoder.cc,
      minValue: 0,
      maxValue: 127,
      behaviour: 'absolute'
    });

    colors.push({
      controlId: encoder.id,
      color: 0x48, // Yellow for middle row
      behaviour: 'static'
    });
  }

  // BOTTOM ROW ENCODERS (8 controls) - IDs 0x20-0x27
  const bottomRowMappings = [
    { id: 0x20, cc: 29 }, // Low Shelf
    { id: 0x21, cc: 30 }, // Low Gain
    { id: 0x22, cc: 31 }, // Low Mid Gain
    { id: 0x23, cc: 32 }, // High Mid Gain
    { id: 0x24, cc: 33 }, // High Gain
    { id: 0x25, cc: 34 }, // Air Gain
    { id: 0x26, cc: 35 }, // High Pass
    { id: 0x27, cc: 36 }, // Output
  ];

  for (const encoder of bottomRowMappings) {
    controls.push({
      controlId: encoder.id,
      channel: 0,
      ccNumber: encoder.cc,
      minValue: 0,
      maxValue: 127,
      behaviour: 'absolute'
    });

    colors.push({
      controlId: encoder.id,
      color: 0x3C, // Green for bottom row
      behaviour: 'static'
    });
  }

  // Sort controls by ID for consistent ordering
  controls.sort((a, b) => a.controlId - b.controlId);
  colors.sort((a, b) => a.controlId - b.controlId);

  console.log(`📊 Prepared custom mode data:`);
  console.log(`   Faders: ${controls.filter(c => c.controlId <= 0x07).length}`);
  console.log(`   Top row encoders: ${controls.filter(c => c.controlId >= 0x10 && c.controlId <= 0x17).length}`);
  console.log(`   Middle row encoders: ${controls.filter(c => c.controlId >= 0x18 && c.controlId <= 0x1F).length}`);
  console.log(`   Bottom row encoders: ${controls.filter(c => c.controlId >= 0x20 && c.controlId <= 0x27).length}`);
  console.log(`   Total controls: ${controls.length}\n`);

  // Create custom mode message
  const customMode: CustomModeMessage = {
    type: 'custom_mode_response',
    manufacturerId: [0x00, 0x20, 0x29],
    slot: 0, // Will be overridden by the slot parameter
    name: 'CHANNEV', // 7 characters max for XL3
    controls,
    colors,
    data: []
  };

  // Connect to device
  const backend = new NodeMidiBackend();
  await backend.initialize();

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

  console.log(`✅ Found LCXL3 ports`);

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

  inputPort.onMessage = (message) => {
    if (message.data[0] === 0xF0) {
      console.log(`📨 SysEx response: ${message.data.length} bytes`);

      // Check if it's an acknowledgment (12-byte response)
      if (message.data.length === 12) {
        const ack = Array.from(message.data);
        console.log(`   Response: ${ack.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
        console.log(`   ✅ Write acknowledged by device`);
      }

      responseReceived = true;
    }
  };

  // Send to slot 0 (device slot 1)
  const slot = 0;
  console.log(`📤 Sending CHANNEV custom mode to slot ${slot + 1}...\n`);

  try {
    const writeRequest = SysExParser.buildCustomModeWriteRequest(slot, customMode);
    console.log(`   Message size: ${writeRequest.length} bytes`);
    console.log(`   Header: ${writeRequest.slice(0, 12).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);

    // Show first control in the message
    const firstControlPos = writeRequest.indexOf(0x49);
    if (firstControlPos > 0) {
      const firstControl = writeRequest.slice(firstControlPos, firstControlPos + 11);
      console.log(`   First control: ${firstControl.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
    }

    await backend.sendMessage(outputPort, {
      timestamp: Date.now(),
      data: writeRequest
    });

    console.log('\n✅ Custom mode sent, waiting for acknowledgment...');

    // Wait for response
    const timeout = 5000;
    const startTime = Date.now();
    while (!responseReceived && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (responseReceived) {
      console.log(`\n🎉 SUCCESS! CHANNEV mode sent to slot ${slot + 1}`);

      // Verify by reading back
      console.log(`\n🔍 Verifying by reading back from slot ${slot + 1}...`);

      responseReceived = false;
      let verifyData: any = null;

      inputPort.onMessage = (message) => {
        if (message.data[0] === 0xF0 && message.data.length > 100) {
          try {
            const parsed = SysExParser.parse(Array.from(message.data));
            if (parsed.type === 'custom_mode_response') {
              verifyData = parsed as any;
              console.log(`\n✅ Verification read successful:`);
              console.log(`   Mode name: "${verifyData.name}"`);
              console.log(`   Controls found: ${verifyData.controls?.length || 0}`);
              console.log(`   Faders: ${verifyData.controls?.filter((c: any) => c.controlId <= 0x07).length || 0}`);
              console.log(`   Encoders: ${verifyData.controls?.filter((c: any) => c.controlId >= 0x10).length || 0}`);
            }
          } catch (e) {
            console.log(`   Parse error during verification`);
          }
          responseReceived = true;
        }
      };

      const readRequest = SysExParser.buildCustomModeReadRequest(slot);
      await backend.sendMessage(outputPort, {
        timestamp: Date.now(),
        data: readRequest
      });

      // Wait for verification response
      const verifyStart = Date.now();
      while (!responseReceived && (Date.now() - verifyStart) < timeout) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (verifyData && verifyData.controls) {
        if (verifyData.controls.length === 32) {
          console.log(`\n✅ PERFECT! All 32 controls verified in slot ${slot + 1}`);
        } else {
          console.log(`\n⚠️  Only ${verifyData.controls.length} of 32 controls were stored`);
          console.log(`   Missing: ${32 - verifyData.controls.length} controls`);
        }
      }
    } else {
      console.log(`\n❌ No response received within ${timeout}ms`);
    }

  } catch (error: any) {
    console.error('❌ Failed to send custom mode:', error.message);
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

// Execute
sendChannevMode().catch(console.error);