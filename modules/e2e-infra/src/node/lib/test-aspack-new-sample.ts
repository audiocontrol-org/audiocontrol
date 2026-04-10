/**
 * Test: can ASPACK create a new sample on the device?
 *
 * Sends a full sample via ASPACK (opcode 0x0D) to a sample index
 * that doesn't exist yet. Checks if the device creates it.
 *
 * Run: E2E_SCSI_BRIDGE_URL=http://s3k.local:7033 tsx modules/e2e-infra/src/node/lib/test-aspack-new-sample.ts
 */

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL ?? 'http://s3k.local:7033';
const TARGET_ID = 6;

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
  // Each sample name is 24 nibbles (12 bytes)
  return Math.floor((data.length - 6) / 24);
}

async function main() {
  console.log('=== ASPACK New Sample Test ===\n');

  const SAMPLE_COUNT = 4000;
  const samples = new Int16Array(SAMPLE_COUNT);
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    samples[i] = Math.round(Math.sin(2 * Math.PI * 440 * i / 44100) * 16000);
  }

  const countBefore = await getSampleCount();
  console.log(`Samples on device before: ${countBefore}`);

  // Use next available index
  const newIdx = countBefore;
  console.log(`Attempting ASPACK to new index ${newIdx}...\n`);

  // Build ASPACK message with all samples
  const msg = [
    0xF0, 0x47, 0x00, 0x0D, 0x48,
    ...toNibbles(newIdx, 2),
    ...toNibbles(0, 4),             // offset = 0
    ...toNibbles(SAMPLE_COUNT, 4),  // count
  ];
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    msg.push(...sampleToNibbles(samples[i]));
  }
  msg.push(0xF7);

  console.log(`Message size: ${msg.length} bytes`);

  await midiEnable();
  const t0 = performance.now();
  await midiSend(msg);
  const reply = await midiRead(7);
  const elapsed = performance.now() - t0;
  await midiDisable();

  console.log(`Reply: [${reply.slice(0, 10).map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);
  console.log(`Time: ${Math.round(elapsed)}ms`);

  if (reply.length >= 4 && reply[3] === 0x16) {
    console.log('✓ Device returned REPLY — accepted!');
  } else {
    console.log('✗ No REPLY or error');
  }

  // Check if sample count increased
  const countAfter = await getSampleCount();
  console.log(`\nSamples on device after: ${countAfter}`);

  if (countAfter > countBefore) {
    console.log(`✓ New sample created! (${countBefore} → ${countAfter})`);
  } else {
    console.log('✗ No new sample — ASPACK overwrote existing sample data only');
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
