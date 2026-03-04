/**
 * MIDI Device Discovery Integration Test
 *
 * Scans all available MIDI interfaces and sends Universal SysEx Identity Request
 * messages to discover connected devices. Reports which devices responded.
 *
 * ## Protocol
 * The Universal SysEx Identity Request (MIDI 1.0 Specification) is:
 *   F0 7E 7F 06 01 F7
 *
 * Where:
 *   F0    = SysEx start
 *   7E    = Universal Non-Real Time
 *   7F    = All devices (broadcast) or specific device ID
 *   06    = General Information (sub-ID1)
 *   01    = Identity Request (sub-ID2)
 *   F7    = SysEx end
 *
 * Devices respond with Identity Reply:
 *   F0 7E [dev] 06 02 [mfr] [family LSB] [family MSB] [member LSB] [member MSB]
 *      [version1] [version2] [version3] [version4] F7
 *
 * ## Running
 * ```bash
 * pnpm test:discovery
 * ```
 *
 * Or run directly:
 * ```bash
 * pnpm vitest run test/integration/midi-device-discovery.test.ts
 * ```
 */

import { describe, it, expect, afterAll } from 'vitest';
import * as easymidi from 'easymidi';

// =============================================================================
// Constants
// =============================================================================

/** Universal SysEx Identity Request message */
const IDENTITY_REQUEST: number[] = [0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7];

/** Well-known MIDI manufacturer IDs (single byte) */
const MANUFACTURER_IDS: Record<number, string> = {
  0x01: 'Sequential Circuits',
  0x02: 'IDP',
  0x03: 'Octave-Plateau (Voyetra)',
  0x04: 'Moog Music',
  0x05: 'Passport Designs',
  0x06: 'Lexicon',
  0x07: 'Kurzweil',
  0x08: 'Fender',
  0x09: 'AKG Acoustics',
  0x0a: 'Voyce Music',
  0x0f: 'Ensoniq',
  0x10: 'Oberheim',
  0x11: 'Apple Computer',
  0x14: 'Emu Systems',
  0x18: 'Akai',
  0x1c: 'Eventide',
  0x22: 'Synthaxe',
  0x27: 'Neve',
  0x29: 'Cheetah',
  0x2f: 'Elka / General Music',
  0x36: 'Hohner',
  0x3e: 'Waldorf Electronics',
  0x40: 'Kawai',
  0x41: 'Roland',
  0x42: 'Korg',
  0x43: 'Yamaha',
  0x44: 'Casio',
  0x47: 'Akai (alternate)',
  0x4b: 'Fujitsu',
  0x4c: 'Sony',
  0x4e: 'Teac',
  0x51: 'Fostex',
  0x52: 'Zoom',
  0x54: 'Matsushita (Technics)',
  0x57: 'Suzuki',
  0x5f: 'Softbank',
};

/** Extended manufacturer IDs (3-byte, starting with 0x00) */
const EXTENDED_MANUFACTURER_IDS: Record<string, string> = {
  '00-20-29': 'Novation',
  '00-20-6B': 'Arturia',
  '00-00-33': 'MOTU',
  '00-00-7D': 'Educational Use',
  '00-01-05': 'M-Audio',
  '00-01-0C': 'Samson',
  '00-01-55': 'Numark',
  '00-01-60': 'Behringer',
  '00-01-73': 'Native Instruments',
  '00-02-0D': 'Ableton',
  '00-02-14': 'Teenage Engineering',
  '00-21-09': 'Access Music',
  '00-21-1A': 'IK Multimedia',
  '00-21-27': 'Elektron',
  '00-21-32': 'Waldorf (extended)',
};

/** Roland model IDs */
const ROLAND_MODEL_IDS: Record<number, string> = {
  0x14: 'D-50',
  0x16: 'D-110',
  0x17: 'D-10',
  0x18: 'D-20',
  0x23: 'U-220',
  0x2b: 'JD-800',
  0x42: 'GS (Sound Canvas)',
  0x45: 'SC-88',
  0x56: 'XV-5080',
};

/** Timeout for waiting for device responses */
const DISCOVERY_TIMEOUT_MS = 3000;

// =============================================================================
// Types
// =============================================================================

interface MidiPortPair {
  inputName: string;
  outputName: string;
  input: easymidi.Input;
  output: easymidi.Output;
}

