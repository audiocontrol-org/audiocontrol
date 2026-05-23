/**
 * tools/scope-discovery/check-refactor-preconditions.runtime.ts
 *
 * Runtime-check primitives extracted from check-refactor-preconditions.ts
 * so the host file stays under the 300-500 line cap (per ~/work/CLAUDE.md).
 *
 * The host file is the gate's CLI entry + commit-message parsing +
 * baseline-loading orchestration; THIS file is the per-precondition
 * verification logic (canonical_side file-existence, tests_proof.sha
 * resolution, tests[] command execution). Splitting along that seam
 * also lets the adversarial validator harness import the runtime
 * primitives directly without spawning subprocesses.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { hasRefactorDisposition, type CloneGroup } from './clones-yaml.js';
import { errorMessage } from './util/typeguards.js';

export interface PreconditionError {
  readonly cloneId: string;
  readonly field: string;
  readonly detail: string;
  readonly nextStep: string;
}

export function preconditionError(
  cloneId: string,
  field: string,
  detail: string,
  nextStep: string,
): PreconditionError {
  return { cloneId, field, detail, nextStep };
}

export interface RuntimeCheckOptions {
  readonly repoRoot: string;
  readonly testTimeoutSeconds: number;
  readonly skipTestRun: boolean;
}

/**
 * Check the per-group preconditions that go BEYOND parse-time validation:
 *   - canonical_side file-existence (when canonical_side is a path, not
 *     "all" or "new").
 *   - tests_proof.sha resolves via `git rev-parse`.
 *   - each named tests[] entry exits 0 when run at HEAD (unless
 *     skipTestRun is set, in which case we still validate that each
 *     command is a non-empty string).
 */
export function checkRuntimePreconditions(
  group: CloneGroup,
  opts: RuntimeCheckOptions,
): readonly PreconditionError[] {
  if (!hasRefactorDisposition(group)) {
    throw new Error(
      `checkRuntimePreconditions invoked on non-refactor group ${group.id} ` +
        `(disposition: ${group.disposition})`,
    );
  }
  const errors: PreconditionError[] = [];
  errors.push(...checkCanonicalSide(group, opts));
  errors.push(...checkTestsProofSha(group, opts));
  if (!opts.skipTestRun) {
    errors.push(...checkTestCommands(group, opts));
  }
  return errors;
}

function checkCanonicalSide(
  group: CloneGroup,
  opts: RuntimeCheckOptions,
): readonly PreconditionError[] {
  if (!hasRefactorDisposition(group)) return [];
  if (group.canonical_side === 'all' || group.canonical_side === 'new') return [];
  const filePath = resolve(opts.repoRoot, group.canonical_side);
  if (existsSync(filePath)) return [];
  return [
    preconditionError(
      group.id,
      'canonical_side',
      `canonical_side points to a file that does not exist: ${group.canonical_side}`,
      `Restore the file at ${group.canonical_side}, OR update the entry's ` +
        `canonical_side to "all"/"new" + supply new_shape_summary, OR fix the path typo.`,
    ),
  ];
}

function checkTestsProofSha(
  group: CloneGroup,
  opts: RuntimeCheckOptions,
): readonly PreconditionError[] {
  if (!hasRefactorDisposition(group)) return [];
  const result = spawnSync(
    'git',
    ['rev-parse', '--verify', `${group.tests_proof.sha}^{commit}`],
    { cwd: opts.repoRoot, encoding: 'utf8' },
  );
  if (result.status === 0) return [];
  return [
    preconditionError(
      group.id,
      'tests_proof.sha',
      `tests_proof.sha '${group.tests_proof.sha}' does not resolve to a ` +
        `reachable commit in this repository.`,
      `Verify the SHA is correct (and present in git history). The SHA must ` +
        `point to a commit that demonstrated the test failing before the ` +
        `canonical-side restoration. Run 'git rev-parse ${group.tests_proof.sha}' ` +
        `to confirm.`,
    ),
  ];
}

function checkTestCommands(
  group: CloneGroup,
  opts: RuntimeCheckOptions,
): readonly PreconditionError[] {
  if (!hasRefactorDisposition(group)) return [];
  const errors: PreconditionError[] = [];
  for (let i = 0; i < group.tests.length; i += 1) {
    const cmd = group.tests[i];
    if (cmd === undefined || cmd.length === 0) {
      errors.push(
        preconditionError(
          group.id,
          `tests[${i}]`,
          `tests[${i}] is empty after parse — internal invariant violation.`,
          `Re-run parse validation; if this persists, the baseline file is ` +
            `corrupt — restore from git history.`,
        ),
      );
      continue;
    }
    const result = spawnSync(cmd, {
      cwd: opts.repoRoot,
      shell: true,
      encoding: 'utf8',
      timeout: opts.testTimeoutSeconds * 1000,
    });
    if (result.error !== undefined) {
      errors.push(testCommandSpawnError(group.id, i, cmd, opts, result.error));
      continue;
    }
    if (result.status !== 0) {
      const excerpt = collectOutputExcerpt(result.stdout, result.stderr);
      errors.push(
        preconditionError(
          group.id,
          `tests[${i}]`,
          `test command exited ${result.status ?? 'signal'}: ${cmd}\n` +
            `      excerpt:\n${excerpt}`,
          `The refactor's safety-net test is failing at HEAD. Restore the ` +
            `canonical side OR fix the test before retrying the commit. The ` +
            `refactor-precondition gate REQUIRES the test passes after the ` +
            `refactor lands.`,
        ),
      );
    }
  }
  return errors;
}

function testCommandSpawnError(
  cloneId: string,
  index: number,
  cmd: string,
  opts: RuntimeCheckOptions,
  spawnErr: Error,
): PreconditionError {
  const errMsg = errorMessage(spawnErr);
  if (errMsg.includes('ETIMEDOUT') || errMsg.toLowerCase().includes('timed out')) {
    return preconditionError(
      cloneId,
      `tests[${index}]`,
      `test command timed out after ${opts.testTimeoutSeconds}s: ${cmd}`,
      `Either the test is genuinely slow (raise --test-timeout-seconds) or ` +
        `hangs on missing fixtures/hardware. Run the command manually to diagnose.`,
    );
  }
  return preconditionError(
    cloneId,
    `tests[${index}]`,
    `test command failed to spawn: ${cmd} (${errMsg})`,
    `Confirm the command is installed (pnpm/tsx/make on PATH) and the ` +
      `command string is valid shell.`,
  );
}

function collectOutputExcerpt(stdout: string, stderr: string): string {
  // First 20 lines of combined output — enough to identify the failing
  // assertion, not so much that the gate's rejection message becomes
  // unreadable.
  const combined = (stdout ?? '') + (stderr ?? '');
  const lines = combined.split(/\r?\n/).filter((l) => l.length > 0);
  const slice = lines.slice(0, 20);
  return slice.map((l) => `        ${l}`).join('\n');
}
