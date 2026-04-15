/**
 * Diagnostic test for #280: Is E_FREQ mapped to the correct byte offset?
 *
 * The S2800/S3000 SysEx spec marks E_FREQ (offset 11) as "Not used."
 * If that's true, the UI's "Env→Filt" knob is reading/writing a dead field,
 * and the real envelope→filter depth is elsewhere (possibly MODVFILT1-3).
 *
 * This test:
 * 1. Reads the keygroup header and dumps all filter-related fields
 * 2. Writes a known value to E_FREQ, reads back, checks it stuck
 * 3. Writes a known value to MODVFILT1, reads back, checks it stuck
 * 4. Reports which fields the device actually honors
 *
 * Run: make test-scsi-write-validation ARGS="--test efreq-mapping"
 *
 * Compare the output against the S3000XL front panel display:
 *   EDIT PROGRAM → KEYGROUP → FILTER → ENV2→FREQ
 */

import * as s3k from '@audiocontrol/sampler-devices/s3k';
import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';
import type { TestContext, TestResult } from '#node/lib/test-types.js';

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Dump all filter-related fields and their values.
 */
function dumpFilterFields(ctx: TestContext, header: KeygroupHeader, label: string): void {
  ctx.log(`\n  --- ${label} ---`);
  ctx.log(`  FILFRQ     = ${header.FILFRQ}  (filter frequency, 0-99)`);
  ctx.log(`  FILQ       = ${header.FILQ}  (filter resonance, 0-15)`);
  ctx.log(`  K_FREQ     = ${header.K_FREQ}  (key→filter)`);
  ctx.log(`  V_FREQ     = ${header.V_FREQ}  (vel→filter, spec: "not used")`);
  ctx.log(`  P_FREQ     = ${header.P_FREQ}  (press→filter, spec: "not used")`);
  ctx.log(`  E_FREQ     = ${header.E_FREQ}  (env→filter, spec: "not used")`);
  ctx.log(`  MODVFILT1  = ${header.MODVFILT1}  (assignable source 1→filter)`);
  ctx.log(`  MODVFILT2  = ${header.MODVFILT2}  (assignable source 2→filter)`);
  ctx.log(`  MODVFILT3  = ${header.MODVFILT3}  (assignable source 3→filter)`);
  ctx.log(`  V_ENV2     = ${header.V_ENV2}  (velocity→env2 scaling)`);
}

/**
 * Write a value to a field, read back, check if it persisted.
 */
async function probeField(
  ctx: TestContext,
  fieldName: string,
  writeFnName: string,
  testValue: number,
  originalHeader: KeygroupHeader,
): Promise<TestResult> {
  const testName = `probe: write ${fieldName}=${testValue} and read back`;

  try {
    // Write
    const toWrite = { ...originalHeader, raw: [...originalHeader.raw] } as KeygroupHeader;
    const writeFn = (s3k as Record<string, Function>)[writeFnName];
    if (!writeFn) {
      return { name: testName, status: 'ERROR', detail: `No write function: ${writeFnName}` };
    }
    (toWrite as Record<string, unknown>)[fieldName] = testValue;
    writeFn(toWrite, testValue);
    await ctx.client.writeKeygroupHeader(toWrite);
    await delay(ctx.writeDelayMs);

    // Read back
    const readback = await ctx.client.fetchKeygroupHeader(0, 0);
    const readValue = (readback as Record<string, unknown>)[fieldName] as number;

    ctx.log(`  ${fieldName}: wrote ${testValue}, read back ${readValue}`);

    // Also dump all filter fields to see if something ELSE changed
    dumpFilterFields(ctx, readback, `after writing ${fieldName}=${testValue}`);

    if (readValue === testValue) {
      return { name: testName, status: 'PASS', detail: `${fieldName}=${readValue} (round-trips)` };
    } else {
      return { name: testName, status: 'FAIL', detail: `wrote ${testValue}, got ${readValue} — field may be ignored by device` };
    }
  } catch (err) {
    return { name: testName, status: 'ERROR', detail: err instanceof Error ? err.message : String(err) };
  }
}

export async function runEfreqMappingTests(ctx: TestContext): Promise<TestResult[]> {
  const results: TestResult[] = [];

  ctx.log('=== E_FREQ field mapping diagnostic (#280) ===');
  ctx.log('Compare these values against the S3000XL front panel:');
  ctx.log('  EDIT PROGRAM → KEYGROUP → FILTER');

  // 1. Read current state
  const original = await ctx.client.fetchKeygroupHeader(0, 0);
  dumpFilterFields(ctx, original, 'current device state');

  // 2. Probe E_FREQ (spec says "not used")
  results.push(await probeField(
    ctx, 'E_FREQ', 'KeygroupHeader_writeE_FREQ', 35, original,
  ));

  // Re-read to get clean state
  const afterEFreq = await ctx.client.fetchKeygroupHeader(0, 0);

  // 3. Probe MODVFILT1 (assignable source 1 → filter)
  results.push(await probeField(
    ctx, 'MODVFILT1', 'KeygroupHeader_writeMODVFILT1', 40, afterEFreq,
  ));

  // Re-read
  const afterModv = await ctx.client.fetchKeygroupHeader(0, 0);

  // 4. Probe V_FREQ (spec says "not used")
  results.push(await probeField(
    ctx, 'V_FREQ', 'KeygroupHeader_writeV_FREQ', 20, afterModv,
  ));

  // 5. Restore original values
  if (!ctx.noRestore) {
    ctx.log('\n  Restoring original values...');
    const restore = { ...original, raw: [...original.raw] } as KeygroupHeader;
    await ctx.client.writeKeygroupHeader(restore);
    await delay(ctx.writeDelayMs);
  }

  ctx.log('\n  === INTERPRETATION ===');
  ctx.log('  If E_FREQ round-trips but the front panel shows 0 for ENV2→FREQ,');
  ctx.log('  then E_FREQ is a dead field and the real param is elsewhere.');
  ctx.log('  Check the front panel after each probe to see which field');
  ctx.log('  the device actually displays as ENV2→FREQ.');

  return results;
}
