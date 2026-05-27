/**
 * tools/scope-discovery/disposition-survivor.gate-scenarios.ts
 *
 * AUDIT-20260524-14 Heavy-backstop scenarios for the
 * `check-disposition-survivor` pre-commit gate. Split out of
 * `disposition-survivor.validate.ts` so the host stays under the
 * 300-500 line cap; the Light-fix scenarios stay in the host (they
 * exercise the strict-parse + refresh-baseline path, which is a
 * different surface).
 *
 * Each scenario builds a throwaway git repo under `mktemp`, commits
 * a HEAD version of clones.yaml, stages a modified version, then
 * runs the gate and asserts on exit code + stderr signatures.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export interface ScenarioResult {
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

interface GateRun { code: number | null; stdout: string; stderr: string; }

interface GitFixture {
  readonly dir: string;
  readonly baseline: string;
}

/**
 * Build a throwaway git repo with the local user config isolated from
 * the host. Returns the absolute fixture root + the CWD-relative baseline
 * path the gate inspects (default: `docs/scope-discovery/clones.yaml`).
 */
function makeGitFixture(label: string): GitFixture {
  const dir = mkdtempSync(path.join(tmpdir(), `disposition-survivor-${label}-`));
  execFileSync('git', ['init', '--initial-branch=main', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'survivor-test@example.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Survivor Test'], { cwd: dir });
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: dir });
  const baselineRel = 'docs/scope-discovery/clones.yaml';
  mkdirSync(path.join(dir, 'docs', 'scope-discovery'), { recursive: true });
  return { dir, baseline: baselineRel };
}

function runSurvivorGate(survivorEntry: string, cwd: string, args: readonly string[] = []): GateRun {
  const result = spawnSync('tsx', [survivorEntry, ...args], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    env: process.env,
  });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

const HEAD_YAML_WITH_KEEP = `generated_at: 2026-05-24T00:00:00Z
clones:
  - id: aaaaaaaaaaaa
    lines: 7
    members:
      - modules/foo/a.ts:1:7
      - modules/foo/b.ts:1:7
    disposition: keep-with-reason
    reason: |
      Multi-paragraph reason the operator wrote.

      The second paragraph naming the trade-off.
  - id: bbbbbbbbbbbb
    lines: 7
    members:
      - modules/bar/a.ts:1:7
      - modules/bar/b.ts:1:7
    disposition: pending
    reason: null
`;

const STAGED_YAML_REVERTS_KEEP = `generated_at: 2026-05-24T01:00:00Z
clones:
  - id: aaaaaaaaaaaa
    lines: 7
    members:
      - modules/foo/a.ts:1:7
      - modules/foo/b.ts:1:7
    disposition: pending
    reason: null
  - id: bbbbbbbbbbbb
    lines: 7
    members:
      - modules/bar/a.ts:1:7
      - modules/bar/b.ts:1:7
    disposition: pending
    reason: null
`;

const STAGED_YAML_ADDS_PENDING = `generated_at: 2026-05-24T01:00:00Z
clones:
  - id: aaaaaaaaaaaa
    lines: 7
    members:
      - modules/foo/a.ts:1:7
      - modules/foo/b.ts:1:7
    disposition: keep-with-reason
    reason: |
      Multi-paragraph reason the operator wrote.

      The second paragraph naming the trade-off.
  - id: bbbbbbbbbbbb
    lines: 7
    members:
      - modules/bar/a.ts:1:7
      - modules/bar/b.ts:1:7
    disposition: pending
    reason: null
  - id: cccccccccccc
    lines: 7
    members:
      - modules/baz/a.ts:1:7
      - modules/baz/b.ts:1:7
    disposition: pending
    reason: null
`;

const STAGED_YAML_PROTECTED_TO_PROTECTED = `generated_at: 2026-05-24T01:00:00Z
clones:
  - id: aaaaaaaaaaaa
    lines: 7
    members:
      - modules/foo/a.ts:1:7
      - modules/foo/b.ts:1:7
    disposition: ignore-with-justification
    reason: |
      Reclassified — no longer "keep" but still not pending.
  - id: bbbbbbbbbbbb
    lines: 7
    members:
      - modules/bar/a.ts:1:7
      - modules/bar/b.ts:1:7
    disposition: pending
    reason: null
`;

/**
 * Commit `headContent` to HEAD, then stage `stagedContent` over it.
 * Leaves the working tree + index in the state the gate inspects.
 */
function setupHeadAndStaged(fix: GitFixture, headContent: string, stagedContent: string): void {
  const absBaseline = path.join(fix.dir, fix.baseline);
  writeFileSync(absBaseline, headContent, 'utf8');
  execFileSync('git', ['add', fix.baseline], { cwd: fix.dir });
  execFileSync('git', ['commit', '-q', '-m', 'baseline'], { cwd: fix.dir });
  writeFileSync(absBaseline, stagedContent, 'utf8');
  execFileSync('git', ['add', fix.baseline], { cwd: fix.dir });
}

