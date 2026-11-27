/**
 * tools/scope-discovery/gates.validate.ts
 *
 * Adversarial validator for `tools/gates.sh` (`make gates`), the verb
 * that replaced the former .githooks/ pre-commit and commit-msg hooks.
 *
 * Strategy: a throwaway git repo with a `main` branch and a `topic`
 * branch, the REAL tools/gates.sh copied in verbatim, and a `make`
 * shim on PATH that routes each `make <target> [VAR=...]` call to a
 * per-target stub. Stubs print a marker, append their arguments (and
 * any COMMIT_MSG_FILE contents) to a call log, and exit with a chosen
 * code.
 *
 * Scenarios:
 *   1. failures-consolidated — 2 gates fail; exit 1, both [FAIL] blocks
 *      with indented output, every other gate listed as [PASS].
 *   2. all-pass — exit 0 and the "all N gate(s) passed" line.
 *   3. survivor-gets-merge-base — check-disposition-survivor receives
 *      `--head-ref <merge-base sha> --working-tree`.
 *   4. refactor-marker-commits-only — check-refactor-preconditions runs
 *      once per branch commit carrying `Closes clones.yaml <id>`, with
 *      that commit's message, and never for unmarked commits.
 *   5. missing-base-fails-loud — an unknown GATES_BASE exits 2 naming it.
 *   6. gutted-self-check — a no-op exit-0 script MUST fail scenario 1's
 *      assertions (the harness has teeth).
 *
 * Run via:
 *   tsx tools/scope-discovery/gates.validate.ts
 *   make check-gates-validate
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { errorMessage } from './util/typeguards.js';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const REAL_GATES = path.join(REPO_ROOT, 'tools', 'gates.sh');

interface ScenarioResult {
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
}
const pass = (name: string, detail: string): ScenarioResult => ({ name, passed: true, detail });
const fail = (name: string, detail: string): ScenarioResult => ({ name, passed: false, detail });

const SCAN_GATES: readonly string[] = [
  'check-css-duplication',
  'check-chevron-sizing',
  'check-clone-duplication',
  'check-anti-patterns',
  'check-adopters',
  'check-editor-symmetry',
];
const ALL_TARGETS: readonly string[] = [...SCAN_GATES, 'check-disposition-survivor', 'check-refactor-preconditions'];

interface FixtureOptions {
  readonly failing: readonly string[];
  readonly branchMessages: readonly string[];
  readonly scriptSource?: string;
}

interface Fixture {
  readonly dir: string;
  readonly script: string;
  readonly binDir: string;
  readonly callLog: string;
  cleanup(): void;
}

function setupFixture(opts: FixtureOptions): Fixture {
  const dir = mkdtempSync(path.join(tmpdir(), 'gates-validate-'));
  const git = (...args: string[]): string => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'tester@example.com');
  git('config', 'user.name', 'Tester');
  git('config', 'commit.gpgsign', 'false');
  writeFileSync(path.join(dir, '.gitignore'), 'bin/\ncalls.log\ngates.sh\n');
  git('add', '.gitignore');
  git('commit', '-q', '-m', 'seed');
  git('checkout', '-q', '-b', 'topic');
  opts.branchMessages.forEach((message, i) => {
    writeFileSync(path.join(dir, `f${i}.txt`), `${i}\n`);
    git('add', `f${i}.txt`);
    git('commit', '-q', '-m', message);
  });

  const script = path.join(dir, 'gates.sh');
  if (opts.scriptSource !== undefined) writeFileSync(script, opts.scriptSource);
  else copyFileSync(REAL_GATES, script);
  chmodSync(script, 0o755);

  const binDir = path.join(dir, 'bin');
  const stubDir = path.join(binDir, 'stubs');
  mkdirSync(stubDir, { recursive: true });
  const callLog = path.join(dir, 'calls.log');
  for (const target of ALL_TARGETS) {
    const code = opts.failing.includes(target) ? 1 : 0;
    const body = [
      '#!/usr/bin/env bash',
      `echo "${target} $*" >> ${JSON.stringify(callLog)}`,
      'for arg in "$@"; do',
      '  case "$arg" in',
      `    COMMIT_MSG_FILE=*) cat "\${arg#COMMIT_MSG_FILE=}" >> ${JSON.stringify(callLog)} ;;`,
      '  esac',
      'done',
      `echo "MARKER-${target}"`,
      `exit ${code}`,
      '',
    ].join('\n');
    const stub = path.join(stubDir, `${target}.sh`);
    writeFileSync(stub, body);
    chmodSync(stub, 0o755);
  }
  const shim = [
    '#!/usr/bin/env bash',
    'while [ "${1:-}" = "--no-print-directory" ]; do shift; done',
    'target="${1:-}"; shift',
    `stub=${JSON.stringify(stubDir)}/"$target".sh`,
    'if [ ! -x "$stub" ]; then echo "make shim: no stub for $target" >&2; exit 2; fi',
    'exec "$stub" "$@"',
    '',
  ].join('\n');
  writeFileSync(path.join(binDir, 'make'), shim);
  chmodSync(path.join(binDir, 'make'), 0o755);

  return { dir, script, binDir, callLog, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

interface Run { readonly code: number; readonly stdout: string; readonly stderr: string; }

function runGates(fx: Fixture, base = 'main'): Run {
  const r = spawnSync('bash', [fx.script], {
    cwd: fx.dir,
    env: { ...process.env, GATES_BASE: base, PATH: `${fx.binDir}:${process.env.PATH ?? ''}` },
    encoding: 'utf8',
  });
  return { code: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function calls(fx: Fixture): string {
  return existsSync(fx.callLog) ? readFileSync(fx.callLog, 'utf8') : '';
}

const TWO_FAILING = ['check-clone-duplication', 'check-anti-patterns'];

/** Scenario 1's assertions; an empty list means the run is a correct consolidated report. */
function consolidationProblems(run: Run): string[] {
  const out = run.stdout;
  const checks: Array<[string, boolean]> = [
    ['non-zero exit', run.code === 1],
    ['header "2 of 7 gate(s) failed"', /2 of 7 gate\(s\) failed/.test(out)],
    ['[FAIL] check-clone-duplication', /\[FAIL\] check-clone-duplication/.test(out)],
    ['[FAIL] check-anti-patterns', /\[FAIL\] check-anti-patterns/.test(out)],
    ['indented clone output', /^ {4}MARKER-check-clone-duplication/m.test(out)],
    ['indented anti-patterns output', /^ {4}MARKER-check-anti-patterns/m.test(out)],
    ...['check-css-duplication', 'check-chevron-sizing', 'check-adopters', 'check-editor-symmetry', 'check-disposition-survivor']
      .map((g): [string, boolean] => [`[PASS] ${g}`, out.includes(`[PASS] ${g}`)]),
  ];
  return checks.filter(([, ok]) => !ok).map(([why]) => why);
}

