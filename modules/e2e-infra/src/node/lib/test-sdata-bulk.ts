/**
 * Test Akai proprietary sample data transfer via SDATA (opcode 0x0B).
 *
 * MESA II uses SDATA with 'BULK' mode and 192-byte chunks to transfer
 * sample waveform data — NOT SDS. This test probes whether the S3000XL
 * accepts sample data via SDATA with offset/length parameters.
 *
 * From MESA II disassembly:
 *   BuildSampleDataRequest(buf, opcode=0x0B, channel, sampleNum, offset, length)
 *   chunk size = 192 bytes (0xC0)
 *   transfer mode = 'BULK'
 *
 * Run: E2E_SCSI_BRIDGE_URL=http://s3k.local:7033 tsx modules/e2e-infra/src/node/lib/test-sdata-bulk.ts
 */

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL ?? 'http://s3k.local:7033';
const TARGET_ID = 6;

// -- Bridge helpers -----------------------------------------------------------

async function sysexSendReceive(data: number[]): Promise<number[]> {
  const resp = await fetch(`${BRIDGE_URL}/sds/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: data }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`sds/send HTTP ${resp.status}: ${text}`);
  }
  const json = await resp.json() as { response?: number[] };
  return json.response ?? [];
}

// -- Nibble encoding (Akai SysEx format) --------------------------------------

function toNibbles(value: number, byteCount: number): number[] {
  const nibbles: number[] = [];
  for (let i = 0; i < byteCount; i++) {
    const byte = (value >> (i * 8)) & 0xFF;
    nibbles.push(byte & 0x0F);
    nibbles.push((byte >> 4) & 0x0F);
  }
  return nibbles;
}

function to7bit(value: number): number[] {
  return [value & 0x7F, (value >> 7) & 0x7F];
}

// -- Test functions -----------------------------------------------------------

async function testReadSampleList(): Promise<string[]> {
  console.log('\n--- Read sample list (RSLIST) ---');
  const resp = await sysexSendReceive([0xF0, 0x47, 0x00, 0x04, 0x48, 0xF7]);
  if (resp.length < 6) {
    console.log('  No samples on device');
    return [];
  }
  // Parse name list: 12-byte names in nibble encoding
  const names: string[] = [];
  const data = resp.slice(5, -1); // strip F0 47 cc opcode 48 ... F7
  const AKAI_CHARS = '0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ#+-.';
  for (let i = 0; i < data.length; i += 24) { // 12 bytes × 2 nibbles
    let name = '';
    for (let j = 0; j < 12; j++) {
      const lo = data[i + j * 2] ?? 0;
      const hi = data[i + j * 2 + 1] ?? 0;
      const byte = (hi << 4) | lo;
      name += byte < AKAI_CHARS.length ? AKAI_CHARS[byte] : ' ';
    }
    names.push(name.trimEnd());
  }
  console.log(`  ${names.length} samples: ${names.join(', ')}`);
  return names;
}

async function testReadSampleHeader(sampleIdx: number): Promise<void> {
  console.log(`\n--- Read sample header (RSDATA) for index ${sampleIdx} ---`);
  const resp = await sysexSendReceive([
    0xF0, 0x47, 0x00, 0x0A, 0x48,
    ...to7bit(sampleIdx),
    0xF7,
  ]);
  console.log(`  Response: ${resp.length} bytes`);
  if (resp.length > 10) {
    // Parse SLOCAT (memory address) and SLNGTH (sample length)
    // from nibble-encoded header data
    const data = resp.slice(5, -1);
    console.log(`  Header data: ${data.length} nibbles (${data.length / 2} bytes)`);
    // SLNGTH is at offset 0x1C (28 bytes = 56 nibbles from start of header)
    if (data.length >= 64) {
      const lenLo = data[56] | (data[57] << 4);
      const lenHi = data[58] | (data[59] << 4);
      const len2 = data[60] | (data[61] << 4);
      const len3 = data[62] | (data[63] << 4);
      const sampleLength = lenLo | (lenHi << 8) | (len2 << 16) | (len3 << 24);
      console.log(`  SLNGTH (sample length): ${sampleLength} samples`);
    }
  }
}

async function testRSPACK(sampleIdx: number): Promise<void> {
  console.log(`\n--- Test RSPACK (opcode 0x0C) for sample ${sampleIdx} ---`);

  // Try nibble encoding: sample number, offset=0, length=192, interval=0
  const msg = [
    0xF0, 0x47, 0x00, 0x0C, 0x48,
    ...toNibbles(sampleIdx, 2),  // sample number (2 bytes = 4 nibbles)
    ...toNibbles(0, 4),           // offset (4 bytes = 8 nibbles)
    ...toNibbles(192, 4),         // length (4 bytes = 8 nibbles)
    ...toNibbles(0, 1),           // interval (1 byte = 2 nibbles)
    0xF7,
  ];
  console.log(`  Sending: [${msg.map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);
  const resp = await sysexSendReceive(msg);
  console.log(`  Response: ${resp.length} bytes`);
  if (resp.length > 0) {
    console.log(`  First bytes: [${resp.slice(0, 20).map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);
  }
}

async function testSDATARead(sampleIdx: number): Promise<void> {
  console.log(`\n--- Test SDATA read (opcode 0x0B) with offset/length ---`);
  console.log('  (This is how MESA II reads sample data)');

  // MESA uses BuildSampleDataRequest with opcode 0x0B, offset, length
  // Try sending a request for sample data at offset 0, length 192
  // Format guess: F0 47 cc 0A 48 [sample_num_7bit] [offset_nibbles] [length_nibbles] F7
  // But MESA uses 0x0B... let's try RSDATA (0x0A) with extra offset/length params

  // Actually, MESA pushes opcode 0x0B to BuildSampleDataRequest.
  // 0x0B is SDATA (normally the response/write opcode for sample headers).
  // With offset+length params, it might request a CHUNK of sample data.

  // Try: standard RSDATA format but with extra offset/length bytes
  // This is speculative — we don't know the exact wire format.

  // Attempt 1: RSDATA-like request with offset and length appended
  const msg1 = [
    0xF0, 0x47, 0x00, 0x0A, 0x48,
    ...to7bit(sampleIdx),
    ...toNibbles(0, 4),      // offset = 0
    ...toNibbles(192, 4),    // length = 192 samples
    0xF7,
  ];
  console.log(`\n  Attempt 1 (RSDATA + offset/length nibbles):`);
  console.log(`  Sending: [${msg1.map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);
  const resp1 = await sysexSendReceive(msg1);
  console.log(`  Response: ${resp1.length} bytes`);
  if (resp1.length > 6) {
    console.log(`  First bytes: [${resp1.slice(0, 20).map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);
  }

  // Attempt 2: Use 7-bit encoding for offset/length (like sample number)
  const msg2 = [
    0xF0, 0x47, 0x00, 0x0A, 0x48,
    ...to7bit(sampleIdx),
    ...to7bit(0), ...to7bit(0),      // offset = 0 (4 bytes, 7-bit pairs)
    ...to7bit(192), ...to7bit(0),    // length = 192
    0xF7,
  ];
  console.log(`\n  Attempt 2 (RSDATA + offset/length 7-bit):`);
  console.log(`  Sending: [${msg2.map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);
  const resp2 = await sysexSendReceive(msg2);
  console.log(`  Response: ${resp2.length} bytes`);
  if (resp2.length > 6) {
    console.log(`  First bytes: [${resp2.slice(0, 20).map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);
  }

  // Attempt 3: RSPACK format but with opcode 0x0A instead of 0x0C
  const msg3 = [
    0xF0, 0x47, 0x00, 0x0A, 0x48,
    ...to7bit(sampleIdx),           // sample number
    0x00, 0x00, 0x00, 0x00,         // offset = 0 (raw bytes)
    0xC0, 0x00, 0x00, 0x00,         // length = 192 (0xC0) raw bytes
    0x00,                            // interval = 0
    0xF7,
  ];
  console.log(`\n  Attempt 3 (RSDATA with RSPACK-like raw params):`);
  console.log(`  Sending: [${msg3.map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);
  const resp3 = await sysexSendReceive(msg3);
  console.log(`  Response: ${resp3.length} bytes`);
  if (resp3.length > 6) {
    console.log(`  First bytes: [${resp3.slice(0, 20).map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);
  }
}

async function testASPACK(sampleIdx: number): Promise<void> {
  console.log(`\n--- Test ASPACK write (opcode 0x0D) ---`);
  console.log('  Sending 192 bytes of silence as sample data...');

  // ASPACK format (from S1000 spec):
  // F0 47 cc 0D 48 ss ss oo oo oo oo nn nn nn nn [data...] F7
  // Each sample word is nibble-encoded (4 nibbles per 16-bit sample)

  const silenceNibbles: number[] = [];
  for (let i = 0; i < 48; i++) { // 48 samples × 4 nibbles = 192 nibbles
    silenceNibbles.push(0, 0, 0, 0); // 16-bit zero in nibble encoding
  }

  const msg = [
    0xF0, 0x47, 0x00, 0x0D, 0x48,
    ...toNibbles(sampleIdx, 2),  // sample number
    ...toNibbles(0, 4),           // offset = 0
    ...toNibbles(48, 4),          // count = 48 samples
    ...silenceNibbles,
    0xF7,
  ];
  console.log(`  Message size: ${msg.length} bytes`);
  console.log(`  Sending: [${msg.slice(0, 30).map(b => b.toString(16).padStart(2, '0')).join(' ')} ...]`);

  const resp = await sysexSendReceive(msg);
  console.log(`  Response: ${resp.length} bytes`);
  if (resp.length > 0) {
    console.log(`  Response: [${resp.map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);
    // Check for REPLY (0x16) — success indicator
    if (resp.length >= 6 && resp[3] === 0x16) {
      console.log('  ✓ Got REPLY — device accepted the data!');
    } else if (resp.length >= 6 && resp[3] === 0x15) {
      console.log('  ✗ Got ERROR response');
    }
  }
}

// -- Main ---------------------------------------------------------------------

async function main() {
  console.log('=== Akai SDATA Bulk Transfer Test ===');
  console.log(`Bridge: ${BRIDGE_URL}\n`);

  // First, check what samples are on the device
  const names = await testReadSampleList();
  if (names.length === 0) {
    console.log('\nNo samples on device — send one via SDS first, then re-run.');
    return;
  }

  // Read first sample's header
  await testReadSampleHeader(0);

  // Skip RSPACK — confirmed it times out over SCSI MIDI
  // await testRSPACK(0);

  // Test SDATA-based reads with offset/length (MESA's approach)
  try {
    await testSDATARead(0);
  } catch (err) {
    console.error('  SDATA read failed:', err);
  }

  // Test ASPACK write (sending sample data to device)
  try {
    await testASPACK(0);
  } catch (err) {
    console.error('  ASPACK write failed:', err);
  }

  console.log('\n=== Done ===');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
