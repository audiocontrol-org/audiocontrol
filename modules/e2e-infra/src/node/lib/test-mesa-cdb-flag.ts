/**
 * Test MESA II's MEASURED CDB[5] flag-byte behavior on real S3000XL hardware.
 *
 * Per test plan docs/1.0/001-IN-PROGRESS/mesa-ii-reverse-engineering/test-plan-2026-04-21-mesa-cdb-flag.md
 * (recalibrated 2026-04-22 per Codex parity review #4292950920).
 *
 * Phase A: connectivity proof (positive control gate-step). Abort if any A-step fails.
 * Phase B: sense-data plumbing sanity (deliberate invalid opcode → confirm REQUEST SENSE
 *          auto-fetch returns ILLEGAL_REQUEST/INVALID_OPCODE).
 * Phase C: BULK-family RSDATA (opcode 0x0A) flag=0x00 baseline vs flag=0x80 test.
 *
 * Phase D (BULK SDATA write probe) is NOT in this script — needs separate setup
 * (catalog read, empty slot pick, original-header roundtrip). Deferred until A-C land.
 *
 * Run after `make deploy-scsi-bridge`:
 *   E2E_SCSI_BRIDGE_URL=http://127.0.0.1:7034 tsx modules/e2e-infra/src/node/lib/test-mesa-cdb-flag.ts
 *
 * (SSH tunnel needed because of node-fetch-vs-direct-IPv4 quirk on this Mac:
 *   ssh -fNL 7034:localhost:7033 orion@s3k.local)
 */

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL ?? 'http://s3k.local:7033';
const TARGET_ID = 6;
const MIDI_CHANNEL = 0;

interface ScsiExecResult {
  status: number;
  sense_data: number[];
  data_in: number[];
  bytes_transferred: number;
}

function hex(bytes: number[] | Uint8Array, max = 64): string {
  const arr = Array.from(bytes);
  const trimmed = arr.slice(0, max);
  const tail = arr.length > max ? ` ... (+${arr.length - max} more)` : '';
  return trimmed.map((b) => b.toString(16).padStart(2, '0')).join(' ') + tail;
}

/** Decode a fixed-format SCSI sense buffer. Returns null if too short. */
function decodeSense(sense: number[]): { key: number; asc: number; ascq: number; keyName: string; ascText: string } | null {
  if (sense.length < 14) return null;
  const responseCode = sense[0] & 0x7f;
  if (responseCode !== 0x70 && responseCode !== 0x71) {
    return null;
  }
  const key = sense[2] & 0x0f;
  const asc = sense[12];
  const ascq = sense[13];
  const keyNames = [
    'NO_SENSE', 'RECOVERED_ERROR', 'NOT_READY', 'MEDIUM_ERROR',
    'HARDWARE_ERROR', 'ILLEGAL_REQUEST', 'UNIT_ATTENTION', 'DATA_PROTECT',
    'BLANK_CHECK', 'VENDOR_SPECIFIC', 'COPY_ABORTED', 'ABORTED_COMMAND',
    'EQUAL', 'VOLUME_OVERFLOW', 'MISCOMPARE', 'RESERVED',
  ];
  const ascCommon: Record<string, string> = {
    '20:00': 'INVALID_COMMAND_OPCODE',
    '24:00': 'INVALID_FIELD_IN_CDB',
    '25:00': 'LOGICAL_UNIT_NOT_SUPPORTED',
    '26:00': 'INVALID_FIELD_IN_PARAMETER',
    '2C:00': 'COMMAND_SEQUENCE_ERROR',
    '29:00': 'POWER_ON_RESET_OR_BUS_RESET',
    '04:00': 'LUN_NOT_READY',
  };
  const ascKey = `${asc.toString(16).padStart(2, '0').toUpperCase()}:${ascq.toString(16).padStart(2, '0').toUpperCase()}`;
  return {
    key,
    asc,
    ascq,
    keyName: keyNames[key] ?? `KEY_${key}`,
    ascText: ascCommon[ascKey] ?? `ASC=0x${ascKey}`,
  };
}

