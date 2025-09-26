#!/usr/bin/env tsx

/**
 * Send the EXACT message from the web editor to verify device accepts it
 */

import { NodeMidiBackend } from '@/core/backends/NodeMidiBackend';

async function sendExactWebMessage() {
  console.log('📤 Sending EXACT web editor message to device\n');

  // This is the exact 419-byte message from the web editor (line 52 of midi-capture.md)
  // F0 00 20 29 02 15 05 00 45 03 00 20 08 43 48 41 4E 4E 45 56 45 49 28 02 00 00 01 40 00 05 7F 00...
  const hexString = `F0 00 20 29 02 15 05 00 45 03 00 20 08 43 48 41 4E 4E 45 56 45 49 28 02 00 00 01 40 00 05 7F 00 49 29 02 00 00 01 40 00 06 7F 00 49 2A 02 00 00 01 40 00 07 7F 00 49 2B 02 00 00 01 40 00 08 7F 00 49 2C 02 00 00 01 40 00 09 7F 00 49 2D 02 00 00 01 40 00 0A 7F 00 49 2E 02 00 00 01 40 00 0B 7F 00 49 2F 02 00 00 01 40 00 0C 7F 00 69 28 48 69 67 68 2D 50 61 73 73 69 29 48 69 67 68 20 50 61 73 73 60 2A 60 2B 60 2C 60 2D 60 2E 60 2F 49 30 02 19 03 01 50 00 25 7F 00 49 31 02 19 03 01 50 00 26 7F 00 49 32 02 19 03 01 50 00 27 7F 00 49 33 02 19 03 01 50 00 28 7F 00 49 34 02 19 03 01 50 00 29 7F 00 49 35 02 19 03 01 50 00 2A 7F 00 49 36 02 19 03 01 50 00 2B 7F 00 49 37 02 19 03 01 50 00 2C 7F 00 49 38 02 25 03 01 50 00 2D 7F 00 49 39 02 25 03 01 50 00 2E 7F 00 49 3A 02 25 03 01 50 00 2F 7F 00 49 3B 02 25 03 01 50 00 30 7F 00 49 3C 02 25 03 01 50 00 31 7F 00 49 3D 02 25 03 01 50 00 32 7F 00 49 3E 02 25 03 01 50 00 33 7F 00 49 3F 02 25 03 01 50 00 34 7F 00 50 30 50 31 50 32 50 33 50 34 50 35 50 36 50 37 50 38 50 39 50 3A 50 3B 50 3C 50 3D 50 3E 50 3F F7`;

  // Convert hex string to byte array
  const bytes = hexString.split(' ').map(h => parseInt(h, 16));

  console.log(`Message size: ${bytes.length} bytes`);
  console.log(`Target slot: ${bytes[9] + 1} (slot byte = 0x${bytes[9].toString(16)})`);

  // Extract mode name
  const nameStart = 13;
  const nameEnd = 21;
  const modeName = String.fromCharCode(...bytes.slice(nameStart, nameEnd));
  console.log(`Mode name: "${modeName}"`);
  console.log(`First bytes: ${bytes.slice(0, 25).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}\n`);

  // Connect to device
  const backend = new NodeMidiBackend();
  await backend.initialize();

  const inputPorts = await backend.getInputPorts();
  const outputPorts = await backend.getOutputPorts();

  const lcxl3Input = inputPorts.find(p => p.name === 'LCXL3 1 MIDI Out');
  const lcxl3Output = outputPorts.find(p => p.name === 'LCXL3 1 MIDI In');

  if (!lcxl3Input || !lcxl3Output) {
    console.log('❌ Launch Control XL 3 not found');
    return;
  }

  const inputPort = await backend.openInput(lcxl3Input.id);
  const outputPort = await backend.openOutput(lcxl3Output.id);
  console.log('✅ Ports opened\n');

  // Set up response handler
  let responseReceived = false;
  let responseData: number[] = [];

  inputPort.onMessage = (message) => {
    if (message.data[0] === 0xF0) {
      responseData = Array.from(message.data);
      responseReceived = true;
      console.log(`📨 Received SysEx response: ${message.data.length} bytes`);

      if (message.data.length === 12) {
        console.log(`   Response: ${responseData.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
        console.log(`   ✅ This is an acknowledgment!`);
      }
    }
  };

  // Send the exact message from web editor
  console.log('📤 Sending EXACT web editor message...');

  await backend.sendMessage(outputPort, {
    timestamp: Date.now(),
    data: bytes
  });

  // Wait for response
  const timeout = 5000;
  const startTime = Date.now();
  while (!responseReceived && (Date.now() - startTime) < timeout) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  if (responseReceived) {
    console.log('\n🎉 Device accepted the message!');

    // Now try to read it back to verify it was stored
    console.log('\n📖 Reading back from slot 4 to verify...');

    responseReceived = false;
    responseData = [];

    // Read from slot 3 (which is where the web editor wrote to)
    const readRequest = [
      0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x40, 0x03, 0x00, 0xF7
    ];

    await backend.sendMessage(outputPort, {
      timestamp: Date.now(),
      data: readRequest
    });

    // Wait for read response
    const readStart = Date.now();
    while (!responseReceived && (Date.now() - readStart) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (responseReceived && responseData.length > 100) {
      console.log(`\n✅ Read successful! Received ${responseData.length} bytes`);

      // Check if it has the mode name
      const readNameStart = 13;
      const readNameBytes = [];
      for (let i = readNameStart; i < responseData.length && i < readNameStart + 20; i++) {
        if (responseData[i] >= 32 && responseData[i] <= 126) {
          readNameBytes.push(responseData[i]);
        } else if (responseData[i] === 0x21) {
          break;
        }
      }
      const readName = String.fromCharCode(...readNameBytes);
      console.log(`   Mode name: "${readName}"`);

      // Count controls (0x48 markers in read response)
      let controlCount = 0;
      for (let i = 20; i < responseData.length - 9; i++) {
        if (responseData[i] === 0x48 && responseData[i + 2] === 0x02) {
          controlCount++;
        }
      }
      console.log(`   Controls found: ${controlCount}`);

      if (controlCount > 20) {
        console.log('\n🎉 SUCCESS! The exact web editor message works perfectly!');
        console.log('   The device accepts and stores the data when sent in the exact format.');
      }
    }
  } else {
    console.log('\n❌ No response received - device did not accept the message');
  }

  // Cleanup
  await inputPort.close();
  await outputPort.close();
  await backend.cleanup();
  console.log('\n✅ Cleanup completed');
}

// Execute
sendExactWebMessage().catch(console.error);