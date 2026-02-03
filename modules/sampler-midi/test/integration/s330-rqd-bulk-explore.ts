/**
 * Exploratory test for S-330 RQD bulk handshake protocol
 *
 * Protocol flow:
 *   Host --- RQD (type) ---> S-330
 *   Host <--- ACK --- S-330
 *   Host <--- DAT (packet 1) --- S-330
 *   Host --- ACK ---> S-330
 *   Host <--- DAT (packet 2) --- S-330
 *   Host --- ACK ---> S-330
 *   ...
 *   Host <--- EOD --- S-330
 *   Host --- ACK ---> S-330
 *
 * Run with: npx tsx test/integration/s330-rqd-bulk-explore.ts
 */

import * as easymidi from 'easymidi';

const MIDI_DEVICE = 'Volt 4';
const ROLAND = 0x41;
const MODEL = 0x1E;
const deviceId = 0x00;

// Commands
const RQD = 0x41;
const DAT = 0x42;
const ACK = 0x43;
const EOD = 0x45;
const ERR = 0x4E;
const RJC = 0x4F;

// Bulk dump types
const BULK_TYPES = {
  ALL_DATA: 0x00,
  PATCH_1_32: 0x01,
  PATCH_33_64: 0x02,
  TONE_1_32: 0x03,
  TONE_33_64: 0x04,
  FUNCTION: 0x05,
};

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

async function main() {
  console.log('=== S-330 RQD Bulk Handshake Test ===\n');

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

  // Helper to wait for a single SysEx message
  function waitForSysEx(timeout = 5000): Promise<number[] | null> {
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

  // Send ACK message
  function sendAck() {
    const msg = [0xF0, ROLAND, deviceId, MODEL, ACK, 0xF7];
    console.log(`  TX ACK: ${hex(msg)}`);
    output.send('sysex', msg as any);
  }

  // Build RQD message with type
  function buildRqdMessage(type: number): number[] {
    const checksum = (128 - type) & 0x7F;
    return [0xF0, ROLAND, deviceId, MODEL, RQD, type, checksum, 0xF7];
  }

  // Perform full RQD handshake
  async function requestBulkData(type: number, typeName: string): Promise<number[][] | null> {
    console.log(`\n=== Requesting ${typeName} (type 0x${type.toString(16).padStart(2, '0')}) ===`);

    const rqdMsg = buildRqdMessage(type);
    console.log(`TX RQD: ${hex(rqdMsg)}`);
    output.send('sysex', rqdMsg as any);

    // Wait for initial response (ACK or RJC)
    const initialResp = await waitForSysEx(3000);
    if (!initialResp) {
      console.log('  No response (timeout)');
      return null;
    }

    const initialCmd = initialResp[4];
    console.log(`RX: ${hex(initialResp.slice(0, 15))}${initialResp.length > 15 ? '...' : ''} (${cmdName(initialCmd)})`);

    if (initialCmd === RJC) {
      console.log('  Request rejected (RJC)');
      return null;
    }

    if (initialCmd === ERR) {
      console.log('  Error response (ERR)');
      return null;
    }

    // If we got ACK, we need to wait for DAT packets
    // If we got DAT directly, start collecting
    const packets: number[][] = [];
    let currentResp = initialResp;

    // If first response was ACK, wait for first DAT
    if (initialCmd === ACK) {
      console.log('  Got ACK, waiting for DAT packets...');
      currentResp = await waitForSysEx(5000);
      if (!currentResp) {
        console.log('  No DAT packet received (timeout)');
        return null;
      }
      console.log(`RX: ${hex(currentResp.slice(0, 15))}${currentResp.length > 15 ? '...' : ''} (${cmdName(currentResp[4])}, len=${currentResp.length})`);
    }

    // Collect DAT packets until EOD
    while (currentResp && currentResp[4] !== EOD) {
      const cmd = currentResp[4];

      if (cmd === DAT) {
        // Extract data from DAT packet (skip header, take until checksum+F7)
        // Format: F0 41 dev 1E 42 [type] [checksum] [data...] [checksum] F7
        // Actually looking at the format, it might be: F0 41 dev 1E 42 [data...] [checksum] F7
        packets.push(currentResp);
        console.log(`  Packet ${packets.length}: ${currentResp.length} bytes`);

        // Send ACK
        sendAck();
        await new Promise(r => setTimeout(r, 50)); // Small delay after ACK

        // Wait for next packet
        currentResp = await waitForSysEx(5000);
        if (currentResp) {
          console.log(`RX: ${hex(currentResp.slice(0, 15))}${currentResp.length > 15 ? '...' : ''} (${cmdName(currentResp[4])}, len=${currentResp.length})`);
        }
      } else if (cmd === ERR) {
        console.log('  Error during transfer');
        return null;
      } else if (cmd === RJC) {
        console.log('  Transfer rejected');
        return null;
      } else {
        console.log(`  Unexpected command: ${cmdName(cmd)}`);
        break;
      }
    }

    // Got EOD - send final ACK
    if (currentResp && currentResp[4] === EOD) {
      console.log('  Got EOD, sending final ACK');
      sendAck();
    }

    console.log(`  Total packets received: ${packets.length}`);
    return packets.length > 0 ? packets : null;
  }

  // Test 1: Request Function params (type 0x05) - should always exist
  const funcPackets = await requestBulkData(BULK_TYPES.FUNCTION, 'Function params');
  if (funcPackets) {
    console.log(`\n  Function data received: ${funcPackets.length} packets`);
    // Try to decode first packet
    if (funcPackets[0].length > 10) {
      const rawData = funcPackets[0].slice(5, -2); // Skip header, before checksum+F7
      console.log(`  First packet raw: ${hex(rawData.slice(0, 20))}...`);
    }
  }

  await new Promise(r => setTimeout(r, 500));

  // Test 2: Request Patch 1-32 (type 0x01)
  const patchPackets = await requestBulkData(BULK_TYPES.PATCH_1_32, 'Patch 1-32');
  if (patchPackets) {
    console.log(`\n  Patch data received: ${patchPackets.length} packets`);
    // Calculate total data size
    let totalBytes = 0;
    for (const pkt of patchPackets) {
      totalBytes += pkt.length - 7; // Subtract header (5) + checksum (1) + F7 (1)
    }
    console.log(`  Total data bytes: ~${totalBytes}`);
  }

  await new Promise(r => setTimeout(r, 500));

  // Test 3: Request Tone 1-32 (type 0x03)
  const tonePackets = await requestBulkData(BULK_TYPES.TONE_1_32, 'Tone 1-32');
  if (tonePackets) {
    console.log(`\n  Tone data received: ${tonePackets.length} packets`);
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
