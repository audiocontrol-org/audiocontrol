/**
 * Hardware verification of the BULK SDATA finding from MESA II disassembly.
 *
 * Per `mesa-ii-analysis/plug-bulk-trace.md` section 11.1, MESA's BULK send is:
 *   CDB:     0c 00 00 01 96 80           (MIDI Send, 406 bytes, reply expected)
 *   Payload: f0 47 [ch] 0b 48 [400 nibble bytes] f7
 *            \__ 200-byte Akai header nibble-encoded (low nibble first per byte) __/
 *
 * The 200-byte Akai header layout is documented in `build-sample-header-decoded.md`.
 * SLNGTH lives at byte 26-29, expressed in BYTES (not sample words),
 * stored as a 4-byte value transformed by vtable[0x38].
 *
 * vtable[0x38] is medium-confidence interpreted as 32-bit-value -> 4-nibble-byte
 * encoder for the LOW 16 bits (per `build-sample-header-decoded.md` section
 * "What vtable[0x38] does to the raw value").
 *
 * This test sends one BULK SDATA exactly as MESA does and verifies whether
 * a sample is created with the expected SLNGTH. If yes, we have closed the
 * SLNGTH bug. If no, our reverse engineering missed something.
 *
 * Run:
 *   E2E_SCSI_BRIDGE_URL=http://s3k.local:7033 \
 *     pnpm --filter @audiocontrol/e2e-infra exec tsx src/node/lib/test-bulk-akai-header.ts
 */

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL ?? 'http://s3k.local:7033';
const TARGET_ID = 6;
const CHANNEL = 0;

// Test SLNGTH value: 4096 bytes = 2048 samples for 16-bit mono.
// Choosing this so the value is non-trivial (not 40, not 0) and encodable in 16 bits.
const TEST_SLNGTH_BYTES = 4096;
const SAMPLE_NAME = 'BULKHDRTEST'; // 11 chars, will be padded to 12

// Sample slot to target. MESA's `AcceptSampleHeader` takes `sample_number`
// and inserts it as a 7-bit-encoded 2-byte field at SysEx bytes 5-6 via
// `Set7BitWord` (see sysex-builder-decoded.md §3 step 3). We pick slot 1 as a
// safe initial target (the user can verify device state separately).
const TEST_SAMPLE_NUM = 1;

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
  // Use reply-expected flag 0x80 to match MESA's BULK CDB behavior.
  await scsiExec([0x0C, 0x00, (len >> 16) & 0xFF, (len >> 8) & 0xFF, len & 0xFF, 0x80], data, 0);
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

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Akai header construction (per build-sample-header-decoded.md)
// ---------------------------------------------------------------------------

/**
 * Encode a 32-bit value via vtable[0x38] semantics: 4 nibble bytes,
 * low nibble first (per `build-sample-header-decoded.md` interpretation).
 * Encodes only the LOW 16 bits — confidence: medium.
 */
function vtable38Encode(value: number): number[] {
  return [
    (value >> 0) & 0xF,
    (value >> 4) & 0xF,
    (value >> 8) & 0xF,
    (value >> 12) & 0xF,
  ];
}

/**
 * Build the 200-byte Akai sample header that MESA constructs in
 * BuildSampleHeaderFromMAH. Layout per `build-sample-header-decoded.md`.
 */
function buildAkaiHeader(opts: {
  sampleName: string;
  slngthBytes: number;
}): Uint8Array {
  const buf = new Uint8Array(200); // zeroed

  buf[0] = 0x03; // device ID / channel constant
  buf[1] = 0;    // sample rate range flag (0 for <=22050; we'll use 22050)
  buf[2] = 0;    // mah@(103) — unknown format byte; try 0

  // Sample name at bytes 3..14 (12 chars), space-padded, ASCII-cleaned, uppercase
  const name = opts.sampleName.toUpperCase().padEnd(12, ' ').slice(0, 12);
  for (let i = 0; i < 12; i++) {
    buf[3 + i] = name.charCodeAt(i);
  }

  buf[15] = 0x80; // SysEx end marker / flags
  buf[16] = 0;    // loop_mode (no loop)
  buf[19] = 2;    // loop_type: 2 = no loop
  // buf[20..21] = fine tuning (leave 0)

  // SLNGTH at 26..29 (vtable[0x38]-encoded total_byte_length)
  const slngthEncoded = vtable38Encode(opts.slngthBytes);
  buf[26] = slngthEncoded[0];
  buf[27] = slngthEncoded[1];
  buf[28] = slngthEncoded[2];
  buf[29] = slngthEncoded[3];

  // loop_start, loop_end, sustain_end, sustain_length all zero (no loop)
  // bytes 30..47 stay zero

  // bytes 48..49 stay zero (sustain_length < 256)
  // bytes 138..139 = mah@(14) — unknown, try 0

  return buf;
}