async function scenarioFailuresConsolidated(): Promise<ScenarioResult> {
  const name = 'failures-consolidated';
  const fx = setupFixture({ failing: TWO_FAILING, branchMessages: ['plain change'] });
  try {
    const run = runGates(fx);
    const problems = consolidationProblems(run);
    if (problems.length > 0) return fail(name, `${problems.join('; ')}\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`);
    return pass(name, 'exit 1; both failures reported with output, 5 passes listed');
  } finally {
    fx.cleanup();
  }
}

async function scenarioAllPass(): Promise<ScenarioResult> {
  const name = 'all-pass';
  const fx = setupFixture({ failing: [], branchMessages: ['plain change'] });
  try {
    const run = runGates(fx);
    if (run.code !== 0) return fail(name, `expected exit 0; got ${run.code}\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`);
    if (!/all 7 gate\(s\) passed/.test(run.stdout)) return fail(name, `expected "all 7 gate(s) passed"; stdout:\n${run.stdout}`);
    return pass(name, 'exit 0; all 7 gates reported passed');
  } finally {
    fx.cleanup();
  }
}

async function scenarioSurvivorGetsMergeBase(): Promise<ScenarioResult> {
  const name = 'survivor-gets-merge-base';
  const fx = setupFixture({ failing: [], branchMessages: ['plain change'] });
  try {
    const base = execFileSync('git', ['merge-base', 'main', 'HEAD'], { cwd: fx.dir, encoding: 'utf8' }).trim();
    runGates(fx);
    const line = calls(fx).split('\n').find((l) => l.startsWith('check-disposition-survivor '));
    if (line === undefined) return fail(name, `survivor gate never ran; calls:\n${calls(fx)}`);
    if (!line.includes(`SURVIVOR_ARGS=--head-ref ${base} --working-tree`)) {
      return fail(name, `expected SURVIVOR_ARGS with --head-ref ${base} --working-tree; got: ${line}`);
    }
    return pass(name, 'survivor compared the working tree against the merge base');
  } finally {
    fx.cleanup();
  }
}

