/**
 * Write-readback tests — Phase A (no cache).
 *
 * Each test: read -> modify -> write -> wait -> read back -> compare -> restore.
 */

import {
  ProgramHeader_writePRNAME,
  ProgramHeader_writePOLYPH,
  KeygroupHeader_writeFILFRQ,
  SampleHeader_writeSHNAME,
} from '@audiocontrol/sampler-devices/s3k';
import type { TestContext, TestResult } from '@/node/lib/test-types.js';

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runWriteTests(ctx: TestContext): Promise<TestResult[]> {
  const results: TestResult[] = [];
  results.push(await testWriteProgramName(ctx));
  results.push(await testWritePolyphony(ctx));
  results.push(await testWriteFilterFreq(ctx));
  results.push(await testWriteSampleName(ctx));
  return results;
}

// ---------------------------------------------------------------------------
// Program name (string field, visible on device LCD)
// ---------------------------------------------------------------------------

async function testWriteProgramName(ctx: TestContext): Promise<TestResult> {
  const name = 'write-program-name';
  try {
    const original = await ctx.client.fetchProgramHeader(0);
    const originalName = original.PRNAME;
    ctx.log(`  Original PRNAME: "${originalName}"`);

    const testName = 'WRITETEST123'; // 12-char Akai name, clearly different
    const modified = { ...original, raw: [...original.raw] };
    ProgramHeader_writePRNAME(modified, testName);
    ctx.log(`  Modified PRNAME in raw: "${modified.PRNAME}"`);

    await ctx.client.writeProgramHeader(modified);
    ctx.log(`  Wrote PRNAME: "${testName}"`);
    await delay(ctx.writeDelayMs);

    const readback = await ctx.client.fetchProgramHeader(0);
    const readbackName = readback.PRNAME;
    ctx.log(`  Readback PRNAME: "${readbackName}"`);

    let result: TestResult;
    if (readbackName.trim() === testName.trim()) {
      result = { name, status: 'PASS', detail: `"${originalName}" -> "${readbackName}"` };
    } else if (readbackName.trim() === originalName.trim()) {
      result = { name, status: 'FAIL', detail: `Write did not persist — readback matches original "${originalName}"` };
    } else {
      result = { name, status: 'ERROR', detail: `Unexpected readback: "${readbackName}" (expected "${testName}" or "${originalName}")` };
    }

    if (!ctx.noRestore) {
      await ctx.client.writeProgramHeader(original);
      await delay(ctx.writeDelayMs);
      const verify = await ctx.client.fetchProgramHeader(0);
      ctx.log(`  Restored PRNAME: "${verify.PRNAME}"`);
    }

    return result;
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  }
}

// ---------------------------------------------------------------------------
// Program polyphony (numeric field, 0-31)
// ---------------------------------------------------------------------------

async function testWritePolyphony(ctx: TestContext): Promise<TestResult> {
  const name = 'write-polyphony';
  try {
    const original = await ctx.client.fetchProgramHeader(0);
    const originalVal = original.POLYPH;
    ctx.log(`  Original POLYPH: ${originalVal}`);

    const testVal = originalVal === 15 ? 10 : 15;
    const modified = { ...original, raw: [...original.raw] };
    ProgramHeader_writePOLYPH(modified, testVal);

    await ctx.client.writeProgramHeader(modified);
    ctx.log(`  Wrote POLYPH: ${testVal}`);
    await delay(ctx.writeDelayMs);

    const readback = await ctx.client.fetchProgramHeader(0);
    ctx.log(`  Readback POLYPH: ${readback.POLYPH}`);

    let result: TestResult;
    if (readback.POLYPH === testVal) {
      result = { name, status: 'PASS', detail: `${originalVal} -> ${readback.POLYPH}` };
    } else if (readback.POLYPH === originalVal) {
      result = { name, status: 'FAIL', detail: `Write did not persist — readback matches original ${originalVal}` };
    } else {
      result = { name, status: 'ERROR', detail: `Unexpected readback: ${readback.POLYPH}` };
    }

    if (!ctx.noRestore) {
      await ctx.client.writeProgramHeader(original);
      await delay(ctx.writeDelayMs);
      const verify = await ctx.client.fetchProgramHeader(0);
      ctx.log(`  Restored POLYPH: ${verify.POLYPH}`);
    }

    return result;
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  }
}

