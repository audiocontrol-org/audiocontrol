#!/usr/bin/env npx tsx
/**
 * SDS hardware tests against a connected Akai S3000XL.
 *
 * Modes:
 *   request    — Send a dump request, receive the sample automatically (default)
 *   listen     — Wait for a device-initiated dump, receive with ACKs
 *   send       — Send a generated test sample to the device
 *   roundtrip  — Send a test sample, receive it back, compare
 *
 * Usage:
 *   tsx scripts/sds-hardware-test.ts request [sampleNumber] [channel]
 *   tsx scripts/sds-hardware-test.ts listen [channel]
 *   tsx scripts/sds-hardware-test.ts send [sampleNumber] [channel]
 *   tsx scripts/sds-hardware-test.ts roundtrip [sampleNumber] [channel]
 *
 * Defaults: sampleNumber=3, channel=0 (S3000XL "logical channel 1" = 0x00)
 */

import * as easymidi from 'easymidi';
import {
  parseSdsMessage,
  buildAck,
  buildDumpHeader,
  buildDumpRequest,
  buildDataPacket,
  validateChecksum,
} from '../modules/midi-core/src/sds/sds-messages';
import { samplesToPackets } from '../modules/midi-core/src/sds/sds-encoding';
import { LOOP_OFF, PACKET_COUNTER_MAX } from '../modules/midi-core/src/sds/sds-constants';
import type { SdsDumpHeader } from '../modules/midi-core/src/sds/sds-types';

const EXCLUDED_PORT_PATTERNS = [/^IAC /i, /^Network /i, /^virtual/i];

function findPort(): { inputName: string; outputName: string } {
  const inputs = easymidi.getInputs().filter(p => !EXCLUDED_PORT_PATTERNS.some(r => r.test(p)));
  const outputs = easymidi.getOutputs().filter(p => !EXCLUDED_PORT_PATTERNS.some(r => r.test(p)));

  console.log('MIDI inputs:', inputs.join(', ') || 'none');
  console.log('MIDI outputs:', outputs.join(', ') || 'none');

  for (const out of outputs) {
    const match = inputs.find(inp => inp === out);
    if (match) return { inputName: match, outputName: out };
  }

  throw new Error('No matching MIDI input/output pair found');
}

// ---------------------------------------------------------------------------
// Generate a known test sample
// ---------------------------------------------------------------------------

function generateTestSample(numSamples: number): Int16Array {
  const samples = new Int16Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    // Triangle wave — easy to verify, covers full 16-bit range
    const phase = (i % 256) / 256;
    const value = phase < 0.5
      ? Math.round(-32768 + phase * 2 * 65535)
      : Math.round(32767 - (phase - 0.5) * 2 * 65535);
    samples[i] = value;
  }
  return samples;
}

// ---------------------------------------------------------------------------
// Closed-loop receiver (returns sample data)
// ---------------------------------------------------------------------------

interface ReceiveResult {
  packets: number;
  expected: number;
  checksumErrors: number;
  elapsedS: string;
  header?: SdsDumpHeader;
  samples?: Int16Array;
}

