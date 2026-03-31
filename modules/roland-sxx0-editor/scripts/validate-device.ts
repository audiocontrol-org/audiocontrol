#!/usr/bin/env npx tsx
/**
 * Validate that a Roland S-series device is connected and responds to SysEx.
 * Discovers the MIDI port and outputs configuration for subsequent tests.
 *
 * Usage: tsx scripts/validate-device.ts [device-id]
 *
 * Output on success (JSON):
 *   {"found":true,"inputPort":"...","outputPort":"...","deviceId":0}
 *
 * Exit codes:
 *   0 = device found
 *   1 = no device found
 */

import * as easymidi from 'easymidi';

const TIMEOUT_MS = 2000;

// Roland S-series protocol constants
const S_SERIES_MODEL_ID = 0x1E;
const ROLAND_ID = 0x41;
const RQD_COMMAND = 0x41;

// S-series response commands
const S_SERIES_RESPONSES = {
  DAT: 0x42,  // Data response
  ACK: 0x43,  // Acknowledge
  EOD: 0x45,  // End of data
  ERR: 0x4E,  // Communication error
  RJC: 0x4F,  // Rejection (request denied)
};

// Ports to exclude (loopback, virtual, network)
const EXCLUDED_PORT_PATTERNS = [
  /^IAC /i,
  /^Network /i,
  /^virtual/i,
];

function isExcludedPort(portName: string): boolean {
  return EXCLUDED_PORT_PATTERNS.some(pattern => pattern.test(portName));
}

// Roland S-330 RQD (Request Data) message format
// F0 41 <dev> 1E 41 <addr 4B> <size 4B> <checksum> F7
function makeRqdMessage(deviceId: number): number[] {
  const address = [0x00, 0x00, 0x00, 0x00];
  const size = [0x00, 0x00, 0x00, 0x02]; // 2 nibbles
  const sum = address.reduce((a, b) => a + b, 0) + size.reduce((a, b) => a + b, 0);
  const checksum = (128 - (sum & 0x7F)) % 128;
  return [
    0xF0,
    ROLAND_ID,
    deviceId,
    S_SERIES_MODEL_ID,
    RQD_COMMAND,
    ...address,
    ...size,
    checksum,
    0xF7,
  ];
}

function isValidSSeriesResponse(bytes: number[]): boolean {
  if (bytes.length < 6) return false;
  if (bytes[0] !== 0xF0) return false;
  if (bytes[1] !== ROLAND_ID) return false;
  if (bytes[3] !== S_SERIES_MODEL_ID) return false;

  const command = bytes[4];
  // Any response command (not RQD which would be an echo)
  return Object.values(S_SERIES_RESPONSES).includes(command);
}

interface DiscoveryResult {
  found: boolean;
  inputPort?: string;
  outputPort?: string;
  deviceId?: number;
  deviceType?: 's330' | 's550';
  responseType?: string;
}

/**
 * Detect whether the connected device is an S-330 or S-550 by probing
 * wave wave stride at address [0x01, 0x40, 0x00, 0x00].
 * - S-550: has 4 wave banks (A-D), wave stride responds with data
 * - S-330: has 2 wave banks (A-B), wave stride is rejected
 */
async function detectDeviceType(
  inputName: string,
  outputName: string,
  deviceId: number,
): Promise<'s330' | 's550'> {
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

    // Default to S-330 on timeout (safer assumption)
    const timeout = setTimeout(() => {
      console.error('    Device type detection timed out, defaulting to S-330');
      cleanup();
      resolve('s330');
    }, TIMEOUT_MS);

    try {
      input = new easymidi.Input(inputName);
      output = new easymidi.Output(outputName);

      input.on('sysex', (msg) => {
        const bytes = msg.bytes;
        if (bytes.length < 5) return;
        if (bytes[1] !== ROLAND_ID) return;
        if (bytes[3] !== S_SERIES_MODEL_ID) return;

        const command = bytes[4];
        const hex = bytes.map((b: number) => b.toString(16).padStart(2, '0')).join(' ');
        console.error(`    wave stride response: ${hex} (command 0x${command.toString(16)})`);
        clearTimeout(timeout);
        cleanup();

        if (command === S_SERIES_RESPONSES.DAT || command === S_SERIES_RESPONSES.EOD || command === S_SERIES_RESPONSES.ACK) {
          // wave stride exists → S-550
          console.error('    wave stride probe: data received → S-550 detected');
          resolve('s550');
        } else {
          // RJC or ERR → wave stride doesn't exist → S-330
          console.error(`    wave stride probe: command 0x${command.toString(16)} → S-330 detected`);
          resolve('s330');
        }
      });

      // Read tone 1 parameters (the auto-fit import target).
      // Tone 1 address: [0x00, 0x03, 0x02, 0x00], full 256-byte block.
      // Check what segmentTop and segmentLength the device actually stored.
      const address = [0x00, 0x03, 0x02, 0x00];
      // Request 4 nibbles (2 bytes) starting at the wave allocation offset
      // Actually, request a larger block to see the full wave params
      // Tone offsets: byte 13=bank, 14=segTop, 15=segLen, 16-18=startPoint
      // Request 32 nibbles (16 bytes) to get wave allocation fields
      const size = [0x00, 0x00, 0x00, 0x20];
      const sum = address.reduce((a, b) => a + b, 0) + size.reduce((a, b) => a + b, 0);
      const checksum = (128 - (sum & 0x7F)) % 128;
      const probe = [
        0xF0, ROLAND_ID, deviceId, S_SERIES_MODEL_ID, RQD_COMMAND,
        ...address, ...size, checksum, 0xF7,
      ];

      console.error(`    Probing wave wave stride: ${probe.map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
      output.send('sysex', probe as unknown[]);
    } catch (e) {
      console.error(`    Device type detection error: ${e}, defaulting to S-330`);
      clearTimeout(timeout);
      cleanup();
      resolve('s330');
    }
  });
}

async function main() {
  const deviceId = parseInt(process.argv[2] || '0', 10);

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
    console.error('✗ No usable MIDI ports available');
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
    const result = await tryPort(inPort, outPort, deviceId);
    if (result.found) {
      // Detect device type (S-330 vs S-550)
      console.error('\nDetecting device type...');
      const deviceType = await detectDeviceType(inPort, outPort, deviceId);
      result.deviceType = deviceType;

      console.error(`\n✓ ${deviceType.toUpperCase()} found on: ${outPort} (device ID ${deviceId})`);
      outputResult(result);
      process.exit(0);
    }
  }

  console.error('\n✗ No S-series device responded');
  outputResult({ found: false });
  process.exit(1);
}

function outputResult(result: DiscoveryResult): void {
  // Output JSON to stdout for machine consumption
  console.log(JSON.stringify(result));
}

async function tryPort(
  inputName: string,
  outputName: string,
  deviceId: number
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

        if (isValidSSeriesResponse(bytes)) {
          const command = bytes[4];
          const responseType = Object.entries(S_SERIES_RESPONSES)
            .find(([, v]) => v === command)?.[0] || 'UNKNOWN';

          console.error(`    → Valid S-series ${responseType} response`);
          clearTimeout(timeout);
          cleanup();
          resolve({
            found: true,
            inputPort: inputName,
            outputPort: outputName,
            deviceId,
            responseType,
          });
        }
      });

      // Send RQD request
      const rqd = makeRqdMessage(deviceId);
      console.error(`    Sending: ${rqd.map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
      output.send('sysex', rqd as any);
    } catch (e) {
      console.error(`    Error: ${e}`);
      clearTimeout(timeout);
      cleanup();
      resolve({ found: false });
    }
  });
}

main();
