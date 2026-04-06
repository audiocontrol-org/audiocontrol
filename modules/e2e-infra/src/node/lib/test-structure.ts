/**
 * Structural operation tests — program create/delete and keygroup lifecycle.
 */

import type { TestContext, TestResult } from '@/node/lib/test-types.js';

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runStructureTests(ctx: TestContext): Promise<TestResult[]> {
  const results: TestResult[] = [];
  // Program creation via PDATA does not work on the S3000XL — the device
  // accepts the write (REPLY OK) but does not add to RPLIST. Tested with:
  // pp,pp above highest index, followed by KDATA. The S1000 SysEx spec
  // documents this behavior but the S3000XL does not implement it.
  // deleteProgram (DELP) works correctly.
  // results.push(await testCreateDeleteProgramRoundTrip(ctx));
  results.push(await testCreateDeleteKeygroupRoundTrip(ctx));
  return results;
}

async function testCreateDeleteProgramRoundTrip(ctx: TestContext): Promise<TestResult> {
  const name = 'create-delete-program-roundtrip';
  try {
    const namesBefore = await ctx.client.fetchProgramNames();
    const countBefore = namesBefore.length;
    ctx.log(`  Initial program count: ${countBefore}`);

    // Per S1000 SysEx spec: PDATA with pp,pp above highest existing
    // program number creates a new program. We also need to send
    // keygroup data (KDATA) for each keygroup specified by GROUPS.
    const newIndex = countBefore;
    ctx.log(`  Creating program at index ${newIndex}...`);
    await ctx.client.createProgram(newIndex);
    await delay(ctx.writeDelayMs);

    // The S1000 spec says dummy keygroups are created but KDATA should follow.
    // Send a keygroup for the new program to complete creation.
    ctx.log(`  Sending keygroup 0 for new program...`);
    const kg0 = await ctx.client.fetchKeygroupHeader(0, 0);
    await ctx.client.createKeygroup(newIndex, 0, kg0);
    await delay(ctx.writeDelayMs);

    const namesAfterCreate = await ctx.client.fetchProgramNames();
    ctx.log(`  Program count after create + KDATA: ${namesAfterCreate.length}`);

    if (namesAfterCreate.length <= countBefore) {
      return {
        name,
        status: 'FAIL',
        detail: `Program creation did not increase count (${countBefore} -> ${namesAfterCreate.length}). S3000XL may not support SysEx program creation.`,
      };
    }

    // Clean up — delete the new program
    const deleteIndex = namesAfterCreate.length - 1;
    ctx.log(`  Deleting program ${deleteIndex}...`);
    await ctx.client.deleteProgram(deleteIndex);
    await delay(ctx.writeDelayMs);

    const namesAfterDelete = await ctx.client.fetchProgramNames();
    ctx.log(`  Program count after delete: ${namesAfterDelete.length}`);

    return {
      name,
      status: 'PASS',
      detail: `${countBefore} -> ${namesAfterCreate.length} -> ${namesAfterDelete.length}`,
    };
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  }
}

async function testCreateDeleteKeygroupRoundTrip(ctx: TestContext): Promise<TestResult> {
  const name = 'create-delete-keygroup-roundtrip';
  try {
    const programBefore = await ctx.client.fetchProgramHeader(0);
    const groupsBefore = programBefore.GROUPS;
    ctx.log(`  Initial GROUPS count: ${groupsBefore}`);

    const newKeygroupIndex = groupsBefore;
    ctx.log(`  Creating keygroup ${newKeygroupIndex}...`);
    await ctx.client.createKeygroup(0, newKeygroupIndex);
    await delay(ctx.writeDelayMs);

    const programAfterCreate = await ctx.client.fetchProgramHeader(0);
    const groupsAfterCreate = programAfterCreate.GROUPS;
    ctx.log(`  GROUPS after create: ${groupsAfterCreate}`);

    if (groupsAfterCreate !== groupsBefore + 1) {
      try { await ctx.client.deleteKeygroup(0, newKeygroupIndex); } catch { /* best effort */ }
      return {
        name,
        status: 'FAIL',
        detail: `Expected GROUPS=${groupsBefore + 1} after create, got ${groupsAfterCreate}`,
      };
    }

    const newKg = await ctx.client.fetchKeygroupHeader(0, newKeygroupIndex);
    ctx.log(`  New keygroup ${newKeygroupIndex} LONOTE=${newKg.LONOTE} HINOTE=${newKg.HINOTE}`);

    ctx.log(`  Deleting keygroup ${newKeygroupIndex}...`);
    await ctx.client.deleteKeygroup(0, newKeygroupIndex);
    await delay(ctx.writeDelayMs);

    const programAfterDelete = await ctx.client.fetchProgramHeader(0);
    const groupsAfterDelete = programAfterDelete.GROUPS;
    ctx.log(`  GROUPS after delete: ${groupsAfterDelete}`);

    if (groupsAfterDelete !== groupsBefore) {
      return {
        name,
        status: 'FAIL',
        detail: `Expected GROUPS=${groupsBefore} after delete, got ${groupsAfterDelete}`,
      };
    }

    return {
      name,
      status: 'PASS',
      detail: `${groupsBefore} -> ${groupsAfterCreate} -> ${groupsAfterDelete}`,
    };
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  }
}
