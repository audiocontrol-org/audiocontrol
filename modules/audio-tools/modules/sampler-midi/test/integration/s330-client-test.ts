/**
 * Test S330Client implementation with real hardware
 *
 * This test uses easymidi to communicate with the S-330 and validates
 * the client implementation outside of the browser context.
 *
 * Run with: npx tsx test/integration/s330-client-test.ts
 */

import * as easymidi from 'easymidi';

// Import the client and types from s330-editor
// We need to replicate the interface since we can't easily import from the other module
const MIDI_DEVICE = 'Volt 4';

// S330MidiIO interface (matches s330-editor/src/core/midi/types.ts)
type SysExCallback = (message: number[]) => void;

interface S330MidiIO {
  send(message: number[]): void;
  onSysEx(callback: SysExCallback): void;
  removeSysExListener(callback: SysExCallback): void;
}

// Constants from sampler-devices
const ROLAND_ID = 0x41;
const S330_MODEL_ID = 0x1e;
const DEFAULT_DEVICE_ID = 0x00;

const S330_COMMANDS = {
  RQ1: 0x11,
  DT1: 0x12,
  WSD: 0x40,
  RQD: 0x41,
  DAT: 0x42,
  ACK: 0x43,
  EOD: 0x45,
  ERR: 0x4e,
  RJC: 0x4f,
} as const;

const TIMING = {
  ACK_TIMEOUT_MS: 500,
};

const PATCH_COMMON_SIZE = 0x10;
const PARTIAL_SIZE = 0x0b;
const TONE_BLOCK_SIZE = 0x26;
const MAX_PARTIALS = 32;
const MAX_PATCHES = 64;
const MAX_TONES = 32;

// Helper functions
function calculateChecksum(address: number[], data: number[]): number {
  const sum =
    address.reduce((a, b) => a + b, 0) + data.reduce((a, b) => a + b, 0);
  const checksum = 128 - (sum & 0x7f);
  return checksum === 128 ? 0 : checksum;
}

function deNibblize(nibbles: number[]): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < nibbles.length - 1; i += 2) {
    const high = (nibbles[i] & 0x0f) << 4;
    const low = nibbles[i + 1] & 0x0f;
    bytes.push(high | low);
  }
  return bytes;
}

function parseName(data: number[], offset: number, length: number = 8): string {
  let name = '';
  for (let i = 0; i < length; i++) {
    const charCode = data[offset + i];
    if (charCode >= 0x20 && charCode <= 0x7e) {
      name += String.fromCharCode(charCode);
    }
  }
  return name.trim();
}

/**
 * Create an easymidi adapter that implements S330MidiIO
 */
function createEasyMidiAdapter(
  input: easymidi.Input,
  output: easymidi.Output
): S330MidiIO {
  const listeners = new Map<SysExCallback, (data: { bytes: number[] }) => void>();

  return {
    send(message: number[]): void {
      output.send('sysex', message as any);
    },

    onSysEx(callback: SysExCallback): void {
      const listener = (data: { bytes: number[] }) => {
        if (data.bytes[0] === 0xf0) {
          callback(data.bytes);
        }
      };
      listeners.set(callback, listener);
      input.on('sysex', listener);
    },

    removeSysExListener(callback: SysExCallback): void {
      const listener = listeners.get(callback);
      if (listener) {
        input.removeListener('sysex', listener);
        listeners.delete(callback);
      }
    },
  };
}

/**
 * Simplified S330 Client for testing
 * (Replicates the core logic from s330-editor)
 */
