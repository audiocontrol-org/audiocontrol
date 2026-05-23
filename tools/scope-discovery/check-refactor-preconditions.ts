/**
 * tools/scope-discovery/check-refactor-preconditions.ts
 *
 * Workplan T5.3 — gate that mechanically enforces the Phase 5 refactor-
 * precondition protocol on commits whose message names one or more
 * clones.yaml entries (`Closes clones.yaml <id>`). Layers four runtime
 * checks on top of T5.1's parse-time validateRefactorPreconditions:
 *   (a) canonical_side file-existence (when not "all"/"new")
 *   (b) tests_proof.sha resolves via git rev-parse
 *   (c) named tests[] commands exit 0 at HEAD
 *   (d) parse-time T5.1 errors surface verbatim
 *
 * Wired via .githooks/commit-msg (the commit-msg hook receives the
 * message file path as $1; pre-commit doesn't). Silent on commits
 * without a marker. Runtime primitives extracted to
 * check-refactor-preconditions.runtime.ts (file-cap split).
 *
 * Invocation flags:
 *   --commit-msg-file <path>      read commit message from file
 *   --commit-msg <text>           inline message (test-only)
 *   --baseline <path>             override docs/scope-discovery/clones.yaml
 *   --repo <path>                 override repo root (test-only)
 *   --test-timeout-seconds <n>    per-test timeout (default: 300)
 *   --skip-test-run               skip running tests (test-only)
 *
 * Exit codes: 0 silent/clean, 1 precondition failure, 2 infra error.
 */

import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type CloneGroup,
  type ClonesYaml,
  hasRefactorDisposition,
  parseClonesYaml,
  RefactorPreconditionError,
  validateRefactorPreconditions,
} from './clones-yaml.js';
import {
  type PreconditionError,
  checkRuntimePreconditions,
  preconditionError,
} from './check-refactor-preconditions.runtime.js';
import { errorMessage, isEnoent } from './util/typeguards.js';

const DEFAULT_BASELINE = 'docs/scope-discovery/clones.yaml';
const DEFAULT_TEST_TIMEOUT_SECONDS = 300;
/**
 * Marker grammar (workplan T5.3 + T5.2 docs):
 *   `Closes clones.yaml <id-or-comma-space-separated-ids>`
 * Match against any line. IDs are 12 lowercase hex chars
 * (deriveContentHashedId truncates SHA-1 to 12 hex chars in clones-yaml.ts).
 */
const MARKER_LINE_REGEX = /^\s*Closes\s+clones\.yaml\s+([0-9a-f, ]+)\s*$/im;
const CLONE_ID_REGEX = /[0-9a-f]{12}/g;

export interface Cli {
  readonly commitMsgFile: string | null;
  readonly commitMsgInline: string | null;
  readonly baselinePath: string;
  readonly repoRoot: string;
  readonly testTimeoutSeconds: number;
  readonly skipTestRun: boolean;
}

function takeNext(argv: readonly string[], i: number, flag: string): string {
  const next = argv[i + 1];
  if (next === undefined) throw new Error(`${flag} requires an argument`);
  return next;
}

function parseCli(argv: readonly string[]): Cli {
  let commitMsgFile: string | null = null;
  let commitMsgInline: string | null = null;
  let baselinePath = DEFAULT_BASELINE;
  let repoRoot = process.cwd();
  let testTimeoutSeconds = DEFAULT_TEST_TIMEOUT_SECONDS;
  let skipTestRun = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--commit-msg-file') { commitMsgFile = takeNext(argv, i, a); i += 1; }
    else if (a === '--commit-msg') { commitMsgInline = takeNext(argv, i, a); i += 1; }
    else if (a === '--baseline') { baselinePath = takeNext(argv, i, a); i += 1; }
    else if (a === '--repo') { repoRoot = takeNext(argv, i, a); i += 1; }
    else if (a === '--test-timeout-seconds') {
      const raw = takeNext(argv, i, a); i += 1;
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`--test-timeout-seconds must be a positive number; got ${raw}`);
      }
      testTimeoutSeconds = parsed;
    }
    else if (a === '--skip-test-run') skipTestRun = true;
    else throw new Error(`unknown arg: ${a}`);
  }
  if (commitMsgFile !== null && commitMsgInline !== null) {
    throw new Error('--commit-msg-file and --commit-msg are mutually exclusive');
  }
  return { commitMsgFile, commitMsgInline, baselinePath, repoRoot, testTimeoutSeconds, skipTestRun };
}