async function scsiExec(
  cdb: number[],
  dataOut: number[] = [],
  expectedIn = 0,
): Promise<ScsiExecResult> {
  const resp = await fetch(`${BRIDGE_URL}/scsi/exec`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      target_id: TARGET_ID,
      lun: 0,
      cdb,
      data_out: dataOut,
      expected_data_in: expectedIn,
    }),
  });
  if (!resp.ok) {
    throw new Error(`scsi/exec HTTP ${resp.status}: ${await resp.text()}`);
  }
  const json = (await resp.json()) as ScsiExecResult;
  return {
    status: json.status,
    sense_data: json.sense_data ?? [],
    data_in: json.data_in ?? [],
    bytes_transferred: json.bytes_transferred ?? 0,
  };
}

async function midiEnable(): Promise<void> {
  await scsiExec([0x09, 0x00, 0x01, 0x00, 0x00, 0x00]);
}

async function midiDisable(): Promise<void> {
  await scsiExec([0x09, 0x00, 0x00, 0x00, 0x00, 0x00]);
}

async function midiSendCdb(data: number[], flag: number): Promise<ScsiExecResult> {
  const len = data.length;
  return scsiExec(
    [0x0c, 0x00, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff, flag],
    data,
    0,
  );
}

async function midiPoll(): Promise<{ status: number; bytes: number; raw: number[] }> {
  const r = await scsiExec([0x0d, 0x00, 0x00, 0x00, 0x00, 0x00], [], 3);
  const d = r.data_in;
  const bytes = d.length >= 3 ? ((d[0] << 16) | (d[1] << 8) | d[2]) : 0;
  return { status: r.status, bytes, raw: d };
}

async function midiRead(len: number): Promise<ScsiExecResult> {
  return scsiExec(
    [0x0e, 0x00, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff, 0x00],
    [],
    len,
  );
}

async function pollUntilReady(timeoutMs: number): Promise<{ bytes: number; pollCount: number }> {
  const start = Date.now();
  let pollCount = 0;
  while (Date.now() - start < timeoutMs) {
    pollCount++;
    const p = await midiPoll();
    if (p.bytes > 0) return { bytes: p.bytes, pollCount };
    await new Promise((r) => setTimeout(r, 50));
  }
  return { bytes: 0, pollCount };
}

async function drainQueue(maxIters = 10): Promise<number> {
  let drained = 0;
  for (let i = 0; i < maxIters; i++) {
    const p = await midiPoll();
    if (p.bytes === 0) break;
    await midiRead(p.bytes);
    drained++;
  }
  return drained;
}

function describeResult(label: string, r: ScsiExecResult): void {
  console.log(`  ${label}:`);
  console.log(`    status:            ${r.status} (0x${r.status.toString(16).padStart(2, '0')}) ${r.status === 0 ? 'GOOD' : r.status === 2 ? 'CHECK_CONDITION' : 'OTHER'}`);
  console.log(`    bytes_transferred: ${r.bytes_transferred}`);
  console.log(`    sense_data (${r.sense_data.length}): ${hex(r.sense_data, 32)}`);
  if (r.sense_data.length > 0) {
    const decoded = decodeSense(r.sense_data);
    if (decoded) {
      console.log(`    sense decoded:     KEY=${decoded.key} ${decoded.keyName}, ASC/ASCQ=${decoded.asc.toString(16).padStart(2, '0')}/${decoded.ascq.toString(16).padStart(2, '0')} ${decoded.ascText}`);
    }
  }
  console.log(`    data_in    (${r.data_in.length}): ${hex(r.data_in, 64)}`);
}

interface PhaseOutcome { pass: boolean; reason?: string; }

