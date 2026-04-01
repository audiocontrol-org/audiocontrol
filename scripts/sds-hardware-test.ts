#!/usr/bin/env npx tsx
/**
 * SDS hardware tests against a connected Akai S3000XL.
 *
 * Modes:
 *   request  — Send a dump request, receive the sample automatically (default)
 *   listen   — Wait for a device-initiated dump, receive with ACKs
 *
 * Usage:
 *   tsx scripts/sds-hardware-test.ts request [sampleNumber] [channel]
 *   tsx scripts/sds-hardware-test.ts listen [channel]
 *
 * Defaults: sampleNumber=3, channel=0 (S3000XL "logical channel 1" = 0x00)
 */

import * as easymidi from 'easymidi';
import {
  parseSdsMessage,
  buildAck,
  buildDumpRequest,
  validateChecksum,
} from '../modules/midi-core/src/sds/sds-messages';

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
// Shared closed-loop receiver
// ---------------------------------------------------------------------------

function receiveWithAcks(
  input: easymidi.Input,
  output: easymidi.Output,
  channel: number,
  timeoutMs: number,
): Promise<{ packets: number; expected: number; checksumErrors: number; elapsedS: string }> {
  return new Promise((resolve) => {
    let expectedPackets = 0;
    let packetsReceived = 0;
    let headerSeen = false;
    let checksumErrors = 0;
    let startTime = 0;

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

      resolve({ packets: packetsReceived, expected: expectedPackets, checksumErrors, elapsedS: elapsed });
    }

    input.on('sysex', (msg) => {
      const bytes: number[] = msg.bytes;
      if (bytes.length < 4 || bytes[1] !== 0x7e) return;

      try {
        const parsed = parseSdsMessage(bytes);

        if (parsed.type === 'dump-header') {
          headerSeen = true;
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

    } else {
      console.error(`Unknown mode: ${mode}. Use "request" or "listen".`);
      process.exitCode = 1;
    }
  } finally {
    input.close();
    output.close();
  }
}

main();
