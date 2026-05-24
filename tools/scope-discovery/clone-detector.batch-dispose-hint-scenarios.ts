/**
 * tools/scope-discovery/clone-detector.batch-dispose-hint-scenarios.ts
 *
 * AUDIT-20260524-09 scenarios for the clone-detector. Separate file from
 * clone-detector.validate.ts so the parent validator stays under the
 * 500-line cap. These scenarios assert the per-NEW-group operator hint
 * (a pre-filled `tsx tools/scope-discovery/batch-dispose.ts --ids <id>
 * --disposition <pick> --reason "<text>"` block) is emitted for NEW
 * groups only and is the actual NEW id (not a placeholder).
 *
 * Same scenario shape as clone-detector.validate.ts and
 * clone-detector.polish-scenarios.ts (ScenarioResult, subprocess
 * invocation via util/run-scanner, .tmp fixture under a dedicated
 * prefix so cleanup stays scoped).
 *
 * Wired into the parent validator's scheduler at the bottom of
 * clone-detector.validate.ts. AUDIT-07 hard test: reverting ONLY the
 * production-code change to clone-detector.ts (the `writeBatchDisposeHint`
 * call sites in `reportDiff` + `reportHuman`) MUST make
 * `scenarioNewGroupCitesBatchDispose` and
 * `scenarioNewGroupCitesBatchDisposeDefaultMode` FAIL.
 */

import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runScannerSubprocess, type ScannerRun } from './util/run-scanner.js';

const DETECTOR_ENTRY = 'tools/scope-discovery/clone-detector.ts';
const TMP_ROOT = '.tmp';
const FIXTURE_PREFIX = 'clone-validator-batchhint-';

/**
 * Two fixture bodies above .jscpd.json thresholds (minLines: 5,
 * minTokens: 50). The hint-citing scenarios plant CLONE_BODY for the
 * baseline-capture step, then CLONE_BODY_B for the NEW group; the
 * dropped-only scenario plants CLONE_BODY twice for baseline then
 * removes one member so the second run reports DROPPED with 0 NEW.
 */
const CLONE_BODY = `export function batchhintAlpha(x: number, y: number): number {
  const sum = x + y;
  const product = x * y;
  const diff = x - y;
  const quot = y === 0 ? 0 : x / y;
  return sum + product + diff + quot;
}
`;

const CLONE_BODY_B = `export function batchhintBeta(a: number, b: number): number {
  const total = a + b;
  const scaled = a * b;
  const delta = a - b;
  const ratio = b === 0 ? 0 : a / b;
  return total + scaled + delta + ratio;
}
`;

/**
 * A clone-free body used by the no-changes scenario as the second file.
 * Above jscpd's per-file size floor so a JSON report still emits; below
 * the cross-file clone threshold so no group is detected.
 */
const NONCLONE_BODY = `type BatchhintGreeter = { name: string };
export function batchhintGreet(g: BatchhintGreeter): string {
  const stamp = new Date().toISOString();
  const headline = \`hello, \${g.name}!\`;
  const trailer = headline.toUpperCase();
  return \`[\${stamp}] \${trailer}\`;
}
`;

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

interface Fixture {
  readonly dir: string;
  readonly baseline: string;
}

async function makeFixture(label: string): Promise<Fixture> {
  const runId = Math.random().toString(36).slice(2, 8);
  const dir = join(TMP_ROOT, `${FIXTURE_PREFIX}${label}-${runId}`);
  await mkdir(dir, { recursive: true });
  return { dir, baseline: join(dir, 'baseline.yaml') };
}

function detectorArgs(fixture: Fixture, extra: readonly string[] = []): readonly string[] {
  return ['--root', fixture.dir, '--baseline', fixture.baseline, ...extra];
}

function runDetector(args: readonly string[]): Promise<ScannerRun> {
  return runScannerSubprocess(DETECTOR_ENTRY, args);
}

/**
 * Extract the NEW group ids from the detector's stdout. The detector
 * prints `NEW    <id> (<n> lines)` (no leading indent in --diff mode,
 * 2-space leading indent in default mode). We tolerate both shapes so
 * the same parser serves both scenarios.
 */
function extractNewIds(stdout: string): readonly string[] {
  const ids: string[] = [];
  for (const line of stdout.split('\n')) {
    const m = /^\s*NEW\s+([0-9a-f]+)\s+\(\d+\s+lines\)\s*$/.exec(line);
    if (m !== null && m[1] !== undefined) ids.push(m[1]);
  }
  return ids;
}

/**
 * Scenario 1 (--diff mode): plant a NEW clone, run with --diff, assert
 * the stdout contains `tsx tools/scope-discovery/batch-dispose.ts --ids
 * <id>` where <id> is the actual NEW group's id (interpolated, not a
 * placeholder string). The continuation lines for --disposition and
 * --reason are also asserted to be present so the operator sees the
 * full paste-and-edit shape.
 */
