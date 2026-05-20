#!/usr/bin/env tsx
/**
 * Node CLI test for the Roland device probe.
 *
 * Runs `probeForRolandDevice` (editor-core) against the real MIDI
 * ports visible to easymidi on the host machine. This test exists
 * to:
 *
 * 1. Prove the probe is transport-agnostic — if it can be driven
 *    from a Node `easymidi`-backed `MidiTransport`, then the
 *    algorithm is properly decoupled from the browser / Web MIDI
 *    / React frontend.
 * 2. Give the operator a way to debug "the probe doesn't work
 *    against my hardware" without running the editor — the script
 *    prints the available ports, the request bytes, and what
 *    (if anything) replied.
 *
 * Exit codes:
 *   0  — at least one port replied with a Roland Identity Reply
 *   1  — no ports replied; usually means EXC SysEx is OFF on the
 *        device, or there is no Roland on the host's MIDI ports
 *   2  — unexpected error
 *
 * Per `.claude/rules/e2e-testing.md`: no mocks. Real easymidi,
 * real MIDI ports, real device (or no-device, which is itself the
 * legitimate "not-found" path).
 */

import { probeForRolandDevice } from '@audiocontrol/editor-core/transports';
import { createEasymidiTransport } from '#node/lib/easymidi-transport.js';

interface CliArgs {
  attempts: number[] | null;
  verbose: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { attempts: null, verbose: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--attempts') {
      args.attempts = (argv[++i] ?? '').split(',').map((s) => Number.parseInt(s, 10)).filter((n) => Number.isFinite(n));
    } else if (arg === '--verbose' || arg === '-v') {
      args.verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: tsx src/node/test-roland-probe.ts [--attempts MS,MS,...] [--verbose]');
      console.log('  --attempts  comma-separated wait windows per retry (default: 500,1500)');
      process.exit(0);
    }
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const transport = createEasymidiTransport();
  const ports = await transport.refresh();

  console.log('=== Roland probe (Node / easymidi) ===');
  console.log('');
  console.log('Available MIDI inputs:');
  for (const p of ports.inputs) console.log(`  - ${p.name}`);
  console.log('');
  console.log('Available MIDI outputs:');
  for (const p of ports.outputs) console.log(`  - ${p.name}`);
  console.log('');

  if (ports.inputs.length === 0 || ports.outputs.length === 0) {
    console.log('No MIDI ports visible — easymidi sees nothing. Plug in a MIDI');
    console.log('interface or check OS-level MIDI driver state.');
    process.exit(1);
  }

  const attempts = args.attempts ?? [500, 1500];
  console.log(`Probing for Roland device (attempts: ${attempts.join('ms / ')}ms)...`);
  console.log(`Probe sends Roland RQ1 (F0 41 00 1E 11 ...); listens for DT1 / DAT reply.`);
  console.log('');

  const startedAt = Date.now();
  const match = await probeForRolandDevice(transport, ports.inputs, ports.outputs, {
    attempts,
    onProbe: (portName: string) => {
      if (args.verbose) console.log(`  -> probing ${portName}…`);
    },
  });
  const elapsedMs = Date.now() - startedAt;

  console.log('');
  if (match) {
    console.log(`SUCCEED: Roland device replied in ${elapsedMs}ms`);
    console.log(`  Input:  ${match.inputName} (id: ${match.inputId})`);
    console.log(`  Output: ${match.outputName} (id: ${match.outputId})`);
    process.exit(0);
  } else {
    console.log(`FAIL: no Roland Identity Reply after probing every port (${elapsedMs}ms total)`);
    console.log('');
    console.log('Common causes:');
    console.log('  - EXC SysEx is OFF on the device (set MIDI > EXC = ON)');
    console.log('  - Device ID mismatch (probe sends broadcast 0x7F, so this is rare)');
    console.log('  - Wrong MIDI cable direction (device IN must connect to host OUT)');
    console.log('  - All visible ports are loopbacks (IAC / loopMIDI / virtual)');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('ERROR:', err instanceof Error ? err.message : String(err));
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(2);
});
