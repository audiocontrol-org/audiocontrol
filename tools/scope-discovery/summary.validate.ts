/**
 * tools/scope-discovery/summary.validate.ts
 *
 * Adversarial validator harness for T7.3 `make clone-summary` /
 * `tools/scope-discovery/summary.ts`. Proves the per-surface counts are
 * computed correctly across all dispositions, that the touching-vs-intra
 * distinction lands as documented, that the CLI honors `--json` and
 * `--verbose`, and that the harness has teeth (a stubbed counter that
 * always emits zeros causes the mixed-fixture assertion to FAIL).
 *
 * Run via:
 *   tsx tools/scope-discovery/summary.validate.ts
 *   make check-clone-summary-validate
 *
 * Exit code:
 *   0   every scenario asserts as expected
 *   1   one or more assertions failed (summary is broken)
 *   2   harness infrastructure error
 */

import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  computeSummary,
  formatSummaryLine,
  runSummary,
  type SummaryCounts,
} from './summary.js';
import { type CloneGroup, serializeClonesYaml } from './clones-yaml.js';
import { globToRegex } from './util/glob.js';
import { runScannerSubprocess } from './util/run-scanner.js';
import { errorMessage, isPlainObject } from './util/typeguards.js';

const TMP_ROOT = '.tmp';
const SUMMARY_ENTRY = 'tools/scope-discovery/summary.ts';
const ROLAND_GLOB = 'modules/roland-sxx0-editor/**';

interface ScenarioResult {
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
}

function pass(name: string, detail: string): ScenarioResult {
  return { name, passed: true, detail };
}

function fail(name: string, detail: string): ScenarioResult {
  return { name, passed: false, detail };
}

/**
 * Mint a synthetic CloneGroup. NOT via makeCloneGroup (which re-derives
 * the id from a token fingerprint): validator fixtures need the SHAPE
 * of a real group but don't care about id stability — the count math
 * only reads `disposition` + `members`.
 */
function syntheticGroup(args: {
  id: string;
  members: readonly string[];
  disposition: 'pending' | 'keep-with-reason' | 'ignore-with-justification';
  reason?: string | null;
}): CloneGroup {
  return {
    id: args.id,
    lines: 8,
    members: [...args.members].sort(),
    disposition: args.disposition,
    reason: args.reason ?? null,
  };
}

/**
 * Mixed fixture used by scenarios 6/7/8/9/13. Six groups exercising
 * every bucket against `modules/roland-sxx0-editor/**`: one pending-
 * touching (1/2 match), one pending-intra (2/2 match), one pending-no-
 * match (0/2), one dispositioned-touching (1/2 match), one dispositioned-
 * intra-but-still-counted-as-touching (2/2 match), one dispositioned-no-
 * match (0/2). Expected counts vs that glob: total=6, pending-touching=2,
 * pending-intra=1, dispositioned-touching=2.
 */
const R = 'modules/roland-sxx0-editor/src/';
const A = 'modules/akai-s3k-editor/src/';
function mixedFixture(): CloneGroup[] {
  return [
    syntheticGroup({
      id: 'mix000000001',
      members: [`${R}PatchEditor.tsx:1:10`, `${A}Other.tsx:1:10`],
      disposition: 'pending',
    }),
    syntheticGroup({
      id: 'mix000000002',
      members: [`${R}A.tsx:1:10`, `${R}B.tsx:1:10`],
      disposition: 'pending',
    }),
    syntheticGroup({
      id: 'mix000000003',
      members: [`${A}Foo.tsx:1:10`, `${A}Bar.tsx:1:10`],
      disposition: 'pending',
    }),
    syntheticGroup({
      id: 'mix000000004',
      members: [`${R}C.tsx:1:10`, `${A}D.tsx:1:10`],
      disposition: 'keep-with-reason',
      reason: 'cross-editor; intentional parity',
    }),
    syntheticGroup({
      id: 'mix000000005',
      members: [`${R}E.tsx:1:10`, `${R}F.tsx:1:10`],
      disposition: 'ignore-with-justification',
      reason: 'fixture boilerplate',
    }),
    syntheticGroup({
      id: 'mix000000006',
      members: [`${A}G.tsx:1:10`, `${A}H.tsx:1:10`],
      disposition: 'keep-with-reason',
      reason: 'akai-only',
    }),
  ];
}