function createS330Client(midiIO: S330MidiIO, deviceId: number = DEFAULT_DEVICE_ID) {
  const timeoutMs = TIMING.ACK_TIMEOUT_MS;

  async function requestDataWithAddress(
    address: number[],
    sizeInBytes: number
  ): Promise<number[]> {
    if (address.length !== 4) {
      throw new Error('Address must be 4 bytes');
    }

    if (address[3] & 0x01) {
      throw new Error(`Address LSB must be even (got 0x${address[3].toString(16)})`);
    }

    const sizeInNibbles = sizeInBytes * 2;
    const size = [
      (sizeInNibbles >> 21) & 0x7f,
      (sizeInNibbles >> 14) & 0x7f,
      (sizeInNibbles >> 7) & 0x7f,
      sizeInNibbles & 0x7f,
    ];

    const cs = calculateChecksum(address, size);
    const message = [
      0xf0,
      ROLAND_ID,
      deviceId,
      S330_MODEL_ID,
      S330_COMMANDS.RQD,
      ...address,
      ...size,
      cs,
      0xf7,
    ];

    return new Promise((resolve, reject) => {
      const allNibbles: number[] = [];
      let timeoutId: ReturnType<typeof setTimeout>;

      function resetTimeout() {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          midiIO.removeSysExListener(listener);
          if (allNibbles.length > 0) {
            resolve(deNibblize(allNibbles));
          } else {
            reject(new Error('RQD response timeout'));
          }
        }, timeoutMs * 2);
      }

      function sendAck() {
        const ackMsg = [
          0xf0,
          ROLAND_ID,
          deviceId,
          S330_MODEL_ID,
          S330_COMMANDS.ACK,
          0xf7,
        ];
        midiIO.send(ackMsg);
      }

      function listener(response: number[]) {
        if (response.length < 5) return;
        if (response[1] !== ROLAND_ID) return;
        if (response[3] !== S330_MODEL_ID) return;

        const respDeviceId = response[2];
        const command = response[4];

        if (respDeviceId !== deviceId) {
          if (command === S330_COMMANDS.RJC || command === S330_COMMANDS.ERR) {
            clearTimeout(timeoutId);
            midiIO.removeSysExListener(listener);
            reject(new Error(`Device ID mismatch (${respDeviceId} vs ${deviceId})`));
          }
          return;
        }

        resetTimeout();

        if (command === S330_COMMANDS.DAT) {
          const dataStart = 9;
          const dataEnd = response.length - 2;
          const nibbles = response.slice(dataStart, dataEnd);
          allNibbles.push(...nibbles);
          sendAck();
        } else if (command === S330_COMMANDS.EOD) {
          clearTimeout(timeoutId);
          midiIO.removeSysExListener(listener);
          sendAck();
          resolve(deNibblize(allNibbles));
        } else if (command === S330_COMMANDS.RJC) {
          clearTimeout(timeoutId);
          midiIO.removeSysExListener(listener);
          reject(new Error('RQD rejected'));
        } else if (command === S330_COMMANDS.ERR) {
          clearTimeout(timeoutId);
          midiIO.removeSysExListener(listener);
          reject(new Error('Communication error'));
        }
      }

      resetTimeout();
      midiIO.onSysEx(listener);
      midiIO.send(message);
    });
  }

  return {
    async requestPatchName(patchIndex: number): Promise<string> {
      const address = [0x00, 0x01, patchIndex, 0x00];
      const data = await requestDataWithAddress(address, 8);
      return parseName(data, 0, 8);
    },

    async requestToneName(toneIndex: number): Promise<string> {
      const address = [0x00, 0x02, toneIndex, 0x00];
      const data = await requestDataWithAddress(address, 8);
      return parseName(data, 0, 8);
    },

    async requestAllPatchNames(): Promise<Array<{ index: number; name: string }>> {
      const patches: Array<{ index: number; name: string }> = [];
      for (let i = 0; i < MAX_PATCHES; i++) {
        try {
          const name = await this.requestPatchName(i);
          if (name && name.trim()) {
            patches.push({ index: i, name });
          }
        } catch (err) {
          // Empty slot
        }
      }
      return patches;
    },

    async requestAllToneNames(): Promise<Array<{ index: number; name: string }>> {
      const tones: Array<{ index: number; name: string }> = [];
      for (let i = 0; i < MAX_TONES; i++) {
        try {
          const name = await this.requestToneName(i);
          if (name && name.trim()) {
            tones.push({ index: i, name });
          }
        } catch (err) {
          // Empty slot
        }
      }
      return tones;
    },

    requestDataWithAddress,
  };
}

// =============================================================================
// Test Runner
// =============================================================================

