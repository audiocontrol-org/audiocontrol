/**
 * tools/scope-discovery/no-verify-detection.validate.ts
 *
 * Adversarial validator for the T7.5 `git commit --no-verify` bypass-
 * detection mechanism (per AUDIT-20260522-01). The mechanism comprises
 * three tracked hooks:
 *
 *   - .githooks/pre-commit  — writes a transient marker as its last
 *     successful action. SKIPPED by `--no-verify`.
 *   - .githooks/post-commit — converts marker → SHA-keyed sentinel.
 *     RUNS on every commit (including `--no-verify`); the marker check
 *     is what turns its presence into a signal.
 *   - .githooks/pre-push    — reads the sentinel; warns on stderr for
 *     any pushed SHA missing from it.
 *
 * The earlier design wrote the sentinel unconditionally from post-commit
 * and claimed missing-sentinel proved `--no-verify`. That was false because
 * post-commit RUNS on `--no-verify`. This validator nails the corrected
 * mechanism against synthetic fixtures so a future refactor can't silently
 * regress it.
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
 *
 * Adversarial self-check (Level 1, fully-gutted detector):
 *   Replace .githooks/pre-commit with a no-op that DOES NOT write the
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
// Fixture setup — create a throwaway git repo wired with our three hooks.
// The pre-commit stub mimics the marker-write contract; the real pre-commit
// in .githooks/pre-commit also writes the marker as its last action, so
// the stub is a faithful structural simulation that doesn't drag in the
// make targets the real hook calls.
// ---------------------------------------------------------------------------

const PRE_COMMIT_STUB_WRITES_MARKER = `#!/usr/bin/env bash
set -euo pipefail
SENTINEL_DIR="$(git rev-parse --git-common-dir)/hooks-sentinels"
mkdir -p "$SENTINEL_DIR"
: > "$SENTINEL_DIR/.pre-commit-marker"
`;

const PRE_COMMIT_STUB_GUTTED = `#!/usr/bin/env bash
# Adversarial gutted stub — exits 0 without writing the marker.
# Used in the self-check to prove the harness has teeth.
set -euo pipefail
`;

interface Fixture {
  readonly dir: string;
  readonly sentinelFile: string;
  cleanup(): void;
}

function setupFixture(preCommitContent: string): Fixture {
  const dir = mkdtempSync(path.join(tmpdir(), 'no-verify-detection-'));
  const git = (...args: string[]): string =>
    execFileSync('git', args, { cwd: dir, encoding: 'utf8' });

  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'tester@example.com');
  git('config', 'user.name', 'Tester');
  git('config', 'commit.gpgsign', 'false');

  const hooksDir = path.join(dir, '.githooks');
  mkdirSync(hooksDir, { recursive: true });

  const preCommitPath = path.join(hooksDir, 'pre-commit');
  writeFileSync(preCommitPath, preCommitContent);
  chmodSync(preCommitPath, 0o755);

  const postCommitPath = path.join(hooksDir, 'post-commit');
  copyFileSync(path.join(HOOKS_SRC, 'post-commit'), postCommitPath);
  chmodSync(postCommitPath, 0o755);

  const prePushPath = path.join(hooksDir, 'pre-push');
  copyFileSync(path.join(HOOKS_SRC, 'pre-push'), prePushPath);
  chmodSync(prePushPath, 0o755);

  git('config', 'core.hooksPath', '.githooks');

  const gitCommonDir = git('rev-parse', '--git-common-dir').trim();
  const gitCommonAbs = path.isAbsolute(gitCommonDir)
    ? gitCommonDir
    : path.join(dir, gitCommonDir);
  const sentinelFile = path.join(gitCommonAbs, 'hooks-sentinels', '.pre-commit-passed');

  return {
    dir,
    sentinelFile,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

function makeCommit(fixture: Fixture, fileName: string, content: string, opts: { noVerify: boolean }): string {
  writeFileSync(path.join(fixture.dir, fileName), content);
  execFileSync('git', ['add', fileName], { cwd: fixture.dir });
  const commitArgs = ['commit', '-q'];
  if (opts.noVerify) commitArgs.push('--no-verify');
  commitArgs.push('-m', opts.noVerify ? 'bypass commit' : 'normal commit');
  execFileSync('git', commitArgs, { cwd: fixture.dir });
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: fixture.dir, encoding: 'utf8' }).trim();
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
  const fixture = setupFixture(PRE_COMMIT_STUB_WRITES_MARKER);
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
  const fixture = setupFixture(PRE_COMMIT_STUB_WRITES_MARKER);
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
  const fixture = setupFixture(PRE_COMMIT_STUB_WRITES_MARKER);
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
  const fixture = setupFixture(PRE_COMMIT_STUB_GUTTED);
  try {
    const sha = makeCommit(fixture, 'a.txt', 'a\n', { noVerify: false });
    const sentinel = readSentinel(fixture);
    if (sentinel.split('\n').includes(sha)) {
      return fail(
        name,
        `with gutted pre-commit (no marker write), sentinel STILL recorded SHA ${sha} — detector has no teeth, contents: ${JSON.stringify(sentinel)}`,
      );
    }
    return pass(
      name,
      `with gutted pre-commit, sentinel correctly does NOT record SHA ${sha} — marker is load-bearing`,
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
