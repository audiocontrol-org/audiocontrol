/**
 * Structural operation tests — program delete and keygroup create/delete lifecycle.
 *
 * Note: Program creation via SysEx (PDATA with new program number) is not
 * supported by the S3000XL. The device accepts the write but does not add
 * a new entry to the RPLIST. New programs are created via front panel or
 * disk load only. Program deletion (DELP) works correctly.
 */

import type { TestContext, TestResult } from '@/node/lib/test-types.js';

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runStructureTests(ctx: TestContext): Promise<TestResult[]> {
  const results: TestResult[] = [];
  results.push(await testDeleteProgram(ctx));
  results.push(await testCreateDeleteKeygroupRoundTrip(ctx));
  return results;
}

async function testDeleteProgram(ctx: TestContext): Promise<TestResult> {
  const name = 'delete-program';
  try {
    const namesBefore = await ctx.client.fetchProgramNames();
    const countBefore = namesBefore.length;
    if (countBefore < 2) {
      return { name, status: 'SKIP', detail: 'Need at least 2 programs to test delete safely' };
    }

    const lastIndex = countBefore - 1;
    const savedHeader = await ctx.client.fetchProgramHeader(lastIndex);
    ctx.log(`  Deleting program ${lastIndex}: "${savedHeader.PRNAME}"...`);
    await ctx.client.deleteProgram(lastIndex);
    await delay(ctx.writeDelayMs);

    const namesAfterDelete = await ctx.client.fetchProgramNames();
    ctx.log(`  Program count: ${countBefore} -> ${namesAfterDelete.length}`);

    if (namesAfterDelete.length !== countBefore - 1) {
      return {
        name,
        status: 'FAIL',
        detail: `Expected ${countBefore - 1} after delete, got ${namesAfterDelete.length}`,
      };
    }

    return {
      name,
      status: 'PASS',
      detail: `Deleted "${savedHeader.PRNAME}" (${countBefore} -> ${namesAfterDelete.length})`,
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