// ---------------------------------------------------------------------------
// Keygroup filter frequency (numeric field, 0-99)
// ---------------------------------------------------------------------------

async function testWriteFilterFreq(ctx: TestContext): Promise<TestResult> {
  const name = 'write-filter-freq';
  try {
    const original = await ctx.client.fetchKeygroupHeader(0, 0);
    const originalVal = original.FILFRQ;
    ctx.log(`  Original FILFRQ: ${originalVal}`);

    const testVal = originalVal === 50 ? 30 : 50;
    const modified = { ...original, raw: [...original.raw] };
    KeygroupHeader_writeFILFRQ(modified, testVal);

    await ctx.client.writeKeygroupHeader(modified);
    ctx.log(`  Wrote FILFRQ: ${testVal}`);
    await delay(ctx.writeDelayMs);

    const readback = await ctx.client.fetchKeygroupHeader(0, 0);
    ctx.log(`  Readback FILFRQ: ${readback.FILFRQ}`);

    let result: TestResult;
    if (readback.FILFRQ === testVal) {
      result = { name, status: 'PASS', detail: `${originalVal} -> ${readback.FILFRQ}` };
    } else if (readback.FILFRQ === originalVal) {
      result = { name, status: 'FAIL', detail: `Write did not persist — readback matches original ${originalVal}` };
    } else {
      result = { name, status: 'ERROR', detail: `Unexpected readback: ${readback.FILFRQ}` };
    }

    if (!ctx.noRestore) {
      await ctx.client.writeKeygroupHeader(original);
      await delay(ctx.writeDelayMs);
      const verify = await ctx.client.fetchKeygroupHeader(0, 0);
      ctx.log(`  Restored FILFRQ: ${verify.FILFRQ}`);
    }

    return result;
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  }
}

// ---------------------------------------------------------------------------
// Sample name (string field)
// ---------------------------------------------------------------------------

async function testWriteSampleName(ctx: TestContext): Promise<TestResult> {
  const name = 'write-sample-name';
  try {
    const original = await ctx.client.fetchSampleHeader(0);
    const originalName = original.SHNAME;
    ctx.log(`  Original SHNAME: "${originalName}"`);

    const testName = 'WRITETEST123'; // 12-char Akai name, clearly different
    const modified = { ...original, raw: [...original.raw] };
    SampleHeader_writeSHNAME(modified, testName);
    ctx.log(`  Modified SHNAME in raw: "${modified.SHNAME}"`);

    await ctx.client.writeSampleHeader(modified);
    ctx.log(`  Wrote SHNAME: "${testName}"`);
    await delay(ctx.writeDelayMs);

    const readback = await ctx.client.fetchSampleHeader(0);
    ctx.log(`  Readback SHNAME: "${readback.SHNAME}"`);

    let result: TestResult;
    if (readback.SHNAME.trim() === testName.trim()) {
      result = { name, status: 'PASS', detail: `"${originalName}" -> "${readback.SHNAME}"` };
    } else if (readback.SHNAME.trim() === originalName.trim()) {
      result = { name, status: 'FAIL', detail: `Write did not persist — readback matches original "${originalName}"` };
    } else {
      result = { name, status: 'ERROR', detail: `Unexpected readback: "${readback.SHNAME}"` };
    }

    if (!ctx.noRestore) {
      await ctx.client.writeSampleHeader(original);
      await delay(ctx.writeDelayMs);
      const verify = await ctx.client.fetchSampleHeader(0);
      ctx.log(`  Restored SHNAME: "${verify.SHNAME}"`);
    }

    return result;
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  }
}