async function scenarioRefactorMarkerCommitsOnly(): Promise<ScenarioResult> {
  const name = 'refactor-marker-commits-only';
  const fx = setupFixture({
    failing: [],
    branchMessages: ['unmarked change', 'refactor: extract primitive\n\nCloses clones.yaml abc123def456', 'another unmarked change'],
  });
  try {
    const run = runGates(fx);
    const log = calls(fx);
    const invocations = log.split('\n').filter((l) => l.startsWith('check-refactor-preconditions '));
    if (invocations.length !== 1) return fail(name, `expected 1 refactor-preconditions run; got ${invocations.length}\ncalls:\n${log}`);
    if (!log.includes('Closes clones.yaml abc123def456')) return fail(name, `marked commit's message not passed; calls:\n${log}`);
    if (log.includes('unmarked change')) return fail(name, `an unmarked commit's message reached the gate; calls:\n${log}`);
    if (!/all 8 gate\(s\) passed/.test(run.stdout)) return fail(name, `expected "all 8 gate(s) passed"; stdout:\n${run.stdout}`);
    return pass(name, 'one run, with the marked commit\'s message; unmarked commits skipped');
  } finally {
    fx.cleanup();
  }
}

async function scenarioMissingBaseFailsLoud(): Promise<ScenarioResult> {
  const name = 'missing-base-fails-loud';
  const fx = setupFixture({ failing: [], branchMessages: ['plain change'] });
  try {
    const run = runGates(fx, 'no-such-ref');
    if (run.code !== 2) return fail(name, `expected exit 2; got ${run.code}\nstderr:\n${run.stderr}`);
    if (!run.stderr.includes("'no-such-ref'")) return fail(name, `expected stderr to name the ref; got:\n${run.stderr}`);
    if (calls(fx) !== '') return fail(name, `no gate should run without a base; calls:\n${calls(fx)}`);
    return pass(name, 'exit 2 naming the missing ref; no gate ran');
  } finally {
    fx.cleanup();
  }
}

async function scenarioGuttedSelfCheck(): Promise<ScenarioResult> {
  const name = 'gutted-self-check';
  const fx = setupFixture({ failing: TWO_FAILING, branchMessages: ['plain change'], scriptSource: '#!/usr/bin/env bash\nexit 0\n' });
  try {
    if (consolidationProblems(runGates(fx)).length === 0) return fail(name, 'a no-op script satisfied scenario 1 — harness has no teeth');
    return pass(name, 'a no-op script fails scenario 1\'s assertions');
  } finally {
    fx.cleanup();
  }
}

const SCENARIOS: Array<() => Promise<ScenarioResult>> = [
  scenarioFailuresConsolidated,
  scenarioAllPass,
  scenarioSurvivorGetsMergeBase,
  scenarioRefactorMarkerCommitsOnly,
  scenarioMissingBaseFailsLoud,
  scenarioGuttedSelfCheck,
];

async function main(): Promise<number> {
  let failures = 0;
  for (const scenario of SCENARIOS) {
    let result: ScenarioResult;
    try {
      result = await scenario();
    } catch (err) {
      result = fail(scenario.name, `harness error: ${errorMessage(err)}`);
    }
    if (result.passed) console.log(`PASS  ${result.name}  ${result.detail}`);
    else {
      console.error(`FAIL  ${result.name}  ${result.detail}`);
      failures += 1;
    }
  }
  console.log(`\ngates: ${SCENARIOS.length - failures}/${SCENARIOS.length} scenarios passed`);
  return failures === 0 ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`infrastructure error: ${errorMessage(err)}`);
    process.exit(2);
  },
);