const MIXED_EXPECTED: SummaryCounts = {
  total: 6,
  pendingTouching: 2,
  pendingIntra: 1,
  dispositionedTouching: 2,
};

/** Scenario 1: empty clones file — every count is zero. */
function scenarioEmpty(): ScenarioResult {
  const result = computeSummary([], globToRegex('modules/**/*.tsx'));
  return assertCounts('empty clones file', result.counts, {
    total: 0,
    pendingTouching: 0,
    pendingIntra: 0,
    dispositionedTouching: 0,
  });
}

/** Scenario 2: no glob match — total > 0, the rest are zero. */
function scenarioNoGlobMatch(): ScenarioResult {
  const clones: CloneGroup[] = [
    syntheticGroup({
      id: 'aaa000000001',
      members: [
        'modules/akai-s3k-editor/src/foo.ts:1:10',
        'modules/akai-s3k-editor/src/bar.ts:1:10',
      ],
      disposition: 'pending',
    }),
  ];
  const result = computeSummary(clones, globToRegex(ROLAND_GLOB));
  return assertCounts('no glob match', result.counts, {
    total: 1,
    pendingTouching: 0,
    pendingIntra: 0,
    dispositionedTouching: 0,
  });
}

/** Scenario 3: one pending-touching (1/2 members in surface). */
function scenarioPendingTouching(): ScenarioResult {
  const clones: CloneGroup[] = [
    syntheticGroup({
      id: 'aaa000000002',
      members: [
        'modules/roland-sxx0-editor/src/PatchEditor.tsx:10:20',
        'modules/akai-s3k-editor/src/KeygroupEditor.tsx:30:40',
      ],
      disposition: 'pending',
    }),
  ];
  const result = computeSummary(clones, globToRegex(ROLAND_GLOB));
  return assertCounts('pending-touching (mixed surfaces)', result.counts, {
    total: 1,
    pendingTouching: 1,
    pendingIntra: 0,
    dispositionedTouching: 0,
  });
}

/** Scenario 4: one pending-intra (2/2 members in surface). intra implies touching. */
function scenarioPendingIntra(): ScenarioResult {
  const clones: CloneGroup[] = [
    syntheticGroup({
      id: 'aaa000000003',
      members: [
        'modules/roland-sxx0-editor/src/PatchEditor.tsx:10:20',
        'modules/roland-sxx0-editor/src/ToneEditor.tsx:30:40',
      ],
      disposition: 'pending',
    }),
  ];
  const result = computeSummary(clones, globToRegex(ROLAND_GLOB));
  return assertCounts('pending-intra', result.counts, {
    total: 1,
    pendingTouching: 1,
    pendingIntra: 1,
    dispositionedTouching: 0,
  });
}

/** Scenario 5: one dispositioned-touching (disposition !== 'pending'). */
function scenarioDispositionedTouching(): ScenarioResult {
  const clones: CloneGroup[] = [
    syntheticGroup({
      id: 'aaa000000004',
      members: [
        'modules/roland-sxx0-editor/src/PatchEditor.tsx:10:20',
        'modules/akai-s3k-editor/src/KeygroupEditor.tsx:30:40',
      ],
      disposition: 'keep-with-reason',
      reason: 'two editors, different domains',
    }),
  ];
  const result = computeSummary(clones, globToRegex(ROLAND_GLOB));
  return assertCounts('dispositioned-touching', result.counts, {
    total: 1,
    pendingTouching: 0,
    pendingIntra: 0,
    dispositionedTouching: 1,
  });
}

/** Scenario 6: mixed fixture — every bucket exercised simultaneously. */
function scenarioMixed(): ScenarioResult {
  const result = computeSummary(mixedFixture(), globToRegex(ROLAND_GLOB));
  return assertCounts('mixed', result.counts, MIXED_EXPECTED);
}

/**
 * Scenario 7: brace-alternation glob `modules/{roland-sxx0,akai-s3k}-editor/**`
 * matches every member in the mixed fixture; pending-intra == pending-touching.
 */
