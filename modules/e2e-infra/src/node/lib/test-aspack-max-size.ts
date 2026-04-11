/**
 * Find the maximum single-chunk ASPACK message size the S3000XL accepts.
 *
 * The device accepts 44100 samples (176KB SysEx) in one chunk. How far can we go?
 * Binary search for the ceiling.
 *
 * Run: E2E_SCSI_BRIDGE_URL=http://10.0.0.57:7033 tsx modules/e2e-infra/src/node/lib/test-aspack-max-size.ts
 */

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL ?? 'http://10.0.0.57:7033';
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
  await scsiExec(
    [0x0C, 0x00, (len >> 16) & 0xFF, (len >> 8) & 0xFF, len & 0xFF, 0x00],
    data, 0,
  );
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

function buildASPACK(sampleIdx: number, sampleCount: number): number[] {
  const msg = [0xF0, 0x47, 0x00, 0x0D, 0x48,
    ...toNibbles(sampleIdx, 2),
    ...toNibbles(0, 4),              // offset = 0
    ...toNibbles(sampleCount, 4),    // count
  ];
  // Fill with a simple pattern (alternating values)
  for (let i = 0; i < sampleCount; i++) {
    const val = (i % 256);
    msg.push(val & 0x0F, (val >> 4) & 0x0F, 0, 0);
  }
  msg.push(0xF7);
  return msg;
}

async function testSize(sampleCount: number, sampleIdx: number): Promise<boolean> {
  const msgSize = 5 + 4 + 8 + 8 + sampleCount * 4 + 1; // header + nibbles + F7
  const pcmBytes = sampleCount * 2;

  process.stdout.write(`  ${sampleCount} samples (${(pcmBytes / 1024).toFixed(1)} KB PCM, ${(msgSize / 1024).toFixed(1)} KB SysEx)... `);

  await midiEnable();
  const msg = buildASPACK(sampleIdx, sampleCount);
  const t0 = performance.now();

  try {
    await midiSend(msg);
  } catch (err) {
    console.log(`SEND FAILED: ${err}`);
    await midiDisable();
    return false;
  }

  const reply = await pollForReply();
  const ms = performance.now() - t0;
  await midiDisable();

  if (reply.length >= 4 && reply[3] === 0x16) {
    const throughput = pcmBytes / (ms / 1000) / 1024;
    console.log(`OK (${Math.round(ms)}ms, ${throughput.toFixed(1)} KB/s)`);
    return true;
  } else {
    console.log(`FAILED (reply: ${reply.length} bytes)`);
    return false;
  }
}

async function main() {
  console.log('=== ASPACK Maximum Message Size Test ===\n');

  // Use last sample on device
  const listResp = await fetch(`${BRIDGE_URL}/sds/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: [0xF0, 0x47, 0x00, 0x04, 0x48, 0xF7] }),
  });
  const listJson = await listResp.json() as { response?: number[] };
  const sampleCount = listJson.response && listJson.response.length > 6
    ? Math.floor((listJson.response.length - 6) / 24) : 0;
  if (sampleCount === 0) {
    console.error('No samples on device.');
    return;
  }
  const sIdx = sampleCount - 1;
  console.log(`Using sample index ${sIdx}\n`);

  // Test increasing sizes
  console.log('--- Linear sweep ---');
  const sizes = [
    66000,    // known to work
    67000,
    67500,
    68000,
    68500,
    69000,
    69500,
    70000,    // known to fail
  ];

  let lastSuccess = 0;
  for (const size of sizes) {
    const ok = await testSize(size, sIdx);
    if (ok) {
      lastSuccess = size;
    } else {
      break;
    }
  }

  console.log(`\n--- Result ---`);
  console.log(`Last successful: ${lastSuccess} samples (${(lastSuccess * 2 / 1024).toFixed(1)} KB PCM)`);
  console.log(`SysEx message size: ${((lastSuccess * 4 + 26) / 1024).toFixed(1)} KB`);

  if (lastSuccess >= 250000) {
    console.log('Ceiling not found — try larger sizes.');
  }

  console.log('\n=== Done ===');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
