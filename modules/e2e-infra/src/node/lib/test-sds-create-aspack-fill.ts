/**
 * Create sample via SDS (small), then overwrite data with ASPACK.
 *
 * 1. SDS: create sample with correct size but minimal data (silence)
 * 2. ASPACK: overwrite with real PCM data at full speed
 *
 * Run: E2E_SCSI_BRIDGE_URL=http://s3k.local:7033 tsx modules/e2e-infra/src/node/lib/test-sds-create-aspack-fill.ts
 */

import WebSocket from 'ws';

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL ?? 'http://s3k.local:7033';
const TARGET_ID = 6;
const SAMPLE_RATE = 44100;
const SAMPLE_COUNT = 44100;

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

/** Create sample via bridge WebSocket SDS (batched, fastest SDS path). */
async function createSampleViaSDS(sampleNumber: number, totalSamples: number): Promise<void> {
  const wsUrl = BRIDGE_URL.replace(/^http/, 'ws') + '/sds/stream';
  // Send silence — we'll overwrite with ASPACK
  const silence = new Array(totalSamples).fill(0);

  return new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => { ws.close(); reject(new Error('SDS timeout')); }, 300_000);

    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'sample-upload',
        target_id: TARGET_ID,
        sample_number: sampleNumber,
        channel: 0,
        sample_rate: SAMPLE_RATE,
        samples: silence,
      }));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'upload-complete') { clearTimeout(timeout); ws.close(); resolve(); }
      if (msg.type === 'sample-error') { clearTimeout(timeout); ws.close(); reject(new Error(msg.error)); }
    });

    ws.on('error', (err) => { clearTimeout(timeout); reject(err); });
  });
}

async function main() {
  console.log('=== SDS Create + ASPACK Fill Test ===\n');

  const samples = new Int16Array(SAMPLE_COUNT);
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    samples[i] = Math.round(Math.sin(2 * Math.PI * 440 * i / SAMPLE_RATE) * 16000);
  }

  const countBefore = await getSampleCount();
  console.log(`Samples before: ${countBefore}`);
  const sampleNumber = countBefore;

  // Step 1: Create sample via SDS (silence)
  console.log(`\nStep 1: Creating sample #${sampleNumber} via SDS (${SAMPLE_COUNT} samples of silence)...`);
  const t0 = performance.now();
  await createSampleViaSDS(sampleNumber, SAMPLE_COUNT);
  const sdsMs = performance.now() - t0;
  console.log(`  SDS create: ${Math.round(sdsMs)}ms`);

  const countAfterSDS = await getSampleCount();
  console.log(`  Samples after SDS: ${countAfterSDS}`);

  if (countAfterSDS <= countBefore) {
    console.error('  SDS did not create sample!');
    return;
  }

  // Find the RSLIST index of the new sample
  const rslistIndex = countAfterSDS - 1;
  console.log(`  New sample at RSLIST index: ${rslistIndex}`);

  // Step 2: Overwrite with real data via ASPACK
  console.log(`\nStep 2: Writing real PCM data via ASPACK...`);
  await midiEnable();

  const msg = [
    0xF0, 0x47, 0x00, 0x0D, 0x48,
    ...toNibbles(rslistIndex, 2),
    ...toNibbles(0, 4),
    ...toNibbles(SAMPLE_COUNT, 4),
  ];
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    msg.push(...sampleToNibbles(samples[i]));
  }
  msg.push(0xF7);

  console.log(`  ASPACK message: ${msg.length} bytes`);
  const tAspack = performance.now();
  await midiSend(msg);
  const reply = await midiRead(7);
  const aspackMs = performance.now() - tAspack;

  await midiDisable();

  if (reply.length >= 4 && reply[3] === 0x16) {
    console.log(`  ✓ ASPACK accepted: ${Math.round(aspackMs)}ms`);
  } else {
    console.log(`  ✗ ASPACK failed:`, reply.slice(0, 10));
  }

  const totalMs = sdsMs + aspackMs;
  const totalBytes = SAMPLE_COUNT * 2;
  console.log(`\n=== Results ===`);
  console.log(`SDS create (silence): ${Math.round(sdsMs)}ms`);
  console.log(`ASPACK fill (real data): ${Math.round(aspackMs)}ms`);
  console.log(`Total: ${Math.round(totalMs)}ms`);
  console.log(`ASPACK throughput: ${((totalBytes / 1024) / (aspackMs / 1000)).toFixed(1)} KB/s`);
  console.log(`\nFor comparison: pure SDS would take ~40s for this sample`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
