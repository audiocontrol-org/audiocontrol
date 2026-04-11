/**
 * Test multi-chunk ASPACK on a pre-allocated sample.
 *
 * Hypothesis: multi-chunk fails because writing beyond the sample's
 * allocated memory returns empty reply. If we first allocate the
 * full size via a single-chunk ASPACK (which triggers reallocation),
 * then multi-chunk should work across the entire range.
 *
 * Run: E2E_SCSI_BRIDGE_URL=http://10.0.0.57:7033 tsx modules/e2e-infra/src/node/lib/test-aspack-multichunk-preallocated.ts
 */

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL ?? 'http://10.0.0.57:7033';
const TARGET_ID = 6;
const TOTAL_SAMPLES = 44100;

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
  const d = await scsiExec([0x0D, 0x00, 0x00, 0x00, 0x00, 0x00], [], 3);
  if (d.length >= 3) return (d[0] << 16) | (d[1] << 8) | d[2];
  return 0;
}

async function midiRead(len: number): Promise<number[]> {
  return scsiExec([0x0E, 0x00, (len >> 16) & 0xFF, (len >> 8) & 0xFF, len & 0xFF, 0x00], [], len);
}

async function pollForReply(): Promise<number[]> {
  for (let i = 0; i < 30; i++) {
    const pending = await midiPoll();
    if (pending > 0) return midiRead(pending);
  }
  return [];
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

function buildASPACK(sampleIdx: number, offset: number, samples: Int16Array, start: number, count: number): number[] {
  const msg = [0xF0, 0x47, 0x00, 0x0D, 0x48,
    ...toNibbles(sampleIdx, 2),
    ...toNibbles(offset, 4),
    ...toNibbles(count, 4),
  ];
  for (let i = 0; i < count; i++) {
    const s = start + i < samples.length ? samples[start + i] : 0;
    msg.push(...sampleToNibbles(s));
  }
  msg.push(0xF7);
  return msg;
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
  console.log('=== ASPACK Multi-Chunk on Pre-Allocated Sample ===\n');

  const samples = new Int16Array(TOTAL_SAMPLES);
  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    samples[i] = Math.round(Math.sin(2 * Math.PI * 440 * i / 44100) * 16000);
  }

  const count = await getSampleCount();
  if (count === 0) { console.error('No samples on device.'); return; }
  const sIdx = count - 1;
  console.log(`Samples on device: ${count}. Using index ${sIdx}.\n`);

  // Step 1: Pre-allocate by writing full sample in single chunk
  console.log(`Step 1: Single-chunk ASPACK (${TOTAL_SAMPLES} samples) to pre-allocate memory...`);
  await midiEnable();
  const allocMsg = buildASPACK(sIdx, 0, samples, 0, TOTAL_SAMPLES);
  const t0 = performance.now();
  await midiSend(allocMsg);
  const allocReply = await pollForReply();
  const allocMs = performance.now() - t0;
  await midiDisable();

  if (allocReply.length >= 4 && allocReply[3] === 0x16) {
    console.log(`  OK — ${Math.round(allocMs)}ms\n`);
  } else {
    console.error(`  Pre-allocation FAILED. Aborting.`);
    return;
  }

  // Step 2: Multi-chunk write across the full range
  for (const chunkSize of [192, 1536, 4096]) {
    const chunks = Math.ceil(TOTAL_SAMPLES / chunkSize);
    console.log(`Step 2: Multi-chunk (${chunkSize} samples/chunk, ${chunks} chunks)...`);

    await midiEnable();
    let offset = 0;
    let failed = false;
    const t1 = performance.now();

    for (let i = 0; i < chunks; i++) {
      const cnt = Math.min(chunkSize, TOTAL_SAMPLES - offset);
      const msg = buildASPACK(sIdx, offset, samples, offset, cnt);

      await midiSend(msg);
      const reply = await pollForReply();

      if (reply.length >= 4 && reply[3] === 0x16) {
        // OK
      } else {
        console.log(`  FAILED at chunk ${i + 1}/${chunks}, offset=${offset}`);
        failed = true;
        break;
      }
      offset += cnt;
    }

    const totalMs = performance.now() - t1;
    await midiDisable();

    if (!failed) {
      const throughput = (TOTAL_SAMPLES * 2) / (totalMs / 1000) / 1024;
      console.log(`  ✓ ALL ${chunks} CHUNKS SUCCEEDED — ${Math.round(totalMs)}ms, ${throughput.toFixed(1)} KB/s\n`);
    }
  }

  console.log('=== Done ===');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