async function main() {
  console.log('=== S330Client Implementation Test ===\n');

  const inputs = easymidi.getInputs();
  const outputs = easymidi.getOutputs();

  const inputName = inputs.find((n) => n.includes(MIDI_DEVICE));
  const outputName = outputs.find((n) => n.includes(MIDI_DEVICE));

  if (!inputName || !outputName) {
    console.error(`ERROR: ${MIDI_DEVICE} not found`);
    console.log('Available inputs:', inputs);
    console.log('Available outputs:', outputs);
    process.exit(1);
  }

  console.log(`Using: ${inputName} / ${outputName}\n`);

  const input = new easymidi.Input(inputName);
  const output = new easymidi.Output(outputName);
  const midiIO = createEasyMidiAdapter(input, output);
  const client = createS330Client(midiIO, DEFAULT_DEVICE_ID);

  // Test 1: Request a single patch name
  console.log('=== Test 1: Request Patch 16 Name ===');
  try {
    const name = await client.requestPatchName(16);
    console.log(`  Patch 16: "${name}"`);
    console.log('  ✓ PASS\n');
  } catch (err) {
    console.log(`  ✗ FAIL: ${err}\n`);
  }

  // Test 2: Request a single tone name
  console.log('=== Test 2: Request Tone 8 Name ===');
  try {
    const name = await client.requestToneName(8);
    console.log(`  Tone 8: "${name}"`);
    console.log('  ✓ PASS\n');
  } catch (err) {
    console.log(`  ✗ FAIL: ${err}\n`);
  }

  // Test 3: Request larger data block (patch common params)
  console.log('=== Test 3: Request Patch 16 Common Params (16 bytes) ===');
  try {
    const data = await client.requestDataWithAddress([0x00, 0x01, 16, 0x00], 16);
    console.log(`  Data length: ${data.length} bytes`);
    console.log(`  Name: "${parseName(data, 0, 8)}"`);
    console.log(`  Bender Range: ${data[8]}`);
    console.log(`  Aftertouch Sens: ${data[9]}`);
    console.log(`  Key Mode: ${data[10]} (0=whole, 1=dual, 2=split)`);
    console.log(`  Level: ${data[15]}`);
    console.log('  ✓ PASS\n');
  } catch (err) {
    console.log(`  ✗ FAIL: ${err}\n`);
  }

  // Test 4: Request tone params
  console.log('=== Test 4: Request Tone 8 Full Params (38 bytes) ===');
  try {
    const data = await client.requestDataWithAddress([0x00, 0x02, 8, 0x00], TONE_BLOCK_SIZE);
    console.log(`  Data length: ${data.length} bytes`);
    console.log(`  Name: "${parseName(data, 0, 8)}"`);
    console.log(`  Original Key: ${data[8]}`);
    console.log(`  Sample Rate: ${data[9] === 0 ? '30kHz' : '15kHz'}`);
    console.log(`  Loop Mode: ${data[19]} (0=fwd, 1=alt, 2=one-shot)`);
    console.log(`  Level: ${data[22]}`);
    console.log('  ✓ PASS\n');
  } catch (err) {
    console.log(`  ✗ FAIL: ${err}\n`);
  }

  // Test 5: Scan for all patches with names
  console.log('=== Test 5: Scan All Patch Names ===');
  console.log('  (This may take a while...)\n');
  try {
    const patches = await client.requestAllPatchNames();
    console.log(`  Found ${patches.length} patches with names:`);
    for (const p of patches) {
      console.log(`    [${p.index.toString().padStart(2)}] "${p.name}"`);
    }
    console.log('  ✓ PASS\n');
  } catch (err) {
    console.log(`  ✗ FAIL: ${err}\n`);
  }

  // Test 6: Scan for all tones with names
  console.log('=== Test 6: Scan All Tone Names ===');
  try {
    const tones = await client.requestAllToneNames();
    console.log(`  Found ${tones.length} tones with names:`);
    for (const t of tones) {
      console.log(`    [${t.index.toString().padStart(2)}] "${t.name}"`);
    }
    console.log('  ✓ PASS\n');
  } catch (err) {
    console.log(`  ✗ FAIL: ${err}\n`);
  }

  // Test 7: Error handling - odd address
  console.log('=== Test 7: Error Handling - Odd Address LSB ===');
  try {
    await client.requestDataWithAddress([0x00, 0x01, 16, 0x01], 8);
    console.log('  ✗ FAIL: Should have thrown\n');
  } catch (err: any) {
    if (err.message.includes('even')) {
      console.log(`  ✓ PASS: Correctly rejected odd address: ${err.message}\n`);
    } else {
      console.log(`  ? UNEXPECTED: ${err.message}\n`);
    }
  }

  console.log('=== All Tests Complete ===');
  input.close();
  output.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
