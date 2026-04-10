/**
 * Test ASPACK throughput via raw SCSI CDBs — bypassing the bridge's
 * send_and_receive control plane entirely.
 *
 * Uses /scsi/exec to send CDB 0x09 (enable MIDI), 0x0C (MIDI send),
 * 0x0E (MIDI read) directly. MIDI mode stays enabled across all chunks.
 *
 * Run: E2E_SCSI_BRIDGE_URL=http://s3k.local:7033 tsx modules/e2e-infra/src/node/lib/test-aspack-raw.ts
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
  const json = await resp.json() as { status: number; data_in: number[] };
  return json.data_in ?? [];
}

async function midiEnable(): Promise<void> {
  await scsiExec([0x09, 0x00, 0x01, 0x00, 0x00, 0x00]);
}

async function midiDisable(): Promise<void> {
  await scsiExec([0x09, 0x00, 0x00, 0x00, 0x00, 0x00]);
}

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
    nibbles.push(byte & 0x0F);
    nibbles.push((byte >> 4) & 0x0F);
  }
  return nibbles;
}

function sampleToNibbles(sample: number): number[] {
  const raw = sample & 0xFFFF;
  return [raw & 0x0F, (raw >> 4) & 0x0F, (raw >> 8) & 0x0F, (raw >> 12) & 0x0F];
}

function buildASPACK(sampleIdx: number, offset: number, samples: Int16Array, start: number, count: number): number[] {
  const msg = [
    0xF0, 0x47, 0x00, 0x0D, 0x48,
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

async function main() {
  console.log('=== ASPACK Raw SCSI Speed Test ===\n');

  const TOTAL_SAMPLES = 44100; // 1 second at 44.1kHz
  const samples = new Int16Array(TOTAL_SAMPLES);
  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    samples[i] = Math.round(Math.sin(2 * Math.PI * 440 * i / 44100) * 16000);
  }

  // Verify samples exist on device via control plane (simpler)
  const listCheckResp = await fetch(`${BRIDGE_URL}/sds/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: [0xF0, 0x47, 0x00, 0x04, 0x48, 0xF7] }),
  });
  const listJson = await listCheckResp.json() as { response?: number[] };
  const listResp = listJson.response ?? [];

  // Check for any non-zero response indicating samples exist
  const hasData = listResp.some(b => b !== 0);
  console.log(`RSLIST response: ${listResp.length} bytes, hasData=${hasData}`);
  if (!hasData) {
    console.error('No samples on device. Send one via SDS first.');
    return;
  }
  // Parse first few bytes to verify it's a valid Akai response
  console.log(`First bytes: [${listResp.slice(0, 20).map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);
  console.log('');

  for (const chunkSize of [4096, 8192, 16384, 44100]) {
    const chunks = Math.ceil(TOTAL_SAMPLES / chunkSize);
    const totalBytes = TOTAL_SAMPLES * 2;

    console.log(`--- Chunk: ${chunkSize} samples (${chunkSize * 2} bytes PCM) ---`);

    // Enable MIDI mode ONCE for all chunks
    await midiEnable();

    const times: number[] = [];
    let offset = 0;
    let failed = false;
    const t0 = performance.now();

    for (let i = 0; i < chunks; i++) {
      const count = Math.min(chunkSize, TOTAL_SAMPLES - offset);
      const msg = buildASPACK(0, offset, samples, offset, count);

      const t1 = performance.now();
      await midiSend(msg);
      const reply = await midiRead(7); // REPLY = F0 47 cc 16 48 ss F7
      const elapsed = performance.now() - t1;
      times.push(elapsed);

      if (reply.length >= 4 && reply[3] === 0x16) {
        // REPLY OK
      } else {
        console.error(`  Chunk ${i} at offset ${offset} failed:`, reply.slice(0, 10));
        failed = true;
        break;
      }

      offset += count;
    }

    // Disable MIDI mode
    await midiDisable();

    if (failed) continue;

    const totalMs = performance.now() - t0;
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const throughput = totalBytes / (totalMs / 1000);

    console.log(`  Chunks: ${chunks}`);
    console.log(`  Total: ${Math.round(totalMs)}ms`);
    console.log(`  Per-chunk: ${avg.toFixed(1)}ms`);
    console.log(`  Throughput: ${(throughput / 1024).toFixed(1)} KB/s`);
    console.log(`  vs batched SDS (2.2 KB/s): ${(throughput / 1024 / 2.2).toFixed(1)}x\n`);
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
