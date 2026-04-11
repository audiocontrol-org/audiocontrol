/**
 * Phase 1: Test ASPACK multi-chunk writes with MESA-style protocol fixes.
 *
 * Tests systematically:
 * 1. Baseline: flag=0x00, no drain (known to fail at offset > 0)
 * 2. CDB flag byte $80 on send
 * 3. Drain pending data between chunks
 * 4. Flag $80 + drain (MESA's full protocol)
 * 5. Opcode 0x0B (SDATA) instead of 0x0D (ASPACK)
 *
 * Run: E2E_SCSI_BRIDGE_URL=http://s3k.local:7033 tsx modules/e2e-infra/src/node/lib/test-aspack-multichunk.ts
 */

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL ?? 'http://s3k.local:7033';
const TARGET_ID = 6;
const CHUNK_SIZE = 192; // MESA's chunk size
const TOTAL_SAMPLES = 1000;

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

async function midiSend(data: number[], flag = 0x00): Promise<void> {
  const len = data.length;
  await scsiExec(
    [0x0C, 0x00, (len >> 16) & 0xFF, (len >> 8) & 0xFF, len & 0xFF, flag],
    data, 0,
  );
}

async function midiPoll(): Promise<number> {
  // Flag 0x00 for data count query. Flag 0x80 returns 0 on S3000XL.
  const d = await scsiExec([0x0D, 0x00, 0x00, 0x00, 0x00, 0x00], [], 3);
  if (d.length >= 3) return (d[0] << 16) | (d[1] << 8) | d[2];
  return 0;
}

async function midiRead(len: number): Promise<number[]> {
  return scsiExec([0x0E, 0x00, (len >> 16) & 0xFF, (len >> 8) & 0xFF, len & 0xFF, 0x00], [], len);
}

async function drain(): Promise<void> {
  const pending = await midiPoll();
  if (pending > 0) {
    const data = await midiRead(pending);
    console.log(`    drained ${data.length} bytes`);
  }
}

async function pollForReply(maxAttempts = 10): Promise<number[]> {
  for (let i = 0; i < maxAttempts; i++) {
    const pending = await midiPoll();
    if (pending > 0) {
      return midiRead(pending);
    }
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

function buildPacket(opcode: number, sampleIdx: number, offset: number, samples: Int16Array, start: number, count: number): number[] {
  const msg = [
    0xF0, 0x47, 0x00, opcode, 0x48,
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

interface TestConfig {
  name: string;
  opcode: number;
  sendFlag: number;
  drainBetween: boolean;
}

async function runTest(config: TestConfig, sampleIdx: number, samples: Int16Array): Promise<boolean> {
  console.log(`\n--- ${config.name} ---`);
  const chunks = Math.ceil(TOTAL_SAMPLES / CHUNK_SIZE);

  await midiEnable();
  if (config.drainBetween) await drain();

  let offset = 0;
  let success = true;

  for (let i = 0; i < chunks; i++) {
    const count = Math.min(CHUNK_SIZE, TOTAL_SAMPLES - offset);
    const msg = buildPacket(config.opcode, sampleIdx, offset, samples, offset, count);

    await midiSend(msg, config.sendFlag);
    const reply = await pollForReply();

    if (reply.length >= 4 && reply[3] === 0x16) {
      const statusByte = reply.length >= 6 ? reply[5] : -1;
      console.log(`  Chunk ${i + 1}/${chunks}: offset=${offset} count=${count} — OK (status=${statusByte})`);
    } else {
      console.log(`  Chunk ${i + 1}/${chunks}: offset=${offset} — FAILED (reply: [${reply.slice(0, 10).map(b => b.toString(16).padStart(2, '0')).join(' ')}])`);
      success = false;
      break;
    }

    offset += count;

    if (config.drainBetween && i < chunks - 1) {
      await drain();
    }
  }

  await midiDisable();
  return success;
}

async function main() {
  console.log('=== ASPACK Multi-Chunk Test (Phase 1) ===');
  console.log(`Chunk size: ${CHUNK_SIZE}, Total: ${TOTAL_SAMPLES} samples\n`);

  const samples = new Int16Array(TOTAL_SAMPLES);
  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    samples[i] = Math.round(Math.sin(2 * Math.PI * 440 * i / 44100) * 16000);
  }

  // Verify device has samples
  const listResp = await fetch(`${BRIDGE_URL}/sds/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: [0xF0, 0x47, 0x00, 0x04, 0x48, 0xF7] }),
  });
  const listJson = await listResp.json() as { response?: number[] };
  const sampleCount = listJson.response && listJson.response.length > 6
    ? Math.floor((listJson.response.length - 6) / 24) : 0;

  if (sampleCount === 0) {
    console.error('No samples on device. Send one via SDS first.');
    return;
  }
  console.log(`Samples on device: ${sampleCount}. Writing to index 0.\n`);

  const tests: TestConfig[] = [
    { name: 'Baseline (flag=0x00, no drain)', opcode: 0x0D, sendFlag: 0x00, drainBetween: false },
    { name: 'Flag $80 on send', opcode: 0x0D, sendFlag: 0x80, drainBetween: false },
    { name: 'Drain between chunks', opcode: 0x0D, sendFlag: 0x00, drainBetween: true },
    { name: 'Flag $80 + drain (MESA protocol)', opcode: 0x0D, sendFlag: 0x80, drainBetween: true },
    { name: 'Opcode 0x0B (SDATA) + flag $80 + drain', opcode: 0x0B, sendFlag: 0x80, drainBetween: true },
  ];

  for (const test of tests) {
    const ok = await runTest(test, 0, samples);
    if (ok) {
      console.log(`  ✓ ALL CHUNKS SUCCEEDED`);
    }
  }

  console.log('\n=== Done ===');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
