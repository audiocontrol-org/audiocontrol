/**
 * Explore S-330 RQD type codes to find patch/tone parameter dumps
 *
 * Goal: Find the type that gives us JUST patch or tone parameters,
 * not the wave sample data which takes forever.
 *
 * Run with: npx tsx test/integration/s330-rqd-types-explore.ts
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
  console.log('=== S-330 RQD Type Code Exploration ===\n');

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

  // Test a type code and count how many packets before giving up
  async function testType(type: number, maxPackets = 10): Promise<{ response: string, packets: number, totalBytes: number }> {
    // Try without checksum first (since that's what worked for type 0x00)
    const msg = [0xF0, ROLAND, deviceId, MODEL, RQD, type, 0xF7];
    console.log(`TX: ${hex(msg)}`);
    output.send('sysex', msg as any);

    const firstResp = await waitForSysEx(2000);
    if (!firstResp) {
      return { response: 'timeout', packets: 0, totalBytes: 0 };
    }

    const cmd = firstResp[4];
    if (cmd === RJC) {
      return { response: 'RJC', packets: 0, totalBytes: 0 };
    }
    if (cmd === ERR) {
      return { response: 'ERR', packets: 0, totalBytes: 0 };
    }
    if (cmd === EOD) {
      return { response: 'EOD (empty)', packets: 0, totalBytes: 0 };
    }

    if (cmd !== DAT) {
      return { response: `unexpected: ${cmdName(cmd)}`, packets: 0, totalBytes: 0 };
    }

    // Got DAT - count packets
    let packets = 1;
    let totalBytes = firstResp.length;
    sendAck();

    while (packets < maxPackets) {
      const resp = await waitForSysEx(1000);
      if (!resp) {
        return { response: `DAT (incomplete after ${packets})`, packets, totalBytes };
      }

      const respCmd = resp[4];
      if (respCmd === EOD) {
        sendAck();
        return { response: 'DAT+EOD (complete)', packets, totalBytes };
      }
      if (respCmd === DAT) {
        packets++;
        totalBytes += resp.length;
        sendAck();
      } else {
        return { response: `DAT then ${cmdName(respCmd)}`, packets, totalBytes };
      }
    }

    return { response: `DAT (>= ${maxPackets} packets, still going...)`, packets, totalBytes };
  }

  // Test various type codes
  const typesToTest = [
    { type: 0x01, desc: 'Type 0x01' },
    { type: 0x02, desc: 'Type 0x02' },
    { type: 0x03, desc: 'Type 0x03' },
    { type: 0x04, desc: 'Type 0x04' },
    { type: 0x05, desc: 'Type 0x05' },
    { type: 0x06, desc: 'Type 0x06' },
    { type: 0x10, desc: 'Type 0x10' },
    { type: 0x11, desc: 'Type 0x11' },
    { type: 0x20, desc: 'Type 0x20' },
    { type: 0x21, desc: 'Type 0x21' },
  ];

  console.log('Testing RQD type codes (without checksum, max 10 packets each):\n');

  for (const { type, desc } of typesToTest) {
    console.log(`\n=== ${desc} (0x${type.toString(16).padStart(2, '0')}) ===`);
    const result = await testType(type, 10);
    console.log(`  Result: ${result.response}`);
    if (result.packets > 0) {
      console.log(`  Packets: ${result.packets}, Total bytes: ${result.totalBytes}`);
    }
    await new Promise(r => setTimeout(r, 300));
  }

  // Also try with a parameter byte (like single patch/tone requests)
  console.log('\n\n=== Testing with parameter byte ===\n');

  const paramTests = [
    { type: 0x02, param: 0x10, desc: 'Type 0x02 param 0x10 (single patch 16?)' },
    { type: 0x03, param: 0x08, desc: 'Type 0x03 param 0x08 (single tone 8?)' },
  ];

  for (const { type, param, desc } of paramTests) {
    console.log(`\n=== ${desc} ===`);
    const msg = [0xF0, ROLAND, deviceId, MODEL, RQD, type, param, 0xF7];
    console.log(`TX: ${hex(msg)}`);
    output.send('sysex', msg as any);

    const resp = await waitForSysEx(2000);
    if (resp) {
      const cmd = resp[4];
      console.log(`RX: ${hex(resp.slice(0, 20))}${resp.length > 20 ? '...' : ''} (${cmdName(cmd)}, len=${resp.length})`);

      if (cmd === DAT) {
        // Count more packets
        sendAck();
        let packets = 1;
        let totalBytes = resp.length;
        for (let i = 0; i < 50; i++) {
          const nextResp = await waitForSysEx(1000);
          if (!nextResp) break;
          const nextCmd = nextResp[4];
          if (nextCmd === EOD) {
            sendAck();
            console.log(`  Complete! ${packets} packets, ${totalBytes} bytes`);
            break;
          }
          if (nextCmd === DAT) {
            packets++;
            totalBytes += nextResp.length;
            sendAck();
          }
        }
      }
    } else {
      console.log('  No response');
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