/**
 * Nibble-encode an arbitrary byte buffer for SysEx transport.
 * Each byte becomes 2 bytes: low nibble first, high nibble second.
 * This is the standard Akai SysEx nibble encoding used by the SCSI Plug
 * to wrap the 200-byte Akai header (per plug-bulk-trace.md section 11.1).
 */
function nibbleEncodeBuffer(input: Uint8Array): number[] {
  const out: number[] = [];
  for (const b of input) {
    out.push(b & 0x0F);
    out.push((b >> 4) & 0x0F);
  }
  return out;
}

// ---------------------------------------------------------------------------
// SysEx send/receive helpers
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
  if (resp.length < 7) return 0;
  return resp[5] | (resp[6] << 8);
}

async function readSampleHeader(index: number): Promise<number[]> {
  const idxLo = index & 0x7F;
  const idxHi = (index >> 7) & 0x7F;
  return sendAndReceive([0xF0, 0x47, CHANNEL, 0x0A, 0x48, idxLo, idxHi, 0xF7], 512);
}

function parseSLNGTH(headerData: number[]): number {
  // SLNGTH at raw index 59 (5-byte SysEx header + offset 26+other-prefix-bytes).
  // Per existing test-aspack-slngth.ts which uses offset 59 and reads 8 nibble bytes.
  const off = 59;
  if (headerData.length < off + 8) return -1;
  let value = 0;
  for (let i = 0; i < 4; i++) {
    const lo = headerData[off + i * 2] & 0x0F;
    const hi = headerData[off + i * 2 + 1] & 0x0F;
    value |= ((hi << 4) | lo) << (i * 8);
  }
  return value;
}

async function drainPending(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    const pending = await midiPoll();
    if (pending > 0) {
      const data = await midiRead(pending);
      console.log(`  Drained ${data.length} bytes`);
    } else {
      break;
    }
    await sleep(10);
  }
}

function hexDump(bytes: number[] | Uint8Array, max = 32): string {
  const arr = Array.from(bytes).slice(0, max);
  return arr.map(b => b.toString(16).padStart(2, '0')).join(' ') +
    (bytes.length > max ? ` ...(${bytes.length - max} more)` : '');
}

