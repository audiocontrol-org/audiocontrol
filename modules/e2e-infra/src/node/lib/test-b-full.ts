const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL ?? 'http://s3k.local:7033';
const TARGET_ID = 6;
const CHANNEL = 0;
const TEST_SAMPLE_COUNT = 1000;
const SAMPLE_RATE = 44100;

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

async function sendAndReceive(msg: number[], maxLen = 1024): Promise<number[]> {
  await midiSend(msg);
  for (let i = 0; i < 30; i++) {
    const pending = await midiPoll();
    if (pending > 0) return midiRead(Math.min(pending, maxLen));
    await sleep(50);
  }
  return [];
}

async function queryRSLIST(): Promise<number> {
  const resp = await sendAndReceive([0xF0, 0x47, CHANNEL, 0x04, 0x48, 0xF7], 4096);
  if (resp.length < 7) return 0;
  return resp[5] | (resp[6] << 8);
}

function parseSLNGTH(data: number[]): number {
  // raw[59] through raw[66]: 4 bytes as 8 nibbles, LE
  const off = 59;
  if (data.length < off + 8) return -1;
  let value = 0;
  for (let i = 0; i < 4; i++) {
    const lo = data[off + i * 2] & 0x0F;
    const hi = data[off + i * 2 + 1] & 0x0F;
    value |= ((hi << 4) | lo) << (i * 8);
  }
  return value;
}

function parseSMPEND(data: number[]): number {
  const off = 75;
  if (data.length < off + 8) return -1;
  let value = 0;
  for (let i = 0; i < 4; i++) {
    const lo = data[off + i * 2] & 0x0F;
    const hi = data[off + i * 2 + 1] & 0x0F;
    value |= ((hi << 4) | lo) << (i * 8);
  }
  return value;
}

function encodeSdsSample(sample: number): number[] {
  const raw = sample & 0xFFFF;
  return [(raw >> 9) & 0x7F, (raw >> 2) & 0x7F, (raw << 5) & 0x60];
}

function buildSdsDataPacket(packetNum: number, samples: number[]): number[] {
  const pkt = [0xF0, 0x7E, CHANNEL, 0x02, packetNum & 0x7F];
  let checksum = 0x7E ^ CHANNEL ^ 0x02 ^ (packetNum & 0x7F);
  for (const s of samples) {
    const enc = encodeSdsSample(s);
    checksum ^= enc[0]; checksum ^= enc[1]; checksum ^= enc[2];
    pkt.push(...enc);
  }
  while (pkt.length - 5 < 120) { pkt.push(0); checksum ^= 0; }
  pkt.push(checksum & 0x7F, 0xF7);
  return pkt;
}

function toNibbles(value: number, byteCount: number): number[] {
  const nibbles: number[] = [];
  for (let i = 0; i < byteCount; i++) {
    const byte = (value >> (i * 8)) & 0xFF;
    nibbles.push(byte & 0x0F, (byte >> 4) & 0x0F);
  }
  return nibbles;
}

function sampleToNibbles(sample: number): number[] {
  const raw = sample & 0xFFFF;
  return [raw & 0x0F, (raw >> 4) & 0x0F, (raw >> 8) & 0x0F, (raw >> 12) & 0x0F];
}

async function main() {
  console.log('=== Full Theory B Test: Create + ASPACK + Check SLNGTH ===\n');
  await midiEnable();

  // Step 1: Get count, pick next free slot
  const countBefore = await queryRSLIST();
  const sampleNumber = countBefore;
  console.log(`Samples: ${countBefore}. Creating sample #${sampleNumber}\n`);

  // Step 2: Create sample via SDS stub (40 samples)
  const periodNs = Math.floor(1_000_000_000 / SAMPLE_RATE);
  const dumpHeader = [
    0xF0, 0x7E, CHANNEL, 0x01,
    sampleNumber & 0x7F, (sampleNumber >> 7) & 0x7F, 16,
    periodNs & 0x7F, (periodNs >> 7) & 0x7F, (periodNs >> 14) & 0x7F,
    40 & 0x7F, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xF7,
  ];
  console.log('Step 2: SDS dump header (length=40)');
  await midiSend(dumpHeader);
  for (let i = 0; i < 10; i++) {
    const p = await midiPoll(); if (p > 0) { const d = await midiRead(p); console.log(`  ACK: [${d.map(b=>b.toString(16).padStart(2,'0')).join(' ')}]`); break; }
    await sleep(100);
  }

  console.log('Step 2b: SDS data packet');
  await midiSend(buildSdsDataPacket(0, new Array(40).fill(0)));
  for (let i = 0; i < 10; i++) {
    const p = await midiPoll(); if (p > 0) { const d = await midiRead(p); console.log(`  ACK: [${d.map(b=>b.toString(16).padStart(2,'0')).join(' ')}]`); break; }
    await sleep(100);
  }
  await sleep(300);

  // Verify creation
  const countAfterCreate = await queryRSLIST();
  console.log(`  Samples after create: ${countAfterCreate}`);
  if (countAfterCreate <= countBefore) { console.log('  FAILED to create'); await midiDisable(); return; }

  // Step 3: Read sample header — check SLNGTH
  console.log('\nStep 3: Read sample header (RSDATA)');
  const idxLo = sampleNumber & 0x7F, idxHi = (sampleNumber >> 7) & 0x7F;
  const header1 = await sendAndReceive([0xF0, 0x47, CHANNEL, 0x0A, 0x48, idxLo, idxHi, 0xF7], 512);
  console.log(`  Header: ${header1.length} bytes`);
  console.log(`  SLNGTH: ${parseSLNGTH(header1)}`);
  console.log(`  SMPEND: ${parseSMPEND(header1)}`);

  // Step 4: ASPACK write 1000 samples
  console.log(`\nStep 4: ASPACK write (${TEST_SAMPLE_COUNT} samples to index ${sampleNumber})`);
  const testSamples = Array.from({ length: TEST_SAMPLE_COUNT }, (_, i) =>
    Math.round(Math.sin(2 * Math.PI * 440 * i / SAMPLE_RATE) * 16000));
  const msg = [
    0xF0, 0x47, CHANNEL, 0x0D, 0x48,
    ...toNibbles(sampleNumber, 2),
    ...toNibbles(0, 4), // offset
    ...toNibbles(TEST_SAMPLE_COUNT, 4), // count
  ];
  for (const s of testSamples) msg.push(...sampleToNibbles(s));
  msg.push(0xF7);
  console.log(`  ASPACK message: ${msg.length} bytes`);
  await midiSend(msg);
  // Poll for REPLY
  let aspackOk = false;
  for (let i = 0; i < 30; i++) {
    const p = await midiPoll();
    if (p > 0) {
      const d = await midiRead(p);
      console.log(`  Reply: [${d.map(b=>b.toString(16).padStart(2,'0')).join(' ')}]`);
      aspackOk = d.length >= 4 && d[3] === 0x16;
      break;
    }
    await sleep(50);
  }
  console.log(`  ASPACK: ${aspackOk ? 'OK' : 'FAILED'}`);

  // Step 5: Read header after ASPACK
  console.log('\nStep 5: Read sample header after ASPACK');
  const header2 = await sendAndReceive([0xF0, 0x47, CHANNEL, 0x0A, 0x48, idxLo, idxHi, 0xF7], 512);
  console.log(`  SLNGTH: ${parseSLNGTH(header2)} (before ASPACK: ${parseSLNGTH(header1)})`);
  console.log(`  SMPEND: ${parseSMPEND(header2)} (before: ${parseSMPEND(header1)})`);

  await midiDisable();
  console.log('\nDone.');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
