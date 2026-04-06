/**
 * Multi (miscellaneous data) tests.
 *
 * The S3000XL's RMDATA (0x10) / MDATA (0x11) opcodes access the device's
 * miscellaneous data block — global settings and multi-timbral configuration.
 */

import type { TestContext, TestResult } from '@/node/lib/test-types.js';

const RMDATA = 0x10;
const MDATA = 0x11;

export async function runMultiTests(ctx: TestContext): Promise<TestResult[]> {
  const results: TestResult[] = [];
  results.push(await testReadMiscData(ctx));
  results.push(await testWriteMiscField(ctx));
  return results;
}

/**
 * Read the miscellaneous data block and decode the nibble-encoded bytes.
 */
async function testReadMiscData(ctx: TestContext): Promise<TestResult> {
  const name = 'multi-read-misc-data';
  try {
    const response = await ctx.client.sendCommand(RMDATA, []);
    ctx.log(`  Raw response: ${response.length} nibbles`);

    // Decode nibble pairs into bytes
    const bytes: number[] = [];
    for (let i = 0; i < response.length - 1; i += 2) {
      bytes.push((response[i + 1] << 4) | response[i]);
    }
    ctx.log(`  Decoded: ${bytes.length} bytes`);
    ctx.log(`  Hex: ${bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ')}`);

    // Try to identify known fields from the S2000 spec:
    // Bytes 0-1: some header/ID
    // The structure likely contains global settings
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] !== 0) {
        ctx.log(`  byte[${i}] = ${bytes[i]} (0x${bytes[i].toString(16)})`);
      }
    }

    return {
      name,
      status: 'PASS',
      detail: `${bytes.length} bytes decoded from ${response.length} nibbles`,
    };
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  }
}

/**
 * Write a field in the miscellaneous data block and verify it persists.
 * We send the full MDATA block back with one byte changed.
 */
async function testWriteMiscField(ctx: TestContext): Promise<TestResult> {
  const name = 'multi-write-misc-field';
  try {
    // 1. Read original
    const original = await ctx.client.sendCommand(RMDATA, []);
    ctx.log(`  Original misc data: ${original.length} nibbles`);

    // 2. Find a non-zero byte to modify (pick one that's likely a setting, not an ID)
    // Try byte index 4 (nibble index 8-9) — skip the first few which may be identifiers
    const testNibbleIndex = 8;
    const originalLo = original[testNibbleIndex];
    const originalHi = original[testNibbleIndex + 1];
    const originalByte = (originalHi << 4) | originalLo;
    ctx.log(`  Target nibbles[${testNibbleIndex}]: lo=${originalLo} hi=${originalHi} (byte=${originalByte})`);

    // Pick a different value
    const testByte = originalByte === 42 ? 43 : 42;
    const testLo = testByte & 0x0f;
    const testHi = (testByte >> 4) & 0x0f;

    // 3. Clone and modify
    const modified = [...original];
    modified[testNibbleIndex] = testLo;
    modified[testNibbleIndex + 1] = testHi;

    // 4. Write back via MDATA
    ctx.log(`  Writing misc data with byte[4]=${testByte}...`);
    try {
      await ctx.client.sendCommand(MDATA, modified);
    } catch (err) {
      // MDATA write may return REPLY which sendCommand treats as response
      ctx.log(`  Write response: ${err}`);
    }

    // 5. Read back
    const readback = await ctx.client.sendCommand(RMDATA, []);
    const readbackLo = readback[testNibbleIndex];
    const readbackHi = readback[testNibbleIndex + 1];
    const readbackByte = (readbackHi << 4) | readbackLo;
    ctx.log(`  Readback byte[4]: ${readbackByte}`);

    // 6. Restore original
    await ctx.client.sendCommand(MDATA, original).catch(() => {});

    if (readbackByte === testByte) {
      return { name, status: 'PASS', detail: `byte[4]: ${originalByte} -> ${readbackByte}` };
    } else if (readbackByte === originalByte) {
      return { name, status: 'FAIL', detail: `Write did not persist — got original ${originalByte}` };
    } else {
      return { name, status: 'ERROR', detail: `Unexpected readback: ${readbackByte}` };
    }
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  }
}

function formatHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}