// ---------------------------------------------------------------------------
// Main test
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== BULK SDATA Akai Header Hardware Verification ===');
  console.log(`Bridge: ${BRIDGE_URL}`);
  console.log(`Target SLNGTH (bytes): ${TEST_SLNGTH_BYTES}`);
  console.log(`Sample name: "${SAMPLE_NAME}"`);
  console.log('');

  await midiEnable();
  console.log('Draining pending data...');
  await drainPending();

  const countBefore = await queryRSLIST();
  console.log(`Samples in device before: ${countBefore}`);

  // Build the 200-byte Akai header
  const headerBuf = buildAkaiHeader({
    sampleName: SAMPLE_NAME,
    slngthBytes: TEST_SLNGTH_BYTES,
  });
  console.log(`\n200-byte Akai header (first 32 bytes):`);
  console.log(`  ${hexDump(headerBuf, 32)}`);
  console.log(`Header bytes 26..29 (SLNGTH encoded): ${hexDump(Array.from(headerBuf.slice(26, 30)))}`);

  // CORRECTED per sysex-builder-decoded.md:
  //   - Nibbleize covers only header_buf[0..191] (192 bytes), NOT all 200 bytes.
  //   - Sample number is inserted as a 7-bit 2-byte field at SysEx bytes 5-6
  //     via MESA's Set7BitWord (between the 5-byte header and the nibble payload).
  //   - Total payload is 392 bytes, not 406.
  const nibblePayload = nibbleEncodeBuffer(headerBuf.slice(0, 192));
  console.log(`Nibble-encoded payload: ${nibblePayload.length} bytes (expected 384, covers header[0..191] only)`);

  // Wrap in SysEx: F0 47 ch 0B 48 [sample_lo 7-bit] [sample_hi 7-bit] [384 nibble bytes] F7
  const sysex = [
    0xF0, 0x47, CHANNEL, 0x0B, 0x48,
    TEST_SAMPLE_NUM & 0x7F,
    (TEST_SAMPLE_NUM >> 7) & 0x7F,
    ...nibblePayload,
    0xF7,
  ];
  console.log(`Total SysEx message: ${sysex.length} bytes (expected 392)`);
  console.log(`SysEx prefix: ${hexDump(sysex.slice(0, 10))}`);
  console.log(`SysEx suffix: ${hexDump(sysex.slice(-4))}`);

  // Send via MIDI Send CDB with reply-expected flag (CDB = 0c 00 00 01 88 80 for 392 bytes)
  console.log('\nSending BULK SDATA...');
  await midiSend(sysex);

  // Wait for reply
  console.log('Polling for reply...');
  let reply: number[] = [];
  for (let i = 0; i < 30; i++) {
    const pending = await midiPoll();
    if (pending > 0) {
      reply = await midiRead(pending);
      break;
    }
    await sleep(50);
  }
  console.log(`Reply: ${reply.length} bytes`);
  if (reply.length > 0) {
    console.log(`  ${hexDump(reply, 32)}`);
    if (reply.length >= 4) {
      const opcode = reply[3];
      const meaning =
        opcode === 0x16 ? 'REPLY (success)' :
        opcode === 0x15 ? 'ERROR' :
        `opcode 0x${opcode.toString(16)}`;
      console.log(`  Decoded: ${meaning}`);
    }
  } else {
    console.log('  (no reply received)');
  }

  // Brief settle
  await sleep(300);

  // Check RSLIST
  const countAfter = await queryRSLIST();
  console.log(`\nSamples in device after: ${countAfter} (was ${countBefore})`);
  const created = countAfter > countBefore;
  console.log(`Sample created: ${created ? 'YES' : 'NO'}`);

  if (!created) {
    console.log('\n✗ FAILED: BULK SDATA did not create a sample.');
    console.log('  The reverse-engineered protocol is incomplete or incorrect.');
    await midiDisable();
    return;
  }

  // Read the new sample header
  const newSampleIndex = countBefore;
  console.log(`\nReading sample header at index ${newSampleIndex}...`);
  const headerResp = await readSampleHeader(newSampleIndex);
  console.log(`  Header response: ${headerResp.length} bytes`);
  if (headerResp.length === 0) {
    console.log('  ✗ Could not read header back');
    await midiDisable();
    return;
  }

  const slngth = parseSLNGTH(headerResp);
  console.log(`  Parsed SLNGTH: ${slngth} (target: ${TEST_SLNGTH_BYTES} bytes — or ${TEST_SLNGTH_BYTES / 2} sample words)`);

  // Read sample name at offset 8 (after 5-byte SysEx header + opcode + 2 padding)
  // Actual offset in the response varies; show the name region.
  const nameStart = 8;
  if (headerResp.length >= nameStart + 12) {
    const nameBytes = headerResp.slice(nameStart, nameStart + 12);
    const nameStr = String.fromCharCode(...nameBytes.map(b => b & 0x7F));
    console.log(`  Sample name (offset ${nameStart}): "${nameStr}"`);
  }

  console.log('\n=== Verdict ===');
  if (slngth === TEST_SLNGTH_BYTES) {
    console.log(`✓ SLNGTH matches target IN BYTES (${slngth}). MESA's interpretation confirmed.`);
  } else if (slngth === TEST_SLNGTH_BYTES / 2) {
    console.log(`✓ SLNGTH matches target / 2 (${slngth}). Device interprets SLNGTH as sample words, not bytes.`);
  } else if (slngth > 0 && slngth < 200) {
    console.log(`◇ SLNGTH = ${slngth} — looks like a stub/default, not driven by our header value.`);
  } else {
    console.log(`? SLNGTH = ${slngth}. Doesn't match target (${TEST_SLNGTH_BYTES}) or target/2 (${TEST_SLNGTH_BYTES / 2}).`);
  }

  await midiDisable();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
