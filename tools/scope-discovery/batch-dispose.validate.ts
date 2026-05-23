/**
 * tools/scope-discovery/batch-dispose.validate.ts
 *
 * Adversarial validator for T7.4 `batch-dispose.ts`. Plants synthetic
 * clones.yaml fixtures, drives the CLI both programmatically and as a
 * subprocess, and proves: dispositions land on the targeted ids;
 * already-disposed ids are skipped (with the right stdout shape under
 * --show-existing); unknown ids fail HARD with no writes; empty/invalid/
 * refactor disposition error actionably; verify-after-write catches a
 * forged write; --dry-run leaves the file unchanged; member ordering
 * is preserved across writes; the gutted-stub self-check rejects a
 * no-op writer. Fixture helpers live in `batch-dispose.fixtures.ts`.
 *
 * Run: tsx tools/scope-discovery/batch-dispose.validate.ts
 *      make check-batch-dispose-validate
 *
 * Exit: 0 all PASS, 1 one or more FAIL, 2 harness infra error.
 */

import { readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { runBatchDispose } from './batch-dispose.js';
import { type CloneGroup } from './clones-yaml.js';
import { runScannerSubprocess } from './util/run-scanner.js';
import { errorMessage } from './util/typeguards.js';
import {
  ROLAND_SRC,
  TMP_ROOT,
  makeCapturedIO,
  makeForgedWriteIO,
  makeGuttedWriterIO,
  syntheticGroup,
  withFixture,
  writeClonesYaml,
} from './batch-dispose.fixtures.js';

const ENTRY = 'tools/scope-discovery/batch-dispose.ts';
const R = ROLAND_SRC;

interface ScenarioResult {
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
}
const pass = (name: string, detail: string): ScenarioResult => ({ name, passed: true, detail });
const fail = (name: string, detail: string): ScenarioResult => ({ name, passed: false, detail });

/** Scenario 1: apply disposition to 3 pending ids; verify-after-write confirms each landed. */
const scenarioApplyToThree = (): Promise<ScenarioResult> => withFixture('apply3', async (fixture) => {
  const clones: CloneGroup[] = [
    syntheticGroup({ id: 'aaaaaaaaaaa1', members: [`${R}A.tsx:1:10`, `${R}B.tsx:1:10`], disposition: 'pending' }),
    syntheticGroup({ id: 'aaaaaaaaaaa2', members: [`${R}C.tsx:1:10`, `${R}D.tsx:1:10`], disposition: 'pending' }),
    syntheticGroup({ id: 'aaaaaaaaaaa3', members: [`${R}E.tsx:1:10`, `${R}F.tsx:1:10`], disposition: 'pending' }),
  ];
  await writeClonesYaml(fixture.path, clones);
  const capt = makeCapturedIO();
  const result = await runBatchDispose(
    [
      '--ids', 'aaaaaaaaaaa1,aaaaaaaaaaa2,aaaaaaaaaaa3',
      '--disposition', 'keep-with-reason',
      '--reason', 'fixture boilerplate; intentional',
      '--clones', fixture.path,
    ],
    capt.io,
  );
  if (result.code !== 0) return fail('apply to 3 pending', `exit ${result.code}; stderr=${capt.stderr()}`);
  if (!result.verified || result.applied.length !== 3) {
    return fail('apply to 3 pending', `verified=${result.verified} applied=${result.applied.length}`);
  }
  const after = await readFile(fixture.path, 'utf8');
  const keepCount = (after.match(/disposition: keep-with-reason/g) ?? []).length;
  if (keepCount !== 3) return fail('apply to 3 pending', `expected 3 keep-with-reason entries; got ${keepCount}`);
  if (!after.includes('fixture boilerplate; intentional')) {
    return fail('apply to 3 pending', 'reason string missing from file');
  }
  return pass('apply to 3 pending', 'all 3 dispositions + reasons landed; verify-after-write passed');
});

/** Scenario 2: already-disposed entry skipped without --show-existing. */
const scenarioSkippedDefault = (): Promise<ScenarioResult> => withFixture('skipdefault', async (fixture) => {
  const clones: CloneGroup[] = [
    syntheticGroup({ id: 'bbbbbbbbbbb1', members: [`${R}A.tsx:1:10`, `${R}B.tsx:1:10`], disposition: 'keep-with-reason', reason: 'existing reason X' }),
    syntheticGroup({ id: 'bbbbbbbbbbb2', members: [`${R}C.tsx:1:10`, `${R}D.tsx:1:10`], disposition: 'pending' }),
    syntheticGroup({ id: 'bbbbbbbbbbb3', members: [`${R}E.tsx:1:10`, `${R}F.tsx:1:10`], disposition: 'pending' }),
  ];
  await writeClonesYaml(fixture.path, clones);
  const capt = makeCapturedIO();
  const result = await runBatchDispose(
    [
      '--ids', 'bbbbbbbbbbb1,bbbbbbbbbbb2,bbbbbbbbbbb3',
      '--disposition', 'ignore-with-justification',
      '--reason', 'new reason Y',
      '--clones', fixture.path,
    ],
    capt.io,
  );
  if (result.code !== 0 || result.applied.length !== 2 || result.skipped.length !== 1) {
    return fail(
      'already-disposed skipped (default)',
      `exit=${result.code} applied=${result.applied.length} skipped=${result.skipped.length}`,
    );
  }
  const out = capt.stdout();
  if (!out.includes('bbbbbbbbbbb1: skipped (already keep-with-reason')) {
    return fail('already-disposed skipped (default)', `expected default skip message; got ${out}`);
  }
  if (out.includes('existing reason X')) {
    return fail('already-disposed skipped (default)', 'existing reason leaked to stdout without --show-existing');
  }
  const after = await readFile(fixture.path, 'utf8');
  if (!after.includes('existing reason X')) {
    return fail('already-disposed skipped (default)', 'existing reason was overwritten');
  }
  return pass('already-disposed skipped (default)', '2 applied; 1 skipped; existing reason preserved; no leak');
});

/** Scenario 3: --show-existing surfaces the existing disposition + reason. */
const scenarioShowExisting = (): Promise<ScenarioResult> => withFixture('showexisting', async (fixture) => {
  const clones: CloneGroup[] = [
    syntheticGroup({ id: 'ccccccccccc1', members: [`${R}A.tsx:1:10`, `${R}B.tsx:1:10`], disposition: 'keep-with-reason', reason: 'PRIOR-REASON' }),
  ];
  await writeClonesYaml(fixture.path, clones);
  const capt = makeCapturedIO();
  const result = await runBatchDispose(
    [
      '--ids', 'ccccccccccc1',
      '--disposition', 'ignore-with-justification',
      '--reason', 'unused',
      '--show-existing',
      '--clones', fixture.path,
    ],
    capt.io,
  );
  if (result.code !== 0) return fail('--show-existing', `exit ${result.code}; stderr=${capt.stderr()}`);
  if (!capt.stdout().includes('ccccccccccc1: already disposed as keep-with-reason: PRIOR-REASON')) {
    return fail('--show-existing', `expected existing-disposition line; got:\n${capt.stdout()}`);
  }
  return pass('--show-existing', 'existing disposition + reason surfaced to stdout');
});

/** Scenario 4: unknown id fails HARD with exit 2 and no writes. */
const scenarioUnknownId = (): Promise<ScenarioResult> => withFixture('unknown', async (fixture) => {
  const clones: CloneGroup[] = [
    syntheticGroup({ id: 'ddddddddddd1', members: [`${R}A.tsx:1:10`, `${R}B.tsx:1:10`], disposition: 'pending' }),
  ];
  await writeClonesYaml(fixture.path, clones);
  const beforeText = await readFile(fixture.path, 'utf8');
  const capt = makeCapturedIO();
  const result = await runBatchDispose(
    [
      '--ids', 'ddddddddddd1,UNKNOWN-ID-XYZ',
      '--disposition', 'keep-with-reason',
      '--reason', 'r',
      '--clones', fixture.path,
    ],
    capt.io,
  );
  if (result.code !== 2 || !capt.stderr().includes('UNKNOWN-ID-XYZ')) {
    return fail('unknown id fails hard', `exit=${result.code} stderr=${capt.stderr()}`);
  }
  const afterText = await readFile(fixture.path, 'utf8');
  if (afterText !== beforeText) return fail('unknown id fails hard', 'file was modified despite unknown-id failure');
  return pass('unknown id fails hard', 'exit 2 + actionable error + no writes');
});

/** Scenario 5: empty --ids list fails with exit 2 + actionable error. */
async function scenarioEmptyIds(): Promise<ScenarioResult> {
  const capt = makeCapturedIO();
  const result = await runBatchDispose(
    ['--ids', ' , , ', '--disposition', 'keep-with-reason', '--reason', 'r'],
    capt.io,
  );
  if (result.code !== 2 || !capt.stderr().includes('--ids must contain at least one id')) {
    return fail('empty --ids', `exit=${result.code} stderr=${capt.stderr()}`);
  }
  return pass('empty --ids', 'exit 2 + actionable error');
}

/** Scenario 6: invalid disposition lists the valid options. */
async function scenarioInvalidDisposition(): Promise<ScenarioResult> {
  const capt = makeCapturedIO();
  const result = await runBatchDispose(
    ['--ids', 'x', '--disposition', 'bogus', '--reason', 'r'],
    capt.io,
  );
  if (result.code !== 2) return fail('invalid disposition', `expected exit 2; got ${result.code}`);
  const stderr = capt.stderr();
  for (const expected of ['pending', 'keep-with-reason', 'ignore-with-justification']) {
    if (!stderr.includes(expected)) {
      return fail('invalid disposition', `expected stderr to list ${expected}; got ${stderr}`);
    }
  }
  return pass('invalid disposition', 'exit 2 + lists all valid options');
}

/** Scenario 7: refactor disposition rejected with redirect to manual editing + validate target. */
async function scenarioRefactorRejected(): Promise<ScenarioResult> {
  const capt = makeCapturedIO();
  const result = await runBatchDispose(
    ['--ids', 'x', '--disposition', 'refactor', '--reason', 'r'],
    capt.io,
  );
  if (result.code !== 2) return fail('refactor rejected', `expected exit 2; got ${result.code}`);
  const stderr = capt.stderr();
  for (const f of ['manual editing', 'check-refactor-preconditions-validate', 'canonical_side', 'tests', 'tests_proof']) {
    if (!stderr.includes(f)) return fail('refactor rejected', `expected mention of ${f}; got ${stderr}`);
  }
  return pass('refactor rejected', 'exit 2 + redirect to manual editing + validate target');
}

/**
 * Scenario 8: verify-after-write catches a forged write. The injected
 * writer writes correctly THEN immediately re-writes with one entry's
 * reason flipped; verify-after-write must detect the mismatch + exit 1.
 */
const scenarioForgedWrite = (): Promise<ScenarioResult> => withFixture('forged', async (fixture) => {
  const clones: CloneGroup[] = [
    syntheticGroup({ id: 'eeeeeeeeeee1', members: [`${R}A.tsx:1:10`, `${R}B.tsx:1:10`], disposition: 'pending' }),
  ];
  await writeClonesYaml(fixture.path, clones);
  const capt = makeForgedWriteIO({ findReason: 'forged-write-target', replaceReason: 'SOMEONE-ELSE-WROTE-THIS' });
  const result = await runBatchDispose(
    [
      '--ids', 'eeeeeeeeeee1',
      '--disposition', 'keep-with-reason',
      '--reason', 'forged-write-target',
      '--clones', fixture.path,
    ],
    capt.io,
  );
  if (result.code !== 1 || result.verified) {
    return fail(
      'verify-after-write detects forged write',
      `exit=${result.code} verified=${result.verified} stderr=${capt.stderr()}`,
    );
  }
  if (!capt.stderr().includes('verify-after-write detected')) {
    return fail('verify-after-write detects forged write', `expected stderr to name failure mode; got ${capt.stderr()}`);
  }
  return pass('verify-after-write detects forged write', 'exit 1 + verified=false + actionable stderr');
});

/** Scenario 9: --dry-run leaves the file unchanged. */
const scenarioDryRun = (): Promise<ScenarioResult> => withFixture('dryrun', async (fixture) => {
  const clones: CloneGroup[] = [
    syntheticGroup({ id: 'fffffffffff1', members: [`${R}A.tsx:1:10`, `${R}B.tsx:1:10`], disposition: 'pending' }),
  ];
  await writeClonesYaml(fixture.path, clones);
  const beforeText = await readFile(fixture.path, 'utf8');
  const capt = makeCapturedIO();
  const result = await runBatchDispose(
    [
      '--ids', 'fffffffffff1',
      '--disposition', 'keep-with-reason',
      '--reason', 'r',
      '--dry-run',
      '--clones', fixture.path,
    ],
    capt.io,
  );
  if (result.code !== 0) return fail('--dry-run', `expected exit 0; got ${result.code}`);
  const afterText = await readFile(fixture.path, 'utf8');
  if (afterText !== beforeText) return fail('--dry-run', 'file was modified despite --dry-run');
  if (!capt.stdout().includes('dry-run: would apply') || !capt.stdout().includes('N/A (dry-run)')) {
    return fail('--dry-run', `expected dry-run preview + N/A verified; got ${capt.stdout()}`);
  }
  return pass('--dry-run', 'file unchanged; preview surfaced; verified=N/A');
});

/** Scenario 10: batch-dispose 5 of 10 pending; the other 5 stay pending. */
const scenarioPartialBatch = (): Promise<ScenarioResult> => withFixture('partial', async (fixture) => {
  const clones: CloneGroup[] = [];
  for (let i = 0; i < 10; i += 1) {
    const idx = i.toString().padStart(2, '0');
    clones.push(syntheticGroup({
      id: `gggggggggg${idx}`,
      members: [`${R}A${idx}.tsx:1:10`, `${R}B${idx}.tsx:1:10`],
      disposition: 'pending',
    }));
  }
  await writeClonesYaml(fixture.path, clones);
  const targets = ['gggggggggg00', 'gggggggggg02', 'gggggggggg04', 'gggggggggg06', 'gggggggggg08'];
  const capt = makeCapturedIO();
  const result = await runBatchDispose(
    [
      '--ids', targets.join(','),
      '--disposition', 'keep-with-reason',
      '--reason', 'even-indexed; intentional',
      '--clones', fixture.path,
    ],
    capt.io,
  );
  if (result.code !== 0 || result.applied.length !== 5) {
    return fail('partial batch (5 of 10)', `exit=${result.code} applied=${result.applied.length}`);
  }
  const after = await readFile(fixture.path, 'utf8');
  const keepCount = (after.match(/disposition: keep-with-reason/g) ?? []).length;
  const pendingCount = (after.match(/disposition: pending/g) ?? []).length;
  if (keepCount !== 5 || pendingCount !== 5) {
    return fail('partial batch (5 of 10)', `expected keep=5 pending=5; got keep=${keepCount} pending=${pendingCount}`);
  }
  return pass('partial batch (5 of 10)', '5 dispositioned; 5 still pending');
});

/** Scenario 11: member ordering preserved through write. */
const scenarioMemberOrdering = (): Promise<ScenarioResult> => withFixture('ordering', async (fixture) => {
  // Bypass syntheticGroup's sort so we control the on-write order.
  const clones: CloneGroup[] = [
    {
      id: 'hhhhhhhhhhh1',
      lines: 8,
      members: [`${R}A.tsx:1:10`, `${R}B.tsx:1:10`, `${R}C.tsx:1:10`],
      disposition: 'pending',
      reason: null,
    },
  ];
  await writeClonesYaml(fixture.path, clones);
  const capt = makeCapturedIO();
  const result = await runBatchDispose(
    [
      '--ids', 'hhhhhhhhhhh1',
      '--disposition', 'keep-with-reason',
      '--reason', 'r',
      '--clones', fixture.path,
    ],
    capt.io,
  );
  if (result.code !== 0) return fail('member ordering preserved', `exit ${result.code}; stderr=${capt.stderr()}`);
  const after = await readFile(fixture.path, 'utf8');
  const aIdx = after.indexOf(`${R}A.tsx:1:10`);
  const bIdx = after.indexOf(`${R}B.tsx:1:10`);
  const cIdx = after.indexOf(`${R}C.tsx:1:10`);
  if (!(aIdx >= 0 && bIdx > aIdx && cIdx > bIdx)) {
    return fail('member ordering preserved', `members not in order; A=${aIdx} B=${bIdx} C=${cIdx}`);
  }
  return pass('member ordering preserved', 'A,B,C remain in original order');
});

/**
 * Scenario 12: gutted-stub self-check. A no-op writer must cause
 * verify-after-write to fail (the on-disk disposition stays `pending`,
 * not the requested `keep-with-reason`).
 */
const scenarioGuttedStub = (): Promise<ScenarioResult> => withFixture('gutted', async (fixture) => {
  const clones: CloneGroup[] = [
    syntheticGroup({ id: 'iiiiiiiiiii1', members: [`${R}A.tsx:1:10`, `${R}B.tsx:1:10`], disposition: 'pending' }),
  ];
  await writeClonesYaml(fixture.path, clones);
  const capt = makeGuttedWriterIO();
  const result = await runBatchDispose(
    [
      '--ids', 'iiiiiiiiiii1',
      '--disposition', 'keep-with-reason',
      '--reason', 'r',
      '--clones', fixture.path,
    ],
    capt.io,
  );
  if (result.code === 0 && result.verified) {
    return fail('gutted-stub self-check', `no-op writer claimed success; stdout=${capt.stdout()} stderr=${capt.stderr()}`);
  }
  return pass('gutted-stub self-check', `no-op writer produced exit ${result.code} + verified=${result.verified}`);
});

/** Scenario 13: subprocess smoke. Locks the tsx entry point + stdout summary shape. */
const scenarioSubprocessSmoke = (): Promise<ScenarioResult> => withFixture('subproc', async (fixture) => {
  const clones: CloneGroup[] = [
    syntheticGroup({ id: 'jjjjjjjjjjj1', members: [`${R}A.tsx:1:10`, `${R}B.tsx:1:10`], disposition: 'pending' }),
  ];
  await writeClonesYaml(fixture.path, clones);
  const run = await runScannerSubprocess(ENTRY, [
    '--ids', 'jjjjjjjjjjj1',
    '--disposition', 'keep-with-reason',
    '--reason', 'subprocess smoke',
    '--clones', fixture.path,
  ]);
  if (run.code !== 0) return fail('subprocess smoke', `exit=${run.code} stderr=${run.stderr}`);
  if (!run.stdout.includes('Applied: 1') || !run.stdout.includes('Verified: Y')) {
    return fail('subprocess smoke', `expected Applied: 1 and Verified: Y; got ${run.stdout}`);
  }
  return pass('subprocess smoke', 'CLI exit 0; Applied:1; Verified:Y');
});

async function cleanupTmp(): Promise<void> {
  try {
    const entries = await readdir(TMP_ROOT, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory() && e.name.startsWith('batch-dispose-validator-')) {
        await rm(join(TMP_ROOT, e.name), { recursive: true, force: true });
      }
    }
  } catch (err) {
    void err;
  }
}

type Scenario = () => Promise<ScenarioResult> | ScenarioResult;

const SCENARIOS: readonly Scenario[] = [
  scenarioApplyToThree,
  scenarioSkippedDefault,
  scenarioShowExisting,
  scenarioUnknownId,
  scenarioEmptyIds,
  scenarioInvalidDisposition,
  scenarioRefactorRejected,
  scenarioForgedWrite,
  scenarioDryRun,
  scenarioPartialBatch,
  scenarioMemberOrdering,
  scenarioGuttedStub,
  scenarioSubprocessSmoke,
];

async function main(): Promise<number> {
  const results: ScenarioResult[] = [];
  try {
    for (const scenario of SCENARIOS) {
      const result = await scenario();
      results.push(result);
      const marker = result.passed ? 'PASS' : 'FAIL';
      process.stdout.write(`  ${marker}  ${result.name} — ${result.detail}\n`);
    }
  } finally {
    await cleanupTmp();
  }
  const failed = results.filter((r) => !r.passed);
  process.stdout.write(
    `\nSummary: ${results.length - failed.length}/${results.length} scenarios passed\n`,
  );
  return failed.length === 0 ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    process.stderr.write(`harness infrastructure error: ${errorMessage(err)}\n`);
    process.exit(2);
  },
);
