/**
 * Multi (miscellaneous data) tests.
 *
 * Phase 1: Exploratory — probe RMDATA (0x10) to discover the response format.
 * Phase 2: Once format is understood, implement full multi read/write tests.
 */

import type { TestContext, TestResult } from '@/node/lib/test-types.js';

const RMDATA = 0x10;

export async function runMultiTests(ctx: TestContext): Promise<TestResult[]> {
  const results: TestResult[] = [];
  results.push(await testProbeRmdata(ctx));
  return results;
}

/**
 * Send RMDATA with various data formats and log what comes back.
 * The S2000 spec shows: selector (0=header, 1=part), part number, offset, count.
 * The S3000XL may use the same format or something different.
 */
async function testProbeRmdata(ctx: TestContext): Promise<TestResult> {
  const name = 'multi-probe-rmdata';
  try {
    // Try requesting with empty data first
    ctx.log('  Probing RMDATA with empty data...');
    try {
      const response = await ctx.client.sendCommand(RMDATA, []);
      ctx.log(`  Response (empty): ${response.length} bytes: ${formatHex(response)}`);
    } catch (err) {
      ctx.log(`  Empty data: ${err}`);
    }

    // Try requesting multi header (selector=0, offset=0, count=32)
    ctx.log('  Probing RMDATA with selector=0 (header)...');
    try {
      const response = await ctx.client.sendCommand(RMDATA, [0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0x00]);
      ctx.log(`  Response (header): ${response.length} bytes: ${formatHex(response)}`);
    } catch (err) {
      ctx.log(`  Header request: ${err}`);
    }

    // Try requesting multi part 0 (selector=1, part=0, offset=0, count=128)
    ctx.log('  Probing RMDATA with selector=1, part=0...');
    try {
      const response = await ctx.client.sendCommand(RMDATA, [0x00, 0x00, 0x01, 0x00, 0x00, 0x08, 0x00]);
      ctx.log(`  Response (part 0): ${response.length} bytes: ${formatHex(response)}`);
    } catch (err) {
      ctx.log(`  Part 0 request: ${err}`);
    }

    return { name, status: 'PASS', detail: 'Probe complete — check logs for response format' };
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  }
}

function formatHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}
