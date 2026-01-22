/**
 * Test RQD with proper address range interpretation
 *
 * Address = starting memory offset
 * Size = address range from that offset
 *
 * Run with: npx tsx test/integration/s330-rqd-address-range.ts
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
const ERR = 0x4E;
const RJC = 0x4F;

function hex(arr: number[]): string {
  return arr.map(b => b.toString(16).padStart(2, '0')).join(' ');
}

function cmdName(cmd: number): string {
  switch (cmd) {
    case DAT: return 'DAT';
    case ACK: return 'ACK';
    case EOD: return 'EOD';
    case RJC: return 'RJC';
    case ERR: return 'ERR';
    default: return `0x${cmd.toString(16)}`;
  }
}

function checksum(data: number[]): number {
  const sum = data.reduce((a, b) => a + b, 0);
  return (128 - (sum & 0x7F)) & 0x7F;
}

async function main() {
  console.log('=== S-330 RQD Address Range Test ===\n');

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

  function waitForSysEx(timeout = 3000): Promise<number[] | null> {
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

  async function testRQD(desc: string, addr: number[], size: number[], maxPackets = 100): Promise<void> {
    console.log(`\n=== ${desc} ===`);
    console.log(`Address: ${hex(addr)}, Size: ${hex(size)}`);

    const cs = checksum([...addr, ...size]);
    const msg = [0xF0, ROLAND, deviceId, MODEL, RQD, ...addr, ...size, cs, 0xF7];
    console.log(`TX: ${hex(msg)}`);
    output.send('sysex', msg as any);

    const packets: number[][] = [];
    let done = false;

    while (!done && packets.length < maxPackets) {
      const resp = await waitForSysEx(2000);
      if (!resp) {
        console.log(`  Timeout after ${packets.length} packets`);
        break;
      }

      const cmd = resp[4];
      if (cmd === DAT) {
        packets.push(resp);
        if (packets.length <= 5 || packets.length % 20 === 0) {
          console.log(`  Packet ${packets.length}: ${resp.length} bytes`);
        }
        sendAck();
      } else if (cmd === EOD) {
        console.log(`  EOD received`);
        sendAck();
        done = true;
      } else if (cmd === RJC) {
        console.log(`  RJC - rejected`);
        done = true;
      } else if (cmd === ERR) {
        console.log(`  ERR - error`);
        done = true;
      }
    }

    if (packets.length > 0) {
      let totalBytes = 0;
      for (const pkt of packets) {
        totalBytes += pkt.length - 11; // Subtract header overhead
      }
      console.log(`  Total: ${packets.length} packets, ~${totalBytes} data bytes`);
    }
  }

  // Test 1: All 32 patches (address range 00-1F for patch number)
  // Patches are at 00 01 pp oo, so range from 00 01 00 00 to 00 01 1F 7F
  await testRQD(
    'All 32 Patches (range 00-1F)',
    [0x00, 0x01, 0x00, 0x00],  // Start: patch 0, offset 0
    [0x00, 0x00, 0x1F, 0x7F],  // Range: through patch 31, offset 127
    200
  );

  await new Promise(r => setTimeout(r, 500));

  // Test 2: All 32 tones (address range 00-1F for tone number)
  // Tones are at 00 02 tt oo
  await testRQD(
    'All 32 Tones (range 00-1F)',
    [0x00, 0x02, 0x00, 0x00],  // Start: tone 0, offset 0
    [0x00, 0x00, 0x1F, 0x7F],  // Range: through tone 31, offset 127
    200
  );

  await new Promise(r => setTimeout(r, 500));

  // Test 3: Single patch (patch 16 full data)
  await testRQD(
    'Single Patch 16 (full data)',
    [0x00, 0x01, 0x10, 0x00],  // Start: patch 16, offset 0
    [0x00, 0x00, 0x00, 0x7F],  // Range: full offset range within patch
    50
  );

  await new Promise(r => setTimeout(r, 500));

  // Test 4: Single tone (tone 8 = RHODES)
  await testRQD(
    'Single Tone 8 (RHODES)',
    [0x00, 0x02, 0x08, 0x00],  // Start: tone 8, offset 0
    [0x00, 0x00, 0x00, 0x7F],  // Range: full offset range within tone
    50
  );

  await new Promise(r => setTimeout(r, 500));

  // Test 5: System parameters
  await testRQD(
    'System Parameters',
    [0x00, 0x00, 0x00, 0x00],  // Start: system area
    [0x00, 0x00, 0x00, 0x0F],  // Range: first 16 offsets
    10
  );

  console.log('\n=== Done ===');
  input.close();
  output.close();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