async function readCommitMessage(cli: Cli): Promise<string> {
  if (cli.commitMsgInline !== null) return cli.commitMsgInline;
  if (cli.commitMsgFile !== null) return readFile(cli.commitMsgFile, 'utf8');
  // Default — read latest commit's message; only hit when the gate is
  // run manually for diagnostic (commit-msg hook always supplies --commit-msg-file).
  const result = spawnSync('git', ['log', '-1', '--format=%B'], {
    cwd: cli.repoRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(
      `git log -1 --format=%B failed (status ${result.status}): ${result.stderr ?? ''}`,
    );
  }
  return result.stdout;
}

/**
 * Extract every clone-group id named by a refactor marker. Permits
 * comma/space separation on a single line + multiple marker lines.
 * Returns unique IDs in first-appearance order.
 */
export function extractRefactorMarkers(commitMessage: string): readonly string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const line of commitMessage.split(/\r?\n/)) {
    const m = MARKER_LINE_REGEX.exec(line);
    if (m === null) continue;
    const idChunk = m[1];
    if (idChunk === undefined) continue;
    const ids = idChunk.match(CLONE_ID_REGEX) ?? [];
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      ordered.push(id);
    }
  }
  return ordered;
}

async function loadBaseline(cli: Cli): Promise<ClonesYaml> {
  const path = resolve(cli.repoRoot, cli.baselinePath);
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (e) {
    if (isEnoent(e)) {
      throw new Error(
        `clones.yaml baseline not found at ${path}. ` +
          `Refactor commits require a tracked baseline; check ${cli.baselinePath} ` +
          `exists and is committed.`,
      );
    }
    throw e;
  }
  let parsed: ClonesYaml | null;
  try {
    parsed = parseClonesYaml(text);
  } catch (e) {
    if (e instanceof RefactorPreconditionError) {
      throw new Error(
        `clones.yaml has refactor-precondition errors at parse time:\n  - ` +
          e.preconditionErrors.join('\n  - ') +
          `\nFix the baseline before re-attempting the refactor commit.`,
      );
    }
    throw e;
  }
  if (parsed === null) {
    throw new Error(
      `clones.yaml at ${path} did not parse as a valid clones document. ` +
        `Inspect the file (yaml may be malformed) and retry.`,
    );
  }
  return parsed;
}

export interface GateResult {
  readonly markedIds: readonly string[];
  readonly errors: readonly PreconditionError[];
}

