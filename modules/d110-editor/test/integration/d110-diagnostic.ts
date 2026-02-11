/**
 * Roland D-110 MIDI Diagnostic Script
 *
 * Comprehensive diagnostic to troubleshoot D-110 SysEx communication.
 * Tests various aspects of the protocol to identify communication issues.
 */

import * as easymidi from 'easymidi';
import { findMidiPort } from '@/core/midi/EasymidiAdapter';
import { calculateChecksum, formatBytes } from '@/core/midi/sysex';
import {
  ROLAND_ID,
  D110_MODEL_ID,
  SYSEX_START,
  SYSEX_END,
} from '@/core/midi/constants';

// Configuration
const MIDI_DEVICE_NAME = process.env.MIDI_DEVICE_NAME || '828mk3 Hybrid MIDI Port';
const LISTEN_TIMEOUT = 10000; // 10 seconds to listen for responses

// D-110 memory addresses for testing
const TEST_ADDRESSES = {
  system: { aa: 0x10, bb: 0x00, cc: 0x00, size: 33, name: 'System Parameters' },
  timbrePart1: { aa: 0x03, bb: 0x00, cc: 0x00, size: 16, name: 'Part 1 Timbre' },
  tempTone1: { aa: 0x04, bb: 0x00, cc: 0x00, size: 246, name: 'Temp Tone 1' },
  // Try reading just 1 byte
  systemSingle: { aa: 0x10, bb: 0x00, cc: 0x00, size: 1, name: 'System (1 byte)' },
};

/**
 * Build RQ1 message with explicit 3-byte size encoding
 */
function buildRQ1(
  address: { aa: number; bb: number; cc: number },
  size: number,
  deviceId: number
): number[] {
  // Size encoded as 3 bytes (21-bit value, 7 bits per byte)
  const sizeHigh = (size >> 14) & 0x7f;
  const sizeMid = (size >> 7) & 0x7f;
  const sizeLow = size & 0x7f;

  const addressAndSize = [address.aa, address.bb, address.cc, sizeHigh, sizeMid, sizeLow];
  const checksum = calculateChecksum(addressAndSize);

  return [
    SYSEX_START,
    ROLAND_ID,
    deviceId,
    D110_MODEL_ID,
    0x11, // RQ1 command
    address.aa,
    address.bb,
    address.cc,
    sizeHigh,
    sizeMid,
    sizeLow,
    checksum,
    SYSEX_END,
  ];
}

/**
 * Build DT1 message (write data)
 */
function buildDT1(
  address: { aa: number; bb: number; cc: number },
  data: number[],
  deviceId: number
): number[] {
  const addressAndData = [address.aa, address.bb, address.cc, ...data];
  const checksum = calculateChecksum(addressAndData);

  return [
    SYSEX_START,
    ROLAND_ID,
    deviceId,
    D110_MODEL_ID,
    0x12, // DT1 command
    address.aa,
    address.bb,
    address.cc,
    ...data,
    checksum,
    SYSEX_END,
  ];
}

/**
 * Build Universal Identity Request
 */
function buildIdentityRequest(deviceId: number): number[] {
  return [0xf0, 0x7e, deviceId, 0x06, 0x01, 0xf7];
}

