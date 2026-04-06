/**
 * Multi (miscellaneous data) tests.
 *
 * Tests the MiscellaneousData structure via the typed client API.
 * The S1000 spec defines 6 fields (BMCHAN, BMOMNI, PSELEN, SELPNM, OMNOVR, EXCHAN).
 * The S3000XL returns 48 bytes total — the first 6 match S1000, the rest are extensions.
 */

import type { TestContext, TestResult } from '@/node/lib/test-types.js';

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runMultiTests(ctx: TestContext): Promise<TestResult[]> {
  const results: TestResult[] = [];
  results.push(await testReadMiscData(ctx));
  results.push(await testWriteMiscProgramSelect(ctx));
  results.push(await testWriteMiscSelectedProgram(ctx));
  return results;
}

async function testReadMiscData(ctx: TestContext): Promise<TestResult> {
  const name = 'multi-read-misc-data';
  try {
    const misc = await ctx.client.fetchMiscData();
    ctx.log(`  BMCHAN (Basic MIDI Channel): ${misc.BMCHAN}`);
    ctx.log(`  BMOMNI (Basic Channel Omni): ${misc.BMOMNI}`);
    ctx.log(`  PSELEN (Program Select Enable): ${misc.PSELEN}`);
    ctx.log(`  SELPNM (Selected Program Number): ${misc.SELPNM}`);
    ctx.log(`  OMNOVR (Omni Override): ${misc.OMNOVR}`);
    ctx.log(`  EXCHAN (Exclusive Channel): ${misc.EXCHAN}`);
    ctx.log(`  MSTUNE (Master Tune): ${misc.MSTUNE}`);

    return { name, status: 'PASS', detail: `BMCHAN=${misc.BMCHAN} PSELEN=${misc.PSELEN} SELPNM=${misc.SELPNM}` };
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  }
}

async function testWriteMiscProgramSelect(ctx: TestContext): Promise<TestResult> {
  const name = 'multi-write-program-select';
  try {
    const original = await ctx.client.fetchMiscData();
    const originalVal = original.PSELEN;
    ctx.log(`  Original PSELEN: ${originalVal}`);

    const testVal = originalVal === 0 ? 1 : 0;
    const modified = { ...original, raw: [...original.raw] };

    // Import the write function dynamically
    const s3k = await import('@audiocontrol/sampler-devices/s3k');
    (s3k as Record<string, Function>)['MiscellaneousData_writePSELEN'](modified, testVal);

    await ctx.client.writeMiscData(modified);
    ctx.log(`  Wrote PSELEN: ${testVal}`);
    await delay(ctx.writeDelayMs);

    const readback = await ctx.client.fetchMiscData();
    ctx.log(`  Readback PSELEN: ${readback.PSELEN}`);

    // Restore
    if (!ctx.noRestore) {
      await ctx.client.writeMiscData(original);
      await delay(ctx.writeDelayMs);
    }

    if (readback.PSELEN === testVal) {
      return { name, status: 'PASS', detail: `${originalVal} -> ${readback.PSELEN}` };
    } else if (readback.PSELEN === originalVal) {
      return { name, status: 'FAIL', detail: `Write did not persist — got original ${originalVal}` };
    } else {
      return { name, status: 'ERROR', detail: `Unexpected readback: ${readback.PSELEN}` };
    }
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  }
}

async function testWriteMiscSelectedProgram(ctx: TestContext): Promise<TestResult> {
  const name = 'multi-write-selected-program';
  try {
    const original = await ctx.client.fetchMiscData();
    const originalVal = original.SELPNM;
    ctx.log(`  Original SELPNM: ${originalVal}`);

    // Pick a different selected program number (safe — doesn't affect communication)
    const testVal = originalVal === 0 ? 1 : 0;
    const modified = { ...original, raw: [...original.raw] };

    const s3k = await import('@audiocontrol/sampler-devices/s3k');
    (s3k as Record<string, Function>)['MiscellaneousData_writeSELPNM'](modified, testVal);

    await ctx.client.writeMiscData(modified);
    ctx.log(`  Wrote SELPNM: ${testVal}`);
    await delay(ctx.writeDelayMs);

    const readback = await ctx.client.fetchMiscData();
    ctx.log(`  Readback SELPNM: ${readback.SELPNM}`);

    // Restore
    if (!ctx.noRestore) {
      await ctx.client.writeMiscData(original);
      await delay(ctx.writeDelayMs);
    }

    if (readback.SELPNM === testVal) {
      return { name, status: 'PASS', detail: `${originalVal} -> ${readback.SELPNM}` };
    } else if (readback.SELPNM === originalVal) {
      return { name, status: 'FAIL', detail: `Write did not persist — got original ${originalVal}` };
    } else {
      return { name, status: 'ERROR', detail: `Unexpected readback: ${readback.SELPNM}` };
    }
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  }
}
