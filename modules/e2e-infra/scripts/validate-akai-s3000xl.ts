#!/usr/bin/env npx tsx
/**
 * Validate that an Akai S3000XL is connected and responds to SysEx.
 *
 * Sends RSTAT (Request Status) and waits for STAT response.
 *
 * SysEx format: F0 47 <channel> 00 48 F7
 *   0x47 = Akai manufacturer ID
 *   0x00 = RSTAT opcode
 *   0x48 = S3000XL device ID
 *
 * Expected response: F0 47 <channel> 01 48 ... F7
 *   0x01 = STAT opcode
 *
 * Output on success (JSON):
 *   {"found":true,"inputPort":"...","outputPort":"..."}
 *
 * Exit codes:
 *   0 = device found
 *   1 = no device found
 */

import * as easymidi from 'easymidi';

const TIMEOUT_MS = 2000;
const AKAI_MANUFACTURER_ID = 0x47;
const S3000XL_DEVICE_ID = 0x48;
const RSTAT_OPCODE = 0x00;

// Ports to exclude (loopback, virtual, network)
const EXCLUDED_PORT_PATTERNS = [/^IAC /i, /^Network /i, /^virtual/i];

function isExcludedPort(portName: string): boolean {
  return EXCLUDED_PORT_PATTERNS.some(pattern => pattern.test(portName));
}

function makeRstatMessage(channel: number): number[] {
  return [0xF0, AKAI_MANUFACTURER_ID, channel, RSTAT_OPCODE, S3000XL_DEVICE_ID, 0xF7];
}

function isValidAkaiResponse(bytes: number[]): boolean {
  if (bytes.length < 6) return false;
  if (bytes[0] !== 0xF0) return false;
  if (bytes[1] !== AKAI_MANUFACTURER_ID) return false;
  // Any response that's not our own RSTAT echo
  return bytes[3] !== RSTAT_OPCODE;
}

interface DiscoveryResult {
  found: boolean;
  inputPort?: string;
  outputPort?: string;
}

function outputResult(result: DiscoveryResult): void {
  // Output JSON to stdout for machine consumption
  console.log(JSON.stringify(result));
}

async function tryPort(
  inputName: string,
  outputName: string,
  channel: number
): Promise<DiscoveryResult> {
  return new Promise((resolve) => {
    let input: easymidi.Input | null = null;
    let output: easymidi.Output | null = null;
    let resolved = false;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        input?.close();
        output?.close();
      }
    };

    const timeout = setTimeout(() => {
      cleanup();
      resolve({ found: false });
    }, TIMEOUT_MS);

    try {
      input = new easymidi.Input(inputName);
      output = new easymidi.Output(outputName);

      console.error(`  Trying ${inputName} / ${outputName}...`);

      input.on('sysex', (msg) => {
        const bytes = msg.bytes;
        const hex = bytes.map((b: number) => b.toString(16).padStart(2, '0')).join(' ');
        console.error(`    Received: ${hex}`);

        if (isValidAkaiResponse(bytes)) {
          const opcode = bytes[3];
          console.error(`    Valid Akai response (opcode 0x${opcode.toString(16)})`);
          clearTimeout(timeout);
          cleanup();
          resolve({
            found: true,
            inputPort: inputName,
            outputPort: outputName,
          });
        }
      });

      // Send RSTAT request
      const rstat = makeRstatMessage(channel);
      console.error(`    Sending: ${rstat.map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
      output.send('sysex', rstat as unknown[]);
    } catch (e) {
      console.error(`    Error: ${e}`);
      clearTimeout(timeout);
      cleanup();
      resolve({ found: false });
    }
  });
}

async function main() {
  const channel = parseInt(process.argv[2] || '0', 10);

  const allInputs = easymidi.getInputs();
  const allOutputs = easymidi.getOutputs();

  // Filter out excluded ports
  const inputs = allInputs.filter(p => !isExcludedPort(p));
  const outputs = allOutputs.filter(p => !isExcludedPort(p));

  console.error('All MIDI inputs:', allInputs.join(', ') || 'none');
  console.error('All MIDI outputs:', allOutputs.join(', ') || 'none');
  console.error('Filtered inputs:', inputs.join(', ') || 'none');
  console.error('Filtered outputs:', outputs.join(', ') || 'none');

  if (inputs.length === 0 || outputs.length === 0) {
    console.error('No usable MIDI ports available');
    outputResult({ found: false });
    process.exit(1);
  }

  // Build port pairs to try (matching input/output names)
  const portsToTry: [string, string][] = [];

  for (const outPort of outputs) {
    // Try exact match first
    if (inputs.includes(outPort)) {
      portsToTry.push([outPort, outPort]);
    } else {
      // Try partial match (e.g., "828mk3 Hybrid MIDI Port" matches)
      const match = inputs.find(inPort => {
        const outBase = outPort.split(' ')[0];
        const inBase = inPort.split(' ')[0];
        return outBase === inBase || inPort.includes(outBase) || outPort.includes(inBase);
      });
      if (match) {
        portsToTry.push([match, outPort]);
      }
    }
  }

  console.error(`\nTrying ${portsToTry.length} port pair(s)...`);

  for (const [inPort, outPort] of portsToTry) {
    const result = await tryPort(inPort, outPort, channel);
    if (result.found) {
      console.error(`\nAkai S3000XL found on: ${outPort}`);
      outputResult(result);
      process.exit(0);
    }
  }

  console.error('\nNo Akai S3000XL responded');
  outputResult({ found: false });
  process.exit(1);
}

main();
