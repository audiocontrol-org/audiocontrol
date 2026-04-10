/**
 * Test batched SDS upload — send multiple SDS packets in one SCSI MIDI send,
 * read multiple ACKs in one SCSI MIDI read.
 *
 * Run: E2E_SCSI_BRIDGE_URL=http://s3k.local:7033 tsx modules/e2e-infra/src/node/lib/test-sds-batch.ts
 */

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL ?? 'http://s3k.local:7033';
const TARGET_ID = 6;
const SDS_CHANNEL = 0;

// -- SCSI exec helper ---------------------------------------------------------

async function scsiExec(cdb: number[], dataOut: number[] = [], expectedIn = 0): Promise<number[]> {
  const resp = await fetch(`${BRIDGE_URL}/scsi/exec`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      target_id: TARGET_ID,
      cdb,
      data_out: dataOut,
      expected_data_in: expectedIn,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`scsi/exec HTTP ${resp.status}: ${text}`);
  }
  const json = await resp.json() as { status: number; data_in: number[] };
  return json.data_in ?? [];
}

async function midiSend(data: number[]): Promise<void> {
  const len = data.length;
  const cdb = [0x0C, 0x00, (len >> 16) & 0xFF, (len >> 8) & 0xFF, len & 0xFF, 0x00];
  await scsiExec(cdb, data, 0);
}

async function midiRead(len: number): Promise<number[]> {
  const cdb = [0x0E, 0x00, (len >> 16) & 0xFF, (len >> 8) & 0xFF, len & 0xFF, 0x00];
  return scsiExec(cdb, [], len);
}

async function midiEnable(): Promise<void> {
  await scsiExec([0x09, 0x00, 0x01, 0x00, 0x00, 0x00]);
}

async function midiDisable(): Promise<void> {
  await scsiExec([0x09, 0x00, 0x00, 0x00, 0x00, 0x00]);
}

// -- SDS helpers ---------------------------------------------------------------

function encodeSdsSample(sample: number): [number, number, number] {
  const raw = sample & 0xFFFF;
  return [(raw >> 9) & 0x7F, (raw >> 2) & 0x7F, (raw << 5) & 0x60];
}

function buildDumpHeader(sampleNumber: number, sampleRate: number, totalSamples: number): number[] {
  const snLo = sampleNumber & 0x7F;
  const snHi = (sampleNumber >> 7) & 0x7F;
  const p = Math.floor(1_000_000_000 / sampleRate);
  return [
    0xF0, 0x7E, SDS_CHANNEL, 0x01, snLo, snHi, 16,
    p & 0x7F, (p >> 7) & 0x7F, (p >> 14) & 0x7F,
    totalSamples & 0x7F, (totalSamples >> 7) & 0x7F, (totalSamples >> 14) & 0x7F,
    0, 0, 0, 0, 0, 0, 0, 0xF7,
  ];
}

function buildDataPacket(pktNum: number, samples: Int16Array, offset: number): number[] {
  const SPP = 40;
  const data = [0xF0, 0x7E, SDS_CHANNEL, 0x02, pktNum & 0x7F];
  let checksum = 0x7E ^ SDS_CHANNEL ^ 0x02 ^ (pktNum & 0x7F);
  for (let i = 0; i < SPP; i++) {
    const s = offset + i < samples.length ? samples[offset + i] : 0;
    const [a, b, c] = encodeSdsSample(s);
    checksum ^= a; checksum ^= b; checksum ^= c;
    data.push(a, b, c);
  }
  data.push(checksum & 0x7F, 0xF7);
  return data;
}

function parseAcks(data: number[]): string[] {
  const acks: string[] = [];
  for (let i = 0; i < data.length; i++) {
    if (data[i] === 0xF0 && i + 5 < data.length && data[i + 1] === 0x7E) {
      const code = data[i + 3];
      switch (code) {
        case 0x7F: acks.push('ACK'); break;
        case 0x7E: acks.push('NAK'); break;
        case 0x7D: acks.push('CANCEL'); break;
        case 0x7C: acks.push('WAIT'); break;
        default: acks.push(`UNKNOWN(0x${code.toString(16)})`);
      }
      i += 5; // skip to after F7
    }
  }
  return acks;
}

// -- Tests --------------------------------------------------------------------

async function testSinglePacket(samples: Int16Array): Promise<number> {
  console.log('\n--- Single packet (baseline) ---');
  await midiEnable();

  // Header
  const header = buildDumpHeader(98, 44100, 40); // Just 1 packet worth
  const t0 = performance.now();
  await midiSend(header);
  const headerAck = await midiRead(12); // WAIT(6) + ACK(6)
  console.log('  Header ACKs:', parseAcks(headerAck));

  // One data packet
  const pkt = buildDataPacket(0, samples, 0);
  const t1 = performance.now();
  await midiSend(pkt);
  const ack = await midiRead(6);
  const t2 = performance.now();
  console.log('  Packet ACK:', parseAcks(ack));
  console.log(`  Send: ${Math.round(t2 - t1)}ms`);

  await midiDisable();
  return t2 - t1;
}

async function testBatchPackets(samples: Int16Array, batchSize: number): Promise<number> {
  console.log(`\n--- Batch ${batchSize} packets ---`);
  const totalSamples = batchSize * 40;
  await midiEnable();

  // Header
  const header = buildDumpHeader(97, 44100, totalSamples);
  await midiSend(header);
  const headerAck = await midiRead(12);
  console.log('  Header ACKs:', parseAcks(headerAck));

  // Batch: concatenate N packets into one MIDI send
  const batch: number[] = [];
  for (let i = 0; i < batchSize; i++) {
    batch.push(...buildDataPacket(i & 0x7F, samples, i * 40));
  }

  const t0 = performance.now();
  await midiSend(batch);
  // Read all ACKs at once: 6 bytes each
  const acks = await midiRead(batchSize * 6);
  const t1 = performance.now();

  const parsed = parseAcks(acks);
  console.log(`  ACKs (${parsed.length}):`, parsed.slice(0, 5).join(', '), parsed.length > 5 ? '...' : '');
  console.log(`  Total: ${Math.round(t1 - t0)}ms`);
  console.log(`  Per-packet: ${((t1 - t0) / batchSize).toFixed(1)}ms`);

  await midiDisable();
  return (t1 - t0) / batchSize;
}

// -- Main ---------------------------------------------------------------------

async function main() {
  console.log('=== SDS Batch Test ===');
  console.log(`Bridge: ${BRIDGE_URL}`);

  // Generate test samples
  const samples = new Int16Array(2000);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = Math.round(Math.sin(2 * Math.PI * 440 * i / 44100) * 16000);
  }

  // Baseline: single packet
  const singleMs = await testSinglePacket(samples);

  // Try batches of increasing size
  for (const batchSize of [2, 5, 10, 20, 50]) {
    try {
      const batchMs = await testBatchPackets(samples, batchSize);
      console.log(`  Speedup vs single: ${(singleMs / batchMs).toFixed(1)}x`);
    } catch (err) {
      console.error(`  Batch ${batchSize} FAILED:`, err);
      // Restart MIDI mode for next test
      try { await midiDisable(); } catch { /* ignore */ }
      break;
    }
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