function scenarioMultiGlob(): ScenarioResult {
  const result = computeSummary(
    mixedFixture(),
    globToRegex('modules/{roland-sxx0,akai-s3k}-editor/**'),
  );
  return assertCounts('multi-glob alternation', result.counts, {
    total: 6,
    pendingTouching: 3,
    pendingIntra: 3,
    dispositionedTouching: 3,
  });
}

/** Scenario 8: --verbose lists each matching group's id, omits non-matching ids. */
async function scenarioVerbose(): Promise<ScenarioResult> {
  const fixture = await makeFixture('verbose');
  try {
    await writeClonesYaml(fixture.path, mixedFixture());
    const run = await runScannerSubprocess(SUMMARY_ENTRY, [
      '--surface',
      ROLAND_GLOB,
      '--clones',
      fixture.path,
      '--verbose',
    ]);
    if (run.code !== 0) {
      return fail('verbose flag', `subprocess exited ${run.code}; stderr:\n${run.stderr}`);
    }
    for (const id of ['mix000000001', 'mix000000002', 'mix000000004', 'mix000000005']) {
      if (!run.stderr.includes(id)) {
        return fail('verbose flag', `expected verbose output to mention id ${id}`);
      }
    }
    for (const id of ['mix000000003', 'mix000000006']) {
      if (run.stderr.includes(id)) {
        return fail('verbose flag', `non-matching id ${id} unexpectedly surfaced`);
      }
    }
    return pass('verbose flag', '4 matching ids surfaced; 2 non-matching ids correctly omitted');
  } finally {
    await rm(fixture.dir, { recursive: true, force: true });
  }
}

/** Scenario 9: --json emits parseable JSON with the four counts + surface + clones. */
async function scenarioJson(): Promise<ScenarioResult> {
  const fixture = await makeFixture('json');
  try {
    await writeClonesYaml(fixture.path, mixedFixture());
    const run = await runScannerSubprocess(SUMMARY_ENTRY, [
      '--surface',
      ROLAND_GLOB,
      '--clones',
      fixture.path,
      '--json',
    ]);
    if (run.code !== 0) {
      return fail('json output', `subprocess exited ${run.code}; stderr:\n${run.stderr}`);
    }
    const parsed: unknown = JSON.parse(run.stdout);
    if (!isPlainObject(parsed)) {
      return fail('json output', `expected JSON object; got ${typeof parsed}`);
    }
    const checks: ReadonlyArray<readonly [string, unknown]> = [
      ['surface', ROLAND_GLOB],
      ['total', 6],
      ['pending-touching', 2],
      ['pending-intra', 1],
      ['dispositioned-touching', 2],
    ];
    for (const [key, expected] of checks) {
      if (parsed[key] !== expected) {
        return fail(
          'json output',
          `expected ${key}=${JSON.stringify(expected)}; got ${JSON.stringify(parsed[key])}`,
        );
      }
    }
    return pass('json output', 'all 5 fields present with expected values');
  } finally {
    await rm(fixture.dir, { recursive: true, force: true });
  }
}

/**
 * Scenario 10: gutted-stub self-check. The mixed-fixture assertion MUST
 * reject all-zero counts; if it accepts them, the harness has no teeth.
 */
function scenarioGuttedStub(): ScenarioResult {
  const stubCounts: SummaryCounts = {
    total: 0,
    pendingTouching: 0,
    pendingIntra: 0,
    dispositionedTouching: 0,
  };
  const stubResult = assertCounts(
    'gutted-stub assertion (negative)',
    stubCounts,
    MIXED_EXPECTED,
  );
  if (stubResult.passed) {
    return fail(
      'gutted-stub self-check',
      'mixed-fixture assertion accepted all-zero counts - harness has no teeth',
    );
  }
  return pass('gutted-stub self-check', 'all-zero counts correctly rejected');
}

/** Scenario 11: missing --surface — CLI exits 2 + mentions --surface in stderr. */
async function scenarioMissingSurface(): Promise<ScenarioResult> {
  const run = await runScannerSubprocess(SUMMARY_ENTRY, []);
  if (run.code !== 2) {
    return fail('missing --surface', `expected exit code 2; got ${run.code}`);
  }
  if (!run.stderr.includes('--surface')) {
    return fail('missing --surface', `expected stderr to mention "--surface"; got ${run.stderr}`);
  }
  return pass('missing --surface', 'exit 2 + actionable stderr');
}

