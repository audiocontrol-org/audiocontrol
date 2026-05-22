/**
 * tools/scope-discovery/clone-detector.validate.ts
 *
 * Adversarial validator harness for `tools/scope-discovery/clone-detector.ts`
 * (workplan T2.5). Proves the detector actually catches NEW clones,
 * accepts DROPPED clones, honors the `ignore-with-justification`
 * disposition, and that the harness itself has teeth (a gutted detector
 * would fail the harness's NEW-detection assertion).
 *
 * Mirrors `tools/check-css-duplication.validate.ts`'s structure:
 *   - subprocess invocation of the underlying checker (no programmatic
 *     coupling to the detector's internals — we exercise it the way the
 *     pre-commit hook does);
 *   - exits 0 on all assertions passing, 1 on any assertion failure,
 *     2 on infrastructure error (fixture I/O, missing tool).
 *
 * Each scenario uses its own short-lived fixture directory under
 * `.tmp/clone-validator-<runid>/`, and scenarios within ONE harness
 * invocation run sequentially — so per-scenario fixtures and
 * baselines stay isolated within a single run.
 *
 * NOTE on parallel invocations: the underlying detector (via
 * `tools/scope-discovery/jscpd-runner.ts`) writes and reads a single
 * shared report path at `reports/duplication/jscpd-report.json`. Two
 * harness instances running concurrently can interleave writes to
 * that file, so do NOT invoke this harness in parallel with itself
 * (or with `tools/scope-discovery/clone-detector.ts`). Sequential
 * invocations are safe.
 *
 * Fixtures are torn down at the end (success OR failure) by a single
 * top-level finally; do NOT touch the production baseline at
 * docs/scope-discovery/clones.yaml.
 *
 * Run via:
 *   tsx tools/scope-discovery/clone-detector.validate.ts
 *   make check-clone-duplication-validate
 *
 * Exit code:
 *   0   every scenario asserts as expected
 *   1   one or more assertions failed (detector is broken)
 *   2   harness infrastructure error
 */

import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import {
  type ClonesYaml,
  parseClonesYaml,
  serializeClonesYaml,
} from './clones-yaml.js';
import { errorMessage } from './util/typeguards.js';

const DETECTOR_ENTRY = 'tools/scope-discovery/clone-detector.ts';
const TMP_ROOT = '.tmp';

