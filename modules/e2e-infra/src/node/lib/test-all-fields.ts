/**
 * Exhaustive field-level write-readback tests.
 *
 * Iterates every field spec for programs, keygroups, and samples,
 * dynamically resolving write functions from the s3k module.
 */

import * as s3k from '@audiocontrol/sampler-devices/s3k';
import type { FieldSpec } from '#node/lib/field-specs-program.js';
import { PROGRAM_FIELD_SPECS } from '#node/lib/field-specs-program.js';
import { KEYGROUP_FIELD_SPECS } from '#node/lib/field-specs-keygroup.js';
import { SAMPLE_FIELD_SPECS } from '#node/lib/field-specs-sample.js';
import type { TestContext, TestResult } from '#node/lib/test-types.js';

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runAllFieldTests(ctx: TestContext): Promise<TestResult[]> {
  const results: TestResult[] = [];

  ctx.log('--- Program Header Fields ---');
  results.push(
    ...(await runFieldGroup(ctx, 'program', PROGRAM_FIELD_SPECS, {
      fetch: () => ctx.client.fetchProgramHeader(0),
      write: (header) => ctx.client.writeProgramHeader(header),
      headerType: 'ProgramHeader',
    })),
  );

  ctx.log('--- Keygroup Header Fields ---');
  results.push(
    ...(await runFieldGroup(ctx, 'keygroup', KEYGROUP_FIELD_SPECS, {
      fetch: () => ctx.client.fetchKeygroupHeader(0, 0),
      write: (header) => ctx.client.writeKeygroupHeader(header),
      headerType: 'KeygroupHeader',
    })),
  );

  ctx.log('--- Sample Header Fields ---');
  results.push(
    ...(await runFieldGroup(ctx, 'sample', SAMPLE_FIELD_SPECS, {
      fetch: () => ctx.client.fetchSampleHeader(0),
      write: (header) => ctx.client.writeSampleHeader(header),
      headerType: 'SampleHeader',
    })),
  );

  return results;
}

async function runFieldGroup<H extends { raw: number[] }>(
  ctx: TestContext,
  groupName: string,
  specs: FieldSpec<H>[],
  ops: {
    fetch: () => Promise<H>;
    write: (header: H) => Promise<void>;
    headerType: string;
  },
): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (const spec of specs) {
    const testName = `${groupName}.${spec.field}`;

    if (spec.skip) {
      results.push({ name: testName, status: 'SKIP', detail: spec.skip });
      ctx.log(`  [SKIP] ${testName} — ${spec.skip}`);
      continue;
    }

    try {
      // 1. Read original
      const original = await ops.fetch();
      const originalValue = spec.read(original);

      // 2. Pick test value that differs from original
      let testValue = spec.testValue;
      if (testValue === originalValue) {
        // Flip to a different value
        if (spec.type === 'number') {
          testValue = (testValue as number) === 0 ? 1 : 0;
        } else {
          testValue = 'ALTTEST12345';
        }
      }

      // 3. Clone and write
      const modified = { ...original, raw: [...original.raw] } as H;
      const writeFn = (s3k as Record<string, Function>)[spec.writeFn];
      if (!writeFn) {
        results.push({
          name: testName,
          status: 'ERROR',
          detail: `Write function ${spec.writeFn} not found`,
        });
        ctx.log(`  [ERROR] ${testName} — Write function ${spec.writeFn} not found`);
        continue;
      }
      writeFn(modified, testValue);

      await ops.write(modified);
      await delay(ctx.writeDelayMs);

      // 4. Read back
      const readback = await ops.fetch();
      const readbackValue = spec.read(readback);

      // 5. Compare
      const sent = spec.type === 'string' ? (testValue as string).trim() : testValue;
      const got = spec.type === 'string' ? (readbackValue as string).trim() : readbackValue;

      let result: TestResult;
      if (got === sent) {
        result = {
          name: testName,
          status: 'PASS',
          detail: `${originalValue} -> ${readbackValue}`,
        };
      } else if (
        got === (spec.type === 'string' ? (originalValue as string).trim() : originalValue)
      ) {
        result = {
          name: testName,
          status: 'FAIL',
          detail: `Write did not persist — got original ${originalValue}`,
        };
      } else {
        result = {
          name: testName,
          status: 'ERROR',
          detail: `Unexpected: sent ${testValue}, got ${readbackValue}`,
        };
      }

      ctx.log(`  [${result.status}] ${testName}${result.detail ? ` — ${result.detail}` : ''}`);
      results.push(result);

      // 6. Restore
      if (!ctx.noRestore) {
        await ops.write(original);
        await delay(ctx.writeDelayMs);
      }
    } catch (err) {
      results.push({ name: testName, status: 'ERROR', detail: String(err) });
      ctx.log(`  [ERROR] ${testName} — ${err}`);
    }
  }

  return results;
}