function receiveWithAcks(
  input: easymidi.Input,
  output: easymidi.Output,
  channel: number,
  timeoutMs: number,
): Promise<ReceiveResult> {
  return new Promise((resolve) => {
    let expectedPackets = 0;
    let packetsReceived = 0;
    let headerSeen = false;
    let checksumErrors = 0;
    let startTime = 0;
    let receivedHeader: SdsDumpHeader | undefined;
    const receivedPacketData: Uint8Array[] = [];

    const timeout = setTimeout(() => {
      finish('Timeout');
    }, timeoutMs);

    function finish(reason: string): void {
      clearTimeout(timeout);
      input.removeAllListeners('sysex');

      const elapsed = startTime ? ((Date.now() - startTime) / 1000).toFixed(1) : '0';

      console.log(`\n=== Result: ${reason} ===`);
      console.log(`  Packets: ${packetsReceived}/${expectedPackets}`);
      console.log(`  Checksum errors: ${checksumErrors}`);
      console.log(`  Time: ${elapsed}s`);

      // Decode samples if we have complete data
      let samples: Int16Array | undefined;
      if (receivedHeader && packetsReceived === expectedPackets && expectedPackets > 0) {
        const { packetsToSamples } = require('../modules/midi-core/src/sds/sds-encoding');
        const decoded = packetsToSamples(receivedPacketData, receivedHeader.sampleFormat, receivedHeader.sampleLength);
        samples = decoded instanceof Int16Array ? decoded : new Int16Array(decoded);
      }

      resolve({
        packets: packetsReceived,
        expected: expectedPackets,
        checksumErrors,
        elapsedS: elapsed,
        header: receivedHeader,
        samples,
      });
    }

    input.on('sysex', (msg) => {
      const bytes: number[] = msg.bytes;
      if (bytes.length < 4 || bytes[1] !== 0x7e) return;

      try {
        const parsed = parseSdsMessage(bytes);

        if (parsed.type === 'dump-header') {
          headerSeen = true;
          receivedHeader = parsed.header;
          startTime = Date.now();
          const bpw = Math.ceil(parsed.header.sampleFormat / 7);
          expectedPackets = Math.ceil((parsed.header.sampleLength * bpw) / 120);
          console.log('Dump Header:');
          console.log(`  Sample #${parsed.header.sampleNumber}, ${parsed.header.sampleFormat}-bit`);
          console.log(`  ${parsed.header.sampleLength} samples, ${Math.round(1_000_000_000 / parsed.header.samplePeriodNs)}Hz`);
          console.log(`  Loop: start=${parsed.header.loopStart}, end=${parsed.header.loopEnd}, type=${parsed.header.loopType}`);
          console.log(`  Expecting ${expectedPackets} packets`);
          console.log('  → ACK header');
          output.send('sysex', buildAck(channel, 0) as unknown[]);

        } else if (parsed.type === 'data-packet') {
          if (!headerSeen) return;

          if (!validateChecksum(parsed.packet, channel)) {
            checksumErrors++;
            console.log(`  Packet ${parsed.packet.packetNumber} CHECKSUM ERROR (${checksumErrors} total)`);
          }

          receivedPacketData.push(parsed.packet.data);
          packetsReceived++;
          const pct = Math.round((packetsReceived / expectedPackets) * 100);

          if (expectedPackets <= 20 || pct % 10 === 0 || packetsReceived === expectedPackets) {
            console.log(`  Packet ${parsed.packet.packetNumber} (${packetsReceived}/${expectedPackets} = ${pct}%)`);
          }

          output.send('sysex', buildAck(channel, parsed.packet.packetNumber) as unknown[]);

          if (packetsReceived >= expectedPackets) {
            finish('Complete');
          }
        }
      } catch (err) {
        console.log(`  [parse error] ${(err as Error).message}`);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Closed-loop sender
// ---------------------------------------------------------------------------

function sendWithAcks(
  input: easymidi.Input,
  output: easymidi.Output,
  channel: number,
  header: SdsDumpHeader,
  samples: Int16Array,
  timeoutMs: number,
): Promise<{ packets: number; expected: number; elapsedS: string; success: boolean }> {
  return new Promise((resolve) => {
    const packets = samplesToPackets(samples, header.sampleFormat);
    const totalPackets = packets.length;
    let currentPacket = 0;
    let waitingForHeaderAck = true;
    const startTime = Date.now();

    console.log(`Sending ${totalPackets} packets...`);

    const timeout = setTimeout(() => {
      finish('Timeout');
    }, timeoutMs);

    function resetTimeout(): void {
      clearTimeout(timeout);
      setTimeout(() => finish('Timeout'), timeoutMs);
    }

    function finish(reason: string): void {
      clearTimeout(timeout);
      input.removeAllListeners('sysex');

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const success = reason === 'Complete';

      console.log(`\n=== Send Result: ${reason} ===`);
      console.log(`  Packets: ${currentPacket}/${totalPackets}`);
      console.log(`  Time: ${elapsed}s`);

      resolve({ packets: currentPacket, expected: totalPackets, elapsedS: elapsed, success });
    }

    function sendNextPacket(): void {
      if (currentPacket >= totalPackets) {
        finish('Complete');
        return;
      }

      const packetNumber = currentPacket % PACKET_COUNTER_MAX;
      const pct = Math.round(((currentPacket + 1) / totalPackets) * 100);

      if (totalPackets <= 20 || pct % 10 === 0 || currentPacket === totalPackets - 1) {
        console.log(`  Sending packet ${packetNumber} (${currentPacket + 1}/${totalPackets} = ${pct}%)`);
      }

      output.send('sysex', buildDataPacket(channel, packetNumber, packets[currentPacket]!) as unknown[]);
    }

    input.on('sysex', (msg) => {
      const bytes: number[] = msg.bytes;
      if (bytes.length < 4 || bytes[1] !== 0x7e) return;

      try {
        const parsed = parseSdsMessage(bytes);

        if (parsed.type === 'ack') {
          resetTimeout();

          if (waitingForHeaderAck) {
            console.log('  Header ACKed');
            waitingForHeaderAck = false;
            sendNextPacket();
          } else {
            currentPacket++;
            sendNextPacket();
          }
        } else if (parsed.type === 'nak') {
          console.log(`  NAK for packet ${parsed.packetNumber} — retransmitting`);
          resetTimeout();
          sendNextPacket(); // Retransmit current packet
        } else if (parsed.type === 'cancel') {
          console.log('  CANCEL received from device');
          finish('Cancelled by device');
        } else if (parsed.type === 'wait') {
          console.log('  WAIT received — pausing');
          resetTimeout();
          // Don't send anything, wait for ACK to resume
        }
      } catch {
        // Ignore non-SDS messages
      }
    });

    // Send dump header
    console.log('Sending Dump Header...');
    output.send('sysex', buildDumpHeader(channel, header) as unknown[]);
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const mode = process.argv[2] ?? 'request';
  const { inputName, outputName } = findPort();
  const input = new easymidi.Input(inputName);
  const output = new easymidi.Output(outputName);

  console.log(`Using: ${inputName} / ${outputName}\n`);

  try {
    if (mode === 'request') {
      const sampleNumber = Number(process.argv[3] ?? 3);
      const channel = Number(process.argv[4] ?? 0);

      console.log(`Sending SDS Dump Request for sample #${sampleNumber}, channel ${channel}`);
      const request = buildDumpRequest(channel, sampleNumber);
      console.log(`  → [${request.map(b => b.toString(16).padStart(2, '0')).join(' ')}]\n`);

      output.send('sysex', request as unknown[]);

      const result = await receiveWithAcks(input, output, channel, 60000);

      if (result.packets === result.expected && result.expected > 0) {
        console.log('\nSDS dump request + closed-loop receive: SUCCESS');
      } else {
        console.log('\nSDS dump request: INCOMPLETE or NO RESPONSE');
        process.exitCode = 1;
      }

    } else if (mode === 'listen') {
      const channel = Number(process.argv[3] ?? 0);

      console.log(`Listening for SDS dump on channel ${channel}`);
      console.log('Initiate a CURRENT SAMPLE dump from the S3000XL EXCL page.\n');

      const result = await receiveWithAcks(input, output, channel, 120000);

      if (result.packets === result.expected && result.expected > 0) {
        console.log('\nClosed-loop receive: SUCCESS');
      } else {
        console.log('\nClosed-loop receive: INCOMPLETE or NO DATA');
        process.exitCode = 1;
      }

    } else if (mode === 'send') {
      const sampleNumber = Number(process.argv[3] ?? 3);
      const channel = Number(process.argv[4] ?? 0);
      const numSamples = 256;

      console.log(`Sending ${numSamples}-sample test waveform to slot #${sampleNumber}, channel ${channel}\n`);

      const samples = generateTestSample(numSamples);
      const header: SdsDumpHeader = {
        sampleNumber,
        sampleFormat: 16,
        samplePeriodNs: 22676, // ~44100Hz
        sampleLength: numSamples,
        loopStart: 0,
        loopEnd: 0,
        loopType: LOOP_OFF,
      };

      const result = await sendWithAcks(input, output, channel, header, samples, 30000);

      if (result.success) {
        console.log('\nSDS send: SUCCESS');
      } else {
        console.log('\nSDS send: FAILED');
        process.exitCode = 1;
      }

    } else if (mode === 'roundtrip') {
      const sampleNumber = Number(process.argv[3] ?? 3);
      const channel = Number(process.argv[4] ?? 0);
      const numSamples = 256;

      console.log(`=== Round-trip test: slot #${sampleNumber}, ${numSamples} samples, channel ${channel} ===\n`);

      // 1. Generate known sample
      const sentSamples = generateTestSample(numSamples);
      const header: SdsDumpHeader = {
        sampleNumber,
        sampleFormat: 16,
        samplePeriodNs: 22676, // ~44100Hz
        sampleLength: numSamples,
        loopStart: 0,
        loopEnd: 0,
        loopType: LOOP_OFF,
      };

      console.log('--- Step 1: Send to device ---');
      const sendResult = await sendWithAcks(input, output, channel, header, sentSamples, 30000);

      if (!sendResult.success) {
        console.log('\nRound-trip FAILED at send step');
        process.exitCode = 1;
        return;
      }

      // Brief pause to let device settle
      await new Promise(r => setTimeout(r, 2000));

      console.log('\n--- Step 2: Receive back from device ---');
      const request = buildDumpRequest(channel, sampleNumber);
      output.send('sysex', request as unknown[]);

      const recvResult = await receiveWithAcks(input, output, channel, 60000);

      if (recvResult.packets !== recvResult.expected || recvResult.expected === 0) {
        console.log('\nRound-trip FAILED at receive step');
        process.exitCode = 1;
        return;
      }

      // 3. Compare
      console.log('\n--- Step 3: Compare ---');

      if (!recvResult.samples) {
        console.log('No sample data decoded');
        process.exitCode = 1;
        return;
      }

      if (recvResult.samples.length !== sentSamples.length) {
        console.log(`Length mismatch: sent ${sentSamples.length}, received ${recvResult.samples.length}`);
        process.exitCode = 1;
        return;
      }

      let mismatches = 0;
      let maxDiff = 0;
      for (let i = 0; i < sentSamples.length; i++) {
        const diff = Math.abs(sentSamples[i] - recvResult.samples[i]);
        if (diff > 0) {
          mismatches++;
          maxDiff = Math.max(maxDiff, diff);
          if (mismatches <= 5) {
            console.log(`  Sample ${i}: sent=${sentSamples[i]}, received=${recvResult.samples[i]}, diff=${diff}`);
          }
        }
      }

      if (mismatches === 0) {
        console.log(`  ${sentSamples.length} samples compared: EXACT MATCH`);
        console.log('\nRound-trip: SUCCESS');
      } else {
        console.log(`  ${mismatches}/${sentSamples.length} samples differ, max diff=${maxDiff}`);
        if (maxDiff <= 1) {
          console.log('\nRound-trip: SUCCESS (within quantization tolerance)');
        } else {
          console.log('\nRound-trip: FAILED (data mismatch)');
          process.exitCode = 1;
        }
      }

    } else {
      console.error(`Unknown mode: ${mode}. Use "request", "listen", "send", or "roundtrip".`);
      process.exitCode = 1;
    }
  } finally {
    input.close();
    output.close();
  }
}

main();
