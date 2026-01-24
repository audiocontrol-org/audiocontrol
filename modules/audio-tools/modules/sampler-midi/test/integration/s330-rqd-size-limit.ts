/**
 * Test RQD size limits - find max requestable range
 *
 * Run with: npx tsx test/integration/s330-rqd-size-limit.ts
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
  console.log('=== S-330 RQD Size Limit Test ===\n');

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

  // Test different size values for patch 16 data
  const addr = [0x00, 0x01, 0x10, 0x00]; // Patch 16, offset 0

  const sizesToTest = [
    0x10,  // 16 - worked before
    0x20,  // 32
    0x40,  // 64
    0x60,  // 96
    0x7F,  // 127
  ];

  console.log('Testing size limits for patch 16 data:\n');

  for (const sizeVal of sizesToTest) {
    const size = [0x00, 0x00, 0x00, sizeVal];
    const cs = checksum([...addr, ...size]);
    const msg = [0xF0, ROLAND, deviceId, MODEL, RQD, ...addr, ...size, cs, 0xF7];

    console.log(`Size 0x${sizeVal.toString(16).padStart(2, '0')}:`);
    output.send('sysex', msg as any);

    const resp = await waitForSysEx(2000);
    if (resp) {
      const cmd = resp[4];
      if (cmd === DAT) {
        console.log(`  ✓ DAT received (${resp.length} bytes)`);
        sendAck();
        // Wait for EOD
        const eod = await waitForSysEx(1000);
        if (eod && eod[4] === EOD) {
          sendAck();
        }
      } else if (cmd === RJC) {
        console.log(`  ✗ RJC - rejected`);
      } else {
        console.log(`  ? ${cmd === 0x45 ? 'EOD' : '0x' + cmd.toString(16)}`);
      }
    } else {
      console.log(`  - Timeout`);
    }

    await new Promise(r => setTimeout(r, 300));
  }

  // Now test requesting multiple patches with different size ranges
  console.log('\n\nTesting multiple patch ranges:\n');

  const patchTests = [
    { addr: [0x00, 0x01, 0x00, 0x00], size: [0x00, 0x00, 0x00, 0x10], desc: 'Patch 0, size 0x10' },
    { addr: [0x00, 0x01, 0x00, 0x00], size: [0x00, 0x00, 0x01, 0x00], desc: 'Patch 0, size 0x0100 (one patch span?)' },
    { addr: [0x00, 0x01, 0x00, 0x00], size: [0x00, 0x00, 0x00, 0x7F], desc: 'Patch 0, size 0x7F' },
  ];

  for (const test of patchTests) {
    const cs = checksum([...test.addr, ...test.size]);
    const msg = [0xF0, ROLAND, deviceId, MODEL, RQD, ...test.addr, ...test.size, cs, 0xF7];

    console.log(`${test.desc}:`);
    console.log(`  TX: ${hex(msg)}`);
    output.send('sysex', msg as any);

    let packets = 0;
    let totalBytes = 0;
    let done = false;

    while (!done) {
      const resp = await waitForSysEx(2000);
      if (!resp) {
        console.log(`  Timeout after ${packets} packets`);
        break;
      }

      const cmd = resp[4];
      if (cmd === DAT) {
        packets++;
        totalBytes += resp.length;
        sendAck();
      } else if (cmd === EOD) {
        sendAck();
        done = true;
      } else if (cmd === RJC) {
        console.log(`  RJC - rejected`);
        done = true;
      } else {
        console.log(`  Unexpected: 0x${cmd.toString(16)}`);
        done = true;
      }
    }

    if (packets > 0) {
      console.log(`  ✓ ${packets} packets, ${totalBytes} total bytes`);
    }

    await new Promise(r => setTimeout(r, 300));
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
