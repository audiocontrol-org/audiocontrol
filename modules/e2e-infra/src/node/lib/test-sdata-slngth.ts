/**
 * Test: can SDATA modify SLNGTH at all?
 * Create a 40-sample stub, read header, try writing SLNGTH=20 (smaller than allocated 48).
 * If this works, the field IS writable — the error code 1 was about exceeding allocation.
 */
const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL ?? 'http://s3k.local:7033';
const TARGET_ID = 6;
const CHANNEL = 0;

async function scsiExec(cdb: number[], dataOut: number[] = [], expectedIn = 0): Promise<number[]> {
  const resp = await fetch(`${BRIDGE_URL}/scsi/exec`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_id: TARGET_ID, cdb, data_out: dataOut, expected_data_in: expectedIn }) });
  if (!resp.ok) throw new Error(`scsi/exec HTTP ${resp.status}`);
  return ((await resp.json()) as { data_in: number[] }).data_in ?? [];
}
async function midiEnable(): Promise<void> { await scsiExec([0x09, 0x00, 0x01, 0x00, 0x00, 0x00]); }
async function midiDisable(): Promise<void> { await scsiExec([0x09, 0x00, 0x00, 0x00, 0x00, 0x00]); }
async function midiSend(data: number[]): Promise<void> { const len = data.length; await scsiExec([0x0C, 0x00, (len >> 16) & 0xFF, (len >> 8) & 0xFF, len & 0xFF, 0x00], data, 0); }
async function midiPoll(): Promise<number> { const r = await scsiExec([0x0D, 0x00, 0x00, 0x00, 0x00, 0x00], [], 4); return r.length >= 3 ? (r[1] << 8) | r[2] : 0; }
async function midiRead(len: number): Promise<number[]> { return scsiExec([0x0E, 0x00, (len >> 16) & 0xFF, (len >> 8) & 0xFF, len & 0xFF, 0x00], [], len); }
function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }

async function sendAndReceive(msg: number[], maxLen = 1024): Promise<number[]> {
  await midiSend(msg);
  for (let i = 0; i < 30; i++) { const p = await midiPoll(); if (p > 0) return midiRead(Math.min(p, maxLen)); await sleep(50); }
  return [];
}

function parseSLNGTH(data: number[]): number {
  const off = 59;
  if (data.length < off + 8) return -1;
  let v = 0;
  for (let i = 0; i < 4; i++) { v |= (((data[off+i*2+1]&0xF)<<4)|(data[off+i*2]&0xF)) << (i*8); }
  return v;
}

function writeNibbleU32(data: number[], off: number, value: number): void {
  let tmp = value;
  for (let i = 0; i < 4; i++) {
    data[off + i * 2] = tmp & 0x0F;
    data[off + i * 2 + 1] = (tmp >> 4) & 0x0F;
    tmp >>= 8;
  }
}

async function main() {
  console.log('=== Test: Can SDATA modify SLNGTH? ===\n');
  await midiEnable();

  // Use the last created sample (from previous test)
  const resp = await sendAndReceive([0xF0, 0x47, CHANNEL, 0x04, 0x48, 0xF7], 4096);
  const count = resp.length >= 7 ? resp[5] | (resp[6] << 8) : 0;
  const sn = count - 1; // last sample
  console.log(`Samples: ${count}. Testing sample #${sn}\n`);

  // Step 1: Read current header
  console.log('Step 1: Read sample header');
  const idxLo = sn & 0x7F, idxHi = (sn >> 7) & 0x7F;
  const header = await sendAndReceive([0xF0, 0x47, CHANNEL, 0x0A, 0x48, idxLo, idxHi, 0xF7], 512);
  const slngthBefore = parseSLNGTH(header);
  console.log(`  SLNGTH: ${slngthBefore}`);
  console.log(`  Header: ${header.length} bytes`);

  // Step 2: Try writing SLNGTH=20 (smaller than current 48)
  console.log('\nStep 2: Write SLNGTH=20 via SDATA');
  const patched = [...header]; // copy
  writeNibbleU32(patched, 59, 20); // SLNGTH = 20
  patched[3] = 0x0B; // Change opcode from 0x09 (RSDATA response) to 0x0B (SDATA write)
  await midiSend(patched);
  
  // Read response
  for (let i = 0; i < 15; i++) {
    const p = await midiPoll();
    if (p > 0) {
      const d = await midiRead(p);
      const hex = d.map(b => b.toString(16).padStart(2,'0')).join(' ');
      // Check for REPLY (0x16) or ERROR (0x15)
      for (let j = 0; j < d.length - 3; j++) {
        if (d[j] === 0xF0 && d[j+1] === 0x47) {
          if (d[j+3] === 0x16) { console.log(`  ✓ REPLY (success): [${hex}]`); break; }
          if (d[j+3] === 0x15) { console.log(`  ✗ ERROR: [${hex}]`); break; }
        }
      }
      break;
    }
    await sleep(100);
  }

  // Step 3: Read back to verify
  console.log('\nStep 3: Read header after SDATA');
  const header2 = await sendAndReceive([0xF0, 0x47, CHANNEL, 0x0A, 0x48, idxLo, idxHi, 0xF7], 512);
  const slngthAfter = parseSLNGTH(header2);
  console.log(`  SLNGTH: ${slngthAfter} (was ${slngthBefore}, target 20)`);

  if (slngthAfter === 20) {
    console.log('\n✓ SDATA CAN modify SLNGTH (at least to smaller values)');
  } else if (slngthAfter === slngthBefore) {
    console.log('\n✗ SLNGTH unchanged — field may be read-only');
  } else {
    console.log(`\n? SLNGTH changed to ${slngthAfter} — unexpected value`);
  }

  await midiDisable();
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
