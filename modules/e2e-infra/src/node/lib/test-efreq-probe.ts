/**
 * Interactive probe for #280: find which SysEx field maps to ENV2→FREQ on the front panel.
 *
 * Strategy: write a distinctive value (+42) to one field at a time in the filter
 * neighborhood. After each write, pause so the user can check the front panel.
 *
 * The test restores original values after each probe.
 *
 * Run: make test-scsi-write-validation ARGS="--test efreq-probe"
 */

import * as s3k from '@audiocontrol/sampler-devices/s3k';
import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';
import type { TestContext, TestResult } from '#node/lib/test-types.js';

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const PROBE_VALUE = 42;

/** Fields in the filter neighborhood that might be ENV2→FREQ */
const CANDIDATES = [
  { field: 'V_FREQ', writeFn: 'KeygroupHeader_writeV_FREQ', desc: 'spec: vel→filter (not used)' },
  { field: 'P_FREQ', writeFn: 'KeygroupHeader_writeP_FREQ', desc: 'spec: press→filter (not used)' },
  { field: 'E_FREQ', writeFn: 'KeygroupHeader_writeE_FREQ', desc: 'spec: env→filter (not used)' },
  { field: 'MODVFILT1', writeFn: 'KeygroupHeader_writeMODVFILT1', desc: 'assignable source 1→filter' },
  { field: 'MODVFILT2', writeFn: 'KeygroupHeader_writeMODVFILT2', desc: 'assignable source 2→filter' },
  { field: 'MODVFILT3', writeFn: 'KeygroupHeader_writeMODVFILT3', desc: 'assignable source 3→filter' },
  { field: 'V_ENV2', writeFn: 'KeygroupHeader_writeV_ENV2', desc: 'velocity→env2 scaling' },
];

export async function runEfreqProbeTests(ctx: TestContext): Promise<TestResult[]> {
  const results: TestResult[] = [];

  ctx.log('=== ENV2→FREQ field probe (#280) ===');
  ctx.log(`Writing ${PROBE_VALUE} to each candidate field, one at a time.`);
  ctx.log('Check the S3000XL front panel after each write:');
  ctx.log('  EDIT PROGRAM → KEYGROUP → FILTER → ENV2→FREQ');
  ctx.log('');

  const original = await ctx.client.fetchKeygroupHeader(0, 0);

  for (const candidate of CANDIDATES) {
    const writeFn = (s3k as Record<string, Function>)[candidate.writeFn];
    if (!writeFn) {
      results.push({ name: `probe ${candidate.field}`, status: 'ERROR', detail: `no writer: ${candidate.writeFn}` });
      continue;
    }

    // Write probe value
    const probed = { ...original, raw: [...original.raw] } as KeygroupHeader;
    (probed as Record<string, unknown>)[candidate.field] = PROBE_VALUE;
    writeFn(probed, PROBE_VALUE);
    await ctx.client.writeKeygroupHeader(probed);
    await delay(ctx.writeDelayMs);

    // Read back to confirm
    const readback = await ctx.client.fetchKeygroupHeader(0, 0);
    const readVal = (readback as Record<string, unknown>)[candidate.field] as number;

    ctx.log(`>>> ${candidate.field} = ${PROBE_VALUE} (${candidate.desc})`);
    ctx.log(`    Readback: ${readVal}`);
    ctx.log(`    CHECK FRONT PANEL NOW — does ENV2→FREQ show +42?`);
    ctx.log('');

    results.push({
      name: `probe ${candidate.field}`,
      status: readVal === PROBE_VALUE ? 'PASS' : 'FAIL',
      detail: `wrote ${PROBE_VALUE}, read ${readVal}`,
    });

    // Restore before next probe
    const restore = { ...original, raw: [...original.raw] } as KeygroupHeader;
    await ctx.client.writeKeygroupHeader(restore);
    await delay(ctx.writeDelayMs);
  }

  ctx.log('=== Probe complete. Which field showed +42 on the front panel? ===');

  return results;
}
