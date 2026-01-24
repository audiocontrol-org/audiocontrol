/**
 * Test RQD with proper address and size format
 *
 * RQD format (from docs):
 *   F0 41 dev MDL 41 [address] [size] [checksum] F7
 *
 * Same as RQ1, but uses handshake protocol (DAT + ACK)
 *
 * Run with: npx tsx test/integration/s330-rqd-with-address.ts
 */

import * as easymidi from 'easymidi';

const MIDI_DEVICE = 'Volt 4';
const ROLAND = 0x41;
const MODEL = 0x1E;
const deviceId = 0x00;

const RQ1 = 0x11;
const RQD = 0x41;
const DT1 = 0x12;
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
    case DT1: return 'DT1';
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

function denibblize(data: number[]): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length - 1; i += 2) {
    const hi = data[i] & 0x0F;
    const lo = data[i + 1] & 0x0F;
    result.push((hi << 4) | lo);
  }
  return result;
}

function bytesToString(bytes: number[]): string {
  return bytes.map(b => b >= 0x20 && b < 0x7F ? String.fromCharCode(b) : '.').join('');
}

async function main() {
  console.log('=== S-330 RQD with Address/Size Test ===\n');

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

  // Test 1: RQD for Patch 16 name (same address we used with RQ1)
  console.log('=== TEST 1: RQD for Patch 16 Name ===');
  console.log('Address: 00 01 10 00, Size: 00 00 00 10 (16 bytes = 8 char name nibblized)');
  {
    const addr = [0x00, 0x01, 0x10, 0x00];
    const size = [0x00, 0x00, 0x00, 0x10];
    const cs = checksum([...addr, ...size]);
    const msg = [0xF0, ROLAND, deviceId, MODEL, RQD, ...addr, ...size, cs, 0xF7];

    console.log(`TX: ${hex(msg)}`);
    output.send('sysex', msg as any);

    // Collect responses with handshake
    let done = false;
    const packets: number[][] = [];

    while (!done) {
      const resp = await waitForSysEx(2000);
      if (!resp) {
        console.log('  Timeout');
        break;
      }

      const cmd = resp[4];
      console.log(`RX: ${hex(resp.slice(0, 25))}${resp.length > 25 ? '...' : ''} (${cmdName(cmd)}, len=${resp.length})`);

      if (cmd === DAT) {
        packets.push(resp);
        console.log('  Sending ACK...');
        sendAck();
      } else if (cmd === DT1) {
        // RQD might return DT1 instead of DAT for small requests?
        packets.push(resp);
        done = true;
      } else if (cmd === EOD) {
        sendAck();
        done = true;
      } else if (cmd === RJC || cmd === ERR) {
        done = true;
      }
    }

    if (packets.length > 0) {
      console.log(`\n  Received ${packets.length} packet(s)`);
      // Parse the data
      const pkt = packets[0];
      const dataStart = 5 + 4; // header + address
      const dataEnd = pkt.length - 2; // before checksum + F7
      const nibblizedData = pkt.slice(dataStart, dataEnd);
      const decoded = denibblize(nibblizedData);
      console.log(`  Decoded: "${bytesToString(decoded)}"`);
    }
  }

  await new Promise(r => setTimeout(r, 500));

  // Test 2: RQD for ALL patches (large request to test handshake)
  console.log('\n=== TEST 2: RQD for All Patch Parameters ===');
  console.log('Address: 00 01 00 00, Size: 00 01 7F 7F (all patch memory)');
  {
    // Request all patches: start at 00 01 00 00, size covers all 64 patches
    // Each patch is about 368 bytes (16 common + 32*11 partials)
    const addr = [0x00, 0x01, 0x00, 0x00];
    const size = [0x00, 0x01, 0x7F, 0x7F]; // Large size to get all patches
    const cs = checksum([...addr, ...size]);
    const msg = [0xF0, ROLAND, deviceId, MODEL, RQD, ...addr, ...size, cs, 0xF7];

    console.log(`TX: ${hex(msg)}`);
    output.send('sysex', msg as any);

    // Collect responses with handshake (limit to 50 packets for testing)
    let done = false;
    const packets: number[][] = [];
    const maxPackets = 50;

    while (!done && packets.length < maxPackets) {
      const resp = await waitForSysEx(2000);
      if (!resp) {
        console.log('  Timeout after', packets.length, 'packets');
        break;
      }

      const cmd = resp[4];
      if (cmd === DAT) {
        packets.push(resp);
        if (packets.length % 10 === 0 || packets.length < 5) {
          console.log(`  Packet ${packets.length}: ${resp.length} bytes`);
        }
        sendAck();
      } else if (cmd === DT1) {
        packets.push(resp);
        console.log(`  Got DT1 with ${resp.length} bytes`);
        done = true;
      } else if (cmd === EOD) {
        console.log('  EOD received');
        sendAck();
        done = true;
      } else if (cmd === RJC) {
        console.log('  RJC - rejected');
        done = true;
      } else if (cmd === ERR) {
        console.log('  ERR - error');
        done = true;
      } else {
        console.log(`  Unexpected: ${cmdName(cmd)}`);
      }
    }

    console.log(`\n  Total packets received: ${packets.length}`);

    if (packets.length > 0) {
      // Combine and analyze data
      let totalBytes = 0;
      for (const pkt of packets) {
        const dataStart = 5 + 4;
        const dataEnd = pkt.length - 2;
        totalBytes += dataEnd - dataStart;
      }
      console.log(`  Total nibblized bytes: ${totalBytes}`);
      console.log(`  Decoded bytes: ~${Math.floor(totalBytes / 2)}`);
    }
  }

  await new Promise(r => setTimeout(r, 500));

  // Test 3: Compare RQ1 vs RQD for same request
  console.log('\n=== TEST 3: Compare RQ1 vs RQD for Patch 16 Name ===');
  {
    const addr = [0x00, 0x01, 0x10, 0x00];
    const size = [0x00, 0x00, 0x00, 0x10];
    const cs = checksum([...addr, ...size]);

    // RQ1
    console.log('\nRQ1:');
    const rq1Msg = [0xF0, ROLAND, deviceId, MODEL, RQ1, ...addr, ...size, cs, 0xF7];
    console.log(`TX: ${hex(rq1Msg)}`);
    output.send('sysex', rq1Msg as any);

    const rq1Resp = await waitForSysEx(2000);
    if (rq1Resp) {
      console.log(`RX: ${hex(rq1Resp.slice(0, 25))}... (${cmdName(rq1Resp[4])}, len=${rq1Resp.length})`);
    } else {
      console.log('  No response');
    }

    await new Promise(r => setTimeout(r, 300));

    // RQD
    console.log('\nRQD:');
    const rqdMsg = [0xF0, ROLAND, deviceId, MODEL, RQD, ...addr, ...size, cs, 0xF7];
    console.log(`TX: ${hex(rqdMsg)}`);
    output.send('sysex', rqdMsg as any);

    const rqdResp = await waitForSysEx(2000);
    if (rqdResp) {
      console.log(`RX: ${hex(rqdResp.slice(0, 25))}... (${cmdName(rqdResp[4])}, len=${rqdResp.length})`);
      if (rqdResp[4] === DAT) {
        console.log('  Sending ACK...');
        sendAck();
        // Wait for EOD or more data
        const next = await waitForSysEx(1000);
        if (next) {
          console.log(`RX: ${hex(next)} (${cmdName(next[4])})`);
          if (next[4] === EOD) sendAck();
        }
      }
    } else {
      console.log('  No response');
    }
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
