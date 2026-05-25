/**
 * tools/scope-discovery/disposition-survivor.validate.ts
 *
 * Adversarial validator for AUDIT-20260524-14. Two complementary
 * mechanisms are exercised:
 *
 *   Light fix — `parseClonesYamlStrict` in `tools/scope-discovery/clones-yaml.parse.ts`:
 *     a shape-error on read now throws `ClonesYamlParseError` rather
 *     than silently returning null. The clone-detector's `readBaseline`
 *     uses the strict variant, so an existing-but-malformed baseline
 *     can no longer be silently overwritten with a fresh-pending wipe.
 *
 *   Heavy backstop — `tools/scope-discovery/check-disposition-survivor.ts`:
 *     a pre-commit gate that fails the commit if any clones.yaml entry
 *     transitions from a protected disposition (keep-with-reason /
 *     ignore-with-justification / refactor) to `pending` in the staged
 *     diff against HEAD.
 *
 * Scenarios (8 total):
 *   1. content-hash-match-preserves-disposition (Light, host)
 *   2. content-hash-match-preserves-refactor-disposition (Light, host)
 *   3. malformed-baseline-fails-loud-not-silent (Light, host)
 *   4-7. Heavy-gate scenarios live in `disposition-survivor.gate-scenarios.ts`
 *        (file-cap split): block loss diff, allow legitimate additions,
 *        allow protected→protected, --force override.
 *   8. gutted-stub self-check (also in the gate-scenarios sibling).
 *
 * Run via:
 *   tsx tools/scope-discovery/disposition-survivor.validate.ts
 *   make check-disposition-survivor-validate
 *
 * Exit code:
 *   0   every scenario asserts as expected
 *   1   one or more assertions failed
 *   2   harness infrastructure error
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseClonesYaml, serializeClonesYaml } from './clones-yaml.js';
import {
  type ScenarioResult,
  scenarioGateAllowsFixForwardWhenHeadMalformed,
  scenarioGateAllowsLegitimateAdditions,
  scenarioGateAllowsProtectedChanges,
  scenarioGateBlocksLossDiff,
  scenarioGateForceOverride,
  scenarioGateStillFailsLoudWhenBothMalformed,
  scenarioGuttedStubSelfCheck,
} from './disposition-survivor.gate-scenarios.js';
import { errorMessage } from './util/typeguards.js';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');
const SURVIVOR_ENTRY = path.join(REPO_ROOT, 'tools/scope-discovery/check-disposition-survivor.ts');
const DETECTOR_ENTRY = path.join(REPO_ROOT, 'tools/scope-discovery/clone-detector.ts');

function pass(name: string, detail: string): ScenarioResult {
  return { name, passed: true, detail };
}
function fail(name: string, detail: string): ScenarioResult {
  return { name, passed: false, detail };
}

// ---------------------------------------------------------------------------
// Light-fix scenarios (clone-detector --refresh-baseline against synthetic
// fixtures planted under .tmp/). These exercise the production
// `parseClonesYamlStrict` + `readBaseline` interaction without git.
// ---------------------------------------------------------------------------

const CLONE_BODY = `export function survivorRepro(x: number, y: number): number {
  const sum = x + y;
  const product = x * y;
  const diff = x - y;
  const quot = y === 0 ? 0 : x / y;
  return sum + product + diff + quot;
}
`;

const MULTI_PARAGRAPH_REASON = `First paragraph of the reason — describes the why.

Second paragraph — names the trade-off, references the precedent.

Third paragraph — names the flip-condition that would change the disposition.`;

interface DetectorRun { code: number | null; stdout: string; stderr: string; }

function runDetector(args: readonly string[]): DetectorRun {
  const result = spawnSync('tsx', [DETECTOR_ENTRY, ...args], {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    env: process.env,
  });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

interface DetectorFixture {
  readonly dir: string;
  readonly baseline: string;
}

function makeDetectorFixture(label: string): DetectorFixture {
  const runId = Math.random().toString(36).slice(2, 8);
  const dir = path.join(REPO_ROOT, '.tmp', `disposition-survivor-${label}-${runId}`);
  mkdirSync(dir, { recursive: true });
  return { dir, baseline: path.join(dir, 'baseline.yaml') };
}

function cleanupDetectorFixtures(): void {
  const tmpRoot = path.join(REPO_ROOT, '.tmp');
  try {
    const entries = readdirSync(tmpRoot, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory() && e.name.startsWith('disposition-survivor-')) {
        rmSync(path.join(tmpRoot, e.name), { recursive: true, force: true });
      }
    }
  } catch {
    /* .tmp may not exist on a fresh checkout */
  }
}