// ---------------------------------------------------------------------------
// PHASE A — connectivity proof (positive control)
// ---------------------------------------------------------------------------

async function phaseA(): Promise<PhaseOutcome> {
  console.log('\n=== Phase A: Connectivity proof (positive control gate) ===');

  console.log('\n[A1] INQUIRY (CDB 0x12)');
  const inq = await scsiExec([0x12, 0x00, 0x00, 0x00, 0x24, 0x00], [], 36);
  describeResult('INQUIRY', inq);
  if (inq.status !== 0 || inq.data_in.length < 32) {
    return { pass: false, reason: 'INQUIRY failed — SCSI bus or target not responsive' };
  }
  const product = String.fromCharCode(...inq.data_in.slice(16, 32)).trim();
  console.log(`    product:           "${product}"`);
  if (!product.includes('S3000') && !product.includes('S3200')) {
    return { pass: false, reason: `Unexpected target: "${product}"` };
  }

  console.log('\n[A2] MIDI ENABLE (CDB 0x09)');
  await midiEnable();
  console.log('    OK');

  console.log('\n[A3] Drain stale MIDI buffer');
  const drained = await drainQueue(10);
  console.log(`    Drained ${drained} stale chunks`);

  // Build a known-working SysEx: RMDATA (request misc data, opcode 0x0E in SYSX family)
  const rmdata = [0xf0, 0x47, MIDI_CHANNEL, 0x0e, 0x48, 0xf7];
  console.log(`\n[A4] SEND RMDATA flag=0x00: ${hex(rmdata)}`);
  const sendResult = await midiSendCdb(rmdata, 0x00);
  describeResult('SEND', sendResult);
  if (sendResult.status !== 0) {
    return { pass: false, reason: `RMDATA send failed with status=${sendResult.status}` };
  }

  console.log('\n[A5] Poll for reply (up to 2s)');
  const polled = await pollUntilReady(2000);
  console.log(`    poll attempts:  ${polled.pollCount}`);
  console.log(`    reply bytes:    ${polled.bytes}`);
  if (polled.bytes === 0) {
    return { pass: false, reason: 'No reply received within 2s' };
  }
  const reply = await midiRead(polled.bytes);
  describeResult('READ', reply);
  if (reply.data_in.length === 0 || reply.data_in[0] !== 0xf0) {
    return { pass: false, reason: `Reply does not start with F0: ${hex(reply.data_in)}` };
  }

  console.log('\n[Phase A PASS] Connectivity proven solid.');
  return { pass: true };
}

// ---------------------------------------------------------------------------
// PHASE B — sense-data plumbing sanity
// ---------------------------------------------------------------------------

async function phaseB(): Promise<PhaseOutcome> {
  console.log('\n\n=== Phase B: Sense-data plumbing sanity ===');
  console.log('Goal: deliberately send invalid opcode; confirm REQUEST SENSE auto-fetch');
  console.log('returns ILLEGAL_REQUEST/INVALID_OPCODE so we can interpret rejections.');

  console.log('\n[B1] Invalid opcode CDB: 99 00 00 00 00 00');
  const invalid = await scsiExec([0x99, 0x00, 0x00, 0x00, 0x00, 0x00], [], 0);
  describeResult('INVALID', invalid);

  if (invalid.status === 0) {
    return { pass: false, reason: 'Sampler accepted invalid opcode (status=0). Bridge or target is not enforcing CDB validity — sense plumbing test is meaningless.' };
  }
  if (invalid.sense_data.length === 0) {
    return { pass: false, reason: 'Status non-zero but no sense data returned. REQUEST SENSE auto-fetch is broken or target does not surface sense via standard means.' };
  }
  const decoded = decodeSense(invalid.sense_data);
  if (decoded) {
    console.log(`\n[Phase B PASS] Sense plumbing alive (standard fixed-format).`);
    console.log(`    KEY=${decoded.keyName}, ASC/ASCQ=${decoded.asc.toString(16)}/${decoded.ascq.toString(16)} (${decoded.ascText})`);
  } else {
    console.log(`\n[Phase B PASS — caveat] Sense data returned but NOT standard SCSI fixed-format.`);
    console.log(`    Raw sense (${invalid.sense_data.length} bytes): ${hex(invalid.sense_data)}`);
    console.log(`    Akai S3000XL appears to use a non-standard sense format. Phase C will still capture`);
    console.log(`    raw sense bytes for any rejection — interpretation will be best-effort.`);
  }
  return { pass: true };
}

