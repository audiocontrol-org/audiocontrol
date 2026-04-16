/**
 * Test: MESA-style SDATA bulk write — header + raw PCM data.
 *
 * Based on disassembly of SendAudioBufferToSampler:
 * 1. Send BuildSampleDataRequest header (SDATA 0x0B with offset/length)
 * 2. Send raw big-endian 16-bit PCM data via SRAW (CDB 0x0C, no SysEx framing)
 *
 * 2026-04-16: HYPOTHESIS — not yet proven. The header may need to be
 * followed by raw PCM data in the same or subsequent CDB 0x0C calls.
 *
 * Requires at least 1 sample on the device (writes to sample 0).
 *
 * Run: pnpm --filter @audiocontrol/e2e-infra exec tsx src/node/lib/test-sdata-bulk-write.ts
 */

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL ?? 'http://s3k.local:7033';
const TARGET_ID = 6;
const CHANNEL = 0;
const TEST_COUNT = 192; // MESA's chunk size from disassembly (0xC0)

async function scsiExec(cdb: number[], dataOut: number[] = [], expectedIn = 0): Promise<number[]> {
  const resp = await fetch(`${BRIDGE_URL}/scsi/exec`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_id: TARGET_ID, cdb, data_out: dataOut, expected_data_in: expectedIn }),
  });
  if (!resp.ok) throw new Error(`scsi/exec HTTP ${resp.status}`);
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
  const r = await scsiExec([0x0D, 0x00, 0x00, 0x00, 0x00, 0x00], [], 4);
  return r.length >= 3 ? (r[1] << 8) | r[2] : 0;
}

async function midiRead(len: number): Promise<number[]> {
  return scsiExec([0x0E, 0x00, (len >> 16) & 0xFF, (len >> 8) & 0xFF, len & 0xFF, 0x00], [], len);
}

function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }

function to7bit(value: number): number[] {
  return [value & 0x7F, (value >> 7) & 0x7F];
}

function to7bit32(value: number): number[] {
  return [value & 0x7F, (value >> 7) & 0x7F, (value >> 14) & 0x7F, (value >> 21) & 0x7F];
}

function hexDump(data: number[], max = 40): string {
  const s = data.slice(0, max).map(b => b.toString(16).padStart(2, '0')).join(' ');
  return data.length > max ? `${s}... (${data.length})` : s;
}

async function drainAll(label: string): Promise<number[]> {
  const all: number[] = [];
  for (let i = 0; i < 10; i++) {
    const p = await midiPoll();
    if (p > 0) {
      const d = await midiRead(p);
      all.push(...d);
      console.log(`  ${label} read ${d.length} bytes: [${hexDump(d)}]`);
    } else {
      break;
    }
    await sleep(20);
  }
  if (all.length === 0) console.log(`  ${label}: (no data)`);
  return all;
}

// Generate a 440Hz sine wave as big-endian 16-bit PCM
function generateSineWaveBE(count: number, sampleRate = 44100, freq = 440): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < count; i++) {
    const sample = Math.round(Math.sin(2 * Math.PI * freq * i / sampleRate) * 16000);
    // Big-endian: high byte first
    bytes.push((sample >> 8) & 0xFF, sample & 0xFF);
  }
  return bytes;
}

async function main() {
  console.log('=== SDATA Bulk Write Test (MESA-style) ===');
  console.log(`2026-04-16: Testing header + raw BE PCM data against sample 0\n`);

  await midiEnable();

  // Step 0: Read sample header to get SLNGTH before we start
  console.log('Step 0: Read sample 0 header (baseline)');
  const rsdata = [0xF0, 0x47, CHANNEL, 0x0A, 0x48, ...to7bit(0), 0xF7];
  await midiSend(rsdata);
  await sleep(200);
  const headerResp = await drainAll('Header');
  if (headerResp.length >= 67) {
    let slngth = 0;
    for (let i = 0; i < 4; i++) {
      slngth |= (((headerResp[59+i*2+1]&0xF)<<4)|(headerResp[59+i*2]&0xF)) << (i*8);
    }
    console.log(`  SLNGTH = ${slngth}\n`);
  }

  // Step 1: Send BuildSampleDataRequest header
  const header = [
    0xF0, 0x47, CHANNEL, 0x0B, 0x48,
    ...to7bit(0),             // sample 0
    ...to7bit32(0),           // offset = 0
    ...to7bit32(TEST_COUNT),  // count = 192
    0x01, 0x00, 0xF7,
  ];
  console.log(`Step 1: Send SDATA header (offset=0, count=${TEST_COUNT})`);
  console.log(`  [${hexDump(header)}]`);
  await midiSend(header, 0x01); // flag 0x01 like SRAW
  await sleep(100);
  await drainAll('After header');

  // Step 2: Send raw big-endian 16-bit PCM data (no SysEx framing)
  const pcmData = generateSineWaveBE(TEST_COUNT);
  console.log(`\nStep 2: Send raw BE PCM data (${pcmData.length} bytes = ${TEST_COUNT} samples)`);
  console.log(`  First bytes: [${hexDump(pcmData, 20)}]`);
  await midiSend(pcmData, 0x01); // flag 0x01 like SRAW
  await sleep(200);
  await drainAll('After PCM');

  // Step 3: Try alternative — header + PCM in single CDB send
  console.log(`\nStep 3: Send header + PCM concatenated in single CDB`);
  const combined = [...header.slice(0, -1), ...pcmData, 0xF7]; // replace F7, append PCM, add F7 at end
  console.log(`  Total: ${combined.length} bytes`);
  console.log(`  Start: [${hexDump(combined, 30)}]`);
  await midiSend(combined, 0x01);
  await sleep(200);
  await drainAll('After combined');

  // Step 4: Try another alternative — header with PCM appended inside SysEx (nibble-encoded)
  // Like ASPACK but with SDATA opcode instead
  console.log(`\nStep 4: SDATA header + nibble-encoded PCM (like ASPACK format but opcode 0x0B)`);
  const nibbleMsg = [
    0xF0, 0x47, CHANNEL, 0x0B, 0x48,
    ...to7bit(0),             // sample 0
    ...to7bit32(0),           // offset = 0
    ...to7bit32(TEST_COUNT),  // count = 192
  ];
  // Append nibble-encoded PCM (same encoding as ASPACK)
  for (let i = 0; i < TEST_COUNT; i++) {
    const sample = Math.round(Math.sin(2 * Math.PI * 440 * i / 44100) * 16000);
    const raw = sample & 0xFFFF;
    nibbleMsg.push(raw & 0x0F, (raw >> 4) & 0x0F, (raw >> 8) & 0x0F, (raw >> 12) & 0x0F);
  }
  nibbleMsg.push(0xF7);
  console.log(`  Total: ${nibbleMsg.length} bytes`);
  await midiSend(nibbleMsg, 0x00);
  await sleep(200);
  await drainAll('After nibble SDATA');

  // Check for REPLY in any response
  console.log('\nStep 5: Final drain (check for delayed responses)');
  await sleep(500);
  await drainAll('Final');

  await midiDisable();
  console.log('\nDone.');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
