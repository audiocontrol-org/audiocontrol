/**
 * tools/scope-discovery/clone-detector.polish-scenarios.ts
 *
 * T7.5 polish-bundle scenarios for the clone-detector. Separate file
 * from clone-detector.validate.ts so the parent validator stays under
 * the 500-line cap. These scenarios exercise:
 *
 *   1. `--diff` flag: prints ONLY NEW + DROPPED groups (subset of the
 *      default output) plus the summary line.
 *   2. `--refresh-baseline` summary line: trails the baseline-write
 *      output with `summary: N dropped, M new (net X)`.
 *
 * Same scenario shape as clone-detector.validate.ts (ScenarioResult,
 * subprocess invocation, .tmp fixture). Imported as adapters by the
 * parent validator's scheduler.
 */

import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { runScannerSubprocess, type ScannerRun } from './util/run-scanner.js';

const DETECTOR_ENTRY = 'tools/scope-discovery/clone-detector.ts';
const TMP_ROOT = '.tmp';

const CLONE_BODY_A = `export function polishCalc(x: number, y: number): number {
  const sum = x + y;
  const product = x * y;
  const diff = x - y;
  const quot = y === 0 ? 0 : x / y;
  return sum + product + diff + quot;
}
`;

const CLONE_BODY_B = `export function polishSummarise(a: number, b: number): number {
  const total = a + b;
  const scaled = a * b;
  const delta = a - b;
  const ratio = b === 0 ? 0 : a / b;
  return total + scaled + delta + ratio;
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
  const dir = join(TMP_ROOT, `clone-validator-polish-${label}-${runId}`);
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
 * Scenario: plant a NEW clone after baseline capture, run with `--diff`,
 * assert the output contains the NEW group lines but NOT the headline
 * "Detected N clone group(s)" or "Baseline diff:" prefixes from the
 * default mode. Output is the subset of the default output that
 * highlights what changed since the baseline.
 */
export async function scenarioDiffFlagSubsetOnly(): Promise<ScenarioResult> {
  const name = 'clone-detector --diff prints NEW + DROPPED + summary only';
  const fixture = await makeFixture('diff');
  await writeFile(join(fixture.dir, 'a.ts'), CLONE_BODY_A, 'utf8');
  await writeFile(join(fixture.dir, 'b.ts'), CLONE_BODY_A, 'utf8');
  const first = await runDetector(detectorArgs(fixture));
  if (first.code !== 0) {
    return fail(name, `baseline-capture exited ${first.code}; stderr:\n${first.stderr}`);
  }
  // Plant a NEW clone group.
  await writeFile(join(fixture.dir, 'c.ts'), CLONE_BODY_B, 'utf8');
  await writeFile(join(fixture.dir, 'd.ts'), CLONE_BODY_B, 'utf8');
  const diffRun = await runDetector(detectorArgs(fixture, ['--diff']));
  if (diffRun.code !== 1) {
    return fail(name, `expected exit 1 with NEW group; got ${diffRun.code}\nstdout:\n${diffRun.stdout}`);
  }
  // --diff output must NAME the planted files in the NEW group...
  if (!diffRun.stdout.includes('c.ts') || !diffRun.stdout.includes('d.ts')) {
    return fail(name, `expected c.ts + d.ts in NEW section; stdout:\n${diffRun.stdout}`);
  }
  // ...must include the summary line in the expected shape...
  if (!/summary: \d+ dropped, \d+ new \(net [+-]?\d+\)/.test(diffRun.stdout)) {
    return fail(name, `expected "summary: N dropped, M new (net X)" line; stdout:\n${diffRun.stdout}`);
  }
  // ...and must NOT include the default-mode headline phrases.
  if (diffRun.stdout.includes('Detected ') || diffRun.stdout.includes('Baseline diff:')) {
    return fail(
      name,
      `--diff output should be a strict subset; found default-mode headline:\n${diffRun.stdout}`,
    );
  }
  return pass(name, 'diff output named planted files, included summary, omitted default-mode headlines');
}

/**
 * Scenario: run `--refresh-baseline` on a clean tree (no NEW/DROPPED),
 * assert the trailing output contains the `summary: 0 dropped, 0 new
 * (net +0)` line distinct from the headline. Establishes the line
 * lands even when there's nothing to report — the operator-facing
 * grep-handle is invariant.
 */
export async function scenarioRefreshBaselineSummaryLine(): Promise<ScenarioResult> {
  const name = 'clone-detector --refresh-baseline emits "summary: N dropped, M new (net X)"';
  const fixture = await makeFixture('refresh');
  await writeFile(join(fixture.dir, 'a.ts'), CLONE_BODY_A, 'utf8');
  await writeFile(join(fixture.dir, 'b.ts'), CLONE_BODY_A, 'utf8');
  // Two runs: first builds the baseline, second --refresh-baseline
  // confirms the summary line lands in refresh mode specifically.
  const first = await runDetector(detectorArgs(fixture));
  if (first.code !== 0) {
    return fail(name, `baseline-capture exited ${first.code}; stderr:\n${first.stderr}`);
  }
  const refresh = await runDetector(detectorArgs(fixture, ['--refresh-baseline']));
  if (refresh.code !== 0) {
    return fail(name, `expected exit 0; got ${refresh.code}\nstdout:\n${refresh.stdout}\nstderr:\n${refresh.stderr}`);
  }
  if (!/summary: 0 dropped, 0 new \(net \+0\)/.test(refresh.stdout)) {
    return fail(name, `expected "summary: 0 dropped, 0 new (net +0)" line; stdout:\n${refresh.stdout}`);
  }
  return pass(name, 'refresh-baseline emitted the summary line in the expected shape');
}

/**
 * Cleanup hook called by the parent validator's finally block. Removes
 * any clone-validator-polish-* fixture directories left under .tmp.
 */
export async function cleanupPolishFixtures(): Promise<void> {
  try {
    const { readdir } = await import('node:fs/promises');
    const entries = await readdir(TMP_ROOT, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory() && e.name.startsWith('clone-validator-polish-')) {
        await rm(join(TMP_ROOT, e.name), { recursive: true, force: true });
      }
    }
  } catch {
    // .tmp may not exist — fine.
  }
}
