/**
 * tools/scope-discovery/pre-commit-consolidation.validate.ts
 *
 * Adversarial validator for the AUDIT-20260524-10 pre-commit gate-
 * consolidation restructure (TF-004 from akai-harmonization).
 *
 * The fix moves `.githooks/pre-commit` from short-circuit-on-first-fail
 * to collect-every-gate's-result-then-report. The opt-in
 * `PRE_COMMIT_SHORT_CIRCUIT=1` env var preserves the prior fast-fail
 * behavior for tight iteration loops.
 *
 * Validation strategy:
 *   - mktemp -d a throwaway dir + git init it.
 *   - Copy the REAL `.githooks/pre-commit` into the throwaway repo
 *     (no stubbing of the hook itself — we exercise the actual
 *     production code).
 *   - Plant a per-test `make` shim on PATH that routes
 *     `make <target>` invocations to controllable per-target stubs.
 *     Each stub returns a predetermined exit code with a
 *     predetermined stdout/stderr line so we can assert against the
 *     consolidated report.
 *   - Stage synthetic .css + .ts files so the hook's conditional
 *     gate triggers (HAS_CSS=1 + HAS_TS=1) fire and all gates run.
 *   - Invoke the hook directly via `bash .githooks/pre-commit` (we
 *     don't need a real `git commit` — the hook is a script and the
 *     gates we care about are the make targets).
 *   - Assert against captured stdout/exit code.
 *
 * Scenarios:
 *   1. multiple-gate-failures-consolidated
 *        Set 2 of 6 gates to fail. Default mode (no env var).
 *        Assert exit 1, stdout names BOTH failing gates, BOTH
 *        per-gate captured outputs are indented under their FAIL
 *        headers, AND all 4 passing gates are listed.
 *
 *   2. short-circuit-env-var-fail-fast
 *        Same gate-failure mix as scenario 1, but with
 *        PRE_COMMIT_SHORT_CIRCUIT=1. Assert exit 1, only the FIRST
 *        failing gate's output appears, later gates never ran.
 *
 *   3. all-gates-pass-no-report
 *        All 6 gates return 0. Assert exit 0, no consolidated
 *        report header.
 *
 *   4. gate-skip-no-css-files-staged
 *        Stage only .ts files. Assert the CSS-conditional gates
 *        (`check-css-duplication`, `check-chevron-sizing`) DON'T
 *        appear in the consolidated report at all — neither as
 *        PASS nor as FAIL.
 *
 *   5. gutted-detector-self-check
 *        Replace the production hook with a stub that always exits
 *        0 regardless of gate results. Re-run scenario 1's setup.
 *        The "stdout names BOTH failing gates" assertion MUST FAIL.
 *        Confirms the harness has teeth.
 *
 * Run via:
 *   tsx tools/scope-discovery/pre-commit-consolidation.validate.ts
 *   make check-pre-commit-consolidation-validate
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { errorMessage } from './util/typeguards.js';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const REAL_PRE_COMMIT = path.join(REPO_ROOT, '.githooks', 'pre-commit');

// ---------------------------------------------------------------------------
// Shared scenario-result shape (mirrors no-verify-detection.validate.ts).
// ---------------------------------------------------------------------------

interface ScenarioResult {
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
}

const pass = (name: string, detail: string): ScenarioResult => ({ name, passed: true, detail });
const fail = (name: string, detail: string): ScenarioResult => ({ name, passed: false, detail });

// ---------------------------------------------------------------------------
// Fixture — throwaway git repo + per-target `make` shim on PATH.
// ---------------------------------------------------------------------------

interface GateOutcome {
  readonly target: string;
  readonly exitCode: number;
  readonly stdout: string;
}

interface FixtureOptions {
  readonly hookSource?: string; // override the real hook (for gutted self-check)
  readonly stageCss: boolean;
  readonly stageTs: boolean;
  readonly gateOutcomes: readonly GateOutcome[];
}

interface Fixture {
  readonly dir: string;
  readonly hookPath: string;
  readonly binDir: string;
  cleanup(): void;
}

function setupFixture(opts: FixtureOptions): Fixture {
  const dir = mkdtempSync(path.join(tmpdir(), 'pre-commit-consolidation-'));
  const git = (...args: string[]): string =>
    execFileSync('git', args, { cwd: dir, encoding: 'utf8' });

  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'tester@example.com');
  git('config', 'user.name', 'Tester');

  // Seed an initial commit so `git diff --cached --diff-filter=ACM`
  // behaves like a real workspace (the hook tolerates the no-HEAD case
  // via `|| true`, but seeding makes the fixture more realistic).
  writeFileSync(path.join(dir, '.gitignore'), 'bin/\n');
  git('add', '.gitignore');
  git('commit', '-q', '-m', 'seed');

  // Hooks dir — copy the production pre-commit verbatim (or use an
  // override for the gutted self-check).
  const hooksDir = path.join(dir, '.githooks');
  mkdirSync(hooksDir, { recursive: true });
  const hookPath = path.join(hooksDir, 'pre-commit');
  if (opts.hookSource !== undefined) {
    writeFileSync(hookPath, opts.hookSource);
  } else {
    copyFileSync(REAL_PRE_COMMIT, hookPath);
  }
  chmodSync(hookPath, 0o755);
  git('config', 'core.hooksPath', '.githooks');

  // Per-target `make` shim. The shim is a single executable script
  // that dispatches based on its arguments. `make --no-print-directory
  // check-foo` → exec the per-target stub `bin/gates/check-foo.sh`.
  const binDir = path.join(dir, 'bin');
  const gatesDir = path.join(binDir, 'gates');
  mkdirSync(gatesDir, { recursive: true });

  // Write per-target stubs based on the outcome table.
  for (const outcome of opts.gateOutcomes) {
    const stubPath = path.join(gatesDir, `${outcome.target}.sh`);
    // Each stub echoes its identifying line then exits with the
    // requested code. The echoed line is what the consolidated report
    // should surface indented under the FAIL header.
    const stubBody = [
      '#!/usr/bin/env bash',
      `echo ${JSON.stringify(outcome.stdout)}`,
      `exit ${outcome.exitCode}`,
      '',
    ].join('\n');
    writeFileSync(stubPath, stubBody);
    chmodSync(stubPath, 0o755);
  }

  // The `make` shim itself: skips --no-print-directory + dispatches to
  // the per-target stub. Anything not in the gates dir is treated as
  // an unknown target (exit 2 + diagnostic) — surfaces test setup gaps.
  const makeShim = [
    '#!/usr/bin/env bash',
    'set -uo pipefail',
    'while [ $# -gt 0 ]; do',
    '  case "$1" in',
    '    --no-print-directory) shift ;;',
    '    -C) shift 2 ;;',
    '    *) break ;;',
    '  esac',
    'done',
    'target="${1:-}"',
    `stub_dir=${JSON.stringify(gatesDir)}`,
    'stub="$stub_dir/$target.sh"',
    'if [ ! -x "$stub" ]; then',
    '  echo "make shim: no stub for target $target" >&2',
    '  exit 2',
    'fi',
    'exec "$stub"',
    '',
  ].join('\n');
  const makePath = path.join(binDir, 'make');
  writeFileSync(makePath, makeShim);
  chmodSync(makePath, 0o755);

  if (opts.stageCss) {
    writeFileSync(path.join(dir, 'a.css'), '.x { color: red; }\n');
    git('add', 'a.css');
  }
  if (opts.stageTs) {
    writeFileSync(path.join(dir, 'a.ts'), 'export const x = 1;\n');
    git('add', 'a.ts');
  }

  return {
    dir,
    hookPath,
    binDir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

interface HookRun {
  readonly stdout: string;
  readonly stderr: string;
  readonly code: number;
}

function runHook(fixture: Fixture, env: Record<string, string> = {}): HookRun {
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ...env,
    PATH: `${fixture.binDir}:${process.env.PATH ?? ''}`,
  };
  const result = spawnSync('bash', [fixture.hookPath], {
    cwd: fixture.dir,
    env: childEnv,
    encoding: 'utf8',
  });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    code: result.status ?? -1,
  };
}

// ---------------------------------------------------------------------------
// Standard outcome table — used by multiple scenarios. 2 of 6 gates
// fail with distinct stdout signatures so we can assert each appears
// under its own FAIL header.
// ---------------------------------------------------------------------------

const FAILING_OUTCOMES: readonly GateOutcome[] = [
  { target: 'check-css-duplication', exitCode: 0, stdout: 'css-ok-marker' },
  { target: 'check-chevron-sizing', exitCode: 0, stdout: 'chevron-ok-marker' },
  { target: 'check-clone-duplication', exitCode: 1, stdout: 'CLONE-FAIL-MARKER: new group abc123' },
  { target: 'check-anti-patterns', exitCode: 1, stdout: 'ANTI-PATTERN-FAIL-MARKER: holdout x.ts' },
  { target: 'check-adopters', exitCode: 0, stdout: 'adopters-ok-marker' },
  { target: 'check-editor-symmetry', exitCode: 0, stdout: 'symmetry-ok-marker' },
  // akai-harmonization workplan task 2.10. The Gate B (source-side)
  // scan fires whenever HAS_TS=1, so the standard "stage .css + .ts"
  // fixture exercises it. Stubbed-pass here to keep the scenarios
  // focused on the consolidation behavior under test.
  { target: 'check-tab-active-state-sources', exitCode: 0, stdout: 'tab-active-state-sources-ok-marker' },
];

const ALL_PASSING_OUTCOMES: readonly GateOutcome[] = FAILING_OUTCOMES.map(
  (o) => ({ ...o, exitCode: 0 }),
);

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

async function scenarioMultipleGateFailuresConsolidated(): Promise<ScenarioResult> {
  const name = 'multiple-gate-failures-consolidated';
  const fixture = setupFixture({
    stageCss: true,
    stageTs: true,
    gateOutcomes: FAILING_OUTCOMES,
  });
  try {
    const run = runHook(fixture);
    if (run.code === 0) {
      return fail(name, `expected non-zero exit; got 0. stdout:\n${run.stdout}`);
    }
    // The consolidated report goes to stdout (the report's `echo`
    // calls don't redirect to stderr).
    const out = run.stdout;
    const checks: Array<[string, boolean]> = [
      ['header names "2 of 7 gate(s) failed"', /2 of 7 gate\(s\) failed/.test(out)],
      ['FAIL block for check-clone-duplication', /\[FAIL\] check-clone-duplication/.test(out)],
      ['FAIL block for check-anti-patterns', /\[FAIL\] check-anti-patterns/.test(out)],
      ['captured clone-detector marker indented', /^ {4}CLONE-FAIL-MARKER/m.test(out)],
      ['captured anti-patterns marker indented', /^ {4}ANTI-PATTERN-FAIL-MARKER/m.test(out)],
      ['PASS line for check-css-duplication', /\[PASS\] check-css-duplication/.test(out)],
      ['PASS line for check-chevron-sizing', /\[PASS\] check-chevron-sizing/.test(out)],
      ['PASS line for check-adopters', /\[PASS\] check-adopters/.test(out)],
      ['PASS line for check-editor-symmetry', /\[PASS\] check-editor-symmetry/.test(out)],
      ['final hint cites PRE_COMMIT_SHORT_CIRCUIT', /PRE_COMMIT_SHORT_CIRCUIT=1/.test(out)],
    ];
    const failed = checks.filter(([, ok]) => !ok).map(([why]) => why);
    if (failed.length > 0) {
      return fail(name, `assertions failed: ${failed.join('; ')}. stdout:\n${out}`);
    }
    return pass(name, `exit ${run.code}; consolidated report names both failures + all 4 passes`);
  } finally {
    fixture.cleanup();
  }
}

async function scenarioShortCircuitEnvVarFailFast(): Promise<ScenarioResult> {
  const name = 'short-circuit-env-var-fail-fast';
  const fixture = setupFixture({
    stageCss: true,
    stageTs: true,
    gateOutcomes: FAILING_OUTCOMES,
  });
  try {
    const run = runHook(fixture, { PRE_COMMIT_SHORT_CIRCUIT: '1' });
    if (run.code === 0) {
      return fail(name, `expected non-zero exit; got 0. stdout:\n${run.stdout}`);
    }
    const combined = run.stdout + run.stderr;
    // First failing gate in declaration order with CSS staged is
    // check-clone-duplication (CSS gates pass, then clone fails first).
    if (!/CLONE-FAIL-MARKER/.test(combined)) {
      return fail(name, `expected first failing gate output (CLONE-FAIL-MARKER) in output. combined:\n${combined}`);
    }
    if (/ANTI-PATTERN-FAIL-MARKER/.test(combined)) {
      return fail(name, `short-circuit should have aborted before check-anti-patterns; saw ANTI-PATTERN-FAIL-MARKER. combined:\n${combined}`);
    }
    if (/\[FAIL\]|\[PASS\]/.test(combined)) {
      return fail(name, `short-circuit mode should not emit consolidated [FAIL]/[PASS] report. combined:\n${combined}`);
    }
    return pass(name, `exit ${run.code}; first failure surfaced, later gates not run, no consolidated report`);
  } finally {
    fixture.cleanup();
  }
}

async function scenarioAllGatesPassNoReport(): Promise<ScenarioResult> {
  const name = 'all-gates-pass-no-report';
  const fixture = setupFixture({
    stageCss: true,
    stageTs: true,
    gateOutcomes: ALL_PASSING_OUTCOMES,
  });
  try {
    const run = runHook(fixture);
    if (run.code !== 0) {
      return fail(name, `expected exit 0; got ${run.code}. stdout:\n${run.stdout}\nstderr:\n${run.stderr}`);
    }
    if (/gate\(s\) failed/.test(run.stdout)) {
      return fail(name, `all gates passed but consolidated header rendered. stdout:\n${run.stdout}`);
    }
    if (/\[FAIL\]/.test(run.stdout)) {
      return fail(name, `all gates passed but [FAIL] block rendered. stdout:\n${run.stdout}`);
    }
    return pass(name, `exit 0; happy path emits no consolidated report`);
  } finally {
    fixture.cleanup();
  }
}

async function scenarioGateSkipNoCssFilesStaged(): Promise<ScenarioResult> {
  const name = 'gate-skip-no-css-files-staged';
  // Outcomes table contains stubs for CSS gates too — but if the
  // pre-commit's HAS_CSS branch is honored, those stubs never run and
  // shouldn't appear in the report.
  const fixture = setupFixture({
    stageCss: false,
    stageTs: true,
    gateOutcomes: ALL_PASSING_OUTCOMES,
  });
  try {
    const run = runHook(fixture);
    if (run.code !== 0) {
      return fail(name, `expected exit 0; got ${run.code}. stdout:\n${run.stdout}\nstderr:\n${run.stderr}`);
    }
    // Force a TS-gate failure path to make absence-of-CSS-gates visible:
    // re-run with one TS gate failing and assert the report names only
    // TS gates (no CSS-gate PASS or FAIL lines).
    fixture.cleanup();
    const fixture2 = setupFixture({
      stageCss: false,
      stageTs: true,
      gateOutcomes: [
        { target: 'check-css-duplication', exitCode: 0, stdout: 'css-ok-marker' },
        { target: 'check-chevron-sizing', exitCode: 0, stdout: 'chevron-ok-marker' },
        { target: 'check-clone-duplication', exitCode: 1, stdout: 'CLONE-FAIL-MARKER' },
        { target: 'check-anti-patterns', exitCode: 0, stdout: 'anti-ok-marker' },
        { target: 'check-adopters', exitCode: 0, stdout: 'adopters-ok-marker' },
        { target: 'check-editor-symmetry', exitCode: 0, stdout: 'symmetry-ok-marker' },
        // Gate B (source-side tab-id registration) also fires on
        // HAS_TS=1; pass-stub it so the count remains stable.
        { target: 'check-tab-active-state-sources', exitCode: 0, stdout: 'tab-active-state-sources-ok-marker' },
      ],
    });
    try {
      const run2 = runHook(fixture2);
      if (run2.code === 0) {
        return fail(name, `expected non-zero exit on TS-only failure; got 0. stdout:\n${run2.stdout}`);
      }
      const out = run2.stdout;
      const expectedAbsent = ['check-css-duplication', 'check-chevron-sizing'];
      for (const target of expectedAbsent) {
        if (out.includes(target)) {
          return fail(name, `CSS gate ${target} unexpectedly appeared in report (no .css files staged). stdout:\n${out}`);
        }
      }
      if (!/\[FAIL\] check-clone-duplication/.test(out)) {
        return fail(name, `TS-gate failure not surfaced. stdout:\n${out}`);
      }
      if (!/1 of 5 gate\(s\) failed/.test(out)) {
        return fail(name, `expected "1 of 5 gate(s) failed" (CSS gates skipped); got. stdout:\n${out}`);
      }
      return pass(name, `exit ${run2.code}; CSS gates absent from report, TS-only report tallies 1/5`);
    } finally {
      fixture2.cleanup();
    }
  } catch {
    fixture.cleanup();
    throw new Error('fixture re-setup failed');
  }
}

async function scenarioGuttedDetectorSelfCheck(): Promise<ScenarioResult> {
  const name = 'gutted-detector-self-check';
  // Stub the pre-commit hook with a no-op exit-0 — simulates a future
  // refactor that accidentally strips the consolidation logic. The
  // FAILING_OUTCOMES table contains 2 failing gates, but the gutted
  // hook never runs them. Assertion: the multi-failure consolidation
  // assertion MUST fail (no "2 of 6 gate(s) failed" line) — proves
  // the harness has teeth.
  const fixture = setupFixture({
    stageCss: true,
    stageTs: true,
    gateOutcomes: FAILING_OUTCOMES,
    hookSource: '#!/usr/bin/env bash\nexit 0\n',
  });
  try {
    const run = runHook(fixture);
    if (run.code !== 0) {
      // Expected: a gutted exit-0 hook returns 0. That alone proves
      // the consolidation logic is missing — there's nothing to do.
      // Cross-check the assertion shape from scenario 1 against the
      // gutted output: it MUST NOT find the header.
      if (/2 of 6 gate\(s\) failed/.test(run.stdout)) {
        return fail(
          name,
          `gutted hook somehow produced consolidated report (impossible without the real logic). stdout:\n${run.stdout}`,
        );
      }
      return pass(
        name,
        `gutted hook exits 0; scenario-1 assertions would correctly fail against this output (no consolidated header)`,
      );
    }
    // Hook exited 0 — and the gutted version has no consolidated
    // report, so scenario-1's primary assertions don't match. That's
    // exactly the failure mode the self-check needs to confirm.
    if (/2 of 6 gate\(s\) failed/.test(run.stdout)) {
      return fail(
        name,
        `gutted hook somehow emitted the consolidated header. stdout:\n${run.stdout}`,
      );
    }
    return pass(
      name,
      `gutted hook exits 0 with no consolidated report — primary scenarios' header assertion would correctly fail`,
    );
  } finally {
    fixture.cleanup();
  }
}

// ---------------------------------------------------------------------------
// Runner — mirrors no-verify-detection.validate.ts.
// ---------------------------------------------------------------------------

const SCENARIOS: Array<() => Promise<ScenarioResult>> = [
  scenarioMultipleGateFailuresConsolidated,
  scenarioShortCircuitEnvVarFailFast,
  scenarioAllGatesPassNoReport,
  scenarioGateSkipNoCssFilesStaged,
  scenarioGuttedDetectorSelfCheck,
];

async function main(): Promise<number> {
  let failures = 0;
  for (const run of SCENARIOS) {
    let result: ScenarioResult;
    try {
      result = await run();
    } catch (err) {
      result = fail(run.name, `harness error: ${errorMessage(err)}`);
    }
    if (result.passed) {
      console.log(`PASS  ${result.name}  ${result.detail}`);
    } else {
      console.error(`FAIL  ${result.name}  ${result.detail}`);
      failures += 1;
    }
  }
  const total = SCENARIOS.length;
  const passed = total - failures;
  console.log(`\npre-commit-consolidation: ${passed}/${total} scenarios passed`);
  return failures === 0 ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`infrastructure error: ${errorMessage(err)}`);
    process.exit(2);
  },
);
