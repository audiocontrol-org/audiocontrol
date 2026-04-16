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

async function main() {
  console.log('=== Theory B — Fixed RSLIST Parsing ===\n');
  await midiEnable();

  const countBefore = await queryRSLIST();
  console.log(`Samples in device: ${countBefore}`);
  const sampleNumber = countBefore; // next free slot
  console.log(`Will create sample #${sampleNumber}\n`);

  // SDS dump header (40 samples)
  const SAMPLE_RATE = 44100;
  const periodNs = Math.floor(1_000_000_000 / SAMPLE_RATE);
  const dumpHeader = [
    0xF0, 0x7E, CHANNEL, 0x01,
    sampleNumber & 0x7F, (sampleNumber >> 7) & 0x7F,
    16,
    periodNs & 0x7F, (periodNs >> 7) & 0x7F, (periodNs >> 14) & 0x7F,
    40 & 0x7F, 0, 0,
    0, 0, 0, 0, 0, 0, 0,
    0xF7,
  ];
  console.log('Sending dump header...');
  await midiSend(dumpHeader);
  // Read ACK
  for (let i = 0; i < 10; i++) {
    const pending = await midiPoll();
    if (pending > 0) {
      const data = await midiRead(pending);
      console.log(`  ACK: [${data.map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);
      break;
    }
    await sleep(100);
  }

  // Data packet
  console.log('Sending data packet...');
  await midiSend(buildSdsDataPacket(0, new Array(40).fill(0)));
  for (let i = 0; i < 10; i++) {
    const pending = await midiPoll();
    if (pending > 0) {
      const data = await midiRead(pending);
      console.log(`  ACK: [${data.map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);
      break;
    }
    await sleep(100);
  }

  await sleep(500);

  const countAfter = await queryRSLIST();
  console.log(`\nSamples before: ${countBefore}, after: ${countAfter}`);
  if (countAfter > countBefore) {
    console.log('✓ Sample created!');
  } else {
    console.log('✗ Sample NOT created');
  }

  await midiDisable();
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