interface DeviceIdentity {
  deviceId: number;
  manufacturerId: number;
  extendedManufacturerId?: string; // For 3-byte IDs starting with 0x00
  manufacturerName: string;
  familyCode: number;
  memberCode: number;
  softwareVersion: string;
  rawMessage: number[];
  portName: string;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Parse a Universal SysEx Identity Reply message
 */
function parseIdentityReply(message: number[], portName: string): DeviceIdentity | null {
  // Minimum valid identity reply: F0 7E [dev] 06 02 [mfr] ... F7
  if (message.length < 7) {
    return null;
  }

  // Check for identity reply header
  if (
    message[0] !== 0xf0 ||
    message[1] !== 0x7e ||
    message[3] !== 0x06 ||
    message[4] !== 0x02
  ) {
    return null;
  }

  const deviceId = message[2];
  let manufacturerId = message[5];
  let extendedManufacturerId: string | undefined;
  let manufacturerName: string;
  let dataOffset = 6; // Where family code starts

  // Check for extended manufacturer ID (starts with 0x00)
  if (manufacturerId === 0x00 && message.length >= 10) {
    // Extended 3-byte manufacturer ID
    extendedManufacturerId = [
      message[5].toString(16).padStart(2, '0'),
      message[6].toString(16).padStart(2, '0'),
      message[7].toString(16).padStart(2, '0'),
    ].join('-').toUpperCase();

    manufacturerName = EXTENDED_MANUFACTURER_IDS[extendedManufacturerId]
      ?? `Unknown Extended (${extendedManufacturerId})`;
    dataOffset = 8; // Family code starts after 3-byte mfr ID
  } else {
    manufacturerName = MANUFACTURER_IDS[manufacturerId]
      ?? `Unknown (0x${manufacturerId.toString(16)})`;
  }

  // Parse family and member codes (if present)
  let familyCode = 0;
  let memberCode = 0;
  let softwareVersion = 'unknown';

  if (message.length >= dataOffset + 4) {
    familyCode = message[dataOffset] | (message[dataOffset + 1] << 7);
    memberCode = message[dataOffset + 2] | (message[dataOffset + 3] << 7);
  }

  if (message.length >= dataOffset + 8) {
    softwareVersion = `${message[dataOffset + 4]}.${message[dataOffset + 5]}.${message[dataOffset + 6]}.${message[dataOffset + 7]}`;
  }

  return {
    deviceId,
    manufacturerId,
    extendedManufacturerId,
    manufacturerName,
    familyCode,
    memberCode,
    softwareVersion,
    rawMessage: message,
    portName,
  };
}

/** Known device models by extended manufacturer ID */
const KNOWN_DEVICES: Record<string, Record<number, string>> = {
  '00-20-29': { // Novation
    0x0148: 'Launch Control XL',
    0x0103: 'Launchpad',
    0x0113: 'Launchpad Mini',
    0x0120: 'Launchpad Pro',
  },
  '00-20-6B': { // Arturia
    0x0002: 'BeatStep Pro',
    0x0000: 'KeyLab',
    0x0001: 'MiniLab',
  },
  '00-00-33': { // MOTU
    0x0001: 'MIDI Timepiece AV',
  },
};

/**
 * Get a human-readable device name based on manufacturer and model
 */
function getDeviceName(identity: DeviceIdentity): string {
  // Check for Roland devices (single-byte manufacturer ID)
  if (identity.manufacturerId === 0x41) {
    // Roland family code often encodes the model
    const modelName = ROLAND_MODEL_IDS[identity.familyCode] ?? ROLAND_MODEL_IDS[identity.memberCode];
    if (modelName) {
      return `Roland ${modelName}`;
    }
    return `Roland Device (Family: ${identity.familyCode}, Member: ${identity.memberCode})`;
  }

  // Check for extended manufacturer ID devices
  if (identity.extendedManufacturerId) {
    const deviceMap = KNOWN_DEVICES[identity.extendedManufacturerId];
    if (deviceMap) {
      // Try family code first, then member code
      const modelName = deviceMap[identity.familyCode] ?? deviceMap[identity.memberCode];
      if (modelName) {
        return `${identity.manufacturerName} ${modelName}`;
      }
    }
    return `${identity.manufacturerName} Device`;
  }

  return `${identity.manufacturerName} Device`;
}

/**
 * Format bytes as hex string for display
 */
function formatBytes(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

// =============================================================================
// Test State
// =============================================================================

const openPorts: MidiPortPair[] = [];

// =============================================================================
// Tests
// =============================================================================

describe('MIDI Device Discovery', () => {
  afterAll(() => {
    // Clean up all open ports
    for (const pair of openPorts) {
      try {
        pair.input.close();
        pair.output.close();
      } catch {
        // Ignore cleanup errors
      }
    }
    openPorts.length = 0;
  });

  it('should list all available MIDI ports', () => {
    const inputs = easymidi.getInputs();
    const outputs = easymidi.getOutputs();

    console.log('\n══════════════════════════════════════════════════════════════');
    console.log('  MIDI DEVICE DISCOVERY');
    console.log('══════════════════════════════════════════════════════════════\n');

    console.log('Available MIDI Inputs:');
    if (inputs.length === 0) {
      console.log('  (none)');
    } else {
      for (const input of inputs) {
        console.log(`  • ${input}`);
      }
    }

    console.log('\nAvailable MIDI Outputs:');
    if (outputs.length === 0) {
      console.log('  (none)');
    } else {
      for (const output of outputs) {
        console.log(`  • ${output}`);
      }
    }

    console.log('');

    expect(inputs.length + outputs.length).toBeGreaterThan(0);
  });

  it('should discover devices via Identity Request broadcast', { timeout: DISCOVERY_TIMEOUT_MS + 2000 }, async () => {
    const inputs = easymidi.getInputs();
    const outputs = easymidi.getOutputs();

    if (inputs.length === 0 || outputs.length === 0) {
      console.log('⚠️  No MIDI ports available for discovery');
      return;
    }

    const discoveredDevices: DeviceIdentity[] = [];
    const portListeners = new Map<string, (msg: { bytes: number[] }) => void>();

    // Open all input ports and attach listeners
    console.log('Opening MIDI input ports for listening...\n');

    for (const inputName of inputs) {
      try {
        const input = new easymidi.Input(inputName);

        const listener = (msg: { bytes: number[] }): void => {
          console.log(`  [${inputName}] Received: ${formatBytes(msg.bytes)}`);

          const identity = parseIdentityReply(msg.bytes, inputName);
          if (identity) {
            discoveredDevices.push(identity);
            console.log(`  ✓ Identity Reply from: ${getDeviceName(identity)}`);
          }
        };

        input.on('sysex', listener);
        portListeners.set(inputName, listener);

        // Store for cleanup (need output too, but we'll add it when we open outputs)
        openPorts.push({ inputName, outputName: '', input, output: null as unknown as easymidi.Output });

        console.log(`  Listening on: ${inputName}`);
      } catch (error) {
        console.log(`  ⚠️  Could not open input: ${inputName} (${(error as Error).message})`);
      }
    }

    console.log('\nSending Identity Request to all MIDI outputs...\n');
    console.log(`  Request: ${formatBytes(IDENTITY_REQUEST)}\n`);

    // Send Identity Request to all output ports
    for (const outputName of outputs) {
      try {
        const output = new easymidi.Output(outputName);

        // Update the port pair with the output
        const existingPair = openPorts.find((p) => p.inputName === outputName || p.outputName === '');
        if (existingPair && existingPair.outputName === '') {
          existingPair.outputName = outputName;
          existingPair.output = output;
        } else {
          // Create a dummy input for cleanup tracking
          openPorts.push({
            inputName: '',
            outputName,
            input: null as unknown as easymidi.Input,
            output,
          });
        }

        console.log(`  Sending to: ${outputName}`);

        // Send the identity request
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        output.send('sysex', IDENTITY_REQUEST as any);
      } catch (error) {
        console.log(`  ⚠️  Could not send to: ${outputName} (${(error as Error).message})`);
      }
    }

    // Wait for responses
    console.log(`\n  Waiting ${DISCOVERY_TIMEOUT_MS}ms for device responses...\n`);
    await new Promise((resolve) => setTimeout(resolve, DISCOVERY_TIMEOUT_MS));

    // Remove listeners
    for (const pair of openPorts) {
      if (pair.input) {
        const listener = portListeners.get(pair.inputName);
        if (listener) {
          pair.input.removeListener('sysex', listener);
        }
      }
    }

    // Report results
    console.log('══════════════════════════════════════════════════════════════');
    console.log('  DISCOVERY RESULTS');
    console.log('══════════════════════════════════════════════════════════════\n');

    if (discoveredDevices.length === 0) {
      console.log('  No devices responded to Identity Request.\n');
      console.log('  Possible reasons:');
      console.log('  • No MIDI devices connected');
      console.log('  • Connected devices don\'t support Identity Request');
      console.log('  • MIDI routing issue (check cables/connections)');
      console.log('  • Device is on a different MIDI channel or device ID\n');
    } else {
      console.log(`  Found ${discoveredDevices.length} device(s):\n`);

      // De-duplicate devices by raw message + port
      const seen = new Set<string>();
      const uniqueDevices = discoveredDevices.filter((d) => {
        const key = `${d.portName}:${formatBytes(d.rawMessage)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      console.log(`  Found ${uniqueDevices.length} unique device(s):\n`);

      for (const device of uniqueDevices) {
        console.log(`  ┌─────────────────────────────────────────────────────────────`);
        console.log(`  │ ${getDeviceName(device)}`);
        console.log(`  ├─────────────────────────────────────────────────────────────`);
        console.log(`  │ Device ID:     ${device.deviceId} (0x${device.deviceId.toString(16)})`);
        if (device.extendedManufacturerId) {
          console.log(`  │ Manufacturer:  ${device.manufacturerName} (${device.extendedManufacturerId})`);
        } else {
          console.log(`  │ Manufacturer:  ${device.manufacturerName} (0x${device.manufacturerId.toString(16)})`);
        }
        console.log(`  │ Family Code:   ${device.familyCode} (0x${device.familyCode.toString(16)})`);
        console.log(`  │ Member Code:   ${device.memberCode} (0x${device.memberCode.toString(16)})`);
        console.log(`  │ SW Version:    ${device.softwareVersion}`);
        console.log(`  │ Port:          ${device.portName}`);
        console.log(`  │ Raw Response:  ${formatBytes(device.rawMessage)}`);
        console.log(`  └─────────────────────────────────────────────────────────────\n`);
      }
    }

    // Test passes regardless of whether devices were found
    // (The purpose is discovery and reporting, not assertion)
    expect(true).toBe(true);
  });

  it('should scan ALL ports and ALL device IDs for supported devices', { timeout: 120000 }, async () => {
    const inputNames = easymidi.getInputs();
    const outputNames = easymidi.getOutputs();

    // ==========================================================================
    // SUPPORTED DEVICES CONFIGURATION
    // Add new devices here as we expand support
    // ==========================================================================
    interface DeviceConfig {
      name: string;
      manufacturer: 'Roland' | 'Akai';
      manufacturerId: number;
      modelId: number;
      // Function to build a probe message for this device
      buildProbe: (deviceId: number) => number[];
      // Valid response commands for this device
      responseCommands: number[];
    }

    // Roland checksum helper
    const rolandChecksum = (data: number[]): number => {
      let sum = 0;
      for (const byte of data) sum += byte;
      return (0x80 - (sum & 0x7f)) & 0x7f;
    };

    const SUPPORTED_DEVICES: DeviceConfig[] = [
      {
        name: 'Roland D-110',
        manufacturer: 'Roland',
        manufacturerId: 0x41,
        modelId: 0x16,
        responseCommands: [0x12], // DT1
        buildProbe: (deviceId) => {
          // RQ1 for system parameters
          const addr = [0x10, 0x00, 0x00];
          const size = [0x00, 0x00, 0x21];
          const checksum = rolandChecksum([...addr, ...size]);
          return [0xf0, 0x41, deviceId, 0x16, 0x11, ...addr, ...size, checksum, 0xf7];
        },
      },
      {
        name: 'Roland S-330',
        manufacturer: 'Roland',
        manufacturerId: 0x41,
        modelId: 0x1e,
        responseCommands: [0x42, 0x43, 0x4f], // DAT, ACK, RJC
        buildProbe: (deviceId) => {
          // RQD for patch data
          const addr = [0x01, 0x00, 0x00, 0x00];
          const size = [0x00, 0x00, 0x00, 0x10];
          const checksum = rolandChecksum([...addr, ...size]);
          return [0xf0, 0x41, deviceId, 0x1e, 0x41, ...addr, ...size, checksum, 0xf7];
        },
      },
      {
        name: 'Roland JV-1080',
        manufacturer: 'Roland',
        manufacturerId: 0x41,
        modelId: 0x6a,
        responseCommands: [0x12], // DT1
        buildProbe: (deviceId) => {
          // RQ1 for system parameters
          const addr = [0x00, 0x00, 0x00, 0x00];
          const size = [0x00, 0x00, 0x00, 0x40];
          const checksum = rolandChecksum([...addr, ...size]);
          return [0xf0, 0x41, deviceId, 0x6a, 0x11, ...addr, ...size, checksum, 0xf7];
        },
      },
      {
        name: 'Akai S3000XL',
        manufacturer: 'Akai',
        manufacturerId: 0x47, // Akai
        modelId: 0x00, // S3000 series uses function-based ID
        responseCommands: [0x52], // Reply
        buildProbe: (deviceId) => {
          // Request sampler name (function 0x09)
          return [0xf0, 0x47, deviceId, 0x00, 0x48, 0x09, 0xf7];
        },
      },
      {
        name: 'Akai S5000/S6000',
        manufacturer: 'Akai',
        manufacturerId: 0x47,
        modelId: 0x5e, // S5000/S6000 model
        responseCommands: [0x52],
        buildProbe: (deviceId) => {
          // Request device info
          return [0xf0, 0x47, deviceId, 0x5e, 0x48, 0x00, 0xf7];
        },
      },
    ];

    // ==========================================================================
    // DISCOVERED DEVICES
    // ==========================================================================
    interface DiscoveredDevice {
      name: string;
      manufacturer: string;
      deviceId: number;
      modelId: number;
      inputPort: string;
      outputPort: string;
      responseData: number[];
    }

    const discoveredDevices: DiscoveredDevice[] = [];

    console.log(`\n${'═'.repeat(70)}`);
    console.log(`  COMPREHENSIVE DEVICE SCAN`);
    console.log(`  Scanning ${outputNames.length} output ports × 32 device IDs × ${SUPPORTED_DEVICES.length} device types`);
    console.log(`${'═'.repeat(70)}\n`);

    console.log('  Supported devices:');
    for (const dev of SUPPORTED_DEVICES) {
      console.log(`    • ${dev.name} (${dev.manufacturer} model 0x${dev.modelId.toString(16)})`);
    }
    console.log('');

    // ==========================================================================
    // OPEN ALL INPUT PORTS FOR LISTENING
    // ==========================================================================
    const openInputs: Array<{ name: string; port: easymidi.Input }> = [];

    console.log('  Opening input ports...');
    for (const inputName of inputNames) {
      // Skip virtual/software ports that might cause loops
      if (inputName.includes('IAC') || inputName.includes('virtual')) {
        continue;
      }
      try {
        const port = new easymidi.Input(inputName);
        openInputs.push({ name: inputName, port });
      } catch (error) {
        console.log(`    ⚠️  Could not open: ${inputName}`);
      }
    }
    console.log(`    Opened ${openInputs.length} input ports\n`);

    // ==========================================================================
    // SET UP LISTENERS ON ALL INPUT PORTS
    // ==========================================================================
    const listenerMap = new Map<string, (msg: { bytes: number[] }) => void>();

    for (const { name: inputName, port } of openInputs) {
      const listener = (msg: { bytes: number[] }): void => {
        const bytes = msg.bytes;
        if (bytes.length < 5 || bytes[0] !== 0xf0) return;

        const manufacturerId = bytes[1];
        const deviceId = bytes[2];
        const modelId = bytes[3];
        const command = bytes[4];

        // Check against all supported devices
        for (const config of SUPPORTED_DEVICES) {
          if (
            manufacturerId === config.manufacturerId &&
            modelId === config.modelId &&
            config.responseCommands.includes(command)
          ) {
            // Check if we already found this exact device
            const existing = discoveredDevices.find(
              (d) => d.name === config.name && d.deviceId === deviceId && d.inputPort === inputName
            );

            if (!existing) {
              console.log(`  ✓ FOUND: ${config.name} @ Device ID ${deviceId} on ${inputName}`);

              discoveredDevices.push({
                name: config.name,
                manufacturer: config.manufacturer,
                deviceId,
                modelId,
                inputPort: inputName,
                outputPort: '', // Will be determined by which output triggered the response
                responseData: bytes,
              });
            }
            break;
          }
        }
      };

      port.on('sysex', listener);
      listenerMap.set(inputName, listener);
    }

    // ==========================================================================
    // SCAN ALL OUTPUT PORTS
    // ==========================================================================
    const openOutputs: Array<{ name: string; port: easymidi.Output }> = [];

    for (const outputName of outputNames) {
      // Skip virtual/software ports
      if (outputName.includes('IAC') || outputName.includes('virtual')) {
        continue;
      }
      // Skip "All Cables" aggregate ports to avoid duplicates
      if (outputName.includes('All Cables')) {
        continue;
      }
      try {
        const port = new easymidi.Output(outputName);
        openOutputs.push({ name: outputName, port });
      } catch (error) {
        // Silently skip ports we can't open
      }
    }

    console.log(`  Scanning ${openOutputs.length} output ports...\n`);

    for (const { name: outputName, port: output } of openOutputs) {
      console.log(`  📤 ${outputName}`);

      // Scan all 32 device IDs (0x00 - 0x1F)
      for (let deviceId = 0; deviceId <= 0x1f; deviceId++) {
        // Send probe for each supported device type
        for (const config of SUPPORTED_DEVICES) {
          const probe = config.buildProbe(deviceId);
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            output.send('sysex', probe as any);
          } catch {
            // Ignore send errors
          }
        }
      }

      // Wait a bit between ports to collect responses
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Wait for final responses
    console.log('\n  Waiting for final responses...');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // ==========================================================================
    // CLEANUP
    // ==========================================================================
    for (const { name, port } of openInputs) {
      const listener = listenerMap.get(name);
      if (listener) {
        port.removeListener('sysex', listener);
      }
      port.close();
    }

    for (const { port } of openOutputs) {
      port.close();
    }

    // ==========================================================================
    // REPORT RESULTS
    // ==========================================================================
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`  SCAN RESULTS`);
    console.log(`${'═'.repeat(70)}\n`);

    if (discoveredDevices.length === 0) {
      console.log('  No supported devices found.\n');
      console.log('  Troubleshooting:');
      console.log('    • Verify devices are powered on');
      console.log('    • Check MIDI cables (both IN and OUT must be connected)');
      console.log('    • Verify MIDI interface routing');
      console.log('    • Check device ID settings on each device\n');
    } else {
      // Group by device type
      const byDevice = new Map<string, DiscoveredDevice[]>();
      for (const d of discoveredDevices) {
        const list = byDevice.get(d.name) || [];
        list.push(d);
        byDevice.set(d.name, list);
      }

      console.log(`  Found ${discoveredDevices.length} device(s):\n`);

      for (const [, devices] of byDevice) {
        for (const device of devices) {
          console.log(`  ┌${'─'.repeat(68)}`);
          console.log(`  │ ${device.name}`);
          console.log(`  ├${'─'.repeat(68)}`);
          console.log(`  │ Device ID:    ${device.deviceId} (0x${device.deviceId.toString(16)}) [User sees: ${device.deviceId + 1}]`);
          console.log(`  │ Model ID:     0x${device.modelId.toString(16)}`);
          console.log(`  │ Input Port:   ${device.inputPort}`);
          console.log(`  │ Response:     ${formatBytes(device.responseData.slice(0, 30))}${device.responseData.length > 30 ? '...' : ''}`);
          console.log(`  └${'─'.repeat(68)}\n`);
        }
      }

      // Summary table
      console.log('  SUMMARY');
      console.log('  ───────────────────────────────────────────────────────────');
      console.log('  Device              Device ID    Port');
      console.log('  ───────────────────────────────────────────────────────────');
      for (const device of discoveredDevices) {
        const name = device.name.padEnd(20);
        const id = `${device.deviceId}`.padEnd(12);
        console.log(`  ${name}${id}${device.inputPort}`);
      }
      console.log('  ───────────────────────────────────────────────────────────\n');
    }

    expect(true).toBe(true);
  });
});
