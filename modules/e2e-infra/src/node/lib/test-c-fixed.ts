const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL ?? 'http://s3k.local:7033';
const TARGET_ID = 6;
const CHANNEL = 0;
const TEST_SAMPLE_COUNT = 1000;
const SAMPLE_RATE = 44100;

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

async function queryRSLIST(): Promise<number> {
  const resp = await sendAndReceive([0xF0, 0x47, CHANNEL, 0x04, 0x48, 0xF7], 4096);
  if (resp.length < 7) return 0;
  return resp[5] | (resp[6] << 8);
}

function parseSLNGTH(data: number[]): number {
  const off = 59;
  if (data.length < off + 8) return -1;
  let v = 0;
  for (let i = 0; i < 4; i++) { v |= (((data[off+i*2+1]&0xF)<<4)|(data[off+i*2]&0xF)) << (i*8); }
  return v;
}

function encodeSdsSample(s: number): number[] { const r = s & 0xFFFF; return [(r>>9)&0x7F,(r>>2)&0x7F,(r<<5)&0x60]; }

function buildSdsDataPacket(pktNum: number, samples: number[]): number[] {
  const pkt = [0xF0, 0x7E, CHANNEL, 0x02, pktNum & 0x7F];
  let cs = 0x7E ^ CHANNEL ^ 0x02 ^ (pktNum & 0x7F);
  for (const s of samples) { const e = encodeSdsSample(s); cs ^= e[0]; cs ^= e[1]; cs ^= e[2]; pkt.push(...e); }
  while (pkt.length - 5 < 120) { pkt.push(0); cs ^= 0; }
  pkt.push(cs & 0x7F, 0xF7);
  return pkt;
}

async function readAck(): Promise<string> {
  for (let i = 0; i < 15; i++) {
    const p = await midiPoll();
    if (p > 0) {
      const d = await midiRead(p);
      const hex = d.map(b => b.toString(16).padStart(2,'0')).join(' ');
      // Look for ACK (7F) or NAK (7E)
      for (let j = 0; j < d.length - 3; j++) {
        if (d[j] === 0xF0 && d[j+1] === 0x7E) {
          if (d[j+3] === 0x7F) return `ACK [${hex}]`;
          if (d[j+3] === 0x7E) return `NAK [${hex}]`;
          if (d[j+3] === 0x7C) continue; // WAIT
        }
      }
      return `OTHER [${hex}]`;
    }
    await sleep(100);
  }
  return 'TIMEOUT';
}

async function main() {
  console.log('=== Theory C (fixed RSLIST): Real length header + data packet ===\n');
  await midiEnable();

  const countBefore = await queryRSLIST();
  const sn = countBefore;
  console.log(`Samples: ${countBefore}. Creating sample #${sn}\n`);

  const periodNs = Math.floor(1_000_000_000 / SAMPLE_RATE);

  // Step 1: SDS dump header with REAL length
  console.log(`Step 1: SDS dump header (length=${TEST_SAMPLE_COUNT})`);
  const dumpHeader = [
    0xF0, 0x7E, CHANNEL, 0x01,
    sn & 0x7F, (sn >> 7) & 0x7F, 16,
    periodNs & 0x7F, (periodNs >> 7) & 0x7F, (periodNs >> 14) & 0x7F,
    TEST_SAMPLE_COUNT & 0x7F, (TEST_SAMPLE_COUNT >> 7) & 0x7F, (TEST_SAMPLE_COUNT >> 14) & 0x7F,
    0, 0, 0, 0, 0, 0, 0, 0xF7,
  ];
  await midiSend(dumpHeader);
  console.log(`  ${await readAck()}`);

  // Step 2: Data packet (40 samples)
  console.log('Step 2: SDS data packet (40 samples)');
  await midiSend(buildSdsDataPacket(0, new Array(40).fill(0)));
  console.log(`  ${await readAck()}`);

  await sleep(500);

  // Step 3: Check RSLIST
  const countAfter = await queryRSLIST();
  console.log(`\nSamples: ${countBefore} → ${countAfter}`);
  if (countAfter > countBefore) {
    console.log('✓ Sample created!');

    // Step 4: Read SLNGTH
    const idxLo = sn & 0x7F, idxHi = (sn >> 7) & 0x7F;
    const header = await sendAndReceive([0xF0, 0x47, CHANNEL, 0x0A, 0x48, idxLo, idxHi, 0xF7], 512);
    const slngth = parseSLNGTH(header);
    console.log(`SLNGTH: ${slngth} (declared ${TEST_SAMPLE_COUNT} in header)`);
  } else {
    console.log('✗ Sample NOT created');
  }

  await midiDisable();
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
