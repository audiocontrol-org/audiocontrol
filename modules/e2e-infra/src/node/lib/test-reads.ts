/**
 * Read-only tests — verify that fetches return valid data with cache disabled.
 */

import type { TestContext, TestResult } from '@/node/lib/test-types.js';

export async function runReadTests(ctx: TestContext): Promise<TestResult[]> {
  const results: TestResult[] = [];
  results.push(await testReadProgramNames(ctx));
  results.push(await testReadSampleNames(ctx));
  results.push(await testReadProgramHeader(ctx));
  results.push(await testReadKeygroupHeader(ctx));
  results.push(await testReadSampleHeader(ctx));
  return results;
}

async function testReadProgramNames(ctx: TestContext): Promise<TestResult> {
  const name = 'read-program-names';
  try {
    const names = await ctx.client.fetchProgramNames();
    ctx.log(`  ${names.length} program(s):`);
    for (const n of names) ctx.log(`    "${n}"`);
    if (names.length === 0) {
      return { name, status: 'FAIL', detail: 'No programs found on device' };
    }
    return { name, status: 'PASS', detail: `${names.length} program(s)` };
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  }
}

async function testReadSampleNames(ctx: TestContext): Promise<TestResult> {
  const name = 'read-sample-names';
  try {
    const names = await ctx.client.fetchSampleNames();
    ctx.log(`  ${names.length} sample(s):`);
    for (const n of names) ctx.log(`    "${n}"`);
    if (names.length === 0) {
      return { name, status: 'FAIL', detail: 'No samples found on device' };
    }
    return { name, status: 'PASS', detail: `${names.length} sample(s)` };
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  }
}

async function testReadProgramHeader(ctx: TestContext): Promise<TestResult> {
  const name = 'read-program-header';
  try {
    const header = await ctx.client.fetchProgramHeader(0);
    ctx.log(`  Program 0: "${header.PRNAME}"`);
    ctx.log(`    GROUPS: ${header.GROUPS}`);
    ctx.log(`    POLYPH: ${header.POLYPH}`);
    return { name, status: 'PASS', detail: `"${header.PRNAME}"` };
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  }
}

async function testReadKeygroupHeader(ctx: TestContext): Promise<TestResult> {
  const name = 'read-keygroup-header';
  try {
    const header = await ctx.client.fetchKeygroupHeader(0, 0);
    ctx.log(`  Program 0, Keygroup 0:`);
    ctx.log(`    LONOTE: ${header.LONOTE}, HINOTE: ${header.HINOTE}`);
    ctx.log(`    SNAME1: "${header.SNAME1}"`);
    return { name, status: 'PASS' };
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  }
}

async function testReadSampleHeader(ctx: TestContext): Promise<TestResult> {
  const name = 'read-sample-header';
  try {
    const header = await ctx.client.fetchSampleHeader(0);
    ctx.log(`  Sample 0: "${header.SHNAME}"`);
    ctx.log(`    SPLENGTH: ${header.SPLENGTH}`);
    ctx.log(`    STFREQ: ${header.STFREQ}`);
    return { name, status: 'PASS', detail: `"${header.SHNAME}"` };
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  }
}
