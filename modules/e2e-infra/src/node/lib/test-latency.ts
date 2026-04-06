/**
 * Latency characterization tests.
 *
 * Measures round-trip latency at each hop in the transport chain:
 *
 *   CLI (Node.js) → HTTP → bridge (Rust) → protobuf → s2p → SCSI → S3000XL
 *
 * Hops measured:
 *   1. HTTP round-trip to bridge /status (no SCSI, no s2p)
 *   2. HTTP round-trip to bridge /sds/send with a no-op or lightweight command
 *      (bridge → s2p protobuf → SCSI → device → back)
 *   3. Full SysEx round-trip: RPLIST (small response)
 *   4. Full SysEx round-trip: RPDATA (large response, ~392 bytes)
 *   5. Full SysEx write round-trip: PDATA write + REPLY
 *
 * Each test runs multiple iterations to get min/max/median.
 */

import type { TestContext, TestResult } from '@/node/lib/test-types.js';

const ITERATIONS = 10;

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stats(arr: number[]): { min: number; max: number; median: number; avg: number } {
  return {
    min: Math.min(...arr),
    max: Math.max(...arr),
    median: median(arr),
    avg: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length),
  };
}

function formatStats(s: { min: number; max: number; median: number; avg: number }): string {
  return `min=${s.min}ms median=${s.median}ms avg=${s.avg}ms max=${s.max}ms`;
}

export async function runLatencyTests(ctx: TestContext): Promise<TestResult[]> {
  const results: TestResult[] = [];
  results.push(await measureHttpStatus(ctx));
  results.push(await measureRplist(ctx));
  results.push(await measureRpdata(ctx));
  results.push(await measureWrite(ctx));
  results.push(await measureReadAfterWrite(ctx));
  return results;
}

/**
 * Hop 1: HTTP only — bridge /status endpoint.
 * Measures: network + Rust HTTP handling. No s2p, no SCSI.
 */
async function measureHttpStatus(ctx: TestContext): Promise<TestResult> {
  const name = 'latency-http-status';
  try {
    const times: number[] = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now();
      await fetch(`${ctx.bridgeUrl}/status`);
      times.push(Math.round(performance.now() - start));
    }
    const s = stats(times);
    ctx.log(`  HTTP /status (${ITERATIONS}x): ${formatStats(s)}`);
    ctx.log(`    Raw: [${times.join(', ')}]`);
    return { name, status: 'PASS', detail: formatStats(s) };
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  }
}

/**
 * Hop 2: Full SCSI round-trip — RPLIST (small payload).
 * Measures: network + bridge + s2p protobuf + SCSI bus + device processing.
 */
async function measureRplist(ctx: TestContext): Promise<TestResult> {
  const name = 'latency-rplist';
  try {
    const times: number[] = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now();
      await ctx.client.fetchProgramNames();
      times.push(Math.round(performance.now() - start));
    }
    const s = stats(times);
    ctx.log(`  RPLIST (${ITERATIONS}x): ${formatStats(s)}`);
    ctx.log(`    Raw: [${times.join(', ')}]`);
    return { name, status: 'PASS', detail: formatStats(s) };
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  }
}

/**
 * Hop 3: Full SCSI round-trip — RPDATA (large payload, ~392 bytes).
 * Measures: same as RPLIST but with larger response to see data transfer overhead.
 */
async function measureRpdata(ctx: TestContext): Promise<TestResult> {
  const name = 'latency-rpdata';
  try {
    const times: number[] = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now();
      await ctx.client.fetchProgramHeader(0);
      times.push(Math.round(performance.now() - start));
    }
    const s = stats(times);
    ctx.log(`  RPDATA (${ITERATIONS}x): ${formatStats(s)}`);
    ctx.log(`    Raw: [${times.join(', ')}]`);
    return { name, status: 'PASS', detail: formatStats(s) };
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  }
}

/**
 * Hop 4: Write round-trip — PDATA write + REPLY.
 * Measures: write path latency (send large payload, get small REPLY).
 */
async function measureWrite(ctx: TestContext): Promise<TestResult> {
  const name = 'latency-write';
  try {
    // Read the header once, then repeatedly write it back unchanged
    const header = await ctx.client.fetchProgramHeader(0);
    const times: number[] = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now();
      await ctx.client.writeProgramHeader(header);
      times.push(Math.round(performance.now() - start));
    }
    const s = stats(times);
    ctx.log(`  PDATA write (${ITERATIONS}x): ${formatStats(s)}`);
    ctx.log(`    Raw: [${times.join(', ')}]`);
    return { name, status: 'PASS', detail: formatStats(s) };
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  }
}

/**
 * Hop 5: Write-then-read round-trip — PDATA + RPDATA back-to-back.
 * Measures: total time for a write-readback cycle (the hot path for editing).
 */
async function measureReadAfterWrite(ctx: TestContext): Promise<TestResult> {
  const name = 'latency-write-read-cycle';
  try {
    const header = await ctx.client.fetchProgramHeader(0);
    const times: number[] = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now();
      await ctx.client.writeProgramHeader(header);
      await ctx.client.fetchProgramHeader(0);
      times.push(Math.round(performance.now() - start));
    }
    const s = stats(times);
    ctx.log(`  Write+Read cycle (${ITERATIONS}x): ${formatStats(s)}`);
    ctx.log(`    Raw: [${times.join(', ')}]`);
    return { name, status: 'PASS', detail: formatStats(s) };
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  }
}
