/**
 * ASPACK upload SLNGTH investigation.
 *
 * Tests two approaches for creating a sample via SDS + filling via ASPACK:
 *
 * Theory A: Real length in SDS dump header, no data packet, ASPACK fills data.
 * Theory B: 40-sample stub header + data packet, ASPACK fills data, SDATA patches SLNGTH.
 *
 * All operations use raw SCSI CDBs through /scsi/exec — no client library,
 * no bridge MIDI session, no caching. Single MIDI session throughout.
 *
 * Run: E2E_SCSI_BRIDGE_URL=http://s3k.local:7033 pnpm --filter @audiocontrol/e2e-infra exec tsx src/node/lib/test-aspack-slngth.ts
 */

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL ?? 'http://s3k.local:7033';
const TARGET_ID = 6;
const CHANNEL = 0;
const TEST_SAMPLE_COUNT = 1000; // Small sample for fast testing
const SAMPLE_RATE = 44100;

// ---------------------------------------------------------------------------
// Raw SCSI helpers
// ---------------------------------------------------------------------------

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
  const result = await scsiExec([0x0D, 0x00, 0x00, 0x00, 0x00, 0x00], [], 4);
  if (result.length >= 4) return (result[2] << 8) | result[3];
  if (result.length >= 3) return (result[1] << 8) | result[2];
  if (result.length >= 2) return result[1];
  if (result.length >= 1) return result[0];
  return 0;
}

async function midiRead(len: number): Promise<number[]> {
  return scsiExec([0x0E, 0x00, (len >> 16) & 0xFF, (len >> 8) & 0xFF, len & 0xFF, 0x00], [], len);
}

// ---------------------------------------------------------------------------
// SysEx helpers (within the same MIDI session)
// ---------------------------------------------------------------------------

async function sendAndReceive(msg: number[], maxResponseLen = 1024): Promise<number[]> {
  await midiSend(msg);
  for (let i = 0; i < 30; i++) {
    const pending = await midiPoll();
    if (pending > 0) {
      return midiRead(Math.min(pending, maxResponseLen));
    }
    await sleep(50);
  }
  return [];
}

async function queryRSLIST(): Promise<number> {
  const resp = await sendAndReceive([0xF0, 0x47, CHANNEL, 0x04, 0x48, 0xF7], 4096);
  if (resp.length < 6) return 0;
  return Math.floor((resp.length - 6) / 24);
}

async function readSampleHeader(index: number): Promise<number[]> {
  const idxLo = index & 0x7F;
  const idxHi = (index >> 7) & 0x7F;
  return sendAndReceive([0xF0, 0x47, CHANNEL, 0x0A, 0x48, idxLo, idxHi, 0xF7], 512);
}

function parseSLNGTH(headerData: number[]): number {
  // SLNGTH at nibble offset 59 from payload start (byte 5 in SysEx frame)
  const off = 5 + 59;
  if (headerData.length < off + 8) return -1;
  let value = 0;
  for (let i = 0; i < 4; i++) {
    const lo = headerData[off + i * 2] & 0x0F;
    const hi = headerData[off + i * 2 + 1] & 0x0F;
    value |= ((hi << 4) | lo) << (i * 8);
  }
  return value;
}

function parseSMPEND(headerData: number[]): number {
  const off = 5 + 75;
  if (headerData.length < off + 8) return -1;
  let value = 0;
  for (let i = 0; i < 4; i++) {
    const lo = headerData[off + i * 2] & 0x0F;
    const hi = headerData[off + i * 2 + 1] & 0x0F;
    value |= ((hi << 4) | lo) << (i * 8);
  }
  return value;
}

// ---------------------------------------------------------------------------
// SDS + ASPACK helpers
// ---------------------------------------------------------------------------

function encodeSdsSample(sample: number): number[] {
  const raw = sample & 0xFFFF;
  return [
    (raw >> 9) & 0x7F,
    (raw >> 2) & 0x7F,
    (raw << 5) & 0x60,
  ];
}