// ---------------------------------------------------------------------------
// PHASE C — RSDATA flag=0x00 baseline vs flag=0x80 test
// ---------------------------------------------------------------------------

function build7BitTwo(value: number): number[] {
  // Akai 7-bit-per-byte little-endian for 14-bit values (sample index)
  return [value & 0x7f, (value >> 7) & 0x7f];
}

async function phaseC(): Promise<void> {
  console.log('\n\n=== Phase C: RSDATA (BULK-family opcode 0x0A) flag comparison ===');
  console.log('Sub-test C1a (baseline, flag=0x00) and C1b (test, flag=0x80) with the same payload.');
  console.log('Result interpretation: see test-plan-2026-04-21-mesa-cdb-flag.md Phase C matrix.');
  console.log('NOTE: any rejection may be state/control-path related, not pure flag rejection.');

  // RSDATA: F0 47 cc 0A 48 [sample_idx_lo] [sample_idx_hi] F7
  const sampleIdx = 0;
  const rsdata = [0xf0, 0x47, MIDI_CHANNEL, 0x0a, 0x48, ...build7BitTwo(sampleIdx), 0xf7];
  console.log(`\nRSDATA payload (sample ${sampleIdx}): ${hex(rsdata)}`);

  // C1a: baseline flag=0x00
  console.log('\n[C1a] Drain queue, then SEND RSDATA flag=0x00');
  await drainQueue(5);
  const c1a = await midiSendCdb(rsdata, 0x00);
  describeResult('SEND C1a flag=0x00', c1a);
  const c1aPolled = await pollUntilReady(2000);
  console.log(`    Poll: ${c1aPolled.pollCount} attempts, ${c1aPolled.bytes} bytes pending`);
  let c1aReply: number[] = [];
  if (c1aPolled.bytes > 0) {
    const rd = await midiRead(c1aPolled.bytes);
    c1aReply = rd.data_in;
    console.log(`    Reply (${c1aReply.length}): ${hex(c1aReply, 64)}`);
  }

  // C1b: test flag=0x80
  console.log('\n[C1b] Drain queue, then SEND RSDATA flag=0x80');
  await drainQueue(5);
  const c1b = await midiSendCdb(rsdata, 0x80);
  describeResult('SEND C1b flag=0x80', c1b);
  // Two ways flag=0x80 might surface a reply:
  //   - inline in c1b.data_in (different protocol pattern)
  //   - via subsequent poll/read (same as 0x00)
  const c1bInline = c1b.data_in;
  const c1bPolled = await pollUntilReady(2000);
  console.log(`    Poll after: ${c1bPolled.pollCount} attempts, ${c1bPolled.bytes} bytes pending`);
  let c1bViaPoll: number[] = [];
  if (c1bPolled.bytes > 0) {
    const rd = await midiRead(c1bPolled.bytes);
    c1bViaPoll = rd.data_in;
    console.log(`    Reply via poll (${c1bViaPoll.length}): ${hex(c1bViaPoll, 64)}`);
  }

  // Comparison summary
  console.log('\n=== Phase C SUMMARY ===');
  console.log(`  C1a flag=0x00:`);
  console.log(`    SCSI status: ${c1a.status}`);
  console.log(`    inline data_in: ${c1a.data_in.length} bytes`);
  console.log(`    reply via poll: ${c1aReply.length} bytes`);
  console.log(`  C1b flag=0x80:`);
  console.log(`    SCSI status: ${c1b.status}`);
  console.log(`    sense_data: ${c1b.sense_data.length} bytes${c1b.sense_data.length > 0 ? ` (${decodeSense(c1b.sense_data)?.keyName} / ${decodeSense(c1b.sense_data)?.ascText})` : ''}`);
  console.log(`    inline data_in: ${c1bInline.length} bytes`);
  console.log(`    reply via poll: ${c1bViaPoll.length} bytes`);

  console.log('\n  INTERPRETATION (per test plan matrix):');
  if (c1a.status !== 0) {
    console.log('    C1a baseline FAILED. Cannot interpret C1b without working baseline.');
    console.log('    The sampler may not have a sample at index 0, or may be in unexpected state.');
    console.log('    Try a different sample index or reset device state.');
    return;
  }
  if (c1b.status === 0 && c1bViaPoll.length > 0) {
    console.log('    → flag=0x80 ACCEPTED with reply via poll (same mechanism as 0x00).');
    console.log('      Promotes candidate target identity (SMSendData or wire-equivalent) by one consistency point.');
    console.log('      Existing bridge comment "S3000XL rejects 0x80" is too strong for this opcode context.');
  } else if (c1b.status === 0 && c1bInline.length > 0) {
    console.log('    → flag=0x80 ACCEPTED with INLINE reply in send-CDB data_in.');
    console.log('      Different protocol pattern from 0x00. Promotes candidate AND tells us the reply mechanism.');
  } else if (c1b.status === 2 && c1b.sense_data.length > 0) {
    const d = decodeSense(c1b.sense_data);
    if (d) {
      console.log(`    → flag=0x80 REJECTED with CHECK CONDITION, sense=${d.keyName} ${d.ascText}.`);
      if (d.key === 0x05 && d.asc === 0x20) {
        console.log('      INVALID_OPCODE: sampler does not recognize this CDB shape at all.');
        console.log('      DOES NOT REFUTE MESA shape — could mean: (a) different patch target in production;');
        console.log('      (b) state setup precondition missing; (c) wrong opcode-family choice for probe.');
      } else if (d.key === 0x05 && d.asc === 0x24) {
        console.log('      INVALID_FIELD_IN_CDB: the flag byte (or another CDB field) is rejected by validation.');
        console.log('      Suggests this exact CDB shape is not recognized in the current device state.');
      } else if (d.key === 0x05 && d.asc === 0x26) {
        console.log('      INVALID_FIELD_IN_PARAMETER: the data_out payload is the issue, not the CDB.');
      } else if (d.asc === 0x2c) {
        console.log('      COMMAND_SEQUENCE_ERROR: state precondition is missing.');
        console.log('      MESA likely issues setup commands before SRAW/BULK that we are not replicating.');
      } else {
        console.log('      Sense pattern not in common interpretation table — consult Akai docs / SCSI standards.');
      }
    }
  } else if (c1b.status !== 0 && c1b.sense_data.length === 0) {
    console.log('    → flag=0x80 REJECTED but no sense data even after auto-fetch.');
    console.log('      Akai may use non-standard sense fields, or rejection is at a layer that does not surface sense.');
    console.log('      Bus capture would be next step.');
  } else {
    console.log('    → unexpected outcome shape. Document raw values above.');
  }
  console.log('\n  Reminder: per Codex parity 2026-04-22 — even a clean PASS does not promote');
  console.log('  the wire format to fully MEASURED. It promotes the candidate identity to');
  console.log('  "more strongly supported." Final promotion requires hardware bus capture');
  console.log('  matching MESA emission OR emulator with bus capture confirming the bytes match.');
}

