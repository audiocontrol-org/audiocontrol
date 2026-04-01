#!/usr/bin/env npx tsx
/**
 * SDS closed-loop receive test against a connected Akai S3000XL.
 *
 * Listens for a device-initiated dump, sends ACKs, reports results.
 *
 * Usage (inside devenv shell):
 *   tsx scripts/sds-hardware-test.ts [channel]
 *
 * Default channel: 0 (S3000XL "logical channel 1" = 0x00 on the wire)
 */

import * as easymidi from 'easymidi';
import {
  parseSdsMessage,
  buildAck,
  validateChecksum,
} from '../modules/midi-core/src/sds/sds-messages';

const SDS_CHANNEL = Number(process.argv[2] ?? 0);

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

async function main(): Promise<void> {
  const { inputName, outputName } = findPort();
  console.log(`Using: ${inputName} / ${outputName}`);
  console.log(`SDS channel: ${SDS_CHANNEL}`);
  console.log('\nInitiate a CURRENT SAMPLE dump from the S3000XL EXCL page.');
  console.log('Waiting up to 120 seconds...\n');

  const input = new easymidi.Input(inputName);
  const output = new easymidi.Output(outputName);

  return new Promise((resolve) => {
    let expectedPackets = 0;
    let packetsReceived = 0;
    let headerSeen = false;
    let checksumErrors = 0;
    let startTime = 0;

    const timeout = setTimeout(() => {
      finish('Timeout');
    }, 120000);

    function finish(reason: string): void {
      clearTimeout(timeout);
      input.removeAllListeners('sysex');

      const elapsed = startTime ? ((Date.now() - startTime) / 1000).toFixed(1) : '?';

      console.log(`\n=== Result: ${reason} ===`);
      console.log(`  Packets: ${packetsReceived}/${expectedPackets}`);
      console.log(`  Checksum errors: ${checksumErrors}`);
      console.log(`  Time: ${elapsed}s`);

      input.close();
      output.close();
      resolve();
    }

    input.on('sysex', (msg) => {
      const bytes: number[] = msg.bytes;

      // Skip non-SDS messages
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
          output.send('sysex', buildAck(SDS_CHANNEL, 0) as unknown[]);

        } else if (parsed.type === 'data-packet') {
          if (!headerSeen) return; // Ignore stray packets

          // Validate checksum
          if (!validateChecksum(parsed.packet, SDS_CHANNEL)) {
            checksumErrors++;
            console.log(`  Packet ${parsed.packet.packetNumber} CHECKSUM ERROR (${checksumErrors} total)`);
          }

          packetsReceived++;
          const pct = Math.round((packetsReceived / expectedPackets) * 100);

          // Log every 10% or every packet for small transfers
          if (expectedPackets <= 20 || pct % 10 === 0 || packetsReceived === expectedPackets) {
            console.log(`  Packet ${parsed.packet.packetNumber} (${packetsReceived}/${expectedPackets} = ${pct}%)`);
          }

          // ACK
          output.send('sysex', buildAck(SDS_CHANNEL, parsed.packet.packetNumber) as unknown[]);

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

main();
