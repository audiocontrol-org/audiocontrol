/**
 * Exploratory test for S-330 RQ1/RQD parameter requests
 *
 * Run with: npx tsx test/integration/s330-rq1-explore.ts
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
const RJC = 0x4F;
const ERR = 0x4E;

function hex(arr: number[]): string {
  return arr.map(b => b.toString(16).padStart(2, '0')).join(' ');
}

// De-nibblize: each pair of bytes (HI, LO) becomes one byte
function denibblize(data: number[]): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i += 2) {
    const hi = data[i] & 0x0F;
    const lo = data[i + 1] & 0x0F;
    result.push((hi << 4) | lo);
  }
  return result;
}

function bytesToString(bytes: number[]): string {
  return bytes.map(b => b >= 0x20 && b < 0x7F ? String.fromCharCode(b) : '.').join('');
}

function checksum(data: number[]): number {
  return (128 - data.reduce((a, b) => a + b, 0) % 128) % 128;
}

function cmdName(cmd: number): string {
  switch (cmd) {
    case DT1: return 'DT1';
    case DAT: return 'DAT';
    case ACK: return 'ACK';
    case RJC: return 'RJC';
    case ERR: return 'ERR';
    default: return `0x${cmd.toString(16)}`;
  }
}

async function main() {
  console.log('=== S-330 RQ1/RQD Exploratory Test ===\n');

  const inputs = easymidi.getInputs();
  const outputs = easymidi.getOutputs();

  console.log('Available inputs:', inputs);
  console.log('Available outputs:', outputs);

  const inputName = inputs.find(n => n.includes(MIDI_DEVICE));
  const outputName = outputs.find(n => n.includes(MIDI_DEVICE));

  if (!inputName || !outputName) {
    console.error(`ERROR: ${MIDI_DEVICE} not found`);
    process.exit(1);
  }

  console.log(`\nUsing: ${inputName} / ${outputName}\n`);

  const input = new easymidi.Input(inputName);
  const output = new easymidi.Output(outputName);

  function sendAndWait(msg: number[], timeout = 3000): Promise<number[] | null> {
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
      console.log(`TX: ${hex(msg)}`);
      output.send('sysex', msg as any);
    });
  }

  // Test 1: RQ1 for Patch 0 Name (address 00 01 00 00, size 16 bytes = 8 chars nibblized)
  console.log('\n=== TEST 1: RQ1 - Patch 0 Name (requesting 16 nibblized bytes) ===');
  {
    const addr = [0x00, 0x01, 0x00, 0x00];
    const size = [0x00, 0x00, 0x00, 0x10];  // 16 bytes for nibblized name
    const cs = checksum([...addr, ...size]);
    const msg = [0xF0, ROLAND, deviceId, MODEL, RQ1, ...addr, ...size, cs, 0xF7];

    const resp = await sendAndWait(msg);
    if (resp) {
      console.log(`RX: ${hex(resp)} (${cmdName(resp[4])}, len=${resp.length})`);
      if (resp[4] === DT1 && resp.length > 10) {
        const dataStart = 5 + 4; // skip header + address
        const dataEnd = resp.length - 2; // before checksum + F7
        const nibblizedBytes = resp.slice(dataStart, dataEnd);
        const nameBytes = denibblize(nibblizedBytes);
        console.log(`Patch 0 name: "${bytesToString(nameBytes)}" (raw: ${hex(nibblizedBytes)})`);
      }
    } else {
      console.log('No response (timeout)');
    }
  }

  await new Promise(r => setTimeout(r, 300));

  // Test 2: RQ1 for Patch 1 Name (address 00 01 01 00, size 16)
  console.log('\n=== TEST 2: RQ1 - Patch 1 Name ===');
  {
    const addr = [0x00, 0x01, 0x01, 0x00];
    const size = [0x00, 0x00, 0x00, 0x10];
    const cs = checksum([...addr, ...size]);
    const msg = [0xF0, ROLAND, deviceId, MODEL, RQ1, ...addr, ...size, cs, 0xF7];

    const resp = await sendAndWait(msg);
    if (resp) {
      console.log(`RX: ${hex(resp)} (${cmdName(resp[4])}, len=${resp.length})`);
      if (resp[4] === DT1 && resp.length > 10) {
        const dataStart = 5 + 4;
        const dataEnd = resp.length - 2;
        const nibblizedBytes = resp.slice(dataStart, dataEnd);
        const nameBytes = denibblize(nibblizedBytes);
        console.log(`Patch 1 name: "${bytesToString(nameBytes)}" (raw: ${hex(nibblizedBytes)})`);
      }
    } else {
      console.log('No response (timeout)');
    }
  }

  await new Promise(r => setTimeout(r, 300));

  // Test 3: RQ1 for Tone 0 Name (address 00 02 00 00, size 16)
  console.log('\n=== TEST 3: RQ1 - Tone 0 Name ===');
  {
    const addr = [0x00, 0x02, 0x00, 0x00];
    const size = [0x00, 0x00, 0x00, 0x10];
    const cs = checksum([...addr, ...size]);
    const msg = [0xF0, ROLAND, deviceId, MODEL, RQ1, ...addr, ...size, cs, 0xF7];

    const resp = await sendAndWait(msg);
    if (resp) {
      console.log(`RX: ${hex(resp)} (${cmdName(resp[4])}, len=${resp.length})`);
      if (resp[4] === DT1 && resp.length > 10) {
        const dataStart = 5 + 4;
        const dataEnd = resp.length - 2;
        const nibblizedBytes = resp.slice(dataStart, dataEnd);
        const nameBytes = denibblize(nibblizedBytes);
        console.log(`Tone 0 name: "${bytesToString(nameBytes)}" (raw: ${hex(nibblizedBytes)})`);
      }
    } else {
      console.log('No response (timeout)');
    }
  }

  await new Promise(r => setTimeout(r, 300));

  // Test 4: RQ1 for System Master Tune (address 00 00 00 00, size 1)
  console.log('\n=== TEST 4: RQ1 - System Master Tune ===');
  {
    const addr = [0x00, 0x00, 0x00, 0x00];
    const size = [0x00, 0x00, 0x00, 0x01];
    const cs = checksum([...addr, ...size]);
    const msg = [0xF0, ROLAND, deviceId, MODEL, RQ1, ...addr, ...size, cs, 0xF7];

    const resp = await sendAndWait(msg);
    if (resp) {
      console.log(`RX: ${hex(resp)} (${cmdName(resp[4])}, len=${resp.length})`);
    } else {
      console.log('No response (timeout)');
    }
  }

  await new Promise(r => setTimeout(r, 300));

  // Test 5: RQD with address (experimental) - also try 16 bytes
  console.log('\n=== TEST 5: RQD with address (experimental) ===');
  {
    const addr = [0x00, 0x01, 0x00, 0x00];
    const size = [0x00, 0x00, 0x00, 0x10];
    const cs = checksum([...addr, ...size]);
    const msg = [0xF0, ROLAND, deviceId, MODEL, RQD, ...addr, ...size, cs, 0xF7];

    const resp = await sendAndWait(msg);
    if (resp) {
      console.log(`RX: ${hex(resp)} (${cmdName(resp[4])}, len=${resp.length})`);
      if ((resp[4] === DAT || resp[4] === DT1) && resp.length > 10) {
        const dataStart = 5 + 4;
        const dataEnd = resp.length - 2;
        const nibblizedBytes = resp.slice(dataStart, dataEnd);
        const nameBytes = denibblize(nibblizedBytes);
        console.log(`RQD Patch 0 name: "${bytesToString(nameBytes)}"`);
      }
    } else {
      console.log('No response (timeout)');
    }
  }

  await new Promise(r => setTimeout(r, 300));

  // Test 6: Request ALL 32 patches with de-nibblization (name is 8 chars = 16 nibblized bytes)
  console.log('\n=== TEST 6: Request Patches 0-31 Names (16 bytes = 8 chars nibblized) ===');
  for (let p = 0; p < 32; p++) {
    const addr = [0x00, 0x01, p, 0x00];
    const size = [0x00, 0x00, 0x00, 0x10];  // 16 bytes for 8-char name nibblized
    const cs = checksum([...addr, ...size]);
    const msg = [0xF0, ROLAND, deviceId, MODEL, RQ1, ...addr, ...size, cs, 0xF7];

    const resp = await sendAndWait(msg, 1000);
    if (resp && resp[4] === DT1 && resp.length > 10) {
      const dataStart = 5 + 4;  // header + 4-byte address
      const dataEnd = resp.length - 2;  // before checksum + F7
      const nibblizedBytes = resp.slice(dataStart, dataEnd);
      const nameBytes = denibblize(nibblizedBytes);
      const name = bytesToString(nameBytes);
      console.log(`Patch ${p.toString().padStart(2)}: "${name}" (raw: ${hex(nibblizedBytes.slice(0, 8))}...)`);
    } else if (resp) {
      console.log(`Patch ${p.toString().padStart(2)}: ${cmdName(resp[4])}`);
    } else {
      console.log(`Patch ${p.toString().padStart(2)}: timeout`);
    }
    await new Promise(r => setTimeout(r, 150));  // More delay between requests
  }

  // Test 7: Request ALL 32 tones with de-nibblization
  console.log('\n=== TEST 7: Request Tones 0-31 Names (16 bytes = 8 chars nibblized) ===');
  for (let t = 0; t < 32; t++) {
    const addr = [0x00, 0x02, t, 0x00];
    const size = [0x00, 0x00, 0x00, 0x10];  // 16 bytes for 8-char name nibblized
    const cs = checksum([...addr, ...size]);
    const msg = [0xF0, ROLAND, deviceId, MODEL, RQ1, ...addr, ...size, cs, 0xF7];

    const resp = await sendAndWait(msg, 1000);
    if (resp && resp[4] === DT1 && resp.length > 10) {
      const dataStart = 5 + 4;
      const dataEnd = resp.length - 2;
      const nibblizedBytes = resp.slice(dataStart, dataEnd);
      const nameBytes = denibblize(nibblizedBytes);
      const name = bytesToString(nameBytes);
      console.log(`Tone ${t.toString().padStart(2)}: "${name}" (raw: ${hex(nibblizedBytes.slice(0, 8))}...)`);
    } else if (resp) {
      console.log(`Tone ${t.toString().padStart(2)}: ${cmdName(resp[4])}`);
    } else {
      console.log(`Tone ${t.toString().padStart(2)}: timeout`);
    }
    await new Promise(r => setTimeout(r, 150));
  }

  console.log('\n=== Done ===');
  input.close();
  output.close();
  process.exit(0);
}

main().catch(console.error);