interface DetectorRun {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * Run the detector as a subprocess against a fixture directory. We
 * spawn `tsx` directly — same shape as the pre-commit hook + the
 * `make check-clone-duplication` target — so the gate we're validating
 * is the same gate developers run.
 */
function runDetector(args: readonly string[]): Promise<DetectorRun> {
  return new Promise((resolvePromise, rejectPromise) => {
    const proc = spawn('tsx', [DETECTOR_ENTRY, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    proc.on('error', rejectPromise);
    proc.on('close', (code) => {
      if (code === null) {
        rejectPromise(new Error(`detector terminated by signal; stderr:\n${stderr}`));
        return;
      }
      resolvePromise({ code, stdout, stderr });
    });
  });
}

/**
 * Two .ts files with a 7-line / well-above-50-token shared body.
 * Above the .jscpd.json thresholds (minLines: 5, minTokens: 50) so jscpd
 * reliably flags them. Identifiers are deliberately mundane so the
 * fixture isn't accidentally picked up by other tools.
 */
const CLONE_BODY_A = `export function fixtureCalc(x: number, y: number): number {
  const sum = x + y;
  const product = x * y;
  const diff = x - y;
  const quot = y === 0 ? 0 : x / y;
  return sum + product + diff + quot;
}
`;

const CLONE_BODY_B = `export function fixtureSummarise(a: number, b: number): number {
  const total = a + b;
  const scaled = a * b;
  const delta = a - b;
  const ratio = b === 0 ? 0 : a / b;
  return total + scaled + delta + ratio;
}
`;

/**
 * Structurally distinct from CLONE_BODY_A / CLONE_BODY_B at the token
 * level (object literal + type alias + string interpolation, not a
 * numeric reduce). Used by the gutted-logic scenario as the second
 * file in a clone-free fixture: above jscpd's per-file size floor so
 * it actually writes a JSON report, below the cross-file clone
 * threshold so no group is detected.
 */
const NONCLONE_BODY = `type Greeter = { name: string };
export function fixtureGreet(g: Greeter): string {
  const stamp = new Date().toISOString();
  const headline = \`hello, \${g.name}!\`;
  const trailer = headline.toUpperCase();
  return \`[\${stamp}] \${trailer}\`;
}
`;

interface Fixture {
  readonly dir: string;
  readonly baseline: string;
}

async function makeFixture(label: string): Promise<Fixture> {
  const runId = Math.random().toString(36).slice(2, 8);
  const dir = join(TMP_ROOT, `clone-validator-${label}-${runId}`);
  await mkdir(dir, { recursive: true });
  return { dir, baseline: join(dir, 'baseline.yaml') };
}

/**
 * Single source of truth for the detector CLI arg shape every scenario
 * uses. Default is the quiet form that matches the pre-commit hook;
 * scenario 1 needs the non-quiet form once to assert on per-group
 * stdout. Avoids 7 repetitions of the same args array.
 */
function detectorArgs(
  fixture: Fixture,
  options: { readonly quiet?: boolean } = {},
): readonly string[] {
  const args = ['--root', fixture.dir, '--baseline', fixture.baseline];
  if (options.quiet !== false) {
    args.push('--quiet');
  }
  return args;
}

async function writeFixtureFile(dir: string, name: string, body: string): Promise<void> {
  await writeFile(join(dir, name), body, 'utf8');
}

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

type RunDetectorFn = (args: readonly string[]) => Promise<DetectorRun>;

/**
 * Core assertion for scenario 1: given a detector function (real or
 * stubbed), plant a NEW clone and check that the detector flags it.
 * Returning a ScenarioResult lets scenario 4 reuse this exact check
 * against a deliberately-gutted detector and confirm the harness
 * has teeth.
 */
async function assertNewCloneDetected(
  label: string,
  detector: RunDetectorFn,
): Promise<ScenarioResult> {
  const fixture = await makeFixture(label);
  await writeFixtureFile(fixture.dir, 'a.ts', CLONE_BODY_A);
  await writeFixtureFile(fixture.dir, 'b.ts', CLONE_BODY_A);
  // Baseline-capture always uses the real detector — the gut applies
  // to the compare-mode run, which is the gate's actual decision step.
  const first = await runDetector(detectorArgs(fixture));
  if (first.code !== 0) {
    return fail('NEW clone detection', `baseline-capture run exited ${first.code}; stderr:\n${first.stderr}`);
  }
  await writeFixtureFile(fixture.dir, 'c.ts', CLONE_BODY_B);
  await writeFixtureFile(fixture.dir, 'd.ts', CLONE_BODY_B);
  const second = await detector(detectorArgs(fixture, { quiet: false }));
  if (second.code !== 1) {
    return fail(
      'NEW clone detection',
      `expected exit 1 with NEW group reported; got exit ${second.code}\nstdout:\n${second.stdout}\nstderr:\n${second.stderr}`,
    );
  }
  // Fix 2: the previous `second.stdout.includes('NEW')` assertion was
  // dead — the detector's non-quiet output always emits the literal
  // `Baseline diff: N NEW, M DROPPED.` line whenever a baseline exists,
  // regardless of NEW count, so the substring is always present. The
  // c.ts/d.ts membership check below is what catches a gutted detector.
  if (!second.stdout.includes('c.ts') || !second.stdout.includes('d.ts')) {
    return fail(
      'NEW clone detection',
      `NEW group should reference planted files c.ts + d.ts; stdout:\n${second.stdout}`,
    );
  }
  return pass('NEW clone detection', 'detector exited 1 and named c.ts + d.ts in the NEW group');
}

/**
 * Scenario 1: plant a NEW clone beyond the baseline; assert the
 * real detector exits 1 and reports `1 NEW`.
 */
async function scenarioNewClone(): Promise<ScenarioResult> {
  return assertNewCloneDetected('new', runDetector);
}

/**
 * Scenario 2: capture a baseline, then refactor away one clone member.
 * Assert the detector exits 0 and reports `1 DROPPED` (i.e. baseline
 * shrinkage is a feature, not a regression).
 */
async function scenarioDroppedClone(): Promise<ScenarioResult> {
  const fixture = await makeFixture('dropped');
  await writeFixtureFile(fixture.dir, 'a.ts', CLONE_BODY_A);
  await writeFixtureFile(fixture.dir, 'b.ts', CLONE_BODY_A);
  const first = await runDetector(detectorArgs(fixture));
  if (first.code !== 0) {
    return fail('DROPPED clone acceptance', `baseline-capture run exited ${first.code}; stderr:\n${first.stderr}`);
  }
  // Refactor: remove one of the cloned files.
  await rm(join(fixture.dir, 'b.ts'));
  const second = await runDetector(detectorArgs(fixture));
  if (second.code !== 0) {
    return fail(
      'DROPPED clone acceptance',
      `expected exit 0 after dropping clone; got exit ${second.code}\nstdout:\n${second.stdout}\nstderr:\n${second.stderr}`,
    );
  }
  if (!/1 DROPPED/.test(second.stdout)) {
    return fail(
      'DROPPED clone acceptance',
      `expected "1 DROPPED" in summary; stdout:\n${second.stdout}`,
    );
  }
  return pass('DROPPED clone acceptance', 'detector exited 0 and reported "1 DROPPED"');
}

/**
 * Scenario 3: hand-edit the baseline's disposition to
 * `ignore-with-justification`; re-run with the source unchanged.
 * The detector keys NEW/DROPPED by group id (any disposition value
 * means "in baseline, not NEW"), so the assertion is: changing the
 * disposition does NOT cause the previously-baselined group to
 * re-appear as NEW. This is the "honor the ignore" semantic for the
 * gate: a dispositioned entry stays out of the failure set on every
 * subsequent run, regardless of which non-pending disposition was
 * chosen.
 */
async function scenarioIgnoreWithJustification(): Promise<ScenarioResult> {
  const fixture = await makeFixture('ignore');
  await writeFixtureFile(fixture.dir, 'a.ts', CLONE_BODY_A);
  await writeFixtureFile(fixture.dir, 'b.ts', CLONE_BODY_A);
  const first = await runDetector(detectorArgs(fixture));
  if (first.code !== 0) {
    return fail(
      'ignore-with-justification honor',
      `baseline-capture run exited ${first.code}; stderr:\n${first.stderr}`,
    );
  }
  const baselineText = await readFile(fixture.baseline, 'utf8');
  const parsed = parseClonesYaml(baselineText);
  if (parsed === null || parsed.clones.length === 0) {
    return fail(
      'ignore-with-justification honor',
      `expected at least one baseline entry; parsed:\n${baselineText}`,
    );
  }
  const mutated: ClonesYaml = {
    generated_at: parsed.generated_at,
    clones: parsed.clones.map((g) => ({
      ...g,
      disposition: 'ignore-with-justification',
      reason: 'harness: legitimate near-duplicate, not refactor candidate',
    })),
  };
  await writeFile(fixture.baseline, serializeClonesYaml(mutated), 'utf8');
  const second = await runDetector(detectorArgs(fixture));
  if (second.code !== 0) {
    return fail(
      'ignore-with-justification honor',
      `expected exit 0 after disposition change; got exit ${second.code}\nstdout:\n${second.stdout}\nstderr:\n${second.stderr}`,
    );
  }
  if (!/0 NEW/.test(second.stdout)) {
    return fail(
      'ignore-with-justification honor',
      `expected "0 NEW" after disposition change; stdout:\n${second.stdout}`,
    );
  }
  return pass(
    'ignore-with-justification honor',
    'dispositioned entry stayed out of NEW on subsequent run (exit 0, 0 NEW)',
  );
}

/**
 * A stubbed detector that simulates a gutted implementation: regardless
 * of input, it returns the always-clean "0 groups; 0 NEW; 0 DROPPED"
 * summary at exit 0 — the failure mode where someone has commented out
 * the detection logic and the gate silently green-lights every commit.
 */
function stubGuttedDetector(): RunDetectorFn {
  return async () => ({
    code: 0,
    stdout: '0 groups; 0 NEW; 0 DROPPED\n',
    stderr: '',
  });
}

/**
 * Scenario 4: gutted-logic self-check. Two complementary assertions:
 *
 *   (a) empty-directory floor — an input with no source files must
 *       yield 0 groups; if the real detector hallucinates clones
 *       against an empty tree, it's broken in a way scenarios 1-3
 *       would not catch.
 *
 *   (b) stub-against-the-harness — run scenario 1's exact assertion
 *       against a stubbed detector that always returns "0 NEW",
 *       and require that the assertion FAILS. If the assertion
 *       passes against the stub, the harness has no teeth (it
 *       accepts both real and gutted detectors as fine), which
 *       would mean scenarios 1-3 prove nothing.
 */
async function scenarioGuttedLogicSelfCheck(): Promise<ScenarioResult> {
  const fixture = await makeFixture('gutted');
  // (a) clone-free floor — fixtures large enough that jscpd produces
  //     a JSON report, but with no fragments duplicated across files,
  //     must yield 0 groups. We can't use a truly-empty directory
  //     because jscpd refuses to write its JSON report when given no
  //     input files; that would surface as detector exit 2
  //     (infrastructure failure), a different error class than
  //     "hallucinated clones".
  await writeFixtureFile(fixture.dir, 'lonely-a.ts', CLONE_BODY_A);
  await writeFixtureFile(fixture.dir, 'lonely-b.ts', NONCLONE_BODY);
  const empty = await runDetector(detectorArgs(fixture));
  if (empty.code !== 0) {
    return fail(
      'gutted-logic self-check',
      `clone-free run should exit 0; got ${empty.code}\nstdout:\n${empty.stdout}\nstderr:\n${empty.stderr}`,
    );
  }
  if (!/0 groups; 0 NEW; 0 DROPPED/.test(empty.stdout)) {
    return fail(
      'gutted-logic self-check',
      `clone-free run must yield "0 groups; 0 NEW; 0 DROPPED"; stdout:\n${empty.stdout}`,
    );
  }
  // (b) run scenario 1's assertion against a gutted stub detector and
  //     verify it fails. If it passes, the harness can't tell a real
  //     detector from a no-op — which is the failure mode we're
  //     guarding against.
  const stubResult = await assertNewCloneDetected('gutted-stub', stubGuttedDetector());
  if (stubResult.passed) {
    return fail(
      'gutted-logic self-check',
      'scenario-1 assertion passed against a gutted (always "0 NEW") detector — harness has no teeth',
    );
  }
  return pass(
    'gutted-logic self-check',
    'clone-free input yields 0 groups; gutted stub detector rejected by scenario-1 assertion',
  );
}

async function cleanupTmp(): Promise<void> {
  // Sweep every clone-validator-* fixture this run could have created.
  // We don't track per-fixture paths because a partial-failure path might
  // skip the local cleanup; the sweep is the catch-all.
  try {
    const entries = await readdir(TMP_ROOT, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory() && e.name.startsWith('clone-validator-')) {
        await rm(join(TMP_ROOT, e.name), { recursive: true, force: true });
      }
    }
  } catch (err) {
    // .tmp/ may not exist on a fresh checkout; that's fine.
    void err;
  }
}

async function main(): Promise<number> {
  await mkdir(TMP_ROOT, { recursive: true });
  const scenarios = [
    scenarioNewClone,
    scenarioDroppedClone,
    scenarioIgnoreWithJustification,
    scenarioGuttedLogicSelfCheck,
  ];
  const results: ScenarioResult[] = [];
  try {
    for (const scenario of scenarios) {
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
    console.error(`harness infrastructure error: ${errorMessage(err)}`);
    process.exit(2);
  },
);