export async function scenarioNewGroupCitesBatchDispose(): Promise<ScenarioResult> {
  const name = 'NEW group --diff output cites batch-dispose.ts with the actual id';
  const fixture = await makeFixture('diff-cites');
  await writeFile(join(fixture.dir, 'a.ts'), CLONE_BODY, 'utf8');
  await writeFile(join(fixture.dir, 'b.ts'), CLONE_BODY, 'utf8');
  const first = await runDetector(detectorArgs(fixture));
  if (first.code !== 0) {
    return fail(name, `baseline-capture exited ${first.code}; stderr:\n${first.stderr}`);
  }
  await writeFile(join(fixture.dir, 'c.ts'), CLONE_BODY_B, 'utf8');
  await writeFile(join(fixture.dir, 'd.ts'), CLONE_BODY_B, 'utf8');
  const diffRun = await runDetector(detectorArgs(fixture, ['--diff']));
  if (diffRun.code !== 1) {
    return fail(name, `expected exit 1 with NEW group; got ${diffRun.code}\nstdout:\n${diffRun.stdout}`);
  }
  const newIds = extractNewIds(diffRun.stdout);
  if (newIds.length === 0) {
    return fail(name, `no NEW group ids parsed from stdout:\n${diffRun.stdout}`);
  }
  // The citation must contain the actual id, not a literal placeholder.
  const cited = `tsx tools/scope-discovery/batch-dispose.ts \\`;
  if (!diffRun.stdout.includes(cited)) {
    return fail(name, `expected stdout to contain "${cited}"; stdout:\n${diffRun.stdout}`);
  }
  for (const id of newIds) {
    const idsFlag = `--ids ${id}`;
    if (!diffRun.stdout.includes(idsFlag)) {
      return fail(name, `expected stdout to contain "${idsFlag}" for NEW id ${id}; stdout:\n${diffRun.stdout}`);
    }
  }
  const dispositionFlag = '--disposition <refactor|keep-with-reason|ignore-with-justification>';
  if (!diffRun.stdout.includes(dispositionFlag)) {
    return fail(name, `expected stdout to contain "${dispositionFlag}"; stdout:\n${diffRun.stdout}`);
  }
  const reasonFlag = '--reason "<one-line rationale>"';
  if (!diffRun.stdout.includes(reasonFlag)) {
    return fail(name, `expected stdout to contain ${JSON.stringify(reasonFlag)}; stdout:\n${diffRun.stdout}`);
  }
  return pass(name, `cited batch-dispose for ${newIds.length} NEW id(s) with full --disposition and --reason placeholders`);
}

/**
 * Scenario 2 (default mode, non-quiet): the per-NEW-group hint must
 * also appear in the default-mode output (the shape `make
 * check-clone-duplication` and the pre-commit hook surface to the
 * operator). Default mode wraps NEW lines in 2-space indent — confirm
 * both the indented NEW line AND the citation lines land.
 */
export async function scenarioNewGroupCitesBatchDisposeDefaultMode(): Promise<ScenarioResult> {
  const name = 'NEW group default-mode output cites batch-dispose.ts (non-quiet)';
  const fixture = await makeFixture('default-cites');
  await writeFile(join(fixture.dir, 'a.ts'), CLONE_BODY, 'utf8');
  await writeFile(join(fixture.dir, 'b.ts'), CLONE_BODY, 'utf8');
  const first = await runDetector(detectorArgs(fixture));
  if (first.code !== 0) {
    return fail(name, `baseline-capture exited ${first.code}; stderr:\n${first.stderr}`);
  }
  await writeFile(join(fixture.dir, 'c.ts'), CLONE_BODY_B, 'utf8');
  await writeFile(join(fixture.dir, 'd.ts'), CLONE_BODY_B, 'utf8');
  // Default mode = no --quiet flag; no --diff flag.
  const defaultRun = await runDetector(detectorArgs(fixture));
  if (defaultRun.code !== 1) {
    return fail(name, `expected exit 1; got ${defaultRun.code}\nstdout:\n${defaultRun.stdout}`);
  }
  const newIds = extractNewIds(defaultRun.stdout);
  if (newIds.length === 0) {
    return fail(name, `no NEW group ids parsed from default-mode stdout:\n${defaultRun.stdout}`);
  }
  for (const id of newIds) {
    const idsFlag = `--ids ${id}`;
    if (!defaultRun.stdout.includes(idsFlag)) {
      return fail(name, `expected default-mode stdout to contain "${idsFlag}"; stdout:\n${defaultRun.stdout}`);
    }
  }
  if (!defaultRun.stdout.includes('tsx tools/scope-discovery/batch-dispose.ts')) {
    return fail(name, `expected default-mode stdout to cite batch-dispose.ts; stdout:\n${defaultRun.stdout}`);
  }
  return pass(name, `default-mode output cited batch-dispose for ${newIds.length} NEW id(s)`);
}

