/**
 * Probe: Send BuildSampleDataRequest (SDATA 0x0B with offset/length) to S3000XL.
 *
 * From MESA II disassembly, this message format is used for bulk sample data:
 *   F0 47 cc 0B 48 ss ss oo oo oo oo nn nn nn nn 01 00 F7
 *
 * We don't yet know:
 * - Whether the device responds to this at all over SCSI MIDI
 * - Whether it's a read request (device sends data) or write command (we send data)
 * - How the actual PCM audio data is transmitted (same CDB? separate CDB? appended?)
 *
 * This test sends the message and logs everything the device sends back.
 * Requires at least 1 sample on the device.
 *
 * Run: pnpm --filter @audiocontrol/e2e-infra exec tsx src/node/lib/test-sdata-bulk-probe.ts
 */

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL ?? 'http://s3k.local:7033';
const TARGET_ID = 6;
const CHANNEL = 0;

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

async function midiSend(data: number[]): Promise<void> {
  const len = data.length;
  await scsiExec([0x0C, 0x00, (len >> 16) & 0xFF, (len >> 8) & 0xFF, len & 0xFF, 0x00], data, 0);
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
  return [
    value & 0x7F,
    (value >> 7) & 0x7F,
    (value >> 14) & 0x7F,
    (value >> 21) & 0x7F,
  ];
}

function hexDump(data: number[], maxLen = 64): string {
  const slice = data.slice(0, maxLen);
  const hex = slice.map(b => b.toString(16).padStart(2, '0')).join(' ');
  return data.length > maxLen ? `${hex}... (${data.length} total)` : hex;
}

async function drainAndLog(label: string): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const pending = await midiPoll();
    if (pending > 0) {
      const data = await midiRead(pending);
      console.log(`  ${label} (${data.length} bytes): [${hexDump(data)}]`);
      // Check for known Akai response types
      if (data.length >= 4) {
        const opcode = data[3];
        if (opcode === 0x16) console.log(`  → REPLY (success)`);
        else if (opcode === 0x15) console.log(`  → ERROR (code ${data.length > 5 ? data[5] : '?'})`);
        else if (opcode === 0x09) console.log(`  → SDATA response (sample header data)`);
        else if (opcode === 0x0B) console.log(`  → SDATA write acknowledgement?`);
        else console.log(`  → opcode 0x${opcode.toString(16)}`);
      }
      // Check for SDS handshake
      for (let i = 0; i < data.length - 3; i++) {
        if (data[i] === 0xF0 && data[i+1] === 0x7E) {
          const type = data[i+3];
          if (type === 0x7F) console.log(`  → SDS ACK`);
          else if (type === 0x7E) console.log(`  → SDS NAK`);
          else if (type === 0x7C) console.log(`  → SDS WAIT`);
          else if (type === 0x7D) console.log(`  → SDS CANCEL`);
        }
      }
    } else {
      if (attempt === 0) console.log(`  ${label}: (no response)`);
      break;
    }
    await sleep(50);
  }
}

async function main() {
  console.log('=== SDATA Bulk Probe ===');
  console.log(`Bridge: ${BRIDGE_URL}`);
  console.log(`2026-04-16: Testing BuildSampleDataRequest format against S3000XL\n`);

  await midiEnable();

  // Use sample 0 (must exist on device)
  const sampleIdx = 0;
  const offset = 0;
  const count = 192; // MESA uses 192-byte (0xC0) chunks

  // Build the SDATA request: F0 47 cc 0B 48 ss ss oo oo oo oo nn nn nn nn 01 00 F7
  const msg = [
    0xF0, 0x47, CHANNEL, 0x0B, 0x48,
    ...to7bit(sampleIdx),           // sample number
    ...to7bit32(offset),            // offset
    ...to7bit32(count),             // count
    0x01,                            // interval
    0x00,                            // reserved
    0xF7,
  ];

  console.log(`Test 1: Send SDATA with offset=${offset}, count=${count} for sample #${sampleIdx}`);
  console.log(`  Message: [${hexDump(msg)}]`);
  console.log(`  (This might be a READ request — device may send sample data back)\n`);

  await midiSend(msg);
  await sleep(200);
  await drainAndLog('Response');

  // Test 2: Try with flag $80 on CDB (MESA uses different flags for expected-reply)
  console.log(`\nTest 2: Same message but with CDB flag $80 (expect reply)`);
  const len = msg.length;
  await scsiExec(
    [0x0C, 0x00, (len >> 16) & 0xFF, (len >> 8) & 0xFF, len & 0xFF, 0x80],
    msg, 0
  );
  await sleep(200);
  await drainAndLog('Response (flag $80)');

  // Test 3: Poll with flag $80 (MESA's SMDataByteEnquiry uses $80 first)
  console.log(`\nTest 3: Poll with flag $80 then read`);
  const pollResult = await scsiExec([0x0D, 0x00, 0x00, 0x00, 0x00, 0x80], [], 4);
  const pending = pollResult.length >= 3 ? (pollResult[1] << 8) | pollResult[2] : 0;
  console.log(`  Poll result: ${pending} bytes pending (raw: [${hexDump(pollResult)}])`);
  if (pending > 0) {
    const data = await midiRead(Math.min(pending, 1024));
    console.log(`  Data: [${hexDump(data)}]`);
  }

  // Test 4: For comparison, send a normal RSDATA (header read) to confirm SCSI MIDI works
  console.log(`\nTest 4: Normal RSDATA for comparison`);
  const rsdata = [0xF0, 0x47, CHANNEL, 0x0A, 0x48, ...to7bit(sampleIdx), 0xF7];
  await midiSend(rsdata);
  await sleep(200);
  await drainAndLog('RSDATA response');

  await midiDisable();
  console.log('\nDone.');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
