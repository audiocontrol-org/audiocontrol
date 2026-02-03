/**
 * Test: Address LSB must also be even (lowest bit = 0)
 *
 * From docs:
 *   *3-1 Address and size should specify a memory space in which data exist.
 *        The lowest bit of LSB byte in address and size should be 0.
 *   *3-2 The number of data bytes should be even number
 *
 * Run with: npx tsx test/integration/s330-rqd-address-lsb.ts
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
  console.log('=== S-330 RQD Address LSB Test ===\n');
  console.log('Testing if address LSB must also be even\n');

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

  async function testRequest(addr: number[], size: number[]): Promise<string> {
    const cs = checksum([...addr, ...size]);
    const msg = [0xF0, ROLAND, deviceId, MODEL, RQD, ...addr, ...size, cs, 0xF7];

    output.send('sysex', msg as any);

    const resp = await waitForSysEx(2000);
    if (!resp) return 'timeout';

    const cmd = resp[4];
    if (cmd === DAT) {
      sendAck();
      while (true) {
        const next = await waitForSysEx(1000);
        if (!next) break;
        if (next[4] === EOD) { sendAck(); break; }
        if (next[4] === DAT) { sendAck(); }
      }
      return `OK (${resp.length}b)`;
    }
    if (cmd === RJC) return 'RJC';
    return `0x${cmd.toString(16)}`;
  }

  // Fixed even size
  const size = [0x00, 0x00, 0x00, 0x10]; // 16 nibbles = 8 bytes

  console.log('Testing address offset (LSB) with fixed size 0x10:\n');
  console.log('Address             | Offset LSB | Even/Odd | Result');
  console.log('--------------------|------------|----------|-------');

  // Test various address offsets (the 4th byte)
  const tests = [
    { addr: [0x00, 0x01, 0x10, 0x00], desc: 'Patch 16, offset 0x00' },
    { addr: [0x00, 0x01, 0x10, 0x01], desc: 'Patch 16, offset 0x01' },
    { addr: [0x00, 0x01, 0x10, 0x02], desc: 'Patch 16, offset 0x02' },
    { addr: [0x00, 0x01, 0x10, 0x03], desc: 'Patch 16, offset 0x03' },
    { addr: [0x00, 0x01, 0x10, 0x04], desc: 'Patch 16, offset 0x04' },
    { addr: [0x00, 0x01, 0x10, 0x05], desc: 'Patch 16, offset 0x05' },
    { addr: [0x00, 0x01, 0x10, 0x08], desc: 'Patch 16, offset 0x08' },
    { addr: [0x00, 0x01, 0x10, 0x09], desc: 'Patch 16, offset 0x09' },
    { addr: [0x00, 0x01, 0x10, 0x0A], desc: 'Patch 16, offset 0x0A' },
    { addr: [0x00, 0x01, 0x10, 0x0B], desc: 'Patch 16, offset 0x0B' },
    { addr: [0x00, 0x01, 0x10, 0x10], desc: 'Patch 16, offset 0x10' },
    { addr: [0x00, 0x01, 0x10, 0x11], desc: 'Patch 16, offset 0x11' },
  ];

  let evenPass = 0, evenFail = 0;
  let oddPass = 0, oddFail = 0;

  for (const test of tests) {
    const lsb = test.addr[3];
    const isEven = lsb % 2 === 0;
    const result = await testRequest(test.addr, size);
    const status = result.startsWith('OK') ? '✓' : '✗';

    if (isEven) {
      if (result.startsWith('OK')) evenPass++; else evenFail++;
    } else {
      if (result.startsWith('OK')) oddPass++; else oddFail++;
    }

    console.log(`${test.desc.padEnd(19)} | 0x${lsb.toString(16).padStart(2, '0')}       | ${isEven ? 'EVEN' : 'ODD '}     | ${status} ${result}`);
    await new Promise(r => setTimeout(r, 150));
  }

  console.log('\n--- Summary ---');
  console.log(`EVEN address LSB: ${evenPass} pass, ${evenFail} fail`);
  console.log(`ODD address LSB:  ${oddPass} pass, ${oddFail} fail`);

  if (evenFail === 0 && oddPass === 0) {
    console.log('\n✓ CONFIRMED: Address LSB must also be even');
  } else if (oddPass > 0) {
    console.log('\n? Address LSB even constraint NOT enforced');
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
