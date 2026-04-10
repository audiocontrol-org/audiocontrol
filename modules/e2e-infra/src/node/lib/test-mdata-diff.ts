/**
 * Read MiscellaneousData (RMDATA) and dump all bytes.
 *
 * Run this TWICE — once with sampler in "Standard" transfer mode,
 * once in "Akai S3000XL" mode — then diff to find the transfer mode byte.
 *
 * Run: E2E_SCSI_BRIDGE_URL=http://s3k.local:7033 tsx modules/e2e-infra/src/node/lib/test-mdata-diff.ts
 *
 * With a label: E2E_SCSI_BRIDGE_URL=http://s3k.local:7033 tsx modules/e2e-infra/src/node/lib/test-mdata-diff.ts standard
 */

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL ?? 'http://s3k.local:7033';
const label = process.argv[2] ?? 'unknown';

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

async function main() {
  console.log(`\n=== MiscellaneousData Dump (${label}) ===`);
  console.log(`Bridge: ${BRIDGE_URL}\n`);

  // RMDATA request: F0 47 cc 0E 48 F7
  const resp = await sysexSendReceive([0xF0, 0x47, 0x00, 0x0E, 0x48, 0xF7]);

  if (resp.length < 6) {
    console.error('No response from RMDATA');
    process.exit(1);
  }

  console.log(`Raw response: ${resp.length} bytes`);

  // Strip SysEx wrapper: F0 47 cc opcode 48 [data] F7
  const nibbles = resp.slice(5, -1);
  const bytes = nibblesToBytes(nibbles);

  console.log(`Data: ${nibbles.length} nibbles = ${bytes.length} bytes\n`);

  // Known fields (from S1000 spec)
  const knownFields = [
    { offset: 0, name: 'BMCHAN', desc: 'Basic MIDI channel' },
    { offset: 1, name: 'BMOMNI', desc: 'Omni mode' },
    { offset: 2, name: 'PSELEN', desc: 'Program select enable' },
    { offset: 3, name: 'SELPNM', desc: 'Selected program number' },
    { offset: 4, name: 'OMNOVR', desc: 'Omni override' },
    { offset: 5, name: 'EXCHAN', desc: 'Exclusive channel' },
    { offset: 6, name: 'MSTUNE', desc: 'Master tune' },
  ];

  for (const field of knownFields) {
    if (field.offset < bytes.length) {
      console.log(`  [${field.offset.toString().padStart(2)}] ${field.name.padEnd(8)} = ${bytes[field.offset].toString().padStart(3)} (0x${bytes[field.offset].toString(16).padStart(2, '0')})  — ${field.desc}`);
    }
  }

  console.log('');

  // Dump all remaining bytes (undocumented S3000XL fields)
  for (let i = 7; i < bytes.length; i++) {
    const val = bytes[i];
    const hex = val.toString(16).padStart(2, '0');
    const marker = val !== 0 ? ' ***' : '';
    console.log(`  [${i.toString().padStart(2)}] MDATA${i.toString().padStart(2, '0')} = ${val.toString().padStart(3)} (0x${hex})${marker}`);
  }

  // Also dump as a single line for easy diffing
  console.log(`\nAll bytes: [${bytes.map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);
  console.log(`\nLabel: ${label}`);
}

function nibblesToBytes(nibbles: number[]): number[] {
  const bytes: number[] = [];
  for (let i = 0; i + 1 < nibbles.length; i += 2) {
    bytes.push((nibbles[i + 1] << 4) | nibbles[i]);
  }
  return bytes;
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
