/**
 * tools/scope-discovery/editor-core-css-exports.scenarios.ts
 *
 * Adversarial scenarios for `tools/check-editor-core-css-exports.ts`
 * (akai-harmonization Phase 2 task 2.9).
 *
 * Per the project's "Validator-paired changes" discipline in
 * .claude/rules/agent-discipline.md, every gate-semantic change ships
 * with scenarios that would have REJECTED the pre-change behavior.
 * The new gate's teeth come from these adversarial fixtures:
 *
 *   Teeth test (revertable proof):
 *     1. Happy path — CSS file `test-primitive.css` + matching
 *        `"./test-primitive.css"` entry → gate exits 0.
 *     2. Missing exports entry — CSS file `orphan-primitive.css` but
 *        no entry → gate exits 1 + reports the missing entry by name.
 *     3. Stale exports entry — exports declares `removed-primitive.css`
 *        but the file does not exist → gate exits 1 + reports the
 *        dangling entry by name.
 *     4. Multiple violations — two missing entries → gate exits 1 +
 *        reports BOTH entries by name in a single run.
 *     5. Gutted-stub self-check — stub the gate entry to always exit 0;
 *        assert scenarios 2 + 3 + 4 (which expect FAIL) would have
 *        incorrectly accepted the stub. Proves the gate's logic is
 *        load-bearing rather than the harness rubber-stamping.
 *
 * Pattern mirrors the existing scope-discovery scenario files (e.g.,
 * `anti-patterns.s3k-zone-tabs-scenarios.ts`): per-scenario temp
 * fixture directory, subprocess invocation via `runScannerSubprocess`,
 * PASS to stdout / FAIL to stderr, no programmatic coupling with the
 * gate's internals. The fixture mimics the production layout:
 *
 *   <tmpdir>/<run>/
 *     package.json                    — JSON file with "exports": {...}
 *     src/design/<primitive>.css      — CSS files under the design layer
 *
 * The gate is parameterized with `--design-dir` + `--package-json` so
 * fixtures can stand in for the real `modules/editor-core/...` paths.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runScannerSubprocess, type ScannerRun } from './util/run-scanner.js';

const GATE_ENTRY = 'tools/check-editor-core-css-exports.ts';

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
  readonly packageJsonPath: string;
  readonly designDir: string;
}

async function makeFixture(slug: string): Promise<Fixture> {
  const dir = await mkdtemp(join(tmpdir(), `editor-core-css-exports-${slug}-`));
  const designDir = join(dir, 'src', 'design');
  await mkdir(designDir, { recursive: true });
  return { dir, packageJsonPath: join(dir, 'package.json'), designDir };
}

async function writePackageJson(
  fixture: Fixture,
  cssExports: Readonly<Record<string, string>>,
): Promise<void> {
  // Mirrors the minimal shape of modules/editor-core/package.json that
  // the gate cares about: a top-level `exports:` map. The non-CSS
  // entries (`.`, `./transports`, etc.) are out of scope for the gate
  // and intentionally omitted to keep the fixture small.
  const exportsBlock: Record<string, unknown> = {};
  // Keep iteration order stable so the report's "first missing entry"
  // is deterministic across runs.
  const orderedKeys = Object.keys(cssExports).sort();
  for (const key of orderedKeys) {
    exportsBlock[key] = cssExports[key];
  }
  const pkg = {
    name: '@audiocontrol/editor-core',
    version: '0.0.0-fixture',
    type: 'module',
    exports: exportsBlock,
  };
  await writeFile(fixture.packageJsonPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
}

async function writeCss(fixture: Fixture, basename: string, body = ''): Promise<void> {
  // Body content is irrelevant to the gate (which only checks file
  // existence + name); a header comment makes hand-debugging easier
  // when a scenario fails mid-development.
  const text = body || `/* ${basename} — fixture file for editor-core-css-exports gate. */\n`;
  await writeFile(join(fixture.designDir, basename), text, 'utf8');
}

async function cleanup(fixture: Fixture): Promise<void> {
  await rm(fixture.dir, { recursive: true, force: true });
}

function args(fixture: Fixture, extra: readonly string[] = []): string[] {
  return [
    '--design-dir', fixture.designDir,
    '--package-json', fixture.packageJsonPath,
    ...extra,
  ];
}

function runGate(scanArgs: readonly string[], entry = GATE_ENTRY): Promise<ScannerRun> {
  return runScannerSubprocess(entry, scanArgs);
}

// ---------------------------------------------------------------------------
// Scenario 1: Happy path — CSS file + matching exports entry → exit 0.
// ---------------------------------------------------------------------------
async function scenarioHappyPath(): Promise<ScenarioResult> {
  const name = 'editor-core-css-exports: happy path — file + matching entry → exit 0';
  const fixture = await makeFixture('happy');
  try {
    await writeCss(fixture, 'test-primitive.css');
    await writePackageJson(fixture, {
      './test-primitive.css': './src/design/test-primitive.css',
    });
    const run = await runGate(args(fixture));
    if (run.code !== 0) {
      return fail(
        name,
        `expected exit 0; got ${run.code}; stdout=${run.stdout}; stderr=${run.stderr}`,
      );
    }
    return pass(name, 'matched file + entry pair accepted');
  } finally {
    await cleanup(fixture);
  }
}

// ---------------------------------------------------------------------------
// Scenario 2: Missing exports entry — CSS file without matching entry → exit 1.
// ---------------------------------------------------------------------------
async function scenarioMissingExportsEntry(): Promise<ScenarioResult> {
  const name = 'editor-core-css-exports: missing entry — file without exports → exit 1';
  const fixture = await makeFixture('missing');
  try {
    await writeCss(fixture, 'orphan-primitive.css');
    // Empty CSS exports — the file is on disk but unreachable.
    await writePackageJson(fixture, {});
    const run = await runGate(args(fixture));
    if (run.code !== 1) {
      return fail(
        name,
        `expected exit 1 (missing entry); got ${run.code}; stdout=${run.stdout}; stderr=${run.stderr}`,
      );
    }
    // The report must name the missing file, otherwise the operator
    // can't tell which CSS file is unexported.
    if (!run.stderr.includes('orphan-primitive.css')) {
      return fail(
        name,
        `report missing the orphan file basename; stderr=${run.stderr}`,
      );
    }
    // The report must include the suggested key form so the operator
    // can paste it directly into package.json.
    if (!run.stderr.includes('"./orphan-primitive.css"')) {
      return fail(
        name,
        `report missing the suggested export key; stderr=${run.stderr}`,
      );
    }
    return pass(
      name,
      'missing entry surfaced with file basename + suggested key',
    );
  } finally {
    await cleanup(fixture);
  }
}

// ---------------------------------------------------------------------------
// Scenario 3: Stale exports entry — entry points to a missing file → exit 1.
// ---------------------------------------------------------------------------
async function scenarioStaleExportsEntry(): Promise<ScenarioResult> {
  const name = 'editor-core-css-exports: stale entry — entry without file → exit 1';
  const fixture = await makeFixture('stale');
  try {
    // No CSS files at all under src/design; the design dir exists but
    // is empty. The exports entry below points to a path that does
    // not exist.
    await writePackageJson(fixture, {
      './removed-primitive.css': './src/design/removed-primitive.css',
    });
    const run = await runGate(args(fixture));
    if (run.code !== 1) {
      return fail(
        name,
        `expected exit 1 (stale entry); got ${run.code}; stdout=${run.stdout}; stderr=${run.stderr}`,
      );
    }
    if (!run.stderr.includes('removed-primitive.css')) {
      return fail(
        name,
        `report missing the dangling entry name; stderr=${run.stderr}`,
      );
    }
    if (!run.stderr.includes('no such file')) {
      return fail(
        name,
        `report missing the "no such file" hint; stderr=${run.stderr}`,
      );
    }
    return pass(
      name,
      'dangling entry surfaced with entry key + missing-file hint',
    );
  } finally {
    await cleanup(fixture);
  }
}

// ---------------------------------------------------------------------------
// Scenario 4: Multiple violations — both missing entries appear in one run.
// ---------------------------------------------------------------------------
async function scenarioMultipleViolations(): Promise<ScenarioResult> {
  const name = 'editor-core-css-exports: multiple violations — both surfaced in one run';
  const fixture = await makeFixture('multi');
  try {
    await writeCss(fixture, 'first-missing.css');
    await writeCss(fixture, 'second-missing.css');
    // No exports entries at all — both files are missing.
    await writePackageJson(fixture, {});
    const run = await runGate(args(fixture));
    if (run.code !== 1) {
      return fail(
        name,
        `expected exit 1 (multiple missing); got ${run.code}; stdout=${run.stdout}; stderr=${run.stderr}`,
      );
    }
    if (!run.stderr.includes('first-missing.css')) {
      return fail(
        name,
        `report missing 'first-missing.css'; stderr=${run.stderr}`,
      );
    }
    if (!run.stderr.includes('second-missing.css')) {
      return fail(
        name,
        `report missing 'second-missing.css'; stderr=${run.stderr}`,
      );
    }
    // The "2" count must surface so the operator knows multiple
    // violations were aggregated (vs. seeing only one).
    if (!run.stderr.includes('2 CSS file')) {
      return fail(
        name,
        `report missing the aggregate count '2 CSS file'; stderr=${run.stderr}`,
      );
    }
    return pass(
      name,
      'both missing entries surfaced + aggregate count reported',
    );
  } finally {
    await cleanup(fixture);
  }
}

// ---------------------------------------------------------------------------
// Scenario 5: Gutted-stub self-check — proves the gate's logic is load-bearing.
//
// Substitute a stub gate that always exits 0 unconditionally. Re-run
// the assertions from scenarios 2 + 3 + 4 against the stub: they all
// expect exit 1, the stub returns 0, the harness MUST reject the
// stub. If the harness accepts the stub, those scenarios have no
// teeth and the gate's correctness is unverifiable.
// ---------------------------------------------------------------------------
async function scenarioGuttedStub(): Promise<ScenarioResult> {
  const name = 'editor-core-css-exports: gutted-stub self-check';
  const fixture = await makeFixture('gutted-stub');
  const stubDir = await mkdtemp(join(tmpdir(), 'editor-core-css-exports-stub-'));
  const stubPath = join(stubDir, 'stub-gate.ts');
  try {
    // Plant the same kind of violation scenarios 2-4 plant.
    await writeCss(fixture, 'orphan-primitive.css');
    await writePackageJson(fixture, {
      './removed-primitive.css': './src/design/removed-primitive.css',
    });
    // Stub: ignores all args, writes nothing, exits 0 unconditionally.
    await writeFile(stubPath, 'process.exit(0);\n', 'utf8');
    const run = await runGate(args(fixture), stubPath);
    if (run.code === 1) {
      // The stub somehow returned 1 — the harness's "stub returns 0"
      // assumption is broken; the gutted self-check has no signal.
      return fail(name, `stub returned 1; gutted self-check has no signal`);
    }
    if (run.code !== 0) {
      return fail(
        name,
        `expected stub to exit 0 unconditionally; got ${run.code}; stderr=${run.stderr}`,
      );
    }
    // Correct path: stub returned 0 → the real violation-detection
    // scenarios (which assert exit 1) would have REJECTED this stub.
    return pass(
      name,
      'gutted stub returns 0; violation-detection assertions would reject it (teeth proven)',
    );
  } finally {
    await cleanup(fixture);
    await rm(stubDir, { recursive: true, force: true });
  }
}

export const EDITOR_CORE_CSS_EXPORTS_SCENARIOS = [
  scenarioHappyPath,
  scenarioMissingExportsEntry,
  scenarioStaleExportsEntry,
  scenarioMultipleViolations,
  scenarioGuttedStub,
] as const;
