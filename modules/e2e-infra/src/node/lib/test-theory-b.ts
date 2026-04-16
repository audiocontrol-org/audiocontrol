/**
 * Test Theory B in isolation: 40-sample stub header + data packet.
 * This is what the bridge does and it works from the web UI.
 * If it fails here, the problem is in this test, not the device.
 */

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

async function queryRSLIST(): Promise<number> {
  // Send RSLIST request
  await midiSend([0xF0, 0x47, CHANNEL, 0x04, 0x48, 0xF7]);
  // Poll for response
  for (let i = 0; i < 30; i++) {
    const pending = await midiPoll();
    if (pending > 0) {
      const data = await midiRead(pending);
      if (data.length < 6) return 0;
      const count = Math.floor((data.length - 6) / 24);
      console.log(`  RSLIST: ${data.length} bytes → ${count} samples`);
      return count;
    }
    await sleep(50);
  }
  console.log('  RSLIST: no response');
  return 0;
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
  console.log('=== Theory B Isolation Test ===\n');

  await midiEnable();

  // Step 1: Get current sample count
  console.log('Step 1: Query RSLIST');
  const countBefore = await queryRSLIST();
  console.log(`  Samples: ${countBefore}`);
  const sampleNumber = countBefore;

  // Step 2: SDS dump header with 40-sample length
  console.log(`\nStep 2: SDS dump header (sample #${sampleNumber}, length=40)`);
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
  console.log(`  Header bytes: [${dumpHeader.map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);
  await midiSend(dumpHeader);

  // Step 3: Read response — log everything
  console.log('\nStep 3: Read ACK');
  for (let i = 0; i < 10; i++) {
    const pending = await midiPoll();
    if (pending > 0) {
      const data = await midiRead(pending);
      console.log(`  Response (${data.length} bytes): [${data.map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);
      break;
    }
    await sleep(100);
  }

  // Step 4: SDS data packet
  console.log('\nStep 4: SDS data packet (40 samples silence)');
  const dataPkt = buildSdsDataPacket(0, new Array(40).fill(0));
  console.log(`  Packet bytes (first 20): [${dataPkt.slice(0, 20).map(b => b.toString(16).padStart(2, '0')).join(' ')}...]`);
  console.log(`  Packet total: ${dataPkt.length} bytes`);
  await midiSend(dataPkt);

  // Step 5: Read response
  console.log('\nStep 5: Read ACK for data packet');
  for (let i = 0; i < 10; i++) {
    const pending = await midiPoll();
    if (pending > 0) {
      const data = await midiRead(pending);
      console.log(`  Response (${data.length} bytes): [${data.map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);
      break;
    }
    await sleep(100);
  }

  // Step 6: Wait and check RSLIST
  console.log('\nStep 6: Wait 500ms then query RSLIST');
  await sleep(500);
  const countAfter = await queryRSLIST();
  console.log(`  Samples before: ${countBefore}, after: ${countAfter}`);

  if (countAfter > countBefore) {
    console.log('  ✓ Sample created!');
  } else {
    console.log('  ✗ Sample NOT created');
  }

  await midiDisable();
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
