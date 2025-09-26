#!/usr/bin/env tsx

/**
 * Send CHANNEV custom mode to slot 1 (slot 0 in protocol)
 * Using the exact working format from web editor
 */

import { NodeMidiBackend } from '@/core/backends/NodeMidiBackend';

async function sendChannevToSlot1() {
  console.log('🎛️ Sending CHANNEV Custom Mode to Slot 1\n');

  // Exact message from web editor for slot 0 (466 bytes)
  // This includes all 24 encoders with labels and colors
  const messageHex = 'f00020290215050045000020084348414e4e45564549100205000148000d7f0049110205000148000e7f0049120205000148000f7f004913020500014800107f004914020500014800117f004915020500014800127f004916020500014800137f004917020500014800147f004918020900014800357f004919020900014800167f00491a020900014800177f00491b020900014800187f00491c020900014800197f00491d0209000148001a7f00491e0209000148001b7f00491f0209000148001c7f004920020d000148001d7f004921020d000148001e7f004922020d000148001f7f004923020d00014800207f004924020d00014800217f004925020d00014800227f004926020d00014800237f004927020d00014800247f0068104d6963204761696e6d114c696e6520416d70204761696e6012601368144c6f7720506173736015601660176a1848696768205368656c6668194c6f77204672657c6c1a4c6f77204d696420467265716d1b48696768204d69642046726571691c486967682046726571601d601e601f69204c6f77205368656c6648214c6f77204761696e6c224c6f77204d6964204761696e6d2348696768204d6964204761696e6924486967682047616e602560266027f7';

  // Convert hex to bytes
  const message: number[] = [];
  for (let i = 0; i < messageHex.length; i += 2) {
    message.push(parseInt(messageHex.substr(i, 2), 16));
  }

  console.log(`📦 Message details:`);
  console.log(`   Size: ${message.length} bytes`);
  console.log(`   Target slot: 1 (protocol slot 0)`);
  console.log(`   Mode name: CHANNEVE`);
  console.log(`   Contains: 24 encoder controls + labels + colors\n`);

  // Connect to device
  const backend = new NodeMidiBackend();
  await backend.initialize();

  const inputPorts = await backend.getInputPorts();
  const outputPorts = await backend.getOutputPorts();

  const lcxl3Input = inputPorts.find(p => p.name === 'LCXL3 1 MIDI Out');
  const lcxl3Output = outputPorts.find(p => p.name === 'LCXL3 1 MIDI In');

  if (!lcxl3Input || !lcxl3Output) {
    console.log('❌ Launch Control XL 3 not found');
    console.log('Available inputs:', inputPorts.map(p => p.name));
    console.log('Available outputs:', outputPorts.map(p => p.name));
    return;
  }

  const inputPort = await backend.openInput(lcxl3Input.id);
  const outputPort = await backend.openOutput(lcxl3Output.id);
  console.log('✅ Ports opened successfully\n');

  // Set up response handler
  let ackReceived = false;
  let ackData: number[] = [];

  inputPort.onMessage = (msg) => {
    if (msg.data[0] === 0xF0) {
      ackData = Array.from(msg.data);
      ackReceived = true;
      console.log(`📨 SysEx response: ${msg.data.length} bytes`);

      if (msg.data.length === 12) {
        console.log(`   ${ackData.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);

        // Check if it's the expected acknowledgment
        const expectedAck = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x15, 0x00, 0x06, 0xF7];
        if (ackData.every((b, i) => b === expectedAck[i])) {
          console.log(`   ✅ Correct acknowledgment for slot 1!`);
        }
      }
    }
  };

  // Send the message
  console.log('📤 Sending CHANNEV custom mode to slot 1...');

  await backend.sendMessage(outputPort, {
    timestamp: Date.now(),
    data: message
  });

  // Wait for acknowledgment
  const timeout = 5000;
  const startTime = Date.now();
  while (!ackReceived && (Date.now() - startTime) < timeout) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  if (ackReceived) {
    console.log('\n✅ Custom mode sent successfully!');

    // Verify by reading back
    console.log('\n📖 Verifying stored data...');

    let readResponse: number[] = [];
    let readReceived = false;

    inputPort.onMessage = (msg) => {
      if (msg.data[0] === 0xF0 && msg.data.length > 100) {
        readResponse = Array.from(msg.data);
        readReceived = true;
        console.log(`   Received ${msg.data.length} bytes`);
      }
    };

    // Read from slot 0
    const readRequest = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x40, 0x00, 0x00, 0xF7];
    await backend.sendMessage(outputPort, {
      timestamp: Date.now(),
      data: readRequest
    });

    // Wait for read response
    const readStart = Date.now();
    while (!readReceived && (Date.now() - readStart) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    if (readReceived) {
      // Count controls in response
      let controlCount = 0;
      for (let i = 0; i < readResponse.length - 10; i++) {
        if (readResponse[i] === 0x48 && readResponse[i + 2] === 0x02) {
          controlCount++;
        }
      }

      // Extract mode name
      let modeName = '';
      const nameStart = readResponse.indexOf(0x43); // 'C' in CHANNEV
      if (nameStart > 0) {
        for (let i = nameStart; i < readResponse.length && i < nameStart + 20; i++) {
          if (readResponse[i] === 0x21 || readResponse[i] === 0x48) break;
          if (readResponse[i] >= 32 && readResponse[i] <= 126) {
            modeName += String.fromCharCode(readResponse[i]);
          }
        }
      }

      console.log(`   Mode name: "${modeName}"`);
      console.log(`   Controls found: ${controlCount}`);

      if (controlCount >= 20) {
        console.log('\n🎉 SUCCESS! CHANNEV mode uploaded to slot 1!');
        console.log('   The device should now show the CHANNEV custom mode');
        console.log('   with 24 encoder mappings for the Analog Obsession plugin');
      } else {
        console.log('\n⚠️  Fewer controls than expected were stored');
        console.log('   You may need to send the fader/button data separately');
      }
    }
  } else {
    console.log('\n❌ No acknowledgment received from device');
  }

  // Cleanup
  await inputPort.close();
  await outputPort.close();
  await backend.cleanup();
  console.log('\n✅ Cleanup completed');
}

// Execute
sendChannevToSlot1().catch(console.error);