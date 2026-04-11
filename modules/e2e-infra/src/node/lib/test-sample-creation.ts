/**
 * Test sample creation mechanisms — find the minimum action needed
 * to register a new sample in RSLIST.
 *
 * Tests:
 * 1. SDS dump header only (no data packets)
 * 2. SDS dump header + 1 data packet
 * 3. SDS dump header + ASPACK data (hybrid)
 * 4. SDATA header write to new index
 *
 * Run: E2E_SCSI_BRIDGE_URL=http://10.0.0.57:7033 tsx modules/e2e-infra/src/node/lib/test-sample-creation.ts
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

async function pollForReply(maxAttempts = 20): Promise<number[]> {
  for (let i = 0; i < maxAttempts; i++) {
    const pending = await midiPoll();
    if (pending > 0) return midiRead(pending);
  }
  return [];
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

function buildDumpHeader(sampleNumber: number, sampleRate: number, totalSamples: number): number[] {
  const snLo = sampleNumber & 0x7F;
  const snHi = (sampleNumber >> 7) & 0x7F;
  const p = Math.floor(1_000_000_000 / sampleRate);
  return [
    0xF0, 0x7E, 0x00, 0x01, snLo, snHi, 16,
    p & 0x7F, (p >> 7) & 0x7F, (p >> 14) & 0x7F,
    totalSamples & 0x7F, (totalSamples >> 7) & 0x7F, (totalSamples >> 14) & 0x7F,
    0, 0, 0, 0, 0, 0, 0, 0xF7,
  ];
}

function buildSdsDataPacket(pktNum: number): number[] {
  const data = [0xF0, 0x7E, 0x00, 0x02, pktNum & 0x7F];
  let checksum = 0x7E ^ 0x00 ^ 0x02 ^ (pktNum & 0x7F);
  // 40 samples of silence (120 bytes)
  for (let i = 0; i < 120; i++) {
    data.push(0);
    checksum ^= 0;
  }
  data.push(checksum & 0x7F, 0xF7);
  return data;
}

async function main() {
  console.log('=== Sample Creation Test ===\n');

  const countBefore = await getSampleCount();
  console.log(`Samples before: ${countBefore}\n`);

  // Test 1: SDS dump header only
  console.log('--- Test 1: SDS dump header only (no data packets) ---');
  await midiEnable();
  const header1 = buildDumpHeader(countBefore, 44100, 1000);
  await midiSend(header1);
  // Read WAIT + ACK
  const ack1 = await pollForReply();
  console.log(`  Header ACK: [${ack1.slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);
  // Don't send any data packets — just disable
  await midiDisable();

  const countAfter1 = await getSampleCount();
  console.log(`  Samples after: ${countAfter1} (${countAfter1 > countBefore ? '✓ NEW SAMPLE' : '✗ no change'})\n`);

  // Test 2: SDS dump header + 1 data packet
  console.log('--- Test 2: SDS dump header + 1 data packet ---');
  const countBefore2 = await getSampleCount();
  await midiEnable();
  const header2 = buildDumpHeader(countBefore2, 44100, 40); // exactly 1 packet worth
  await midiSend(header2);
  const ack2 = await pollForReply();
  console.log(`  Header ACK: [${ack2.slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);

  // Send 1 data packet
  const pkt = buildSdsDataPacket(0);
  await midiSend(pkt);
  const pktAck = await pollForReply();
  console.log(`  Packet ACK: [${pktAck.slice(0, 6).map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);
  await midiDisable();

  // Wait a moment for device to commit
  await new Promise(r => setTimeout(r, 500));
  const countAfter2 = await getSampleCount();
  console.log(`  Samples after: ${countAfter2} (${countAfter2 > countBefore2 ? '✓ NEW SAMPLE' : '✗ no change'})\n`);

  // Test 3: SDS dump header + ASPACK (hybrid — header creates slot, ASPACK fills data)
  console.log('--- Test 3: SDS dump header + cancel + ASPACK ---');
  const countBefore3 = await getSampleCount();
  await midiEnable();
  const header3 = buildDumpHeader(countBefore3, 44100, 1000);
  await midiSend(header3);
  const ack3 = await pollForReply();
  console.log(`  Header ACK: [${ack3.slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);

  // Send SDS Cancel to end the SDS session
  const cancel = [0xF0, 0x7E, 0x00, 0x7D, 0x00, 0xF7];
  await midiSend(cancel);
  await new Promise(r => setTimeout(r, 200));
  // Drain any response
  const pending = await midiPoll();
  if (pending > 0) await midiRead(pending);

  await midiDisable();
  await new Promise(r => setTimeout(r, 500));
  const countAfter3 = await getSampleCount();
  console.log(`  Samples after cancel: ${countAfter3} (${countAfter3 > countBefore3 ? '✓ NEW SAMPLE' : '✗ no change'})\n`);

  // Test 4: SDATA header write to new index
  console.log('--- Test 4: SDATA header write to new index ---');
  const countBefore4 = await getSampleCount();
  // Build a minimal sample header via SDATA (opcode 0x0B)
  // Need to write SLNGTH field with the desired sample count
  // First, read an existing sample header to use as template
  const templateResp = await fetch(`${BRIDGE_URL}/sds/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: [0xF0, 0x47, 0x00, 0x0A, 0x48, countBefore4 - 1, 0x00, 0xF7] }),
  });
  const templateJson = await templateResp.json() as { response?: number[] };
  const templateData = templateJson.response ?? [];

  if (templateData.length > 20) {
    // Try writing this header data to a new index
    // Change the opcode from 0x0B (response) to write, targeting new index
    const writeMsg = [0xF0, 0x47, 0x00, 0x0B, 0x48, ...templateData.slice(5, -1), 0xF7];
    // Replace the sample number nibbles at the start with the new index
    // Actually, SDATA write might auto-target based on the index in the header
    console.log(`  Template header: ${templateData.length} bytes`);

    const writeResp = await fetch(`${BRIDGE_URL}/sds/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: writeMsg }),
    });
    const writeJson = await writeResp.json() as { response?: number[] };
    const writeResult = writeJson.response ?? [];
    console.log(`  SDATA write response: [${writeResult.slice(0, 10).map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);

    const countAfter4 = await getSampleCount();
    console.log(`  Samples after: ${countAfter4} (${countAfter4 > countBefore4 ? '✓ NEW SAMPLE' : '✗ no change'})`);
  } else {
    console.log('  Could not read template header');
  }

  console.log('\n=== Done ===');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
