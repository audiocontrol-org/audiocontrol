/**
 * Test ASPACK (opcode 0x0D) throughput for sample data writes.
 *
 * ASPACK writes sample PCM data to the device using the Akai proprietary
 * protocol. Each sample word is nibble-encoded (4 nibbles per 16-bit sample).
 *
 * Run: E2E_SCSI_BRIDGE_URL=http://s3k.local:7033 tsx modules/e2e-infra/src/node/lib/test-aspack-speed.ts
 */

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL ?? 'http://s3k.local:7033';

async function sysexSendReceive(data: number[]): Promise<number[]> {
  const resp = await fetch(`${BRIDGE_URL}/sds/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: data }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${text}`);
  }
  const json = await resp.json() as { response?: number[] };
  return json.response ?? [];
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
  return [
    raw & 0x0F,
    (raw >> 4) & 0x0F,
    (raw >> 8) & 0x0F,
    (raw >> 12) & 0x0F,
  ];
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
  console.log('=== ASPACK Speed Test ===\n');

  // Generate sine wave
  const TOTAL_SAMPLES = 4000;
  const samples = new Int16Array(TOTAL_SAMPLES);
  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    samples[i] = Math.round(Math.sin(2 * Math.PI * 440 * i / 44100) * 16000);
  }

  // First, we need a sample on the device to write to.
  // Read sample list to find one.
  const listResp = await sysexSendReceive([0xF0, 0x47, 0x00, 0x04, 0x48, 0xF7]);
  if (listResp.length < 10) {
    console.error('No samples on device. Send one via SDS first.');
    return;
  }
  console.log('Writing to sample index 0\n');

  // Test different chunk sizes
  for (const chunkSize of [48, 96, 192, 384]) {
    const chunks = Math.ceil(TOTAL_SAMPLES / chunkSize);
    const totalBytes = TOTAL_SAMPLES * 2;

    console.log(`--- Chunk size: ${chunkSize} samples (${chunkSize * 4} nibbles, ${chunkSize * 2} bytes PCM) ---`);
    console.log(`  Chunks: ${chunks}, Total: ${totalBytes} bytes`);

    const times: number[] = [];
    let offset = 0;
    const t0 = performance.now();

    for (let i = 0; i < chunks; i++) {
      const count = Math.min(chunkSize, TOTAL_SAMPLES - offset);
      const msg = buildASPACK(0, offset, samples, offset, count);

      const t1 = performance.now();
      const resp = await sysexSendReceive(msg);
      const elapsed = performance.now() - t1;
      times.push(elapsed);

      // Check for REPLY
      if (resp.length >= 6 && resp[3] === 0x16) {
        // OK
      } else if (resp.length >= 6 && resp[3] === 0x15) {
        console.error(`  ERROR at offset ${offset}: device rejected data`);
        break;
      } else {
        console.error(`  Unexpected response at offset ${offset}:`, resp.slice(0, 10));
        break;
      }

      offset += count;
    }

    const totalMs = performance.now() - t0;
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const throughput = totalBytes / (totalMs / 1000);

    console.log(`  Total: ${Math.round(totalMs)}ms`);
    console.log(`  Per-chunk: ${avg.toFixed(1)}ms`);
    console.log(`  Throughput: ${(throughput / 1024).toFixed(1)} KB/s`);
    console.log('');
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
