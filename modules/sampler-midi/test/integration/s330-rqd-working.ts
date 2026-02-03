/**
 * Working S-330 RQD bulk transfer test
 *
 * Discovered protocol:
 *   Host --- RQD (type, no checksum) ---> S-330
 *   Host <--- DAT (packet 1) --- S-330
 *   Host --- ACK ---> S-330
 *   Host <--- DAT (packet 2) or EOD --- S-330
 *   Host --- ACK ---> S-330
 *   ...
 *
 * Run with: npx tsx test/integration/s330-rqd-working.ts
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

function denibblize(data: number[]): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i += 2) {
    if (i + 1 < data.length) {
      const hi = data[i] & 0x0F;
      const lo = data[i + 1] & 0x0F;
      result.push((hi << 4) | lo);
    }
  }
  return result;
}

function bytesToString(bytes: number[]): string {
  return bytes.map(b => b >= 0x20 && b < 0x7F ? String.fromCharCode(b) : '.').join('');
}

async function main() {
  console.log('=== S-330 RQD Bulk Transfer (Working) ===\n');

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

  function sendAck() {
    const msg = [0xF0, ROLAND, deviceId, MODEL, ACK, 0xF7];
    output.send('sysex', msg as any);
  }

  async function requestBulkData(type: number, typeName: string): Promise<number[][]> {
    console.log(`\n=== Requesting ${typeName} (type 0x${type.toString(16).padStart(2, '0')}) ===`);

    // Send RQD without checksum
    const rqdMsg = [0xF0, ROLAND, deviceId, MODEL, RQD, type, 0xF7];
    console.log(`TX RQD: ${hex(rqdMsg)}`);
    output.send('sysex', rqdMsg as any);

    const packets: number[][] = [];
    let done = false;

    while (!done) {
      const resp = await waitForSysEx(5000);
      if (!resp) {
        console.log('  Timeout waiting for response');
        break;
      }

      const cmd = resp[4];
      console.log(`RX: ${cmdName(cmd)} (len=${resp.length})`);

      if (cmd === DAT) {
        packets.push(resp);
        console.log(`  Packet ${packets.length} received, sending ACK...`);
        sendAck();
        await new Promise(r => setTimeout(r, 20)); // Small delay after ACK
      } else if (cmd === EOD) {
        console.log('  End of data, sending final ACK');
        sendAck();
        done = true;
      } else if (cmd === RJC) {
        console.log('  Request rejected');
        done = true;
      } else if (cmd === ERR) {
        console.log('  Error response');
        done = true;
      } else {
        console.log(`  Unexpected: ${cmdName(cmd)}`);
        done = true;
      }
    }

    console.log(`  Total packets: ${packets.length}`);
    return packets;
  }

  // Request All Patches (type 0x00)
  const patchPackets = await requestBulkData(0x00, 'All Patches');

  if (patchPackets.length > 0) {
    console.log('\n=== Analyzing Patch Data ===');

    // Combine all packet data
    let allData: number[] = [];
    for (const pkt of patchPackets) {
      // DAT format: F0 41 dev 1E 42 type checksum data... checksum F7
      // Skip header (6 bytes: F0 41 dev 1E 42 type) and trailer (2 bytes: checksum F7)
      // Actually let's figure out the exact format from the data
      const data = pkt.slice(5, -2); // Skip F0 41 dev 1E 42, and checksum F7
      allData = allData.concat(data);
    }

    console.log(`Total nibblized bytes: ${allData.length}`);

    // De-nibblize
    const decoded = denibblize(allData);
    console.log(`Decoded bytes: ${decoded.length}`);

    // Try to find patch names (8 bytes each, at start of each patch block)
    // Patch size unknown - let's look for patterns
    console.log(`\nFirst 64 decoded bytes: ${hex(decoded.slice(0, 64))}`);
    console.log(`As ASCII: "${bytesToString(decoded.slice(0, 64))}"`);

    // Let's try to find patch boundaries by looking for 8-byte name fields
    // followed by parameter data
    console.log('\nSearching for patch names in data...');
    for (let i = 0; i < Math.min(decoded.length, 2000); i++) {
      // Look for potential 8-char ASCII names
      const slice = decoded.slice(i, i + 8);
      if (slice.length === 8) {
        const allPrintable = slice.every(b => b >= 0x20 && b < 0x7F);
        const hasLetters = slice.some(b => (b >= 0x41 && b <= 0x5A) || (b >= 0x61 && b <= 0x7A));
        if (allPrintable && hasLetters) {
          const name = bytesToString(slice).trim();
          if (name.length >= 3) {
            console.log(`  Offset ${i}: "${bytesToString(slice)}"`);
          }
        }
      }
    }
  }

  await new Promise(r => setTimeout(r, 500));

  // Request All Tones (type 0x01)
  const tonePackets = await requestBulkData(0x01, 'All Tones');

  if (tonePackets.length > 0) {
    console.log('\n=== Analyzing Tone Data ===');

    let allData: number[] = [];
    for (const pkt of tonePackets) {
      const data = pkt.slice(5, -2);
      allData = allData.concat(data);
    }

    console.log(`Total nibblized bytes: ${allData.length}`);
    const decoded = denibblize(allData);
    console.log(`Decoded bytes: ${decoded.length}`);

    console.log(`\nFirst 64 decoded bytes: ${hex(decoded.slice(0, 64))}`);
    console.log(`As ASCII: "${bytesToString(decoded.slice(0, 64))}"`);

    console.log('\nSearching for tone names in data...');
    for (let i = 0; i < Math.min(decoded.length, 2000); i++) {
      const slice = decoded.slice(i, i + 8);
      if (slice.length === 8) {
        const allPrintable = slice.every(b => b >= 0x20 && b < 0x7F);
        const hasLetters = slice.some(b => (b >= 0x41 && b <= 0x5A) || (b >= 0x61 && b <= 0x7A));
        if (allPrintable && hasLetters) {
          const name = bytesToString(slice).trim();
          if (name.length >= 3) {
            console.log(`  Offset ${i}: "${bytesToString(slice)}"`);
          }
        }
      }
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