function buildSdsDataPacket(packetNum: number, samples: number[]): number[] {
  const pkt = [0xF0, 0x7E, CHANNEL, 0x02, packetNum & 0x7F];
  let checksum = 0x7E ^ CHANNEL ^ 0x02 ^ (packetNum & 0x7F);
  for (const s of samples) {
    const enc = encodeSdsSample(s);
    checksum ^= enc[0]; checksum ^= enc[1]; checksum ^= enc[2];
    pkt.push(...enc);
  }
  // Pad to 120 bytes if needed
  while (pkt.length - 5 < 120) {
    pkt.push(0); checksum ^= 0;
  }
  pkt.push(checksum & 0x7F, 0xF7);
  return pkt;
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

function buildAspackChunk(sampleIndex: number, offset: number, samples: number[]): number[] {
  const msg = [
    0xF0, 0x47, CHANNEL, 0x0D, 0x48,
    ...toNibbles(sampleIndex, 2),
    ...toNibbles(offset, 4),
    ...toNibbles(samples.length, 4),
  ];
  for (const s of samples) {
    msg.push(...sampleToNibbles(s));
  }
  msg.push(0xF7);
  return msg;
}

async function waitForAck(): Promise<string> {
  // Poll + read with retries. Device may respond with WAIT then ACK.
  let allBytes: number[] = [];
  for (let attempt = 0; attempt < 30; attempt++) {
    const pending = await midiPoll();
    if (pending > 0) {
      const data = await midiRead(pending);
      allBytes.push(...data);
      // Scan for SDS handshake: F0 7E ch [type] pp F7
      for (let i = 0; i < allBytes.length - 3; i++) {
        if (allBytes[i] === 0xF0 && allBytes[i + 1] === 0x7E) {
          const type = allBytes[i + 3];
          if (type === 0x7F) return 'ACK';
          if (type === 0x7E) return 'NAK';
          if (type === 0x7D) return 'CANCEL';
          // WAIT (0x7C) — keep polling for ACK
        }
      }
    }
    await sleep(100);
  }
  return `TIMEOUT (${allBytes.length} bytes): [${allBytes.slice(0, 20).map(b => b.toString(16).padStart(2, '0')).join(' ')}]`;
}

async function sendAspackAndWaitReply(msg: number[]): Promise<boolean> {
  await midiSend(msg);
  for (let i = 0; i < 30; i++) {
    const pending = await midiPoll();
    if (pending > 0) {
      const reply = await midiRead(pending);
      return reply.length >= 4 && reply[3] === 0x16; // REPLY opcode
    }
    await sleep(10);
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Test functions
// ---------------------------------------------------------------------------

async function testTheoryA(sampleNumber: number): Promise<void> {
  console.log('\n========================================');
  console.log('THEORY A: Real length in dump header, no data packet, ASPACK fills');
  console.log('========================================\n');

  const periodNs = Math.floor(1_000_000_000 / SAMPLE_RATE);

  // Step 1: Send dump header with real length
  const dumpHeader = [
    0xF0, 0x7E, CHANNEL, 0x01,
    sampleNumber & 0x7F, (sampleNumber >> 7) & 0x7F,
    16,
    periodNs & 0x7F, (periodNs >> 7) & 0x7F, (periodNs >> 14) & 0x7F,
    TEST_SAMPLE_COUNT & 0x7F, (TEST_SAMPLE_COUNT >> 7) & 0x7F, (TEST_SAMPLE_COUNT >> 14) & 0x7F,
    0, 0, 0, 0, 0, 0, 0,
    0xF7,
  ];

  console.log(`Step 1: SDS dump header (sample #${sampleNumber}, declared length=${TEST_SAMPLE_COUNT})`);
  await midiSend(dumpHeader);
  const ack1 = await waitForAck();
  console.log(`  Response: ${ack1}`);
  if (!ack1.includes('ACK')) {
    console.log('  FAILED — dump header not ACKed. Aborting Theory A.');
    return;
  }

  // Step 2: NO data packet — go straight to ASPACK
  console.log(`Step 2: ASPACK data (${TEST_SAMPLE_COUNT} samples, no SDS data packet)`);
  const testSamples = Array.from({ length: TEST_SAMPLE_COUNT }, (_, i) =>
    Math.round(Math.sin(2 * Math.PI * 440 * i / SAMPLE_RATE) * 16000));

  const aspackMsg = buildAspackChunk(sampleNumber, 0, testSamples);
  const ok = await sendAspackAndWaitReply(aspackMsg);
  console.log(`  ASPACK reply: ${ok ? 'OK' : 'FAILED'}`);

  // Step 3: Check RSLIST
  console.log('Step 3: Query RSLIST');
  const count = await queryRSLIST();
  console.log(`  Sample count: ${count}`);
  console.log(`  Expected sample at index: ${sampleNumber}`);
  if (count > sampleNumber) {
    console.log('  ✓ Sample exists in RSLIST');
  } else {
    console.log('  ✗ Sample NOT in RSLIST — Theory A failed to create sample');
    return;
  }

  // Step 4: Read sample header
  console.log('Step 4: Read sample header (RSDATA)');
  const header = await readSampleHeader(sampleNumber);
  const slngth = parseSLNGTH(header);
  const smpend = parseSMPEND(header);
  console.log(`  SLNGTH: ${slngth}`);
  console.log(`  SMPEND: ${smpend}`);
  console.log(`  Expected: ${TEST_SAMPLE_COUNT}`);
  if (slngth === TEST_SAMPLE_COUNT) {
    console.log('  ✓ SLNGTH matches declared count');
  } else {
    console.log(`  ✗ SLNGTH mismatch: got ${slngth}, expected ${TEST_SAMPLE_COUNT}`);
  }
}

async function testTheoryB(sampleNumber: number): Promise<void> {
  console.log('\n========================================');
  console.log('THEORY B: 40-sample stub header + data packet, ASPACK fills, SDATA patches SLNGTH');
  console.log('========================================\n');

  const periodNs = Math.floor(1_000_000_000 / SAMPLE_RATE);

  // Step 1: Send dump header with 40-sample length
  const dumpHeader = [
    0xF0, 0x7E, CHANNEL, 0x01,
    sampleNumber & 0x7F, (sampleNumber >> 7) & 0x7F,
    16,
    periodNs & 0x7F, (periodNs >> 7) & 0x7F, (periodNs >> 14) & 0x7F,
    40 & 0x7F, 0, 0,
    0, 0, 0, 0, 0, 0, 0,
    0xF7,
  ];

  console.log(`Step 1: SDS dump header (sample #${sampleNumber}, declared length=40)`);
  await midiSend(dumpHeader);
  const ack1 = await waitForAck();
  console.log(`  Response: ${ack1}`);

  // Step 2: Send 1 data packet (40 samples of silence)
  console.log('Step 2: SDS data packet (40 samples silence)');
  const silencePacket = buildSdsDataPacket(0, new Array(40).fill(0));
  await midiSend(silencePacket);
  const ack2 = await waitForAck();
  console.log(`  Response: ${ack2}`);

  // Step 3: Brief pause for device to commit
  await sleep(200);

  // Step 4: Check RSLIST
  console.log('Step 3: Query RSLIST');
  const countAfterCreate = await queryRSLIST();
  console.log(`  Sample count: ${countAfterCreate}`);
  if (countAfterCreate > sampleNumber) {
    console.log('  ✓ Sample created in RSLIST');
  } else {
    console.log('  ✗ Sample NOT created — Theory B step 1 failed');
    return;
  }

  // Step 5: Read sample header to see SLNGTH before ASPACK
  console.log('Step 4: Read sample header BEFORE ASPACK');
  const headerBefore = await readSampleHeader(sampleNumber);
  const slngthBefore = parseSLNGTH(headerBefore);
  const smpendBefore = parseSMPEND(headerBefore);
  console.log(`  SLNGTH: ${slngthBefore}`);
  console.log(`  SMPEND: ${smpendBefore}`);

  // Step 6: ASPACK data
  console.log(`Step 5: ASPACK data (${TEST_SAMPLE_COUNT} samples)`);
  const testSamples = Array.from({ length: TEST_SAMPLE_COUNT }, (_, i) =>
    Math.round(Math.sin(2 * Math.PI * 440 * i / SAMPLE_RATE) * 16000));

  const aspackMsg = buildAspackChunk(sampleNumber, 0, testSamples);
  const ok = await sendAspackAndWaitReply(aspackMsg);
  console.log(`  ASPACK reply: ${ok ? 'OK' : 'FAILED'}`);

  // Step 7: Read sample header after ASPACK
  console.log('Step 6: Read sample header AFTER ASPACK');
  const headerAfterAspack = await readSampleHeader(sampleNumber);
  const slngthAfterAspack = parseSLNGTH(headerAfterAspack);
  const smpendAfterAspack = parseSMPEND(headerAfterAspack);
  console.log(`  SLNGTH: ${slngthAfterAspack} (was ${slngthBefore})`);
  console.log(`  SMPEND: ${smpendAfterAspack} (was ${smpendBefore})`);
  if (slngthAfterAspack !== slngthBefore) {
    console.log('  Note: ASPACK changed SLNGTH!');
  } else {
    console.log('  Note: ASPACK did NOT change SLNGTH');
  }

  // Step 8: Attempt SDATA patch of SLNGTH
  console.log(`Step 7: Attempt SDATA patch (SLNGTH=${TEST_SAMPLE_COUNT}, SMPEND=${TEST_SAMPLE_COUNT})`);

  // Read fresh header
  const headerToPatch = await readSampleHeader(sampleNumber);
  if (headerToPatch.length < 90) {
    console.log(`  FAILED — header too short: ${headerToPatch.length} bytes`);
    return;
  }

  // Patch SLNGTH (nibble offset 59 from payload)
  const payloadStart = 5;
  const slngthOff = payloadStart + 59;
  const smpendOff = payloadStart + 75;

  for (const [fieldOff, value] of [[slngthOff, TEST_SAMPLE_COUNT], [smpendOff, TEST_SAMPLE_COUNT]] as const) {
    let tmp = value;
    for (let i = 0; i < 4; i++) {
      headerToPatch[fieldOff + i * 2] = tmp & 0x0F;
      headerToPatch[fieldOff + i * 2 + 1] = (tmp >> 4) & 0x0F;
      tmp >>= 8;
    }
  }

  // Change opcode from 0x09 (RSDATA response) to 0x0B (SDATA write)
  headerToPatch[3] = 0x0B;

  await midiSend(headerToPatch);

  // Check for response
  await sleep(100);
  let sdataResponse = 'no response';
  for (let i = 0; i < 10; i++) {
    const pending = await midiPoll();
    if (pending > 0) {
      const resp = await midiRead(pending);
      if (resp.length >= 4) {
        const opcode = resp[3];
        if (opcode === 0x16) { sdataResponse = 'REPLY (success)'; break; }
        if (opcode === 0x15) { sdataResponse = `ERROR (code ${resp.length > 5 ? resp[5] : '?'})`; break; }
        sdataResponse = `opcode 0x${opcode.toString(16)}: [${resp.slice(0, 10).map(b => b.toString(16).padStart(2, '0')).join(' ')}]`;
        break;
      }
    }
    await sleep(50);
  }
  console.log(`  SDATA response: ${sdataResponse}`);

  // Step 9: Read header after SDATA patch
  console.log('Step 8: Read sample header AFTER SDATA patch');
  const headerAfterPatch = await readSampleHeader(sampleNumber);
  const slngthAfterPatch = parseSLNGTH(headerAfterPatch);
  const smpendAfterPatch = parseSMPEND(headerAfterPatch);
  console.log(`  SLNGTH: ${slngthAfterPatch} (target: ${TEST_SAMPLE_COUNT})`);
  console.log(`  SMPEND: ${smpendAfterPatch} (target: ${TEST_SAMPLE_COUNT})`);

  if (slngthAfterPatch === TEST_SAMPLE_COUNT) {
    console.log('  ✓ SDATA patch succeeded');
  } else {
    console.log('  ✗ SDATA patch failed or value unchanged');
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function drainPending(): Promise<void> {
  // Drain any buffered data from previous operations
  for (let i = 0; i < 5; i++) {
    const pending = await midiPoll();
    if (pending > 0) {
      const data = await midiRead(pending);
      console.log(`  Drained ${data.length} bytes: [${data.slice(0, 20).map(b => b.toString(16).padStart(2, '0')).join(' ')}...]`);
    } else {
      break;
    }
    await sleep(10);
  }
}

async function main() {
  console.log('=== ASPACK SLNGTH Investigation ===');
  console.log(`Bridge: ${BRIDGE_URL}`);
  console.log(`Test sample count: ${TEST_SAMPLE_COUNT}`);
  console.log(`Sample rate: ${SAMPLE_RATE}`);

  await midiEnable();
  console.log('\nDraining pending data...');
  await drainPending();

  // Get current sample count
  const countBefore = await queryRSLIST();
  console.log(`\nCurrent samples in device: ${countBefore}`);

  // Theory A: use next free slot
  await testTheoryA(countBefore);

  // Re-check count — Theory A may or may not have created a sample
  const countAfterA = await queryRSLIST();
  console.log(`\nSamples after Theory A: ${countAfterA}`);

  // Theory B: use next free slot
  await testTheoryB(countAfterA);

  const countAfterB = await queryRSLIST();
  console.log(`\nSamples after Theory B: ${countAfterB}`);

  await midiDisable();

  console.log('\n=== Summary ===');
  console.log(`Samples: ${countBefore} → ${countAfterA} (Theory A) → ${countAfterB} (Theory B)`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