/** Scenario 12: formatSummaryLine emits the exact pipe-separated layout. */
function scenarioFormatLine(): ScenarioResult {
  const line = formatSummaryLine(MIXED_EXPECTED);
  const expected = 'total: 6 | pending-touching: 2 | pending-intra: 1 | dispositioned-touching: 2';
  if (line !== expected) {
    return fail('format line shape', `expected:\n  ${expected}\ngot:\n  ${line}`);
  }
  return pass('format line shape', 'matches workplan-documented layout exactly');
}

/**
 * Scenario 13: programmatic runSummary wraps computeSummary correctly.
 * The subprocess scenarios exercise the CLI shell; this locks the
 * importable surface for callers that don't want to spawn tsx.
 */
async function scenarioProgrammaticRun(): Promise<ScenarioResult> {
  const fixture = await makeFixture('prog');
  try {
    await writeClonesYaml(fixture.path, mixedFixture());
    const result = await runSummary([
      '--surface',
      ROLAND_GLOB,
      '--clones',
      fixture.path,
    ]);
    if (result.code !== 0 || result.summary === undefined) {
      return fail('programmatic run', `expected code 0 with summary; got code ${result.code}`);
    }
    return assertCounts('programmatic run', result.summary.counts, MIXED_EXPECTED);
  } finally {
    await rm(fixture.dir, { recursive: true, force: true });
  }
}

interface Fixture {
  readonly dir: string;
  readonly path: string;
}

async function makeFixture(label: string): Promise<Fixture> {
  const runId = Math.random().toString(36).slice(2, 8);
  const dir = join(TMP_ROOT, `summary-validator-${label}-${runId}`);
  await mkdir(dir, { recursive: true });
  return { dir, path: join(dir, 'clones.yaml') };
}

async function writeClonesYaml(path: string, clones: readonly CloneGroup[]): Promise<void> {
  const text = serializeClonesYaml({
    generated_at: '2026-05-22T00:00:00.000Z',
    clones: [...clones],
  });
  await writeFile(path, text, 'utf8');
}

/** Shared count comparator — returns a ScenarioResult so scenario 10 can reuse it. */
function assertCounts(
  name: string,
  actual: SummaryCounts,
  expected: SummaryCounts,
): ScenarioResult {
  const mismatches: string[] = [];
  if (actual.total !== expected.total) {
    mismatches.push(`total: expected ${expected.total}, got ${actual.total}`);
  }
  if (actual.pendingTouching !== expected.pendingTouching) {
    mismatches.push(
      `pending-touching: expected ${expected.pendingTouching}, got ${actual.pendingTouching}`,
    );
  }
  if (actual.pendingIntra !== expected.pendingIntra) {
    mismatches.push(
      `pending-intra: expected ${expected.pendingIntra}, got ${actual.pendingIntra}`,
    );
  }
  if (actual.dispositionedTouching !== expected.dispositionedTouching) {
    mismatches.push(
      `dispositioned-touching: expected ${expected.dispositionedTouching}, got ${actual.dispositionedTouching}`,
    );
  }
  if (mismatches.length > 0) return fail(name, mismatches.join('; '));
  return pass(name, formatSummaryLine(actual));
}

async function cleanupTmp(): Promise<void> {
  try {
    const entries = await readdir(TMP_ROOT, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory() && e.name.startsWith('summary-validator-')) {
        await rm(join(TMP_ROOT, e.name), { recursive: true, force: true });
      }
    }
  } catch (err) {
    void err;
  }
}

type Scenario = () => Promise<ScenarioResult> | ScenarioResult;

const SCENARIOS: readonly Scenario[] = [
  scenarioEmpty,
  scenarioNoGlobMatch,
  scenarioPendingTouching,
  scenarioPendingIntra,
  scenarioDispositionedTouching,
  scenarioMixed,
  scenarioMultiGlob,
  scenarioVerbose,
  scenarioJson,
  scenarioGuttedStub,
  scenarioMissingSurface,
  scenarioFormatLine,
  scenarioProgrammaticRun,
];

async function main(): Promise<number> {
  await mkdir(TMP_ROOT, { recursive: true });
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
