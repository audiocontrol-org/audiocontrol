/**
 * Connection and SCSI bus tests.
 *
 * Verifies the bridge is reachable and the sampler is online.
 */

import type { ScsiMidiBridgeStatus, ScsiDevice } from '@audiocontrol/midi-core';
import type { TestContext, TestResult } from '#node/lib/test-types.js';

export async function runConnectionTests(ctx: TestContext): Promise<TestResult[]> {
  const results: TestResult[] = [];
  results.push(await testConnect(ctx));
  results.push(await testScan(ctx));
  return results;
}

async function testConnect(ctx: TestContext): Promise<TestResult> {
  const name = 'connect';
  try {
    const res = await fetch(`${ctx.bridgeUrl}/status`);
    if (!res.ok) {
      return { name, status: 'FAIL', detail: `HTTP ${res.status}: ${await res.text()}` };
    }
    const status: ScsiMidiBridgeStatus = await res.json();
    ctx.log(`  Bridge version: ${status.version}`);
    ctx.log(`  SCSI2Pi version: ${status.scsi2piVersion}`);
    ctx.log(`  Board ID: ${status.boardId}`);
    ctx.log(`  Sampler reachable: ${status.samplerReachable}`);

    if (!status.samplerReachable) {
      return { name, status: 'FAIL', detail: 'Bridge reports sampler not reachable' };
    }
    return { name, status: 'PASS' };
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  }
}

async function testScan(ctx: TestContext): Promise<TestResult> {
  const name = 'scan';
  try {
    const res = await fetch(`${ctx.bridgeUrl}/scsi/scan`);
    if (!res.ok) {
      return { name, status: 'FAIL', detail: `HTTP ${res.status}: ${await res.text()}` };
    }
    const devices: ScsiDevice[] = await res.json();
    ctx.log(`  Found ${devices.length} SCSI device(s):`);
    for (const d of devices) {
      ctx.log(`    ID ${d.id}: ${d.vendor} ${d.product} rev ${d.revision}`);
    }

    const sampler = devices.find(
      (d) => d.product.includes('S3000') || d.product.includes('S3200'),
    );
    if (!sampler) {
      return { name, status: 'FAIL', detail: 'No S3000XL found on SCSI bus' };
    }
    return { name, status: 'PASS', detail: `${sampler.vendor} ${sampler.product} at ID ${sampler.id}` };
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  }
}
