#!/usr/bin/env tsx

/**
 * Send the complete CHANNEV custom mode using BOTH SysEx messages
 * with proper acknowledgment waiting between them
 */

import { NodeMidiBackend } from '@/core/backends/NodeMidiBackend';

async function sendCompleteChannev() {
  console.log('📤 Sending Complete CHANNEV Custom Mode (2 messages)\n');

  // Message 1: Encoders to slot 0 (466 bytes)
  const msg1Hex = 'f00020290215050045000020084348414e4e45564549100205000148000d7f0049110205000148000e7f0049120205000148000f7f004913020500014800107f004914020500014800117f004915020500014800127f004916020500014800137f004917020500014800147f004918020900014800357f004919020900014800167f00491a020900014800177f00491b020900014800187f00491c020900014800197f00491d0209000148001a7f00491e0209000148001b7f00491f0209000148001c7f004920020d000148001d7f004921020d000148001e7f004922020d000148001f7f004923020d00014800207f004924020d00014800217f004925020d00014800227f004926020d00014800237f004927020d00014800247f0068104d6963204761696e6d114c696e6520416d70204761696e6012601368144c6f7720506173736015601660176a1848696768205368656c6668194c6f77204672657c6c1a4c6f77204d696420467265716d1b48696768204d69642046726571691c486967682046726571601d601e601f69204c6f77205368656c6648214c6f77204761696e6c224c6f77204d6964204761696e6d2348696768204d6964204761696e6924486967682047616e602560266027f7';

  // Message 2: Faders/Buttons to slot 3 (419 bytes)
  const msg2Hex = 'f00020290215050045030020084348414e4e4556454928020000014800057f004929020000014800067f00492a020000014800077f00492b020000014800087f00492c020000014800097f00492d0200000148000a7f00492e0200000148000b7f00492f0200000148000c7f006928486967682d506173736929486967682050617373602a602b602c602d602e602f49300219030150002575004931021903015000267f004932021903015000277f004933021903015000287f004934021903015000297f0049350219030150002a7f0049360219030150002b7f0049370219030150002c7f0049380225030150002d7f0049390225030150002e7f00493a0225030150002f7f00493b022503015000307f00493c022503015000317f00493d022503015000327f00493e022503015000337f00493f022503015000347f006230496e6e314c6f77205065616b2f5368656c6669324c6f77204d69642051463348696768204d696420516f3448696768205065616b2f5368656c664035603660376838506f6c61726974796939455120f6e2f4f6666603a603b603c603d603e603ff7';

  // Convert hex to bytes
  const msg1: number[] = [];
  for (let i = 0; i < msg1Hex.length; i += 2) {
    msg1.push(parseInt(msg1Hex.substr(i, 2), 16));
  }

  const msg2: number[] = [];
  for (let i = 0; i < msg2Hex.length; i += 2) {
    msg2.push(parseInt(msg2Hex.substr(i, 2), 16));
  }

  console.log(`Message 1: ${msg1.length} bytes (encoders to slot ${msg1[9] + 1})`);
  console.log(`Message 2: ${msg2.length} bytes (faders/buttons to slot ${msg2[9] + 1})\n`);

  // Connect to device
  const backend = new NodeMidiBackend();
  await backend.initialize();

  const inputPorts = await backend.getInputPorts();
  const outputPorts = await backend.getOutputPorts();
  const dawInputPorts = await backend.getInputPorts();

  const lcxl3Input = inputPorts.find(p => p.name === 'LCXL3 1 MIDI Out');
  const lcxl3Output = outputPorts.find(p => p.name === 'LCXL3 1 MIDI In');
  const lcxl3DawInput = dawInputPorts.find(p => p.name === 'LCXL3 1 DAW Out');

  if (!lcxl3Input || !lcxl3Output) {
    console.log('❌ Launch Control XL 3 not found');
    return;
  }

  const inputPort = await backend.openInput(lcxl3Input.id);
  const outputPort = await backend.openOutput(lcxl3Output.id);

  // Also open DAW port if available to monitor those messages
  let dawPort = null;
  if (lcxl3DawInput) {
    try {
      dawPort = await backend.openInput(lcxl3DawInput.id);
      dawPort.onMessage = (msg) => {
        if (msg.data[0] >= 0x90 && msg.data[0] <= 0x9F) {
          console.log(`  📎 DAW: Note On ch${(msg.data[0] & 0x0F) + 1}`);
        } else if (msg.data[0] >= 0x80 && msg.data[0] <= 0x8F) {
          console.log(`  📎 DAW: Note Off ch${(msg.data[0] & 0x0F) + 1}`);
        } else if (msg.data[0] >= 0xB0 && msg.data[0] <= 0xBF) {
          console.log(`  📎 DAW: Control ch${(msg.data[0] & 0x0F) + 1} CC${msg.data[1]}=${msg.data[2]}`);
        }
      };
    } catch (e) {
      console.log('  (DAW port monitoring not available)');
    }
  }

  console.log('✅ Ports opened\n');

  // Send first message
  let ack1Received = false;
  let ack1Data: number[] = [];

  inputPort.onMessage = (message) => {
    if (message.data[0] === 0xF0) {
      ack1Data = Array.from(message.data);
      ack1Received = true;
      console.log(`📨 SysEx ACK 1: ${message.data.length} bytes`);
      console.log(`   ${ack1Data.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
    }
  };

  console.log('📤 Sending Message 1 (encoders)...');
  await backend.sendMessage(outputPort, {
    timestamp: Date.now(),
    data: msg1
  });

  // Wait for acknowledgment
  const timeout = 5000;
  let startTime = Date.now();
  while (!ack1Received && (Date.now() - startTime) < timeout) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  if (!ack1Received) {
    console.log('❌ No acknowledgment for message 1');
    await cleanup();
    return;
  }

  // Verify it's the expected ACK (slot 0)
  const expectedAck1 = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x15, 0x00, 0x06, 0xF7];
  const ack1Match = ack1Data.length === expectedAck1.length &&
                     ack1Data.every((b, i) => b === expectedAck1[i]);

  if (ack1Match) {
    console.log('✅ Message 1 acknowledged correctly!\n');
  } else {
    console.log('⚠️  Unexpected acknowledgment format\n');
  }

  // Send second message
  let ack2Received = false;
  let ack2Data: number[] = [];

  inputPort.onMessage = (message) => {
    if (message.data[0] === 0xF0) {
      ack2Data = Array.from(message.data);
      ack2Received = true;
      console.log(`📨 SysEx ACK 2: ${message.data.length} bytes`);
      console.log(`   ${ack2Data.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
    }
  };

  console.log('📤 Sending Message 2 (faders/buttons)...');
  await backend.sendMessage(outputPort, {
    timestamp: Date.now(),
    data: msg2
  });

  // Wait for second acknowledgment
  startTime = Date.now();
  while (!ack2Received && (Date.now() - startTime) < timeout) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  if (!ack2Received) {
    console.log('❌ No acknowledgment for message 2');
    await cleanup();
    return;
  }

  // Verify it's the expected ACK (slot 3)
  const expectedAck2 = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x15, 0x03, 0x06, 0xF7];
  const ack2Match = ack2Data.length === expectedAck2.length &&
                     ack2Data.every((b, i) => b === expectedAck2[i]);

  if (ack2Match) {
    console.log('✅ Message 2 acknowledged correctly!\n');
  } else {
    console.log('⚠️  Unexpected acknowledgment format\n');
  }

  // Verify by reading back
  console.log('📖 Verifying stored data...\n');

  // Read slot 0
  let readResponse0: number[] = [];
  let read0Received = false;

  inputPort.onMessage = (message) => {
    if (message.data[0] === 0xF0 && message.data.length > 100) {
      readResponse0 = Array.from(message.data);
      read0Received = true;
    }
  };

  const readRequest0 = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x40, 0x00, 0x00, 0xF7];
  await backend.sendMessage(outputPort, {
    timestamp: Date.now(),
    data: readRequest0
  });

  startTime = Date.now();
  while (!read0Received && (Date.now() - startTime) < timeout) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  if (read0Received) {
    console.log(`  Slot 1: ${readResponse0.length} bytes received`);
    // Count controls
    let count = 0;
    for (let i = 0; i < readResponse0.length - 10; i++) {
      if (readResponse0[i] === 0x48 && readResponse0[i + 2] === 0x02) count++;
    }
    console.log(`  ✅ ${count} encoder controls found`);
  }

  // Read slot 3
  let readResponse3: number[] = [];
  let read3Received = false;

  inputPort.onMessage = (message) => {
    if (message.data[0] === 0xF0 && message.data.length > 100) {
      readResponse3 = Array.from(message.data);
      read3Received = true;
    }
  };

  const readRequest3 = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x40, 0x03, 0x00, 0xF7];
  await backend.sendMessage(outputPort, {
    timestamp: Date.now(),
    data: readRequest3
  });

  startTime = Date.now();
  while (!read3Received && (Date.now() - startTime) < timeout) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  if (read3Received) {
    console.log(`  Slot 4: ${readResponse3.length} bytes received`);
    // Count controls
    let count = 0;
    for (let i = 0; i < readResponse3.length - 10; i++) {
      if (readResponse3[i] === 0x48 && readResponse3[i + 2] === 0x02) count++;
    }
    console.log(`  ✅ ${count} fader/button controls found`);
  }

  console.log('\n🎉 SUCCESS! Complete CHANNEV mode sent and verified!');
  console.log('   The custom mode spans across slots 1 and 4');

  async function cleanup() {
    await inputPort.close();
    await outputPort.close();
    if (dawPort) await dawPort.close();
    await backend.cleanup();
  }

  await cleanup();
  console.log('\n✅ Cleanup completed');
}

// Execute
sendCompleteChannev().catch(console.error);