// ---------------------------------------------------------------------------
// PHASE D — WRITE-direction probe per Codex parity recommendation 2026-04-22
// (Codex: "minimal WRITE-direction 0x0B/SDATA family with the candidate-style
// flag behavior, not more 0x0A/RSDATA work")
// ---------------------------------------------------------------------------

function build7BitFour(value: number): number[] {
  // Akai 7-bit-per-byte little-endian for 28-bit values (offset, count)
  return [
    value & 0x7f,
    (value >> 7) & 0x7f,
    (value >> 14) & 0x7f,
    (value >> 21) & 0x7f,
  ];
}

async function phaseD(): Promise<void> {
  console.log('\n\n=== Phase D: SDATA WRITE (BULK-family opcode 0x0B) flag comparison ===');
  console.log('WRITE-direction probe per Codex recommendation: tests the strongest remaining');
  console.log('structural ambiguity (READ-vs-WRITE family) before any preconditioning experiments.');

  // Build SDATA WRITE SysEx: F0 47 cc 0B 48 [ss ss] [oo oo oo oo] [nn nn nn nn] 01 00 F7
  // Sample 0 (known to exist per Phase A/C), offset 0, count 0 — zero-byte no-op write.
  // Zero count means even if the device honors the write semantically, no data is altered.
  const sampleIdx = 0;
  const offset = 0;
  const count = 0;
  const sdata = [
    0xf0, 0x47, MIDI_CHANNEL, 0x0b, 0x48,
    ...build7BitTwo(sampleIdx),
    ...build7BitFour(offset),
    ...build7BitFour(count),
    0x01, // interval
    0x00, // reserved
    0xf7,
  ];
  console.log(`\nSDATA WRITE payload (sample ${sampleIdx}, offset ${offset}, count ${count}, ${sdata.length} bytes total):`);
  console.log(`  ${hex(sdata)}`);

  // D1a: baseline flag=0x00
  console.log('\n[D1a] Drain queue, then SEND SDATA WRITE flag=0x00');
  await drainQueue(5);
  const d1a = await midiSendCdb(sdata, 0x00);
  describeResult('SEND D1a flag=0x00', d1a);
  const d1aPolled = await pollUntilReady(2000);
  console.log(`    Poll: ${d1aPolled.pollCount} attempts, ${d1aPolled.bytes} bytes pending`);
  let d1aReply: number[] = [];
  if (d1aPolled.bytes > 0) {
    const rd = await midiRead(d1aPolled.bytes);
    d1aReply = rd.data_in;
    console.log(`    Reply (${d1aReply.length}): ${hex(d1aReply, 64)}`);
  }

  // D1b: test flag=0x80
  console.log('\n[D1b] Drain queue, then SEND SDATA WRITE flag=0x80');
  await drainQueue(5);
  const d1b = await midiSendCdb(sdata, 0x80);
  describeResult('SEND D1b flag=0x80', d1b);
  const d1bInline = d1b.data_in;
  const d1bPolled = await pollUntilReady(2000);
  console.log(`    Poll after: ${d1bPolled.pollCount} attempts, ${d1bPolled.bytes} bytes pending`);
  let d1bViaPoll: number[] = [];
  if (d1bPolled.bytes > 0) {
    const rd = await midiRead(d1bPolled.bytes);
    d1bViaPoll = rd.data_in;
    console.log(`    Reply via poll (${d1bViaPoll.length}): ${hex(d1bViaPoll, 64)}`);
  }

  // Summary + interpretation
  console.log('\n=== Phase D SUMMARY ===');
  console.log(`  D1a flag=0x00 (baseline):`);
  console.log(`    SCSI status: ${d1a.status}; sense ${d1a.sense_data.length} bytes: ${hex(d1a.sense_data)}`);
  console.log(`    inline data_in: ${d1a.data_in.length} bytes; reply via poll: ${d1aReply.length} bytes`);
  console.log(`  D1b flag=0x80 (test):`);
  console.log(`    SCSI status: ${d1b.status}; sense ${d1b.sense_data.length} bytes: ${hex(d1b.sense_data)}`);
  console.log(`    inline data_in: ${d1bInline.length} bytes; reply via poll: ${d1bViaPoll.length} bytes`);

  console.log('\n  CROSS-PHASE COMPARISON (sense bytes):');
  console.log(`    Invalid opcode (0x99, Phase B):       ${hex([0x02, 0x00, 0x00, 0x00])}  ← non-standard 4-byte`);
  console.log(`    RSDATA 0x0A + flag=0x80 (Phase C C1b): 03 00 00 00  ← non-standard 4-byte`);
  console.log(`    SDATA  0x0B + flag=0x00 (Phase D D1a): ${hex(d1a.sense_data)}`);
  console.log(`    SDATA  0x0B + flag=0x80 (Phase D D1b): ${hex(d1b.sense_data)}`);

  console.log('\n  INTERPRETATION:');
  if (d1a.status !== 0 && d1b.status !== 0) {
    if (JSON.stringify(d1a.sense_data) === JSON.stringify(d1b.sense_data)) {
      console.log('    → Both flags rejected with IDENTICAL sense. The flag byte is NOT the discriminator');
      console.log('      for SDATA. Sense reflects something else (state, count=0 invalidity, etc.).');
    } else {
      console.log('    → Both flags rejected but with DIFFERENT sense. The flag byte produces a');
      console.log('      different rejection mode. Captures the discrimination signal.');
    }
  } else if (d1a.status === 0 && d1b.status !== 0) {
    console.log('    → flag=0x00 ACCEPTED, flag=0x80 REJECTED for SDATA WRITE.');
    console.log('      Same pattern as RSDATA. The candidate-style WRITE+flag=0x80 path is');
    console.log('      rejected on hardware. DOES NOT REFUTE MESA shape — could mean different');
    console.log('      production patch target OR missing state setup.');
  } else if (d1a.status === 0 && d1b.status === 0) {
    console.log('    → BOTH flags ACCEPTED for SDATA WRITE. flag=0x80 works in WRITE direction!');
    console.log('      Strong promotion of the candidate target identity. Existing bridge comment');
    console.log('      "S3000XL rejects 0x80" applies to READ-family only, NOT WRITE.');
  } else if (d1a.status !== 0 && d1b.status === 0) {
    console.log('    → SURPRISING: flag=0x80 accepted but flag=0x00 rejected for SDATA WRITE.');
    console.log('      Strongly suggests the device requires flag=0x80 for WRITE direction.');
    console.log('      Existing bridge code (which always uses 0x00) may be working only because');
    console.log('      the device tolerates BULK-via-fallthrough differently than direct SDATA.');
  }

  console.log('\n  Reminder: per Codex 2026-04-22 — even a clean PASS does not promote the');
  console.log('  wire format to fully MEASURED. It promotes the candidate identity to');
  console.log('  "more strongly supported." This is a constrained probe, not full validation.');
}

async function main() {
  console.log('=== MESA II CDB[5] flag-byte hardware validation (Phases A-D) ===');
  console.log(`Bridge: ${BRIDGE_URL}`);
  console.log(`Target: SCSI ID ${TARGET_ID}`);

  try {
    const a = await phaseA();
    if (!a.pass) {
      console.error(`\n[ABORT] Phase A failed: ${a.reason}`);
      await midiDisable().catch(() => {});
      process.exit(2);
    }

    const b = await phaseB();
    if (!b.pass) {
      console.error(`\n[ABORT] Phase B failed: ${b.reason}`);
      console.error('Sense plumbing not working — subsequent rejection results would be uninterpretable.');
      await midiDisable().catch(() => {});
      process.exit(3);
    }

    await phaseC();
    await phaseD();

    console.log('\n=== Test complete. Disabling MIDI mode. ===');
    await midiDisable();
  } catch (err) {
    console.error('\n[FATAL]', err);
    await midiDisable().catch(() => {});
    process.exit(1);
  }
}

main();