function checkGroupForMarker(
  id: string,
  byId: ReadonlyMap<string, CloneGroup>,
  cli: Cli,
): readonly PreconditionError[] {
  const group = byId.get(id);
  if (group === undefined) {
    return [
      preconditionError(
        id,
        '<entry>',
        `refactor marker names clone-group ${id} but no entry exists in clones.yaml.`,
        `Either remove the marker (this commit does not close a clone) or ` +
          `add the entry to docs/scope-discovery/clones.yaml first. Marker ` +
          `IDs are exactly 12 lowercase hex chars derived from the group's members.`,
      ),
    ];
  }
  if (!hasRefactorDisposition(group)) {
    return [
      preconditionError(
        id,
        'disposition',
        `marker names ${id} but its disposition is '${group.disposition}', not 'refactor'.`,
        `Update the entry's disposition to 'refactor' AND supply the ` +
          `precondition fields (canonical_side, canonical_reason, tests, ` +
          `tests_proof — see docs/scope-discovery/README.md §Refactor Preconditions).`,
      ),
    ];
  }
  // Re-validate parse-time preconditions defensively (in case the
  // baseline was edited mid-flight). Reconstruct the raw entry shape.
  const rawEntry: Record<string, unknown> = {
    canonical_side: group.canonical_side,
    canonical_reason: group.canonical_reason,
    tests: group.tests,
    tests_proof: group.tests_proof,
    ...(group.new_shape_summary !== undefined
      ? { new_shape_summary: group.new_shape_summary }
      : {}),
  };
  const parseCheck = validateRefactorPreconditions(rawEntry, id);
  if (!parseCheck.ok) {
    return parseCheck.errors.map((detail) =>
      preconditionError(
        id,
        '<schema>',
        detail,
        `Fix the entry in docs/scope-discovery/clones.yaml; see ` +
          `docs/scope-discovery/README.md §Refactor Preconditions for field shapes.`,
      ),
    );
  }
  return checkRuntimePreconditions(group, {
    repoRoot: cli.repoRoot,
    testTimeoutSeconds: cli.testTimeoutSeconds,
    skipTestRun: cli.skipTestRun,
  });
}

/**
 * Programmatic entry point — exported so the adversarial validator
 * harness can drive the gate without subprocess overhead.
 */
export async function runGate(cli: Cli, commitMessage: string): Promise<GateResult> {
  const markedIds = extractRefactorMarkers(commitMessage);
  if (markedIds.length === 0) return { markedIds, errors: [] };
  const baseline = await loadBaseline(cli);
  const byId = new Map<string, CloneGroup>();
  for (const g of baseline.clones) byId.set(g.id, g);
  const errors: PreconditionError[] = [];
  for (const id of markedIds) {
    errors.push(...checkGroupForMarker(id, byId, cli));
  }
  return { markedIds, errors };
}

function formatErrors(result: GateResult): string {
  const lines: string[] = [];
  lines.push(
    `check-refactor-preconditions: ${result.errors.length} precondition error(s) ` +
      `across ${result.markedIds.length} claimed clone-group(s):\n`,
  );
  result.errors.forEach((e, idx) => {
    lines.push(
      `  ${idx + 1}. [${e.cloneId} :: ${e.field}] ${e.detail}\n` +
        `      next step: ${e.nextStep}`,
    );
  });
  return lines.join('\n') + '\n';
}

async function main(): Promise<number> {
  let cli: Cli;
  try {
    cli = parseCli(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`check-refactor-preconditions: ${errorMessage(e)}\n`);
    return 2;
  }
  let commitMessage: string;
  try {
    commitMessage = await readCommitMessage(cli);
  } catch (e) {
    process.stderr.write(
      `check-refactor-preconditions: failed to read commit message: ${errorMessage(e)}\n`,
    );
    return 2;
  }
  let result: GateResult;
  try {
    result = await runGate(cli, commitMessage);
  } catch (e) {
    process.stderr.write(`check-refactor-preconditions: ${errorMessage(e)}\n`);
    return 2;
  }
  if (result.markedIds.length === 0) return 0; // Silent on non-refactor commits.
  if (result.errors.length === 0) {
    process.stdout.write(
      `check-refactor-preconditions: OK — all preconditions satisfied for ` +
        `${result.markedIds.length} clone-group(s): ${result.markedIds.join(', ')}\n`,
    );
    return 0;
  }
  process.stderr.write(formatErrors(result));
  return 1;
}

function isCliEntryPoint(): boolean {
  if (typeof process === 'undefined' || process.argv.length < 2) return false;
  const invoked = process.argv[1];
  if (invoked === undefined) return false;
  return invoked === fileURLToPath(import.meta.url);
}

if (isCliEntryPoint()) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`check-refactor-preconditions crashed: ${errorMessage(err)}\n`);
      process.exit(2);
    },
  );
}
