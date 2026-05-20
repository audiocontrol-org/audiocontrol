#!/usr/bin/env tsx
/**
 * Roland S-330 / S-550 handshake diagnostic.
 *
 * The connect-page auto-probe currently sends a Universal Non-
 * Realtime Identity Request (F0 7E 7F 06 01 F7). This is a 1991
 * MMA standard; the S-330 (1988) and S-550 (1989-90) predate it
 * and the device docs in this repo (s330-sysex-protocol.md,
 * s550-sysex-protocol.md) don't mention Identity Request at all —
 * only Roland's proprietary RQD/DAT/ACK handshake.
 *
 * The operator reports "the probe doesn't work" against a real
 * device. This script tests several candidate handshake messages
 * against a chosen MIDI port pair, logs every SysEx the device
 * sends back, and reports which (if any) elicited a response.
 *
 * Per project memory `feedback_dont_blame_device.md`: don't claim
 * the device fails to respond without proving it. This is the
 * proof — actual byte-level conversations.
 *
 * Per project memory `feedback_disassemble_before_probe.md`: for
 * protocol reverse-engineering, gather evidence first (which this
 * script does), then encode the result in the probe.
 *
 * Usage:
 *   tsx src/node/roland-handshake-diag.ts                      # auto-pick first non-loopback pair
 *   tsx src/node/roland-handshake-diag.ts --in "Volt 4" --out "Volt 4"
 *
 * Output: for each candidate, prints the bytes sent and any
 * incoming SysEx received within a per-candidate wait window.
 */

import * as easymidi from 'easymidi';

interface CliArgs {
  inputName: string | null;
  outputName: string | null;
  waitMs: number;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { inputName: null, outputName: null, waitMs: 600 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--in') args.inputName = argv[++i] ?? null;
    else if (arg === '--out') args.outputName = argv[++i] ?? null;
    else if (arg === '--wait') args.waitMs = Number.parseInt(argv[++i] ?? '600', 10);
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: tsx src/node/roland-handshake-diag.ts [--in NAME] [--out NAME] [--wait MS]');
      process.exit(0);
    }
  }
  return args;
}

const LOOPBACK_PATTERNS = /(iac|loopmidi|loopback|virtual|network|midifire)/i;

function pickRealPort(names: string[]): string | null {
  const real = names.find((n) => !LOOPBACK_PATTERNS.test(n));
  return real ?? null;
}

