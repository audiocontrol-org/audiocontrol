/**
 * Structural operation tests — keygroup create/delete lifecycle.
 */

import type { TestContext, TestResult } from '@/node/lib/test-types.js';

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runStructureTests(ctx: TestContext): Promise<TestResult[]> {
  const results: TestResult[] = [];
  results.push(await testCreateDeleteKeygroupRoundTrip(ctx));
  return results;
}

async function testCreateDeleteKeygroupRoundTrip(ctx: TestContext): Promise<TestResult> {
  const name = 'create-delete-keygroup-roundtrip';
  try {
    // 1. Read initial program state
    const programBefore = await ctx.client.fetchProgramHeader(0);
    const groupsBefore = programBefore.GROUPS;
    ctx.log(`  Initial GROUPS count: ${groupsBefore}`);

    // 2. Create a new keygroup (clones keygroup 0)
    const newKeygroupIndex = groupsBefore;
    ctx.log(`  Creating keygroup ${newKeygroupIndex}...`);
    await ctx.client.createKeygroup(0, newKeygroupIndex);
    await delay(ctx.writeDelayMs);

    // 3. Verify GROUPS incremented
    const programAfterCreate = await ctx.client.fetchProgramHeader(0);
    const groupsAfterCreate = programAfterCreate.GROUPS;
    ctx.log(`  GROUPS after create: ${groupsAfterCreate}`);

    if (groupsAfterCreate !== groupsBefore + 1) {
      // Attempt cleanup before failing
      try { await ctx.client.deleteKeygroup(0, newKeygroupIndex); } catch { /* best effort */ }
      return {
        name,
        status: 'FAIL',
        detail: `Expected GROUPS=${groupsBefore + 1} after create, got ${groupsAfterCreate}`,
      };
    }

    // 4. Read the new keygroup to verify it exists
    const newKg = await ctx.client.fetchKeygroupHeader(0, newKeygroupIndex);
    ctx.log(`  New keygroup ${newKeygroupIndex} LONOTE=${newKg.LONOTE} HINOTE=${newKg.HINOTE}`);

    // 5. Delete the keygroup
    ctx.log(`  Deleting keygroup ${newKeygroupIndex}...`);
    await ctx.client.deleteKeygroup(0, newKeygroupIndex);
    await delay(ctx.writeDelayMs);

    // 6. Verify GROUPS restored
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