async function scenarioContentHashMatchPreservesDisposition(): Promise<ScenarioResult> {
  const name = 'content-hash-match preserves keep-with-reason + multi-paragraph reason';
  const fix = makeDetectorFixture('keep');
  writeFileSync(path.join(fix.dir, 'a.ts'), CLONE_BODY, 'utf8');
  writeFileSync(path.join(fix.dir, 'b.ts'), CLONE_BODY, 'utf8');
  const r1 = runDetector(['--root', fix.dir, '--baseline', fix.baseline, '--quiet']);
  if (r1.code !== 0) {
    return fail(name, `baseline-capture exit ${r1.code}; stderr:\n${r1.stderr}`);
  }
  const parsed = parseClonesYaml(readFileSync(fix.baseline, 'utf8'));
  if (parsed === null || parsed.clones.length === 0) {
    return fail(name, `baseline empty after capture`);
  }
  const mutated = {
    generated_at: parsed.generated_at,
    clones: parsed.clones.map((g) => ({
      id: g.id, lines: g.lines, members: g.members,
      disposition: 'keep-with-reason' as const, reason: MULTI_PARAGRAPH_REASON,
    })),
  };
  writeFileSync(fix.baseline, serializeClonesYaml(mutated), 'utf8');
  const r2 = runDetector(['--root', fix.dir, '--baseline', fix.baseline, '--quiet', '--refresh-baseline']);
  if (r2.code !== 0) {
    return fail(name, `refresh exit ${r2.code}; stderr:\n${r2.stderr}\nstdout:\n${r2.stdout}`);
  }
  const after = parseClonesYaml(readFileSync(fix.baseline, 'utf8'));
  if (after === null || after.clones.length === 0) {
    return fail(name, 'baseline empty after refresh');
  }
  const e = after.clones[0]!;
  if (e.disposition !== 'keep-with-reason') {
    return fail(name, `disposition reverted: expected keep-with-reason, got ${e.disposition}`);
  }
  if (e.reason !== MULTI_PARAGRAPH_REASON) {
    return fail(name, `reason mutated:\n  expected: ${JSON.stringify(MULTI_PARAGRAPH_REASON)}\n  actual:   ${JSON.stringify(e.reason)}`);
  }
  return pass(name, 'disposition + multi-paragraph reason survived --refresh-baseline byte-for-byte');
}

async function scenarioContentHashMatchPreservesRefactor(): Promise<ScenarioResult> {
  const name = 'content-hash-match preserves refactor + canonical fields';
  const fix = makeDetectorFixture('refactor');
  writeFileSync(path.join(fix.dir, 'a.ts'), CLONE_BODY, 'utf8');
  writeFileSync(path.join(fix.dir, 'b.ts'), CLONE_BODY, 'utf8');
  const r1 = runDetector(['--root', fix.dir, '--baseline', fix.baseline, '--quiet']);
  if (r1.code !== 0) {
    return fail(name, `baseline-capture exit ${r1.code}; stderr:\n${r1.stderr}`);
  }
  const parsed = parseClonesYaml(readFileSync(fix.baseline, 'utf8'));
  if (parsed === null || parsed.clones.length === 0) {
    return fail(name, `baseline empty after capture`);
  }
  // Hand-write the YAML for the refactor entry so we exercise the
  // strict-parse path on the full discriminated-union shape, including
  // optional new_shape_summary.
  const id = parsed.clones[0]!.id;
  const members = parsed.clones[0]!.members;
  const refactorYaml = `generated_at: ${parsed.generated_at}
clones:
  - id: ${id}
    lines: 7
    members:
${members.map((m) => `      - ${m}`).join('\n')}
    disposition: refactor
    reason: Migrating the duplicated helper into a shared primitive
    canonical_side: new
    canonical_reason: |
      Neither current side carries the intended regime; both consumers
      will switch to the new shape once the helper extracts.
    new_shape_summary: |
      sharedCalc(x, y) — sum + product + diff + quot, single source of truth
    tests:
      - .tmp/fixture/round-trip.spec.ts
    tests_proof:
      sha: abc1234
      demonstration: |
        Failing on parent commit (no shared helper, drift between sites);
        passing on this commit (single helper, asserted equality across consumers).
`;
  writeFileSync(fix.baseline, refactorYaml, 'utf8');
  const r2 = runDetector(['--root', fix.dir, '--baseline', fix.baseline, '--quiet', '--refresh-baseline']);
  if (r2.code !== 0) {
    return fail(name, `refresh exit ${r2.code}; stderr:\n${r2.stderr}\nstdout:\n${r2.stdout}`);
  }
  const after = parseClonesYaml(readFileSync(fix.baseline, 'utf8'));
  if (after === null || after.clones.length === 0) {
    return fail(name, 'baseline empty after refresh');
  }
  const e = after.clones[0]!;
  if (e.disposition !== 'refactor') {
    return fail(name, `disposition reverted: expected refactor, got ${e.disposition}`);
  }
  if (e.canonical_side !== 'new') {
    return fail(name, `canonical_side not preserved: got ${e.canonical_side}`);
  }
  if (!e.canonical_reason.includes('Neither current side carries')) {
    return fail(name, `canonical_reason mutated: ${e.canonical_reason}`);
  }
  if (e.new_shape_summary === undefined || !e.new_shape_summary.includes('sharedCalc')) {
    return fail(name, `new_shape_summary mutated/missing: ${e.new_shape_summary}`);
  }
  if (e.tests.length !== 1 || e.tests[0] !== '.tmp/fixture/round-trip.spec.ts') {
    return fail(name, `tests mutated: ${JSON.stringify(e.tests)}`);
  }
  if (e.tests_proof.sha !== 'abc1234') {
    return fail(name, `tests_proof.sha mutated: ${e.tests_proof.sha}`);
  }
  return pass(name, 'refactor entry + all five precondition fields survived --refresh-baseline byte-for-byte');
}

