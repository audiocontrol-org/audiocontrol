/**
 * Hybrid: SDS dump header to create sample, ASPACK to write data.
 *
 * SDS dump header creates the sample slot and allocates memory.
 * ASPACK (opcode 0x0D) writes the PCM data at 10x the SDS speed.
 *
 * Run: E2E_SCSI_BRIDGE_URL=http://s3k.local:7033 tsx modules/e2e-infra/src/node/lib/test-sds-header-aspack-data.ts
 */

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL ?? 'http://s3k.local:7033';
const TARGET_ID = 6;
const SAMPLE_RATE = 44100;
const SAMPLE_COUNT = 44100; // 1 second

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

async function midiRead(len: number): Promise<number[]> {
  return scsiExec([0x0E, 0x00, (len >> 16) & 0xFF, (len >> 8) & 0xFF, len & 0xFF, 0x00], [], len);
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

async function getSampleCount(): Promise<number> {
  const resp = await fetch(`${BRIDGE_URL}/sds/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: [0xF0, 0x47, 0x00, 0x04, 0x48, 0xF7] }),
  });
  const json = await resp.json() as { response?: number[] };
  const data = json.response ?? [];
  if (data.length < 6) return 0;
  return Math.floor((data.length - 6) / 24);
}

async function main() {
  console.log('=== Hybrid SDS Header + ASPACK Data Test ===\n');

  // Generate sine wave
  const samples = new Int16Array(SAMPLE_COUNT);
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    samples[i] = Math.round(Math.sin(2 * Math.PI * 440 * i / SAMPLE_RATE) * 16000);
  }

  const countBefore = await getSampleCount();
  console.log(`Samples before: ${countBefore}`);
  const sampleNumber = countBefore; // next free slot

  await midiEnable();

  // Step 1: Send SDS Dump Header to create the sample
  console.log(`\nStep 1: SDS Dump Header (sample #${sampleNumber}, ${SAMPLE_COUNT} samples)...`);
  const periodNs = Math.floor(1_000_000_000 / SAMPLE_RATE);
  const snLo = sampleNumber & 0x7F;
  const snHi = (sampleNumber >> 7) & 0x7F;
  const dumpHeader = [
    0xF0, 0x7E, 0x00, 0x01,
    snLo, snHi,
    16, // bits
    periodNs & 0x7F, (periodNs >> 7) & 0x7F, (periodNs >> 14) & 0x7F,
    SAMPLE_COUNT & 0x7F, (SAMPLE_COUNT >> 7) & 0x7F, (SAMPLE_COUNT >> 14) & 0x7F,
    0, 0, 0, // loop start
    0, 0, 0, // loop end
    0,        // loop type
    0xF7,
  ];

  const t0 = performance.now();
  await midiSend(dumpHeader);
  // Read ACK (might get WAIT then ACK)
  const headerAck = await midiRead(12);
  const headerMs = performance.now() - t0;
  console.log(`  Header sent: ${Math.round(headerMs)}ms`);
  console.log(`  ACK bytes: [${headerAck.slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);

  // Step 2: Send sample data via ASPACK in chunks
  const CHUNK_SIZE = SAMPLE_COUNT; // Send everything in one chunk
  const totalBytes = SAMPLE_COUNT * 2;
  const chunks = Math.ceil(SAMPLE_COUNT / CHUNK_SIZE);
  console.log(`\nStep 2: ASPACK data (${chunks} chunks of ${CHUNK_SIZE} samples)...`);

  const tData = performance.now();
  let offset = 0;
  for (let i = 0; i < chunks; i++) {
    const count = Math.min(CHUNK_SIZE, SAMPLE_COUNT - offset);
    const msg = [
      0xF0, 0x47, 0x00, 0x0D, 0x48,
      ...toNibbles(sampleNumber, 2),
      ...toNibbles(offset, 4),
      ...toNibbles(count, 4),
    ];
    for (let j = 0; j < count; j++) {
      msg.push(...sampleToNibbles(samples[offset + j]));
    }
    msg.push(0xF7);

    await midiSend(msg);
    const reply = await midiRead(7);

    if (reply.length >= 4 && reply[3] === 0x16) {
      console.log(`  Chunk ${i + 1}/${chunks}: offset=${offset} count=${count} — OK`);
    } else {
      console.error(`  Chunk ${i + 1}/${chunks}: FAILED`, reply.slice(0, 10));
      break;
    }
    offset += count;
  }
  const dataMs = performance.now() - tData;

  await midiDisable();

  const totalMs = performance.now() - t0;
  const throughput = totalBytes / (totalMs / 1000);

  console.log(`\n=== Results ===`);
  console.log(`Header: ${Math.round(headerMs)}ms`);
  console.log(`Data: ${Math.round(dataMs)}ms`);
  console.log(`Total: ${Math.round(totalMs)}ms`);
  console.log(`Throughput: ${(throughput / 1024).toFixed(1)} KB/s`);

  const countAfter = await getSampleCount();
  console.log(`\nSamples before: ${countBefore}, after: ${countAfter}`);
  if (countAfter > countBefore) {
    console.log('✓ New sample created via hybrid SDS header + ASPACK data!');
  } else {
    console.log('✗ No new sample created');
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
