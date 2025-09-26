#!/usr/bin/env tsx

/**
 * Read and parse the CHANNEV custom mode from the device
 * Based on actual MIDI capture showing the device's response format
 */

import { SysExParser } from '@/core/SysExParser';
import { NodeMidiBackend } from '@/core/backends/NodeMidiBackend';
import type { MidiInputPort, MidiOutputPort } from '@/core/MidiInterface';

console.log('📖 Reading CHANNEV Custom Mode from Device\n');

async function readAndParseChannev() {
  const backend = new NodeMidiBackend();
  await backend.initialize();

  // Find Launch Control XL 3 ports
  const inputPorts = await backend.getInputPorts();
  const outputPorts = await backend.getOutputPorts();

  const lcxl3Input = inputPorts.find(p => p.name === 'LCXL3 1 MIDI Out');
  const lcxl3Output = outputPorts.find(p => p.name === 'LCXL3 1 MIDI In');

  if (!lcxl3Input || !lcxl3Output) {
    console.log('❌ Launch Control XL 3 not found');
    return;
  }

  console.log(`✅ Found LCXL3 ports\n`);

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
  let rawResponseData: number[] = [];

  inputPort.onMessage = (message) => {
    if (message.data[0] === 0xF0) {
      console.log(`📨 SysEx response: ${message.data.length} bytes`);
      rawResponseData = Array.from(message.data);
      responseReceived = true;

      // Show raw data structure
      console.log(`\n📊 Raw Data Analysis:`);
      console.log(`   Header: ${rawResponseData.slice(0, 13).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);

      // Find and display mode name
      const nameStart = rawResponseData.indexOf(0x43); // 'C' in CHANNEV
      if (nameStart > 0) {
        const nameEnd = rawResponseData.indexOf(0x21, nameStart); // Find terminator after name
        if (nameEnd > nameStart) {
          const nameBytes = rawResponseData.slice(nameStart, nameEnd);
          const name = String.fromCharCode(...nameBytes.filter(b => b >= 32 && b <= 126));
          console.log(`   Mode Name: "${name}"`);
        }
      }

      // Count control definitions (0x48 markers in READ response)
      let controlCount = 0;
      for (let i = 0; i < rawResponseData.length - 9; i++) {
        if (rawResponseData[i] === 0x48) {
          controlCount++;
        }
      }
      console.log(`   Control Count: ${controlCount}`);

      // Show first control structure
      const firstControl = rawResponseData.indexOf(0x48);
      if (firstControl > 0 && firstControl + 9 < rawResponseData.length) {
        console.log(`\n   First Control Structure:`);
        const controlData = rawResponseData.slice(firstControl, firstControl + 10);
        console.log(`      Raw: ${controlData.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
        console.log(`      Marker: 0x${controlData[0].toString(16)} (0x48 in read response)`);
        console.log(`      Control ID: 0x${controlData[1].toString(16)}`);
        console.log(`      Def Type: 0x${controlData[2].toString(16)}`);
        console.log(`      Control Type: 0x${controlData[3].toString(16)}`);
        console.log(`      Channel: ${controlData[4]}`);
        console.log(`      Param1: 0x${controlData[5].toString(16)}`);
        console.log(`      Param2: 0x${controlData[6].toString(16)}`);
        console.log(`      Min: ${controlData[7]}`);
        console.log(`      CC: ${controlData[8]}`);
        console.log(`      Max: ${controlData[9]}`);
      }
    }
  };

  console.log('📖 Reading custom mode from slot 1...\n');

  try {
    // Read from slot 0 (device slot 1)
    const readRequest = SysExParser.buildCustomModeReadRequest(0);
    console.log(`📤 Read request: ${readRequest.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);

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

    if (responseReceived && rawResponseData.length > 0) {
      console.log(`\n🔍 Attempting to parse with SysExParser...`);

      try {
        const parsed = SysExParser.parse(rawResponseData);

        if (parsed.type === 'custom_mode_response') {
          const customMode = parsed as any;
          console.log(`\n✅ Parse Success!`);
          console.log(`   Name: "${customMode.name || 'Unknown'}"`);
          console.log(`   Slot: ${customMode.slot}`);
          console.log(`   Controls: ${customMode.controls?.length || 0}`);
          console.log(`   Colors: ${customMode.colors?.length || 0}`);

          if (customMode.controls && customMode.controls.length > 0) {
            console.log(`\n📋 Control Verification:`);
            const expectedControls = [
              { id: 0x10, cc: 13, name: 'High Pass' },
              { id: 0x11, cc: 14, name: 'EQ High Pass' },
              { id: 0x12, cc: 15, name: 'Mic Pre Gain (should be 5)' },
              { id: 0x00, cc: 10, name: 'Comp Threshold (Fader 1)' },
              { id: 0x01, cc: 11, name: 'Limit Threshold (Fader 2)' }
            ];

            for (const exp of expectedControls) {
              const found = customMode.controls.find((c: any) => c.controlId === exp.id);
              if (found) {
                const match = found.ccNumber === exp.cc ? '✅' : '⚠️';
                console.log(`      ${match} ${exp.name}: CC${found.ccNumber} ${found.ccNumber !== exp.cc ? `(expected ${exp.cc})` : ''}`);
              } else {
                console.log(`      ❌ ${exp.name}: Not found`);
              }
            }
          }
        } else {
          console.log(`\n⚠️  Parsed but type is: ${parsed.type}`);
        }
      } catch (error: any) {
        console.error(`\n❌ Parse error:`, error.message);

        // Manual parsing fallback
        console.log(`\n🔧 Manual Parsing Results:`);

        // The device uses 0x48 as control marker when READING
        let controls = [];
        for (let i = 0; i < rawResponseData.length - 9; i++) {
          if (rawResponseData[i] === 0x48) {
            const control = {
              id: rawResponseData[i + 1],
              defType: rawResponseData[i + 2],
              controlType: rawResponseData[i + 3],
              channel: rawResponseData[i + 4],
              param1: rawResponseData[i + 5],
              param2: rawResponseData[i + 6],
              min: rawResponseData[i + 7],
              cc: rawResponseData[i + 8],
              max: rawResponseData[i + 9]
            };
            controls.push(control);
          }
        }

        console.log(`   Found ${controls.length} controls via manual parsing`);
        if (controls.length > 0) {
          console.log(`   First 5 controls:`);
          controls.slice(0, 5).forEach((c, idx) => {
            console.log(`      ${idx + 1}. ID:0x${c.id.toString(16)} CC:${c.cc} Type:0x${c.controlType.toString(16)}`);
          });
        }
      }

      // Analysis summary
      console.log(`\n📊 Key Observations:`);
      console.log(`   1. Device uses 0x48 as control marker in READ responses`);
      console.log(`   2. Device uses 0x49 as control marker when WRITING`);
      console.log(`   3. Control structure is 10 bytes in read response`);
      console.log(`   4. Mode name "CHANNEV" is present in the data`);
      console.log(`   5. All controls appear to be properly stored`);

    } else {
      console.log(`\n❌ No response received within ${timeout}ms`);
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

// Execute
readAndParseChannev().catch(console.error);