async function scenarioMalformedBaselineFailsLoud(): Promise<ScenarioResult> {
  const name = 'malformed-baseline fails loud (exit 2) and does NOT silently wipe dispositions';
  const fix = makeDetectorFixture('malformed');
  writeFileSync(path.join(fix.dir, 'a.ts'), CLONE_BODY, 'utf8');
  writeFileSync(path.join(fix.dir, 'b.ts'), CLONE_BODY, 'utf8');
  // Plant a malformed baseline: one good keep-with-reason entry + one
  // entry missing the required `members` field (shape error).
  const malformedYaml = `generated_at: 2026-05-24T00:00:00Z
clones:
  - id: aaaaaaaaaaaa
    lines: 7
    members:
      - ${fix.dir}/a.ts:1:7
      - ${fix.dir}/b.ts:1:7
    disposition: keep-with-reason
    reason: |
      Operator-curated reason that MUST survive the malformed sibling.
  - id: brokenentry1
    lines: 7
    disposition: keep-with-reason
    reason: I am missing members - shape error!
`;
  writeFileSync(fix.baseline, malformedYaml, 'utf8');
  const beforeBytes = readFileSync(fix.baseline, 'utf8');
  const r = runDetector(['--root', fix.dir, '--baseline', fix.baseline, '--refresh-baseline']);
  if (r.code !== 2) {
    return fail(name, `expected exit 2 on malformed baseline; got ${r.code}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  }
  if (!r.stderr.includes('malformed') && !r.stderr.includes('shape error')) {
    return fail(name, `expected stderr to mention malformed/shape error; got:\n${r.stderr}`);
  }
  if (!r.stderr.includes('Refusing to silently overwrite')) {
    return fail(name, `expected stderr to name "Refusing to silently overwrite"; got:\n${r.stderr}`);
  }
  // The baseline file on disk must be UNCHANGED — the detector refused to write.
  const afterBytes = readFileSync(fix.baseline, 'utf8');
  if (afterBytes !== beforeBytes) {
    return fail(name, `baseline was modified on disk despite the error path; before:\n${beforeBytes}\nafter:\n${afterBytes}`);
  }
  return pass(name, 'detector exited 2 with actionable error, baseline preserved byte-for-byte on disk');
}

async function main(): Promise<number> {
  const lightScenarios: Array<() => Promise<ScenarioResult>> = [
    scenarioContentHashMatchPreservesDisposition,
    scenarioContentHashMatchPreservesRefactor,
    scenarioMalformedBaselineFailsLoud,
  ];
  const heavyScenarios: Array<(entry: string) => Promise<ScenarioResult>> = [
    scenarioGateBlocksLossDiff,
    scenarioGateAllowsLegitimateAdditions,
    scenarioGateAllowsProtectedChanges,
    scenarioGateForceOverride,
    // AUDIT-20260524-XX (this commit) — fix-forward path for malformed
    // HEAD + well-formed staged. Mirrors the real-world bug where a
    // pre-existing decimal-only clone id ("310995005263") was coerced
    // to number by YAML, blocking the very commit that fixes it.
    scenarioGateAllowsFixForwardWhenHeadMalformed,
    scenarioGateStillFailsLoudWhenBothMalformed,
    scenarioGuttedStubSelfCheck,
  ];
  const results: ScenarioResult[] = [];
  try {
    for (const scenario of lightScenarios) {
      const result = await scenario();
      results.push(result);
      const marker = result.passed ? 'PASS' : 'FAIL';
      process.stdout.write(`  ${marker}  ${result.name} — ${result.detail}\n`);
    }
    for (const scenario of heavyScenarios) {
      const result = await scenario(SURVIVOR_ENTRY);
      results.push(result);
      const marker = result.passed ? 'PASS' : 'FAIL';
      process.stdout.write(`  ${marker}  ${result.name} — ${result.detail}\n`);
    }
  } finally {
    cleanupDetectorFixtures();
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
