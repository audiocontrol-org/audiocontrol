const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL ?? 'http://s3k.local:7033';
const TARGET_ID = 6;
const CHANNEL = 0;

async function scsiExec(cdb: number[], dataOut: number[] = [], expectedIn = 0): Promise<number[]> {
  const resp = await fetch(`${BRIDGE_URL}/scsi/exec`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_id: TARGET_ID, cdb, data_out: dataOut, expected_data_in: expectedIn }),
  });
  if (!resp.ok) throw new Error(`scsi/exec HTTP ${resp.status}: ${await resp.text()}`);
  return ((await resp.json()) as { data_in: number[] }).data_in ?? [];
}

async function midiEnable(): Promise<void> { await scsiExec([0x09, 0x00, 0x01, 0x00, 0x00, 0x00]); }
async function midiDisable(): Promise<void> { await scsiExec([0x09, 0x00, 0x00, 0x00, 0x00, 0x00]); }

async function midiSend(data: number[]): Promise<void> {
  const len = data.length;
  await scsiExec([0x0C, 0x00, (len >> 16) & 0xFF, (len >> 8) & 0xFF, len & 0xFF, 0x00], data, 0);
}

async function midiPoll(): Promise<number> {
  const result = await scsiExec([0x0D, 0x00, 0x00, 0x00, 0x00, 0x00], [], 4);
  if (result.length >= 3) return (result[1] << 8) | result[2];
  return 0;
}

async function midiRead(len: number): Promise<number[]> {
  return scsiExec([0x0E, 0x00, (len >> 16) & 0xFF, (len >> 8) & 0xFF, len & 0xFF, 0x00], [], len);
}

function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  await midiEnable();
  
  // Send RSLIST
  await midiSend([0xF0, 0x47, CHANNEL, 0x04, 0x48, 0xF7]);
  
  for (let i = 0; i < 30; i++) {
    const pending = await midiPoll();
    if (pending > 0) {
      const data = await midiRead(pending);
      console.log(`RSLIST response: ${data.length} bytes`);
      console.log(`Raw: [${data.map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);
      
      // Parse: F0 47 cc opcode 48 [data] F7
      // Each sample name is 12 chars, each nibble-encoded = 24 bytes
      const payload = data.slice(5, -1); // strip F0 47 cc op 48 ... F7
      console.log(`Payload: ${payload.length} bytes`);
      console.log(`Payload / 24 = ${payload.length / 24} entries`);
      
      // Decode names: each char is 2 nibbles (lo, hi)
      const names: string[] = [];
      for (let j = 0; j < payload.length; j += 24) {
        let name = '';
        for (let k = 0; k < 12; k++) {
          const lo = payload[j + k * 2] & 0x0F;
          const hi = payload[j + k * 2 + 1] & 0x0F;
          const charCode = (hi << 4) | lo;
          name += String.fromCharCode(charCode);
        }
        names.push(name);
      }
      console.log(`\nSample names:`);
      names.forEach((n, i) => console.log(`  [${i}] "${n}"`));
      break;
    }
    await sleep(50);
  }
  
  await midiDisable();
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