export async function scenarioGateBlocksLossDiff(survivorEntry: string): Promise<ScenarioResult> {
  const name = 'disposition-survivor gate blocks keep-with-reason → pending transition';
  const fix = makeGitFixture('block');
  try {
    setupHeadAndStaged(fix, HEAD_YAML_WITH_KEEP, STAGED_YAML_REVERTS_KEEP);
    const r = runSurvivorGate(survivorEntry, fix.dir);
    if (r.code !== 1) {
      return fail(name, `expected exit 1; got ${r.code}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
    }
    if (!r.stderr.includes('aaaaaaaaaaaa')) {
      return fail(name, `expected stderr to name id "aaaaaaaaaaaa"; got:\n${r.stderr}`);
    }
    if (!r.stderr.includes('keep-with-reason')) {
      return fail(name, `expected stderr to name "keep-with-reason"; got:\n${r.stderr}`);
    }
    if (!r.stderr.includes('pending')) {
      return fail(name, `expected stderr to name "pending"; got:\n${r.stderr}`);
    }
    if (!r.stderr.includes('--force')) {
      return fail(name, `expected stderr to name "--force" override path; got:\n${r.stderr}`);
    }
    return pass(name, 'gate exited 1, named the id + transition + override path');
  } finally {
    rmSync(fix.dir, { recursive: true, force: true });
  }
}

export async function scenarioGateAllowsLegitimateAdditions(survivorEntry: string): Promise<ScenarioResult> {
  const name = 'disposition-survivor gate allows new pending entries (no loss diff)';
  const fix = makeGitFixture('allow-add');
  try {
    setupHeadAndStaged(fix, HEAD_YAML_WITH_KEEP, STAGED_YAML_ADDS_PENDING);
    const r = runSurvivorGate(survivorEntry, fix.dir);
    if (r.code !== 0) {
      return fail(name, `expected exit 0; got ${r.code}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
    }
    return pass(name, 'gate exited 0 — adding a fresh pending entry is not a loss');
  } finally {
    rmSync(fix.dir, { recursive: true, force: true });
  }
}

export async function scenarioGateAllowsProtectedChanges(survivorEntry: string): Promise<ScenarioResult> {
  const name = 'disposition-survivor gate allows protected → protected transitions';
  const fix = makeGitFixture('protected');
  try {
    setupHeadAndStaged(fix, HEAD_YAML_WITH_KEEP, STAGED_YAML_PROTECTED_TO_PROTECTED);
    const r = runSurvivorGate(survivorEntry, fix.dir);
    if (r.code !== 0) {
      return fail(name, `expected exit 0; got ${r.code}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
    }
    return pass(name, 'gate exited 0 — keep → ignore-with-justification is a reclassification, not a loss');
  } finally {
    rmSync(fix.dir, { recursive: true, force: true });
  }
}

export async function scenarioGateForceOverride(survivorEntry: string): Promise<ScenarioResult> {
  const name = 'disposition-survivor gate --force override accepts loss diff';
  const fix = makeGitFixture('force');
  try {
    setupHeadAndStaged(fix, HEAD_YAML_WITH_KEEP, STAGED_YAML_REVERTS_KEEP);
    const r = runSurvivorGate(survivorEntry, fix.dir, ['--force']);
    if (r.code !== 0) {
      return fail(name, `expected exit 0 under --force; got ${r.code}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
    }
    if (!r.stderr.includes('--force override')) {
      return fail(name, `expected stderr to acknowledge --force override; got:\n${r.stderr}`);
    }
    if (!r.stderr.includes('aaaaaaaaaaaa')) {
      return fail(name, `expected stderr to name the overridden id; got:\n${r.stderr}`);
    }
    return pass(name, 'gate exited 0 under --force; override warning emitted with id detail');
  } finally {
    rmSync(fix.dir, { recursive: true, force: true });
  }
}

/**
 * Adversarial self-check: stub the gate with a no-op `exit 0` shell
 * script and re-run scenario 4's assertions against it. If the
 * assertions pass against the stub, the harness has no teeth.
 */
export async function scenarioGuttedStubSelfCheck(_survivorEntry: string): Promise<ScenarioResult> {
  const name = 'gutted-stub self-check: a no-op gate MUST fail scenario 4';
  const fix = makeGitFixture('gutted');
  try {
    setupHeadAndStaged(fix, HEAD_YAML_WITH_KEEP, STAGED_YAML_REVERTS_KEEP);
    const stubPath = path.join(fix.dir, 'stub-gate.sh');
    writeFileSync(stubPath, '#!/usr/bin/env bash\nexit 0\n', { mode: 0o755 });
    const result = spawnSync(stubPath, [], {
      cwd: fix.dir,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
    const stub: GateRun = { code: result.status, stdout: result.stdout, stderr: result.stderr };
    if (stub.code === 1 && stub.stderr.includes('aaaaaaaaaaaa')) {
      return fail(name, 'stub passed scenario-4 assertions — harness has no teeth');
    }
    return pass(name, 'gutted stub correctly failed scenario-4 assertions (exit 0, no id in stderr)');
  } finally {
    rmSync(fix.dir, { recursive: true, force: true });
  }
}