/**
 * Scenario 3: DROPPED-only run does NOT cite batch-dispose. DROPPED
 * groups are removed via `make refresh-clones-baseline`, not via
 * batch-dispose, so a citation here would mislead the operator. The
 * scenario captures a baseline with two clone members, then removes
 * one and re-runs; the second run must report 1 DROPPED + 0 NEW and
 * must NOT contain "batch-dispose.ts" anywhere in stdout.
 */
export async function scenarioDroppedGroupNoCitation(): Promise<ScenarioResult> {
  const name = 'DROPPED-only run does NOT cite batch-dispose.ts';
  const fixture = await makeFixture('dropped-only');
  await writeFile(join(fixture.dir, 'a.ts'), CLONE_BODY, 'utf8');
  await writeFile(join(fixture.dir, 'b.ts'), CLONE_BODY, 'utf8');
  const first = await runDetector(detectorArgs(fixture));
  if (first.code !== 0) {
    return fail(name, `baseline-capture exited ${first.code}; stderr:\n${first.stderr}`);
  }
  // Drop one clone member. The remaining single file no longer has a
  // pair — the group becomes DROPPED with 0 NEW.
  await rm(join(fixture.dir, 'b.ts'));
  const droppedRun = await runDetector(detectorArgs(fixture));
  if (droppedRun.code !== 0) {
    return fail(name, `expected exit 0 with only a DROPPED group; got ${droppedRun.code}\nstdout:\n${droppedRun.stdout}\nstderr:\n${droppedRun.stderr}`);
  }
  if (!droppedRun.stdout.includes('DROPPED')) {
    return fail(name, `expected "DROPPED" in stdout; stdout:\n${droppedRun.stdout}`);
  }
  if (droppedRun.stdout.includes('batch-dispose.ts')) {
    return fail(
      name,
      `DROPPED groups must NOT cite batch-dispose.ts (dispose-via-refresh, not batch-dispose); stdout:\n${droppedRun.stdout}`,
    );
  }
  // Belt-and-suspenders: also check the --diff mode for the same fixture.
  const diffRun = await runDetector(detectorArgs(fixture, ['--diff']));
  if (diffRun.stdout.includes('batch-dispose.ts')) {
    return fail(
      name,
      `--diff mode with only DROPPED groups must NOT cite batch-dispose.ts; stdout:\n${diffRun.stdout}`,
    );
  }
  return pass(name, 'DROPPED-only run kept stdout free of batch-dispose citation in both default and --diff modes');
}

/**
 * Scenario 4: a clone-free fixture (no NEW, no DROPPED) must NOT
 * mention batch-dispose anywhere. Confirms the hint is gated on the
 * NEW-group iteration and isn't, e.g., printed unconditionally as a
 * footer.
 */
export async function scenarioNoChangesNoCitation(): Promise<ScenarioResult> {
  const name = 'no-NEW no-DROPPED run does NOT cite batch-dispose.ts';
  const fixture = await makeFixture('no-changes');
  await writeFile(join(fixture.dir, 'lonely-a.ts'), CLONE_BODY, 'utf8');
  await writeFile(join(fixture.dir, 'lonely-b.ts'), NONCLONE_BODY, 'utf8');
  // First run writes the empty-clones baseline.
  const first = await runDetector(detectorArgs(fixture));
  if (first.code !== 0) {
    return fail(name, `baseline-capture exited ${first.code}; stderr:\n${first.stderr}`);
  }
  // Second run on the unchanged tree: 0 NEW, 0 DROPPED.
  const second = await runDetector(detectorArgs(fixture));
  if (second.code !== 0) {
    return fail(name, `expected exit 0; got ${second.code}\nstdout:\n${second.stdout}`);
  }
  if (second.stdout.includes('batch-dispose.ts')) {
    return fail(name, `no-changes run must NOT cite batch-dispose.ts; stdout:\n${second.stdout}`);
  }
  // Also via --diff mode (still no NEW, no DROPPED).
  const diffRun = await runDetector(detectorArgs(fixture, ['--diff']));
  if (diffRun.stdout.includes('batch-dispose.ts')) {
    return fail(name, `--diff no-changes run must NOT cite batch-dispose.ts; stdout:\n${diffRun.stdout}`);
  }
  return pass(name, 'no-changes run kept stdout free of batch-dispose citation in both default and --diff modes');
}

/**
 * Cleanup hook called by the parent validator's finally block. Removes
 * any clone-validator-batchhint-* fixture directories left under .tmp.
 */
export async function cleanupBatchDisposeHintFixtures(): Promise<void> {
  try {
    const entries = await readdir(TMP_ROOT, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory() && e.name.startsWith(FIXTURE_PREFIX)) {
        await rm(join(TMP_ROOT, e.name), { recursive: true, force: true });
      }
    }
  } catch {
    // .tmp may not exist — fine.
  }
}
