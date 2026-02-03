/**
 * Test hypothesis: RQD size must be EVEN (nibble count)
 *
 * Since data is nibblized (1 byte = 2 nibbles), requesting an
 * odd number of nibbles doesn't make sense.
 *
 * Run with: npx tsx test/integration/s330-rqd-size-even-odd.ts
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

function checksum(data: number[]): number {
  const sum = data.reduce((a, b) => a + b, 0);
  return (128 - (sum & 0x7F)) & 0x7F;
}

async function main() {
  console.log('=== S-330 RQD Even/Odd Size Test ===\n');
  console.log('Hypothesis: Size must be EVEN (nibble count)\n');

  const inputs = easymidi.getInputs();
  const outputs = easymidi.getOutputs();

  const inputName = inputs.find(n => n.includes(MIDI_DEVICE));
  const outputName = outputs.find(n => n.includes(MIDI_DEVICE));

  if (!inputName || !outputName) {
    console.error(`ERROR: ${MIDI_DEVICE} not found`);
    process.exit(1);
  }

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

  async function testSize(size: number[]): Promise<{ result: string, bytes?: number }> {
    const addr = [0x00, 0x01, 0x10, 0x00]; // Patch 16
    const cs = checksum([...addr, ...size]);
    const msg = [0xF0, ROLAND, deviceId, MODEL, RQD, ...addr, ...size, cs, 0xF7];

    output.send('sysex', msg as any);

    const resp = await waitForSysEx(2000);
    if (!resp) return { result: 'timeout' };

    const cmd = resp[4];
    if (cmd === DAT) {
      sendAck();
      let totalBytes = resp.length;
      while (true) {
        const next = await waitForSysEx(1000);
        if (!next) break;
        if (next[4] === EOD) { sendAck(); break; }
        if (next[4] === DAT) { totalBytes += next.length; sendAck(); }
      }
      return { result: 'OK', bytes: totalBytes };
    }
    if (cmd === RJC) return { result: 'RJC' };
    return { result: `0x${cmd.toString(16)}` };
  }

  // Test consecutive even and odd values
  console.log('Testing consecutive values:\n');
  console.log('Size (hex) | Decimal | Even/Odd | Result');
  console.log('-----------|---------|----------|-------');

  const testValues = [
    0x10, 0x11, 0x12, 0x13, 0x14, 0x15,
    0x20, 0x21, 0x22, 0x23,
    0x30, 0x31, 0x32, 0x33,
    0x40, 0x41, 0x42, 0x43,
    0x50, 0x51, 0x52, 0x53,
    0x5E, 0x5F, 0x60, 0x61, 0x62, 0x63,
  ];

  let evenPass = 0, evenFail = 0;
  let oddPass = 0, oddFail = 0;

  for (const val of testValues) {
    const size = [0x00, 0x00, 0x00, val];
    const r = await testSize(size);
    const isEven = val % 2 === 0;
    const status = r.result === 'OK' ? '✓' : '✗';

    if (isEven) {
      if (r.result === 'OK') evenPass++; else evenFail++;
    } else {
      if (r.result === 'OK') oddPass++; else oddFail++;
    }

    console.log(`0x${val.toString(16).padStart(2, '0')}       | ${val.toString().padStart(3)}     | ${isEven ? 'EVEN' : 'ODD '}     | ${status} ${r.result}${r.bytes ? ` (${r.bytes}b)` : ''}`);
    await new Promise(r => setTimeout(r, 150));
  }

  console.log('\n--- Summary ---');
  console.log(`EVEN values: ${evenPass} pass, ${evenFail} fail`);
  console.log(`ODD values:  ${oddPass} pass, ${oddFail} fail`);

  if (evenFail === 0 && oddPass === 0) {
    console.log('\n✓ HYPOTHESIS CONFIRMED: Size must be even (nibble count)');
  } else {
    console.log('\n✗ Hypothesis partially refuted');
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
