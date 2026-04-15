/**
 * Regression test for #280: writing FILFRQ/FILQ corrupts E_FREQ.
 *
 * Tests cross-field integrity: writing one keygroup field must not
 * change the value of unrelated fields. This is a Node.js test that
 * talks directly to the device through the S3K client — no UI involved.
 *
 * If this test fails, the bug is in the client/encoding layer.
 * If this test passes, the bug is in the UI state management layer.
 */

import * as s3k from '@audiocontrol/sampler-devices/s3k';
import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';
// Relative import: @/ path alias is broken with tsx + nodenext (see package.json #node/* for native Node imports)
import type { TestContext, TestResult } from './test-types.js';

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Test that writing field A doesn't corrupt field B.
 *
 * 1. Read keygroup header from device
 * 2. Record the value of the "witness" field (B)
 * 3. Change the "target" field (A) to a different value
 * 4. Write the header to the device
 * 5. Read back the header
 * 6. Assert the witness field still has its original value
 */
async function testCrossFieldIntegrity(
  ctx: TestContext,
  targetField: string,
  targetWriteFn: string,
  targetTestValue: number,
  witnessField: string,
  witnessLabel: string,
): Promise<TestResult> {
  const testName = `cross-field: writing ${targetField} does not corrupt ${witnessField}`;

  try {
    // 1. Read current keygroup header
    const original = await ctx.client.fetchKeygroupHeader(0, 0);
    const originalWitness = (original as Record<string, unknown>)[witnessField] as number;
    const originalTarget = (original as Record<string, unknown>)[targetField] as number;

    ctx.log(`  ${testName}: ${witnessLabel}=${originalWitness}, ${targetField}=${originalTarget}`);

    // Ensure witness is non-zero so we can detect if it gets zeroed
    let witnessValue = originalWitness;
    if (witnessValue === 0) {
      ctx.log(`  Setting ${witnessLabel} to 25 (was 0)`);
      const setup = { ...original, raw: [...original.raw] } as KeygroupHeader;
      const witnessWriteFn = (s3k as Record<string, Function>)[`KeygroupHeader_write${witnessField}`];
      if (!witnessWriteFn) {
        return { name: testName, status: 'ERROR', detail: `No write function for ${witnessField}` };
      }
      (setup as Record<string, unknown>)[witnessField] = 25;
      witnessWriteFn(setup, 25);
      await ctx.client.writeKeygroupHeader(setup);
      await delay(ctx.writeDelayMs);
      witnessValue = 25;
    }

    // 2. Read again to get a clean header with the witness value set
    const clean = await ctx.client.fetchKeygroupHeader(0, 0);
    const cleanWitness = (clean as Record<string, unknown>)[witnessField] as number;
    ctx.log(`  After setup: ${witnessLabel}=${cleanWitness}`);

    // 3. Write the target field to a different value
    const modified = { ...clean, raw: [...clean.raw] } as KeygroupHeader;
    const targetWriter = (s3k as Record<string, Function>)[targetWriteFn];
    if (!targetWriter) {
      return { name: testName, status: 'ERROR', detail: `No write function ${targetWriteFn}` };
    }
    const newTargetValue = originalTarget === targetTestValue ? targetTestValue + 1 : targetTestValue;
    (modified as Record<string, unknown>)[targetField] = newTargetValue;
    targetWriter(modified, newTargetValue);

    ctx.log(`  Writing ${targetField}=${newTargetValue}`);
    await ctx.client.writeKeygroupHeader(modified);
    await delay(ctx.writeDelayMs);

    // 4. Read back and check witness
    const readback = await ctx.client.fetchKeygroupHeader(0, 0);
    const readbackWitness = (readback as Record<string, unknown>)[witnessField] as number;
    const readbackTarget = (readback as Record<string, unknown>)[targetField] as number;

    ctx.log(`  Readback: ${witnessLabel}=${readbackWitness}, ${targetField}=${readbackTarget}`);

    // 5. Restore original values
    if (!ctx.noRestore) {
      const restore = { ...readback, raw: [...readback.raw] } as KeygroupHeader;
      targetWriter(restore, originalTarget);
      (restore as Record<string, unknown>)[targetField] = originalTarget;
      const witnessWriter = (s3k as Record<string, Function>)[`KeygroupHeader_write${witnessField}`];
      if (witnessWriter) {
        witnessWriter(restore, originalWitness);
        (restore as Record<string, unknown>)[witnessField] = originalWitness;
      }
      await ctx.client.writeKeygroupHeader(restore);
      await delay(ctx.writeDelayMs);
    }

    // 6. Assert
    if (readbackWitness !== cleanWitness) {
      return {
        name: testName,
        status: 'FAIL',
        detail: `${witnessLabel} changed from ${cleanWitness} to ${readbackWitness} after writing ${targetField}=${newTargetValue}`,
      };
    }

    return {
      name: testName,
      status: 'PASS',
      detail: `${witnessLabel}=${readbackWitness} unchanged after ${targetField}=${readbackTarget}`,
    };
  } catch (err) {
    return {
      name: testName,
      status: 'ERROR',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function runFilterEFreqBugTests(ctx: TestContext): Promise<TestResult[]> {
  const results: TestResult[] = [];

  ctx.log('=== Bug #280: Cross-field integrity tests ===');

  // Test FILFRQ → E_FREQ
  results.push(await testCrossFieldIntegrity(
    ctx, 'FILFRQ', 'KeygroupHeader_writeFILFRQ', 50, 'E_FREQ', 'Env→Filt',
  ));

  // Test FILQ → E_FREQ
  results.push(await testCrossFieldIntegrity(
    ctx, 'FILQ', 'KeygroupHeader_writeFILQ', 8, 'E_FREQ', 'Env→Filt',
  ));

  // Test K_FREQ → E_FREQ
  results.push(await testCrossFieldIntegrity(
    ctx, 'K_FREQ', 'KeygroupHeader_writeK_FREQ', 25, 'E_FREQ', 'Env→Filt',
  ));

  // Test V_FREQ → E_FREQ
  results.push(await testCrossFieldIntegrity(
    ctx, 'V_FREQ', 'KeygroupHeader_writeV_FREQ', 20, 'E_FREQ', 'Env→Filt',
  ));

  // Test P_FREQ → E_FREQ
  results.push(await testCrossFieldIntegrity(
    ctx, 'P_FREQ', 'KeygroupHeader_writeP_FREQ', 15, 'E_FREQ', 'Env→Filt',
  ));

  // Test ATTAK1 → E_FREQ (non-filter field, should also not corrupt)
  results.push(await testCrossFieldIntegrity(
    ctx, 'ATTAK1', 'KeygroupHeader_writeATTAK1', 30, 'E_FREQ', 'Env→Filt',
  ));

  // Test FILFRQ → ATTAK1 (verify it's not just E_FREQ — test another witness)
  results.push(await testCrossFieldIntegrity(
    ctx, 'FILFRQ', 'KeygroupHeader_writeFILFRQ', 60, 'ATTAK1', 'Attack',
  ));

  return results;
}