async function runDiagnostic() {
  console.log('='.repeat(70));
  console.log('Roland D-110 MIDI Diagnostic');
  console.log('='.repeat(70));
  console.log();

  // List available MIDI ports
  const inputs = easymidi.getInputs();
  const outputs = easymidi.getOutputs();

  console.log('Available MIDI Inputs:');
  inputs.forEach((port, i) => console.log(`  ${i}: ${port}`));
  console.log();

  console.log('Available MIDI Outputs:');
  outputs.forEach((port, i) => console.log(`  ${i}: ${port}`));
  console.log();

  // Find target device
  const inputPort = findMidiPort(inputs, MIDI_DEVICE_NAME);
  const outputPort = findMidiPort(outputs, MIDI_DEVICE_NAME);

  if (!inputPort || !outputPort) {
    console.error(`ERROR: MIDI device "${MIDI_DEVICE_NAME}" not found`);
    console.error('Set MIDI_DEVICE_NAME environment variable to use a different device');
    process.exit(1);
  }

  console.log(`Using MIDI device: ${inputPort}`);
  console.log();

  // Open MIDI ports
  const input = new easymidi.Input(inputPort);
  const output = new easymidi.Output(outputPort);

  // Collection of received messages
  const receivedMessages: Array<{ time: number; bytes: number[] }> = [];
  const startTime = Date.now();

  // Listen for ALL SysEx messages
  input.on('sysex', (msg: { bytes: number[] }) => {
    const elapsed = Date.now() - startTime;
    receivedMessages.push({ time: elapsed, bytes: msg.bytes });
    console.log(`[${elapsed}ms] RECEIVED: ${formatBytes(msg.bytes)}`);

    // Analyze the message
    analyzeMessage(msg.bytes);
  });

  // Also listen for other MIDI messages
  input.on('noteon', (msg) => {
    console.log(`[${Date.now() - startTime}ms] Note ON: ch=${msg.channel} note=${msg.note} vel=${msg.velocity}`);
  });
  input.on('noteoff', (msg) => {
    console.log(`[${Date.now() - startTime}ms] Note OFF: ch=${msg.channel} note=${msg.note}`);
  });
  input.on('cc', (msg) => {
    console.log(`[${Date.now() - startTime}ms] CC: ch=${msg.channel} ctrl=${msg.controller} val=${msg.value}`);
  });

  console.log('='.repeat(70));
  console.log('DIAGNOSTIC TESTS');
  console.log('='.repeat(70));
  console.log();

  // Test 1: Universal Identity Request to different device IDs
  console.log('--- Test 1: Universal Identity Request ---');
  for (const devId of [0x10, 0x11, 0x7f]) {
    const identityReq = buildIdentityRequest(devId);
    console.log(`Sending Identity Request (device ${devId.toString(16)}): ${formatBytes(identityReq)}`);
    output.send('sysex', identityReq as unknown as number[]);
    await sleep(500);
  }
  console.log();

  // Test 2: RQ1 requests with different device IDs
  console.log('--- Test 2: RQ1 System Params Request (different device IDs) ---');
  for (const devId of [0x10, 0x11, 0x00]) {
    const addr = TEST_ADDRESSES.system;
    const rq1 = buildRQ1(addr, addr.size, devId);
    console.log(`Sending RQ1 (device ${devId.toString(16)}): ${formatBytes(rq1)}`);
    output.send('sysex', rq1 as unknown as number[]);
    await sleep(500);
  }
  console.log();

  // Test 3: Try different memory addresses
  console.log('--- Test 3: RQ1 Different Memory Addresses ---');
  for (const [key, addr] of Object.entries(TEST_ADDRESSES)) {
    const rq1 = buildRQ1(addr, addr.size, 0x10);
    console.log(`Sending RQ1 for ${addr.name}: ${formatBytes(rq1)}`);
    output.send('sysex', rq1 as unknown as number[]);
    await sleep(500);
  }
  console.log();

  // Test 4: Try sending a DT1 message (write to system - just reverb time)
  // This is a safe write - reverb time 0-7
  console.log('--- Test 4: DT1 Write Test (change reverb time) ---');
  const reverbAddr = { aa: 0x10, bb: 0x00, cc: 0x02 }; // Reverb time offset
  const dt1 = buildDT1(reverbAddr, [0x05], 0x10); // Set reverb time to 5
  console.log(`Sending DT1 (reverb time=5): ${formatBytes(dt1)}`);
  output.send('sysex', dt1 as unknown as number[]);
  await sleep(500);

  // Now read it back
  console.log('Reading back with RQ1...');
  const rq1ReadBack = buildRQ1(TEST_ADDRESSES.system, TEST_ADDRESSES.system.size, 0x10);
  console.log(`Sending RQ1: ${formatBytes(rq1ReadBack)}`);
  output.send('sysex', rq1ReadBack as unknown as number[]);
  console.log();

  // Wait and collect responses
  console.log('='.repeat(70));
  console.log(`Waiting ${LISTEN_TIMEOUT / 1000}s for responses...`);
  console.log('='.repeat(70));

  await sleep(LISTEN_TIMEOUT);

  // Summary
  console.log();
  console.log('='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total messages received: ${receivedMessages.length}`);

  if (receivedMessages.length === 0) {
    console.log();
    console.log('NO MESSAGES RECEIVED!');
    console.log();
    console.log('Possible causes:');
    console.log('1. D-110 MIDI OUT not connected to interface MIDI IN');
    console.log('2. Wrong MIDI cables (MIDI OUT -> MIDI IN, not MIDI THRU)');
    console.log('3. D-110 not powered on or initialized');
    console.log('4. Wrong device ID (check D-110 system settings)');
    console.log('5. Interface MIDI IN not working');
  } else {
    console.log();
    console.log('Messages received:');
    receivedMessages.forEach((msg, i) => {
      console.log(`  ${i + 1}. [${msg.time}ms] ${formatBytes(msg.bytes.slice(0, 30))}${msg.bytes.length > 30 ? '...' : ''}`);
    });

    // Analyze what we got
    const d110Responses = receivedMessages.filter(
      (m) => m.bytes[1] === ROLAND_ID && m.bytes[3] === D110_MODEL_ID && m.bytes[4] === 0x12
    );

    const echoedRequests = receivedMessages.filter(
      (m) => m.bytes[1] === ROLAND_ID && m.bytes[3] === D110_MODEL_ID && m.bytes[4] === 0x11
    );

    const identityResponses = receivedMessages.filter(
      (m) => m.bytes[0] === 0xf0 && m.bytes[1] === 0x7e && m.bytes[3] === 0x06 && m.bytes[4] === 0x02
    );

    console.log();
    console.log(`D-110 DT1 responses (cmd=0x12): ${d110Responses.length}`);
    console.log(`Echoed RQ1 requests (cmd=0x11): ${echoedRequests.length}`);
    console.log(`Identity responses: ${identityResponses.length}`);

    if (d110Responses.length > 0) {
      console.log();
      console.log('SUCCESS! D-110 is responding with data.');
    } else if (echoedRequests.length > 0) {
      console.log();
      console.log('MIDI THRU is active - seeing echoed requests but no D-110 responses.');
      console.log('The D-110 receives messages (echoes them) but is not sending data back.');
      console.log();
      console.log('Check:');
      console.log('1. Device ID setting on D-110 (should be 17 for device ID 0x10)');
      console.log('2. Make sure D-110 MIDI OUT is connected to interface MIDI IN');
      console.log('   (MIDI THRU only echoes, it does not include D-110 responses)');
    }
  }

  // Cleanup
  input.close();
  output.close();

  console.log();
  console.log('Diagnostic complete.');
}

function analyzeMessage(bytes: number[]) {
  if (bytes.length < 5) {
    console.log('  -> Too short to analyze');
    return;
  }

  if (bytes[0] !== SYSEX_START || bytes[bytes.length - 1] !== SYSEX_END) {
    console.log('  -> Not a valid SysEx message');
    return;
  }

  if (bytes[1] === ROLAND_ID) {
    const deviceId = bytes[2];
    const modelId = bytes[3];
    const command = bytes[4];

    if (modelId === D110_MODEL_ID) {
      const cmdName = command === 0x11 ? 'RQ1 (request)' : command === 0x12 ? 'DT1 (data)' : `unknown (0x${command.toString(16)})`;
      console.log(`  -> Roland D-110 message: device=${deviceId.toString(16)}, cmd=${cmdName}`);

      if (command === 0x12) {
        const address = { aa: bytes[5], bb: bytes[6], cc: bytes[7] };
        const dataLength = bytes.length - 10; // F0 41 dev 16 12 AA BB CC [data] chk F7
        console.log(`  -> DT1 Response: address=${address.aa.toString(16)}:${address.bb.toString(16)}:${address.cc.toString(16)}, data length=${dataLength}`);
      }
    } else {
      console.log(`  -> Roland message but not D-110 (model ID: 0x${modelId.toString(16)})`);
    }
  } else if (bytes[1] === 0x7e) {
    // Universal SysEx
    if (bytes[3] === 0x06 && bytes[4] === 0x02) {
      console.log(`  -> Identity Response from device ${bytes[2].toString(16)}`);
    }
  } else {
    console.log(`  -> Non-Roland SysEx (manufacturer: 0x${bytes[1].toString(16)})`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run diagnostic
runDiagnostic().catch(console.error);
