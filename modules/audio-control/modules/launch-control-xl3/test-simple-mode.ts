#!/usr/bin/env tsx

/**
 * Test sending a simple custom mode with minimal controls
 */

import { SysExParser } from '@/core/SysExParser';
import { NodeMidiBackend } from '@/core/backends/NodeMidiBackend';
import type { CustomModeMessage } from '@/core/types/SysEx';

async function testSimpleMode() {
  console.log('🧪 Testing Simple Custom Mode\n');

  // Create a minimal test mode with just 2 controls
  const testMode: CustomModeMessage = {
    type: 'custom_mode_response',
    manufacturerId: [0x00, 0x20, 0x29],
    slot: 0,
    name: 'TESTMODE', // 8 characters like web editor's "CHANNEVE"
    controls: [
      // One fader
      { controlId: 0x00, channel: 0, ccNumber: 5, minValue: 0, maxValue: 127, behaviour: 'absolute' },
      // One encoder
      { controlId: 0x10, channel: 0, ccNumber: 13, minValue: 0, maxValue: 127, behaviour: 'absolute' }
    ],
    colors: [
      { controlId: 0x00, color: 0x0F, behaviour: 'static' },
      { controlId: 0x10, color: 0x60, behaviour: 'static' }
    ],
    data: []
  };

  const backend = new NodeMidiBackend();
  await backend.initialize();

  const inputPorts = await backend.getInputPorts();
  const outputPorts = await backend.getOutputPorts();

  const lcxl3Input = inputPorts.find(p => p.name === 'LCXL3 1 MIDI Out');
  const lcxl3Output = outputPorts.find(p => p.name === 'LCXL3 1 MIDI In');

  if (!lcxl3Input || !lcxl3Output) {
    console.log('❌ Device not found');
    return;
  }

  const inputPort = await backend.openInput(lcxl3Input.id);
  const outputPort = await backend.openOutput(lcxl3Output.id);

  // Send test mode
  const slot = 1; // Use slot 1 (not 0)
  const writeMsg = SysExParser.buildCustomModeWriteRequest(slot, testMode);

  console.log(`📤 Sending ${writeMsg.length} bytes to slot ${slot + 1}`);
  console.log(`   Header: ${writeMsg.slice(0, 15).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);

  let writeAck = false;
  inputPort.onMessage = (msg) => {
    if (msg.data[0] === 0xF0 && msg.data.length === 12) {
      console.log(`✅ Write acknowledged`);
      writeAck = true;
    }
  };

  await backend.sendMessage(outputPort, {
    timestamp: Date.now(),
    data: writeMsg
  });

  // Wait for ack
  let timeout = 2000;
  let start = Date.now();
  while (!writeAck && (Date.now() - start) < timeout) {
    await new Promise(r => setTimeout(r, 50));
  }

  if (!writeAck) {
    console.log('❌ No acknowledgment');
  }

  // Read back
  console.log(`\n📖 Reading back from slot ${slot + 1}...`);

  let readResponse: any = null;
  inputPort.onMessage = (msg) => {
    if (msg.data[0] === 0xF0 && msg.data.length > 20) {
      console.log(`📨 Received ${msg.data.length} bytes`);
      try {
        const parsed = SysExParser.parse(Array.from(msg.data));
        if (parsed.type === 'custom_mode_response') {
          readResponse = parsed;
        }
      } catch (e) {
        console.log('Parse error:', e);
      }
    }
  };

  const readMsg = SysExParser.buildCustomModeReadRequest(slot);
  await backend.sendMessage(outputPort, {
    timestamp: Date.now(),
    data: readMsg
  });

  // Wait for response
  start = Date.now();
  while (!readResponse && (Date.now() - start) < timeout) {
    await new Promise(r => setTimeout(r, 50));
  }

  if (readResponse) {
    const mode = readResponse as CustomModeMessage;
    console.log(`\n✅ Read successful:`);
    console.log(`   Name: "${mode.name}"`);
    console.log(`   Controls: ${mode.controls?.length || 0}`);

    if (mode.controls && mode.controls.length > 0) {
      console.log(`   First control: ID=0x${mode.controls[0].controlId.toString(16)} CC=${mode.controls[0].ccNumber}`);
    }

    if (mode.controls?.length === 2) {
      console.log(`\n🎉 SUCCESS! Simple mode stored correctly!`);
    } else {
      console.log(`\n⚠️  Expected 2 controls, got ${mode.controls?.length || 0}`);
    }
  } else {
    console.log('\n❌ No response received');
  }

  await inputPort.close();
  await outputPort.close();
  await backend.cleanup();
}

testSimpleMode().catch(console.error);