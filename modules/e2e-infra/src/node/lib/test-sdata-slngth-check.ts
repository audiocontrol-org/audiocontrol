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

function to7bit(v: number): number[] { return [v & 0x7F, (v >> 7) & 0x7F]; }
function to7bit32(v: number): number[] { return [v & 0x7F, (v >> 7) & 0x7F, (v >> 14) & 0x7F, (v >> 21) & 0x7F]; }

async function main() {
  console.log('=== Check SLNGTH after SDATA nibble write ===\n');
  await midiEnable();

  // Read SLNGTH before
  const h1 = await sendAndReceive([0xF0, 0x47, CHANNEL, 0x0A, 0x48, ...to7bit(0), 0xF7], 512);
  console.log(`SLNGTH before: ${parseSLNGTH(h1)}`);

  // Send SDATA with 500 nibble-encoded samples (more than current SLNGTH of 256?)
  const count = 500;
  const msg = [0xF0, 0x47, CHANNEL, 0x0B, 0x48, ...to7bit(0), ...to7bit32(0), ...to7bit32(count)];
  for (let i = 0; i < count; i++) {
    const s = Math.round(Math.sin(2 * Math.PI * 440 * i / 44100) * 16000) & 0xFFFF;
    msg.push(s & 0x0F, (s >> 4) & 0x0F, (s >> 8) & 0x0F, (s >> 12) & 0x0F);
  }
  msg.push(0xF7);
  console.log(`Sending SDATA with ${count} samples (${msg.length} bytes)...`);
  await midiSend(msg);
  // Check for REPLY
  await sleep(200);
  for (let i = 0; i < 10; i++) {
    const p = await midiPoll();
    if (p > 0) { const d = await midiRead(p); console.log(`Reply: [${d.map(b=>b.toString(16).padStart(2,'0')).join(' ')}]`); break; }
    await sleep(50);
  }

  // Read SLNGTH after
  const h2 = await sendAndReceive([0xF0, 0x47, CHANNEL, 0x0A, 0x48, ...to7bit(0), 0xF7], 512);
  console.log(`SLNGTH after:  ${parseSLNGTH(h2)}`);

  if (parseSLNGTH(h2) !== parseSLNGTH(h1)) {
    console.log(`\n✓ SLNGTH CHANGED! ${parseSLNGTH(h1)} → ${parseSLNGTH(h2)}`);
  } else {
    console.log(`\n✗ SLNGTH unchanged (still ${parseSLNGTH(h1)})`);
  }

  await midiDisable();
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
