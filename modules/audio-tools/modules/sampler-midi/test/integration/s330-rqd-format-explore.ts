/**
 * Exploratory test for S-330 RQD message format variations
 *
 * Testing different RQD formats to find what the S-330 accepts.
 *
 * Run with: npx tsx test/integration/s330-rqd-format-explore.ts
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

async function main() {
  console.log('=== S-330 RQD Format Exploration ===\n');

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

  function sendAck() {
    const msg = [0xF0, ROLAND, deviceId, MODEL, ACK, 0xF7];
    console.log(`TX ACK: ${hex(msg)}`);
    output.send('sysex', msg as any);
  }

  // Test various RQD formats

  // Format 1: RQD type checksum (what I was doing)
  // F0 41 00 1E 41 01 7F F7
  console.log('\n=== TEST 1: RQD with checksum (type 0x01 = All Tones) ===');
  console.log('Format: F0 41 dev 1E 41 type checksum F7');
  {
    const type = 0x01;
    const cs = (128 - type) & 0x7F;
    const msg = [0xF0, ROLAND, deviceId, MODEL, RQD, type, cs, 0xF7];
    const resp = await sendAndWait(msg);
    if (resp) {
      console.log(`RX: ${hex(resp)} (${cmdName(resp[4])})`);
    } else {
      console.log('No response');
    }
  }

  await new Promise(r => setTimeout(r, 500));

  // Format 2: RQD type only (no checksum)
  // F0 41 00 1E 41 01 F7
  console.log('\n=== TEST 2: RQD without checksum (type 0x01) ===');
  console.log('Format: F0 41 dev 1E 41 type F7');
  {
    const msg = [0xF0, ROLAND, deviceId, MODEL, RQD, 0x01, 0xF7];
    const resp = await sendAndWait(msg);
    if (resp) {
      console.log(`RX: ${hex(resp)} (${cmdName(resp[4])})`);
    } else {
      console.log('No response');
    }
  }

  await new Promise(r => setTimeout(r, 500));

  // Format 3: Single tone request (from docs example)
  // F0 41 00 1E 41 03 00 F7 (type 03 = single tone, 00 = tone number)
  console.log('\n=== TEST 3: Single Tone request (from docs) ===');
  console.log('Format: F0 41 dev 1E 41 03 toneNum F7');
  {
    const msg = [0xF0, ROLAND, deviceId, MODEL, RQD, 0x03, 0x08, 0xF7]; // Tone 8 = RHODES
    const resp = await sendAndWait(msg);
    if (resp) {
      console.log(`RX: ${hex(resp.slice(0, 20))}${resp.length > 20 ? '...' : ''} (${cmdName(resp[4])}, len=${resp.length})`);
      if (resp[4] === ACK) {
        console.log('Got ACK! Waiting for DAT...');
        const dat = await sendAndWait([], 5000); // Just wait, don't send
        if (dat) {
          console.log(`RX: ${hex(dat.slice(0, 20))}${dat.length > 20 ? '...' : ''} (${cmdName(dat[4])}, len=${dat.length})`);
        }
      }
    } else {
      console.log('No response');
    }
  }

  await new Promise(r => setTimeout(r, 500));

  // Format 4: Single tone with checksum
  console.log('\n=== TEST 4: Single Tone with checksum ===');
  console.log('Format: F0 41 dev 1E 41 03 toneNum checksum F7');
  {
    const type = 0x03;
    const toneNum = 0x08;
    const cs = (128 - type - toneNum) & 0x7F;
    const msg = [0xF0, ROLAND, deviceId, MODEL, RQD, type, toneNum, cs, 0xF7];
    const resp = await sendAndWait(msg);
    if (resp) {
      console.log(`RX: ${hex(resp.slice(0, 20))}${resp.length > 20 ? '...' : ''} (${cmdName(resp[4])}, len=${resp.length})`);
    } else {
      console.log('No response');
    }
  }

  await new Promise(r => setTimeout(r, 500));

  // Format 5: Try type 0x00 (All patches) without checksum
  console.log('\n=== TEST 5: All Patches without checksum ===');
  {
    const msg = [0xF0, ROLAND, deviceId, MODEL, RQD, 0x00, 0xF7];
    const resp = await sendAndWait(msg);
    if (resp) {
      console.log(`RX: ${hex(resp)} (${cmdName(resp[4])})`);
    } else {
      console.log('No response');
    }
  }

  await new Promise(r => setTimeout(r, 500));

  // Format 6: Try single patch request (type 02, patch number)
  console.log('\n=== TEST 6: Single Patch request (patch 16 = RHODES) ===');
  {
    const msg = [0xF0, ROLAND, deviceId, MODEL, RQD, 0x02, 0x10, 0xF7]; // type 02, patch 16
    const resp = await sendAndWait(msg);
    if (resp) {
      console.log(`RX: ${hex(resp.slice(0, 20))}${resp.length > 20 ? '...' : ''} (${cmdName(resp[4])}, len=${resp.length})`);
      if (resp[4] === ACK) {
        console.log('Got ACK! Waiting for DAT...');
        const dat = await sendAndWait([], 5000);
        if (dat) {
          console.log(`RX: ${hex(dat.slice(0, 20))}${dat.length > 20 ? '...' : ''} (${cmdName(dat[4])}, len=${dat.length})`);
        }
      }
    } else {
      console.log('No response');
    }
  }

  await new Promise(r => setTimeout(r, 500));

  // Format 7: Try 0x7F (All data)
  console.log('\n=== TEST 7: All Data (0x7F) ===');
  {
    const msg = [0xF0, ROLAND, deviceId, MODEL, RQD, 0x7F, 0xF7];
    const resp = await sendAndWait(msg);
    if (resp) {
      console.log(`RX: ${hex(resp)} (${cmdName(resp[4])})`);
    } else {
      console.log('No response');
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
