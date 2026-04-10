/**
 * Test RSPACK (read sample data) in S3000 protocol mode.
 *
 * Run: E2E_SCSI_BRIDGE_URL=http://s3k.local:7033 tsx modules/e2e-infra/src/node/lib/test-rspack-s3000.ts
 */

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL ?? 'http://s3k.local:7033';
const TARGET_ID = 6;

async function scsiExec(cdb: number[], dataOut: number[] = [], expectedIn = 0): Promise<number[]> {
  const resp = await fetch(`${BRIDGE_URL}/scsi/exec`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_id: TARGET_ID, cdb, data_out: dataOut, expected_data_in: expectedIn }),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
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

function toNibbles(value: number, byteCount: number): number[] {
  const nibbles: number[] = [];
  for (let i = 0; i < byteCount; i++) {
    const byte = (value >> (i * 8)) & 0xFF;
    nibbles.push(byte & 0x0F, (byte >> 4) & 0x0F);
  }
  return nibbles;
}

async function main() {
  console.log('=== RSPACK in S3000 Mode ===\n');

  await midiEnable();

  // Try RSPACK with nibble encoding: sample 0, offset 0, length 48
  const msg = [
    0xF0, 0x47, 0x00, 0x0C, 0x48,
    ...toNibbles(0, 2),    // sample number
    ...toNibbles(0, 4),    // offset
    ...toNibbles(48, 4),   // length
    ...toNibbles(0, 1),    // interval
    0xF7
  ];

  console.log(`RSPACK: [${msg.map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);
  console.log(`Sending...`);
  await midiSend(msg);

  // Poll for response
  console.log('Polling...');
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 100));
    const pending = await midiPoll();
    console.log(`  Poll ${i}: ${pending} bytes pending`);
    if (pending > 0) {
      const data = await midiRead(pending);
      console.log(`  Read: ${data.length} bytes`);
      console.log(`  First 30: [${data.slice(0, 30).map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);
      if (data[3] !== undefined) {
        console.log(`  Opcode: 0x${data[3].toString(16)} (${data[3] === 0x0D ? 'ASPACK' : data[3] === 0x16 ? 'REPLY' : data[3] === 0x15 ? 'ERROR' : 'unknown'})`);
      }
      break;
    }
  }

  await midiDisable();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