function hex(bytes: readonly number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

/** Roland checksum: 7-bit two's complement of the sum of bytes. */
function rolandChecksum(bytes: readonly number[]): number {
  let sum = 0;
  for (const b of bytes) sum = (sum + b) & 0x7f;
  return (0x80 - sum) & 0x7f;
}

interface Candidate {
  name: string;
  bytes: number[];
  note: string;
}

function buildCandidates(deviceId: number): Candidate[] {
  // RQD body: address(4) + size(4). Request 2 bytes from address 0.
  // Project's client uses 0-LSB-must-be-even rule; 0x00 is fine.
  const rqdAddress = [0x00, 0x00, 0x00, 0x00];
  const rqdSize = [0x00, 0x00, 0x00, 0x04]; // 4 nibbles = 2 bytes
  const rqdChecksum = rolandChecksum([...rqdAddress, ...rqdSize]);

  // RQ1 body: address(4) + size(4) — same shape as RQD per the
  // Roland docs (one-shot variant of the request).
  const rq1Checksum = rolandChecksum([...rqdAddress, ...rqdSize]);

  return [
    {
      name: 'Universal Identity Request (broadcast)',
      bytes: [0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7],
      note: 'MMA 1991 standard; S-330/S-550 predate it. Probably no response.',
    },
    {
      name: 'Universal Identity Request (device id 0x10)',
      bytes: [0xf0, 0x7e, 0x10, 0x06, 0x01, 0xf7],
      note: 'Try device ID 0x10 in case device only replies to its own ID.',
    },
    {
      name: 'Roland RQ1 (one-shot Data Request, 2 bytes at addr 0)',
      bytes: [
        0xf0, 0x41, deviceId, 0x1e, 0x11,
        ...rqdAddress, ...rqdSize, rq1Checksum, 0xf7,
      ],
      note: 'Listed in s550-sysex-protocol.md but client code uses RQD instead.',
    },
    {
      name: 'Roland RQD (handshaking Data Request, 2 bytes at addr 0)',
      bytes: [
        0xf0, 0x41, deviceId, 0x1e, 0x41,
        ...rqdAddress, ...rqdSize, rqdChecksum, 0xf7,
      ],
      note: 'Known-good against hardware — used by requestDataWithAddress.',
    },
  ];
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const inputs = easymidi.getInputs();
  const outputs = easymidi.getOutputs();

  const inputName = args.inputName ?? pickRealPort(inputs);
  const outputName = args.outputName ?? pickRealPort(outputs);

  if (!inputName || !outputName) {
    console.error('No non-loopback MIDI port available. Visible ports:');
    console.error('  Inputs:', inputs);
    console.error('  Outputs:', outputs);
    process.exit(1);
  }

  console.log(`=== Roland handshake diagnostic ===`);
  console.log(`  Input:  ${inputName}`);
  console.log(`  Output: ${outputName}`);
  console.log(`  Per-candidate wait: ${args.waitMs}ms`);
  console.log('');

  const input = new easymidi.Input(inputName);
  const output = new easymidi.Output(outputName);

  const allMessages: Array<{ candidate: string; bytes: number[]; receivedMs: number }> = [];

  // Try device IDs 0 and 16 (front-panel "1" and "17") for the
  // Roland-flavored candidates. The S-330/S-550 default is 1 on
  // the front panel (0x00 in the wire format).
  for (const deviceId of [0x00, 0x10]) {
    const candidates = buildCandidates(deviceId);
    for (const cand of candidates) {
      console.log(`--- [devId 0x${deviceId.toString(16).padStart(2, '0')}] ${cand.name} ---`);
      console.log(`    note: ${cand.note}`);
      console.log(`    send: ${hex(cand.bytes)}`);

      const before = allMessages.length;
      const startedAt = Date.now();
      const listener = (msg: { bytes: number[] }) => {
        allMessages.push({
          candidate: cand.name,
          bytes: msg.bytes,
          receivedMs: Date.now() - startedAt,
        });
      };
      input.on('sysex', listener);

      const sendTyped = output as unknown as { send: (k: 'sysex', b: number[]) => void };
      try {
        sendTyped.send('sysex', cand.bytes);
      } catch (err) {
        console.log(`    send failed: ${err instanceof Error ? err.message : String(err)}`);
        input.removeListener('sysex', listener);
        continue;
      }

      await new Promise((r) => setTimeout(r, args.waitMs));
      input.removeListener('sysex', listener);

      const got = allMessages.slice(before);
      if (got.length === 0) {
        console.log(`    recv: (no SysEx within ${args.waitMs}ms)`);
      } else {
        for (const m of got) {
          console.log(`    recv +${m.receivedMs}ms (${m.bytes.length} bytes): ${hex(m.bytes)}`);
        }
      }
      console.log('');
    }
  }

  input.close();
  output.close();

  // Summary
  console.log('=== Summary ===');
  if (allMessages.length === 0) {
    console.log('No responses to any candidate. Likely causes:');
    console.log('  - EXC SysEx is OFF on the device (set MIDI > EXC = ON)');
    console.log('  - Wrong port pair (try --in / --out with different names)');
    console.log('  - Cable direction reversed (device IN <- host OUT, device OUT -> host IN)');
    process.exit(1);
  }
  const grouped = new Map<string, Array<{ bytes: number[]; receivedMs: number }>>();
  for (const m of allMessages) {
    const arr = grouped.get(m.candidate) ?? [];
    arr.push({ bytes: m.bytes, receivedMs: m.receivedMs });
    grouped.set(m.candidate, arr);
  }
  for (const [name, msgs] of grouped) {
    console.log(`  ${name}: ${msgs.length} response(s)`);
    for (const m of msgs) console.log(`    +${m.receivedMs}ms: ${hex(m.bytes)}`);
  }
}

main().catch((err) => {
  console.error('ERROR:', err instanceof Error ? err.message : String(err));
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(2);
});
