/**
 * Test RQD size field boundary - find exactly where rejection starts
 *
 * Previous findings:
 *   Size 0x60: works
 *   Size 0x7F: rejected
 *   Size 0x0100: works (!)
 *
 * This is strange - why does 0x7F fail but 0x0100 work?
 * Let's test the boundary more precisely.
 *
 * Run with: npx tsx test/integration/s330-rqd-size-boundary.ts
 */

import * as easymidi from 'easymidi';

const MIDI_DEVICE = 'Volt 4';
const ROLAND = 0x41;
const MODEL = 0x1E;
const deviceId = 0x00;

const RQD = 0x41;
const DAT = 0x42;
const ACK = 0x43;
const EOD = 0x45;
const RJC = 0x4F;

function hex(arr: number[]): string {
  return arr.map(b => b.toString(16).padStart(2, '0')).join(' ');
}

function checksum(data: number[]): number {
  const sum = data.reduce((a, b) => a + b, 0);
  return (128 - (sum & 0x7F)) & 0x7F;
}

async function main() {
  console.log('=== S-330 RQD Size Boundary Test ===\n');

  const inputs = easymidi.getInputs();
  const outputs = easymidi.getOutputs();

  const inputName = inputs.find(n => n.includes(MIDI_DEVICE));
  const outputName = outputs.find(n => n.includes(MIDI_DEVICE));

  if (!inputName || !outputName) {
    console.error(`ERROR: ${MIDI_DEVICE} not found`);
    process.exit(1);
  }

  console.log(`Using: ${inputName} / ${outputName}\n`);

  const input = new easymidi.Input(inputName);
  const output = new easymidi.Output(outputName);

  function waitForSysEx(timeout = 2000): Promise<number[] | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        input.removeListener('sysex', listener);
        resolve(null);
      }, timeout);

      function listener(data: { bytes: number[] }) {
        if (data.bytes[0] === 0xF0) {
          clearTimeout(timer);
          input.removeListener('sysex', listener);
          resolve(data.bytes);
        }
      }

      input.on('sysex', listener);
    });
  }

  function sendAck() {
    const msg = [0xF0, ROLAND, deviceId, MODEL, ACK, 0xF7];
    output.send('sysex', msg as any);
  }

  async function testSize(addr: number[], size: number[]): Promise<string> {
    const cs = checksum([...addr, ...size]);
    const msg = [0xF0, ROLAND, deviceId, MODEL, RQD, ...addr, ...size, cs, 0xF7];

    output.send('sysex', msg as any);

    const resp = await waitForSysEx(2000);
    if (!resp) return 'timeout';

    const cmd = resp[4];
    if (cmd === DAT) {
      sendAck();
      // Collect remaining packets
      let packets = 1;
      let totalBytes = resp.length;
      while (true) {
        const next = await waitForSysEx(1000);
        if (!next) break;
        if (next[4] === EOD) {
          sendAck();
          break;
        }
        if (next[4] === DAT) {
          packets++;
          totalBytes += next.length;
          sendAck();
        }
      }
      return `OK (${packets} pkt, ${totalBytes} bytes)`;
    }
    if (cmd === RJC) return 'RJC';
    if (cmd === EOD) {
      sendAck();
      return 'EOD (empty)';
    }
    return `0x${cmd.toString(16)}`;
  }

  const addr = [0x00, 0x01, 0x10, 0x00]; // Patch 16, offset 0

  // Test 1: Find exact boundary between 0x60 and 0x7F
  console.log('=== Test 1: Finding boundary between 0x60 and 0x7F ===\n');
  const boundaryTests = [0x61, 0x62, 0x64, 0x68, 0x70, 0x78, 0x7C, 0x7E, 0x7F];

  for (const sizeVal of boundaryTests) {
    const size = [0x00, 0x00, 0x00, sizeVal];
    const result = await testSize(addr, size);
    console.log(`Size [00 00 00 ${sizeVal.toString(16).padStart(2, '0')}]: ${result}`);
    await new Promise(r => setTimeout(r, 200));
  }

  // Test 2: Multi-byte size values around 0x80
  console.log('\n=== Test 2: Multi-byte size values ===\n');
  const multiByteTests = [
    { size: [0x00, 0x00, 0x00, 0x7F], desc: '00 00 00 7F (127)' },
    { size: [0x00, 0x00, 0x01, 0x00], desc: '00 00 01 00 (128 in 7-bit?)' },
    { size: [0x00, 0x00, 0x00, 0x80], desc: '00 00 00 80 (128 - invalid MIDI?)' },
    { size: [0x00, 0x00, 0x01, 0x01], desc: '00 00 01 01' },
    { size: [0x00, 0x00, 0x01, 0x7F], desc: '00 00 01 7F' },
    { size: [0x00, 0x00, 0x02, 0x00], desc: '00 00 02 00' },
  ];

  for (const test of multiByteTests) {
    const result = await testSize(addr, test.size);
    console.log(`Size [${test.desc}]: ${result}`);
    await new Promise(r => setTimeout(r, 200));
  }

  // Test 3: Is 0x7F special? Test requesting exactly one less
  console.log('\n=== Test 3: Offset variations with size 0x7F ===\n');

  // Maybe 0x7F only fails for certain addresses?
  const offsetTests = [
    { addr: [0x00, 0x01, 0x00, 0x00], desc: 'Patch 0, offset 0' },
    { addr: [0x00, 0x01, 0x10, 0x00], desc: 'Patch 16, offset 0' },
    { addr: [0x00, 0x02, 0x00, 0x00], desc: 'Tone 0, offset 0' },
    { addr: [0x00, 0x02, 0x08, 0x00], desc: 'Tone 8, offset 0' },
  ];

  for (const test of offsetTests) {
    const size = [0x00, 0x00, 0x00, 0x7F];
    const result = await testSize(test.addr, size);
    console.log(`${test.desc} + size 7F: ${result}`);
    await new Promise(r => setTimeout(r, 200));
  }

  // Test 4: What if the size would go past available data?
  console.log('\n=== Test 4: Size relative to data available ===\n');

  // Patch data is probably ~0x60 bytes (16 common + 32*11 partials = 368, but nibblized?)
  // Let's see what happens with different starting offsets
  const relativeTests = [
    { addr: [0x00, 0x01, 0x10, 0x00], size: [0x00, 0x00, 0x00, 0x60], desc: 'Patch 16 offset 0, size 0x60' },
    { addr: [0x00, 0x01, 0x10, 0x10], size: [0x00, 0x00, 0x00, 0x60], desc: 'Patch 16 offset 0x10, size 0x60' },
    { addr: [0x00, 0x01, 0x10, 0x20], size: [0x00, 0x00, 0x00, 0x60], desc: 'Patch 16 offset 0x20, size 0x60' },
    { addr: [0x00, 0x01, 0x10, 0x40], size: [0x00, 0x00, 0x00, 0x40], desc: 'Patch 16 offset 0x40, size 0x40' },
  ];

  for (const test of relativeTests) {
    const result = await testSize(test.addr, test.size);
    console.log(`${test.desc}: ${result}`);
    await new Promise(r => setTimeout(r, 200));
  }

  // Test 5: Request crossing patch boundary
  console.log('\n=== Test 5: Crossing entity boundaries ===\n');

  // What happens if we request data that spans multiple patches?
  const crossingTests = [
    { addr: [0x00, 0x01, 0x10, 0x00], size: [0x00, 0x00, 0x01, 0x00], desc: 'Patch 16, range 0x100 (into patch 17?)' },
    { addr: [0x00, 0x01, 0x1F, 0x00], size: [0x00, 0x00, 0x01, 0x00], desc: 'Patch 31, range 0x100 (last patch)' },
    { addr: [0x00, 0x01, 0x00, 0x00], size: [0x00, 0x00, 0x10, 0x00], desc: 'Patch 0, range 0x1000 (many patches)' },
  ];

  for (const test of crossingTests) {
    const result = await testSize(test.addr, test.size);
    console.log(`${test.desc}: ${result}`);
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n=== Done ===');
  input.close();
  output.close();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
