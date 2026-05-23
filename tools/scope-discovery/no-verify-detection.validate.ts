/**
 * tools/scope-discovery/no-verify-detection.validate.ts
 *
 * Adversarial validator for the T7.5 `git commit --no-verify` bypass-
 * detection mechanism (per AUDIT-20260522-01 and AUDIT-20260522-03). The
 * mechanism comprises three tracked hooks:
 *
 *   - .githooks/pre-commit  — runs the static gates. Does NOT write the
 *     marker (per AUDIT-03; see below).
 *   - .githooks/commit-msg  — writes a transient `.pre-commit-marker` as
 *     its last successful action. SKIPPED by `--no-verify`. Moved here
 *     from pre-commit per AUDIT-03 to close a stale-marker hole.
 *   - .githooks/post-commit — converts marker → SHA-keyed sentinel.
 *     RUNS on every commit (including `--no-verify`); the marker check
 *     is what turns its presence into a signal.
 *   - .githooks/pre-push    — reads the sentinel; warns on stderr for
 *     any pushed SHA missing from it.
 *
 * The earliest design wrote the sentinel unconditionally from post-commit
 * and claimed missing-sentinel proved `--no-verify`. That was false because
 * post-commit RUNS on `--no-verify`. AUDIT-01's fix moved the marker write
 * to pre-commit; AUDIT-03 then found a stale-marker hole — a failed
 * commit-msg (or other later hook) could strand the marker for a
 * subsequent `--no-verify` commit to inherit. AUDIT-03's fix moves the
 * marker write to commit-msg (which runs after pre-commit succeeds and
 * immediately before the atomic commit landing — no abort window).
 *
 * Scenarios:
 *   1. normal-commit-recorded
 *        Make a normal commit; assert the sentinel file contains HEAD's SHA.
 *   2. noverify-commit-not-recorded
 *        Make a `--no-verify` commit; assert the sentinel does NOT contain
 *        HEAD's SHA.
 *   3. pre-push-warns-on-bypassed-sha
 *        Run pre-push against a synthetic push range covering both commits;
 *        assert stderr mentions the bypassed SHA and NOT the normal SHA,
 *        and assert exit 0 (warning-only design).
 *   4. stale-marker-from-aborted-commit  (AUDIT-20260522-03)
 *        Simulate a failed commit-msg (gate aborts before marker write),
 *        then a subsequent `git commit --no-verify`. Assert the sentinel
 *        does NOT contain the bypassed SHA. With the AUDIT-01 architecture
 *        (marker written by pre-commit), this scenario would have failed
 *        because the marker outlived the aborted commit.
 *
 * Adversarial self-check (Level 1, fully-gutted detector):
 *   Replace .githooks/commit-msg with a no-op that DOES NOT write the
 *   marker. Re-run scenario 1; the assertion (sentinel contains the
 *   normal-commit SHA) MUST fail. If it passes, the harness has no teeth
 *   — the sentinel is being written via some other path and the
 *   detector cannot actually distinguish bypass from non-bypass.
 *
 * Run via:
 *   tsx tools/scope-discovery/no-verify-detection.validate.ts
 *   make check-no-verify-detection-validate
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { errorMessage } from './util/typeguards.js';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const HOOKS_SRC = path.join(REPO_ROOT, '.githooks');

// ---------------------------------------------------------------------------
// Scenario result shape (mirrors dispatch-wrapper.validate.ts).
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Fixture setup — create a throwaway git repo wired with our four hooks.
// Per AUDIT-20260522-03, the marker is written by commit-msg (not
// pre-commit). The commit-msg stub here mimics that contract; the real
// .githooks/commit-msg also writes the marker as its last successful
// action, so the stub is a faithful structural simulation that doesn't
// drag in the make targets the real hook calls.
// ---------------------------------------------------------------------------

const PRE_COMMIT_STUB_NOOP = `#!/usr/bin/env bash
# Static-gate placeholder. Per AUDIT-03 the marker is NOT written here.
set -euo pipefail
`;

const COMMIT_MSG_STUB_WRITES_MARKER = `#!/usr/bin/env bash
set -euo pipefail
SENTINEL_DIR="$(git rev-parse --git-common-dir)/hooks-sentinels"
mkdir -p "$SENTINEL_DIR"
: > "$SENTINEL_DIR/.pre-commit-marker"
`;

const COMMIT_MSG_STUB_GUTTED = `#!/usr/bin/env bash
# Adversarial gutted stub — exits 0 without writing the marker.
# Used in the self-check to prove the harness has teeth.
set -euo pipefail
`;

const COMMIT_MSG_STUB_ABORTS = `#!/usr/bin/env bash
# Simulates a commit-msg gate (e.g., refactor-preconditions) aborting the
# commit BEFORE the marker write. With the AUDIT-03 architecture the marker
# write is the last action after any abortable gate, so an early exit must
# leave no marker on disk.
set -euo pipefail
echo "commit-msg: simulated gate failure" >&2
exit 1
`;

interface FixtureOptions {
  readonly preCommit: string;
  readonly commitMsg: string;
}

interface Fixture {
  readonly dir: string;
  readonly sentinelFile: string;
  readonly markerFile: string;
  cleanup(): void;
}

function setupFixture(opts: FixtureOptions): Fixture {
  const dir = mkdtempSync(path.join(tmpdir(), 'no-verify-detection-'));
  const git = (...args: string[]): string =>
    execFileSync('git', args, { cwd: dir, encoding: 'utf8' });

  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'tester@example.com');
  git('config', 'user.name', 'Tester');
  git('config', 'commit.gpgsign', 'false');

  const hooksDir = path.join(dir, '.githooks');
  mkdirSync(hooksDir, { recursive: true });

  const writeHook = (name: string, content: string): void => {
    const hookPath = path.join(hooksDir, name);
    writeFileSync(hookPath, content);
    chmodSync(hookPath, 0o755);
  };
  const copyHook = (name: string): void => {
    const hookPath = path.join(hooksDir, name);
    copyFileSync(path.join(HOOKS_SRC, name), hookPath);
    chmodSync(hookPath, 0o755);
  };

  writeHook('pre-commit', opts.preCommit);
  writeHook('commit-msg', opts.commitMsg);
  copyHook('post-commit');
  copyHook('pre-push');

  git('config', 'core.hooksPath', '.githooks');

  const gitCommonDir = git('rev-parse', '--git-common-dir').trim();
  const gitCommonAbs = path.isAbsolute(gitCommonDir)
    ? gitCommonDir
    : path.join(dir, gitCommonDir);
  const sentinelDir = path.join(gitCommonAbs, 'hooks-sentinels');
  const sentinelFile = path.join(sentinelDir, '.pre-commit-passed');
  const markerFile = path.join(sentinelDir, '.pre-commit-marker');

  return {
    dir,
    sentinelFile,
    markerFile,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

const HAPPY_FIXTURE_OPTS: FixtureOptions = {
  preCommit: PRE_COMMIT_STUB_NOOP,
  commitMsg: COMMIT_MSG_STUB_WRITES_MARKER,
};

function makeCommit(fixture: Fixture, fileName: string, content: string, opts: { noVerify: boolean }): string {
  writeFileSync(path.join(fixture.dir, fileName), content);
  execFileSync('git', ['add', fileName], { cwd: fixture.dir });
  const commitArgs = ['commit', '-q'];
  if (opts.noVerify) commitArgs.push('--no-verify');
  commitArgs.push('-m', opts.noVerify ? 'bypass commit' : 'normal commit');
  execFileSync('git', commitArgs, { cwd: fixture.dir });
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: fixture.dir, encoding: 'utf8' }).trim();
}

// Attempt a commit whose commit-msg stub aborts. Returns true if the commit
// did NOT land (the expected outcome); false if it landed unexpectedly.
function attemptAbortedCommit(fixture: Fixture, fileName: string, content: string): boolean {
  writeFileSync(path.join(fixture.dir, fileName), content);
  execFileSync('git', ['add', fileName], { cwd: fixture.dir });
  const result = spawnSync('git', ['commit', '-q', '-m', 'will-abort'], {
    cwd: fixture.dir,
    encoding: 'utf8',
  });
  return result.status !== 0;
}

function readSentinel(fixture: Fixture): string {
  try {
    return readFileSync(fixture.sentinelFile, 'utf8');
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

async function scenarioNormalCommitRecorded(): Promise<ScenarioResult> {
  const name = 'normal-commit-recorded';
  const fixture = setupFixture(HAPPY_FIXTURE_OPTS);
  try {
    const sha = makeCommit(fixture, 'a.txt', 'a\n', { noVerify: false });
    const sentinel = readSentinel(fixture);
    if (!sentinel.split('\n').includes(sha)) {
      return fail(name, `sentinel missing SHA ${sha}; contents: ${JSON.stringify(sentinel)}`);
    }
    return pass(name, `sentinel records SHA ${sha} after normal commit`);
  } finally {
    fixture.cleanup();
  }
}

async function scenarioNoverifyCommitNotRecorded(): Promise<ScenarioResult> {
  const name = 'noverify-commit-not-recorded';
  const fixture = setupFixture(HAPPY_FIXTURE_OPTS);
  try {
    const sha = makeCommit(fixture, 'b.txt', 'b\n', { noVerify: true });
    const sentinel = readSentinel(fixture);
    if (sentinel.split('\n').includes(sha)) {
      return fail(name, `sentinel unexpectedly contains --no-verify SHA ${sha}; contents: ${JSON.stringify(sentinel)}`);
    }
    return pass(name, `sentinel does not record SHA ${sha} after --no-verify commit`);
  } finally {
    fixture.cleanup();
  }
}

async function scenarioPrePushWarnsOnBypassed(): Promise<ScenarioResult> {
  const name = 'pre-push-warns-on-bypassed-sha';
  const fixture = setupFixture(HAPPY_FIXTURE_OPTS);
  try {
    const shaNormal = makeCommit(fixture, 'a.txt', 'a\n', { noVerify: false });
    const shaBypass = makeCommit(fixture, 'b.txt', 'b\n', { noVerify: true });
    const zero = '0000000000000000000000000000000000000000';
    const stdin = `refs/heads/main ${shaBypass} refs/heads/main ${zero}\n`;
    const prePushPath = path.join(fixture.dir, '.githooks', 'pre-push');
    const result = spawnSync('bash', [prePushPath], {
      cwd: fixture.dir,
      input: stdin,
      encoding: 'utf8',
    });
    if (result.status !== 0) {
      return fail(name, `pre-push exited non-zero (${result.status}); stderr: ${result.stderr}`);
    }
    const shortBypass = execFileSync('git', ['rev-parse', '--short', shaBypass], {
      cwd: fixture.dir,
      encoding: 'utf8',
    }).trim();
    const shortNormal = execFileSync('git', ['rev-parse', '--short', shaNormal], {
      cwd: fixture.dir,
      encoding: 'utf8',
    }).trim();
    if (!result.stderr.includes(shortBypass)) {
      return fail(name, `pre-push stderr does not mention bypassed SHA ${shortBypass}; stderr: ${result.stderr}`);
    }
    if (result.stderr.includes(shortNormal)) {
      return fail(name, `pre-push stderr mentions normal SHA ${shortNormal} (false positive); stderr: ${result.stderr}`);
    }
    return pass(name, `pre-push warns on ${shortBypass} and not on ${shortNormal}`);
  } finally {
    fixture.cleanup();
  }
}

// ---------------------------------------------------------------------------
// Adversarial self-check — replace pre-commit with the gutted stub.
// If scenario 1 still passes, the sentinel is being written via some
// path other than the marker conversion, so the detector has no teeth.
// ---------------------------------------------------------------------------

async function scenarioGuttedDetectorSelfCheck(): Promise<ScenarioResult> {
  const name = 'gutted-detector-self-check';
  const fixture = setupFixture({
    preCommit: PRE_COMMIT_STUB_NOOP,
    commitMsg: COMMIT_MSG_STUB_GUTTED,
  });
  try {
    const sha = makeCommit(fixture, 'a.txt', 'a\n', { noVerify: false });
    const sentinel = readSentinel(fixture);
    if (sentinel.split('\n').includes(sha)) {
      return fail(
        name,
        `with gutted commit-msg (no marker write), sentinel STILL recorded SHA ${sha} — detector has no teeth, contents: ${JSON.stringify(sentinel)}`,
      );
    }
    return pass(
      name,
      `with gutted commit-msg, sentinel correctly does NOT record SHA ${sha} — marker is load-bearing`,
    );
  } finally {
    fixture.cleanup();
  }
}

// AUDIT-20260522-03 — failed commit-msg must not strand the marker.
// Simulate: pre-commit succeeds, commit-msg's gate aborts (commit dies),
// then operator runs `git commit --no-verify`. The bypass SHA must NOT
// appear in the sentinel. Under the AUDIT-01 architecture (marker written
// by pre-commit), this scenario fails because the aborted commit-msg leaves
// the marker behind for the subsequent --no-verify commit's post-commit to
// consume.
async function scenarioStaleMarkerFromAbortedCommit(): Promise<ScenarioResult> {
  const name = 'stale-marker-from-aborted-commit';
  // First fixture phase: use the abort-on-commit-msg stub so the first
  // commit fails and never writes the marker.
  const fixture = setupFixture({
    preCommit: PRE_COMMIT_STUB_NOOP,
    commitMsg: COMMIT_MSG_STUB_ABORTS,
  });
  try {
    const aborted = attemptAbortedCommit(fixture, 'a.txt', 'a\n');
    if (!aborted) {
      return fail(name, 'commit-msg ABORTS stub did not actually abort the commit');
    }
    // Stale-marker check: with the AUDIT-03 architecture (marker written
    // by commit-msg as its last action), the failed commit-msg must NOT
    // have left a marker on disk.
    const markerStranded = (() => {
      try {
        readFileSync(fixture.markerFile);
        return true;
      } catch {
        return false;
      }
    })();
    if (markerStranded) {
      return fail(
        name,
        'failed commit-msg STRANDED .pre-commit-marker on disk — stale-marker hole still present',
      );
    }
    // Now run a --no-verify commit. With no stale marker, post-commit must
    // not record this SHA.
    const bypassSha = makeCommit(fixture, 'b.txt', 'b\n', { noVerify: true });
    const sentinel = readSentinel(fixture);
    if (sentinel.split('\n').includes(bypassSha)) {
      return fail(
        name,
        `--no-verify SHA ${bypassSha} inherited a stale marker and was recorded; contents: ${JSON.stringify(sentinel)}`,
      );
    }
    return pass(
      name,
      `failed commit-msg leaves no marker; subsequent --no-verify SHA ${bypassSha} correctly not recorded`,
    );
  } finally {
    fixture.cleanup();
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const SCENARIOS: Array<() => Promise<ScenarioResult>> = [
  scenarioNormalCommitRecorded,
  scenarioNoverifyCommitNotRecorded,
  scenarioPrePushWarnsOnBypassed,
  scenarioGuttedDetectorSelfCheck,
  scenarioStaleMarkerFromAbortedCommit,
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
  console.log(`\nno-verify-detection: ${passed}/${total} scenarios passed`);
  return failures === 0 ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`infrastructure error: ${errorMessage(err)}`);
    process.exit(2);
  },
);
