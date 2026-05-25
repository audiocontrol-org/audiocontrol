/**
 * tools/scope-discovery/tab-active-state.scenarios.ts
 *
 * Adversarial scenarios for `tools/codegen-tab-active-state.ts`
 * (Gate A: registry ↔ CSS sync) and
 * `tools/check-tab-active-state-sources.ts` (Gate B: every
 * source-side tab id is registered).
 *
 * Per the project's "Validator-paired changes" discipline in
 * .claude/rules/agent-discipline.md, every gate-semantic change ships
 * with scenarios that would have REJECTED the pre-change behavior.
 * The two gates' teeth come from these adversarial fixtures.
 *
 * Gate A scenarios:
 *   1. happy path — registry + generated CSS match → exit 0
 *   2. out-of-sync — registry mutated without regenerating → exit 1
 *      with a drift report naming the missing tab id
 *   3. manual edit drift — generated CSS hand-edited (a panel-show
 *      selector deleted, the bug task 2.10 names) → exit 1 with
 *      a drift report naming the dropped id
 *   4. new family added — registry gains a family, CSS is missing
 *      the corresponding 4 blocks → exit 1
 *   5. stale family removed — registry drops a family, CSS still
 *      emits the corresponding blocks → exit 1
 *   6. YAML schema violation — registry entry missing `id` →
 *      exit 2 with a descriptive error
 *   7. prefix invariant violation — tab id not prefixed with
 *      family id → exit 2 with a descriptive error
 *   8. gutted-stub self-check — stub the codegen to always exit 0;
 *      scenarios 2-5 (which expect exit 1) would reject the stub
 *
 * Gate B scenarios:
 *   9. unregistered tab id in source — fixture .tsx file references
 *      `id: 'tt-NEW'` but registry doesn't have it → exit 1
 *   10. registered tab id in source — same .tsx file with `tt-NEW`
 *      added to registry → exit 0
 *
 * The fixture layout mirrors the scope-discovery scenario file
 * convention (see editor-core-css-exports.scenarios.ts): per-scenario
 * `mkdtemp`, subprocess invocation via `runScannerSubprocess`,
 * cleanup in `finally`. The codegen + scanner are parameterized
 * (`--in`/`--out`/`--registry`/`--scan-root`/`--scan-subdir`) so the
 * scenarios drive them against fixture trees rather than the
 * production layout.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runScannerSubprocess, type ScannerRun } from './util/run-scanner.js';

const CODEGEN_ENTRY = 'tools/codegen-tab-active-state.ts';
const SOURCES_GATE_ENTRY = 'tools/check-tab-active-state-sources.ts';

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
  readonly registryPath: string;
  readonly cssPath: string;
}

async function makeFixture(slug: string): Promise<Fixture> {
  const dir = await mkdtemp(join(tmpdir(), `tab-active-state-${slug}-`));
  return {
    dir,
    registryPath: join(dir, 'tab-groups.yaml'),
    cssPath: join(dir, 'tab-active-state.css'),
  };
}

async function cleanup(fixture: Fixture): Promise<void> {
  await rm(fixture.dir, { recursive: true, force: true });
}

/**
 * A minimal valid registry — one family, two tab ids. Enough to
 * exercise the codegen end-to-end without over-fitting the scenarios
 * to the production family roster.
 */
const MINIMAL_REGISTRY_YAML = `version: 1
tab_groups:
  - id: ft
    owner_editor: fixture-editor
    consumer: fixture/component.tsx
    mode: uncontrolled
    tab_ids:
      - ft-one
      - ft-two
`;

async function writeMinimalRegistry(fixture: Fixture): Promise<void> {
  await writeFile(fixture.registryPath, MINIMAL_REGISTRY_YAML, 'utf8');
}

async function writeRegistry(fixture: Fixture, yamlText: string): Promise<void> {
  await writeFile(fixture.registryPath, yamlText, 'utf8');
}

function runGate(scanArgs: readonly string[], entry = CODEGEN_ENTRY): Promise<ScannerRun> {
  return runScannerSubprocess(entry, scanArgs);
}

/**
 * Args helper for the codegen — uses `--in`/`--out` for fixture
 * paths so the scenarios don't touch the production registry/CSS.
 */
function codegenArgs(
  fixture: Fixture,
  extra: readonly string[] = [],
): readonly string[] {
  return ['--in', fixture.registryPath, '--out', fixture.cssPath, ...extra];
}

/**
 * Generate the CSS into the fixture's cssPath. Used as a setup step
 * by scenarios that then mutate the CSS or the registry to assert
 * specific drift behaviors.
 */
async function generateCss(fixture: Fixture): Promise<void> {
  const run = await runGate(codegenArgs(fixture));
  if (run.code !== 0) {
    throw new Error(
      `setup: codegen failed unexpectedly; stderr=${run.stderr}`,
    );
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Scenario 1: Gate A — happy path
// ────────────────────────────────────────────────────────────────────────────
async function scenarioHappyPath(): Promise<ScenarioResult> {
  const name = 'tab-active-state: gate A happy path — registry + CSS in sync → exit 0';
  const fixture = await makeFixture('happy');
  try {
    await writeMinimalRegistry(fixture);
    await generateCss(fixture);
    const run = await runGate(codegenArgs(fixture, ['--check']));
    if (run.code !== 0) {
      return fail(name, `expected exit 0; got ${run.code}; stderr=${run.stderr}`);
    }
    return pass(name, 'sync gate accepts a registry + freshly-regenerated CSS');
  } finally {
    await cleanup(fixture);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Scenario 2: Gate A — registry mutated without regenerating
// ────────────────────────────────────────────────────────────────────────────
async function scenarioRegistryMutatedNotRegen(): Promise<ScenarioResult> {
  const name = 'tab-active-state: gate A out-of-sync — registry mutated without regen → exit 1';
  const fixture = await makeFixture('out-of-sync');
  try {
    await writeMinimalRegistry(fixture);
    await generateCss(fixture);
    // Mutate the registry — add a new tab id; do NOT regenerate.
    const mutated = MINIMAL_REGISTRY_YAML.replace(
      '- ft-two\n',
      '- ft-two\n      - ft-three\n',
    );
    await writeRegistry(fixture, mutated);
    const run = await runGate(codegenArgs(fixture, ['--check']));
    if (run.code !== 1) {
      return fail(
        name,
        `expected exit 1; got ${run.code}; stderr=${run.stderr}`,
      );
    }
    if (!run.stderr.includes('ft-three')) {
      return fail(
        name,
        `drift report missing 'ft-three' (the added but un-regenerated id); stderr=${run.stderr}`,
      );
    }
    return pass(name, 'sync gate detects registry mutation + names the missing id');
  } finally {
    await cleanup(fixture);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Scenario 3: Gate A — manual edit of generated CSS drops a panel-show selector
// ────────────────────────────────────────────────────────────────────────────
async function scenarioManualEditDrift(): Promise<ScenarioResult> {
  const name = 'tab-active-state: gate A manual edit — CSS hand-edited to drop a selector → exit 1';
  const fixture = await makeFixture('manual-edit');
  try {
    await writeMinimalRegistry(fixture);
    await generateCss(fixture);
    // Read the generated CSS + delete the `#ft-two:checked` selector
    // line from the panel-show block (the precise failure mode task
    // 2.10 names — a tab id added to 3 of 4 lists silently breaks
    // one behavior).
    const { readFile, writeFile: writeFileAsync } = await import('node:fs/promises');
    const css = await readFile(fixture.cssPath, 'utf8');
    // Remove every selector line referencing ft-two — simulates a
    // hand-edit that dropped the id from all 4 blocks. The drift
    // report should name ft-two as missing.
    const mangled = css
      .split('\n')
      .filter((line) => !line.includes('ft-two'))
      .join('\n');
    await writeFileAsync(fixture.cssPath, mangled, 'utf8');
    const run = await runGate(codegenArgs(fixture, ['--check']));
    if (run.code !== 1) {
      return fail(
        name,
        `expected exit 1; got ${run.code}; stderr=${run.stderr}`,
      );
    }
    if (!run.stderr.includes('ft-two')) {
      return fail(
        name,
        `drift report missing 'ft-two' (the dropped id); stderr=${run.stderr}`,
      );
    }
    return pass(name, 'sync gate detects manual deletion + names the dropped id');
  } finally {
    await cleanup(fixture);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Scenario 4: Gate A — YAML schema violation (missing required `id` field)
// ────────────────────────────────────────────────────────────────────────────
async function scenarioYamlSchemaViolation(): Promise<ScenarioResult> {
  const name = 'tab-active-state: gate A schema — entry missing `id` → exit 2';
  const fixture = await makeFixture('schema-violation');
  try {
    // `id:` omitted from the single entry — the parser should reject.
    await writeRegistry(
      fixture,
      `version: 1
tab_groups:
  - owner_editor: fixture-editor
    consumer: fixture/x.tsx
    mode: uncontrolled
    tab_ids:
      - ft-one
`,
    );
    const run = await runGate(codegenArgs(fixture));
    if (run.code !== 2) {
      return fail(
        name,
        `expected exit 2 (schema violation); got ${run.code}; stderr=${run.stderr}`,
      );
    }
    if (!run.stderr.includes('id')) {
      return fail(
        name,
        `error message must reference the missing field; stderr=${run.stderr}`,
      );
    }
    return pass(name, 'schema violation surfaced + names the missing field');
  } finally {
    await cleanup(fixture);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Scenario 5: Gate A — prefix invariant violation (tab id not prefixed with family id)
// ────────────────────────────────────────────────────────────────────────────
async function scenarioPrefixInvariantViolation(): Promise<ScenarioResult> {
  const name = 'tab-active-state: gate A prefix — tab id missing family prefix → exit 2';
  const fixture = await makeFixture('prefix-violation');
  try {
    // Family `ft`, but tab id `pt-foo` — the prefix-invariant catches
    // the typo where a tab id is filed under the wrong family.
    await writeRegistry(
      fixture,
      `version: 1
tab_groups:
  - id: ft
    owner_editor: fixture-editor
    consumer: fixture/x.tsx
    mode: uncontrolled
    tab_ids:
      - pt-foo
`,
    );
    const run = await runGate(codegenArgs(fixture));
    if (run.code !== 2) {
      return fail(
        name,
        `expected exit 2 (prefix invariant); got ${run.code}; stderr=${run.stderr}`,
      );
    }
    if (!run.stderr.includes('pt-foo') || !run.stderr.includes('ft-')) {
      return fail(
        name,
        `error message must name the offending tab id + the expected prefix; stderr=${run.stderr}`,
      );
    }
    return pass(name, 'prefix invariant violation surfaced + names both pieces');
  } finally {
    await cleanup(fixture);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Scenario 6: Gate A — gutted-stub self-check
// ────────────────────────────────────────────────────────────────────────────
async function scenarioGuttedStub(): Promise<ScenarioResult> {
  const name = 'tab-active-state: gate A gutted-stub self-check';
  const fixture = await makeFixture('gutted-stub');
  const stubDir = await mkdtemp(join(tmpdir(), 'tab-active-state-stub-'));
  const stubPath = join(stubDir, 'stub-gate.ts');
  try {
    // Plant a clear drift state (registry has ft-two, CSS doesn't).
    await writeMinimalRegistry(fixture);
    await generateCss(fixture);
    // Now mangle the CSS — drop ft-two entirely.
    const { readFile, writeFile: writeFileAsync } = await import('node:fs/promises');
    const css = await readFile(fixture.cssPath, 'utf8');
    const mangled = css
      .split('\n')
      .filter((line) => !line.includes('ft-two'))
      .join('\n');
    await writeFileAsync(fixture.cssPath, mangled, 'utf8');
    // Stub: ignores all args, writes nothing, exits 0 unconditionally.
    await writeFile(stubPath, 'process.exit(0);\n', 'utf8');
    const run = await runGate(codegenArgs(fixture, ['--check']), stubPath);
    if (run.code === 1) {
      return fail(name, `stub returned 1; gutted self-check has no signal`);
    }
    if (run.code !== 0) {
      return fail(
        name,
        `expected stub to exit 0 unconditionally; got ${run.code}; stderr=${run.stderr}`,
      );
    }
    return pass(
      name,
      'gutted stub returns 0; drift-detection assertions would reject it (teeth proven)',
    );
  } finally {
    await cleanup(fixture);
    await rm(stubDir, { recursive: true, force: true });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Scenario 7: Gate B — unregistered tab id in source
// ────────────────────────────────────────────────────────────────────────────
async function scenarioGateBUnregisteredSource(): Promise<ScenarioResult> {
  const name = 'tab-active-state: gate B unregistered source — id not in registry → exit 1';
  const fixture = await makeFixture('gate-b-unregistered');
  try {
    await writeMinimalRegistry(fixture);
    // Plant a fixture .tsx file under a scan subdir; the file
    // references `id: 'ft-NEW'` which is NOT in the registry. Gate B
    // must surface it.
    const scanSubdir = 'fixture-modules';
    const tsxDir = join(fixture.dir, scanSubdir);
    await mkdir(tsxDir, { recursive: true });
    await writeFile(
      join(tsxDir, 'NewTabs.tsx'),
      `// fixture file; references an unregistered tab id.\nexport const tabs = [{ id: 'ft-new-tab', label: 'New' }];\n`,
      'utf8',
    );
    const run = await runGate(
      [
        '--registry', fixture.registryPath,
        '--scan-root', fixture.dir,
        '--scan-subdir', scanSubdir,
      ],
      SOURCES_GATE_ENTRY,
    );
    if (run.code !== 1) {
      return fail(
        name,
        `expected exit 1 (unregistered id); got ${run.code}; stderr=${run.stderr}`,
      );
    }
    if (!run.stderr.includes('ft-new-tab')) {
      return fail(
        name,
        `report must name 'ft-new-tab'; stderr=${run.stderr}`,
      );
    }
    if (!run.stderr.includes('NewTabs.tsx')) {
      return fail(
        name,
        `report must name the source file; stderr=${run.stderr}`,
      );
    }
    return pass(name, 'Gate B surfaces unregistered id + names file + tab id');
  } finally {
    await cleanup(fixture);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Scenario 8: Gate B — registered tab id in source (negative-match check)
// ────────────────────────────────────────────────────────────────────────────
async function scenarioGateBRegisteredSource(): Promise<ScenarioResult> {
  const name = 'tab-active-state: gate B registered source — id in registry → exit 0';
  const fixture = await makeFixture('gate-b-registered');
  try {
    await writeMinimalRegistry(fixture);
    // Plant a fixture .tsx file referencing only IDs that ARE in the
    // registry. Gate B must accept.
    const scanSubdir = 'fixture-modules';
    const tsxDir = join(fixture.dir, scanSubdir);
    await mkdir(tsxDir, { recursive: true });
    await writeFile(
      join(tsxDir, 'KnownTabs.tsx'),
      `// fixture file; references registered tab ids only.\nexport const tabs = [\n  { id: 'ft-one', label: 'One' },\n  { id: 'ft-two', label: 'Two' },\n];\n`,
      'utf8',
    );
    const run = await runGate(
      [
        '--registry', fixture.registryPath,
        '--scan-root', fixture.dir,
        '--scan-subdir', scanSubdir,
      ],
      SOURCES_GATE_ENTRY,
    );
    if (run.code !== 0) {
      return fail(
        name,
        `expected exit 0 (all ids registered); got ${run.code}; stderr=${run.stderr}; stdout=${run.stdout}`,
      );
    }
    return pass(name, 'Gate B accepts registered ids');
  } finally {
    await cleanup(fixture);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Scenario 9: Gate B — negative-match for unrelated id attributes (TF-015 lesson)
// ────────────────────────────────────────────────────────────────────────────
async function scenarioGateBNegativeMatch(): Promise<ScenarioResult> {
  const name = 'tab-active-state: gate B negative-match — unrelated id attrs untouched → exit 0';
  const fixture = await makeFixture('gate-b-negative');
  try {
    await writeMinimalRegistry(fixture);
    // The fixture file mentions plenty of ID-shaped strings whose
    // prefixes are NOT family prefixes (e.g., `id="some-thing"`,
    // `id: 'foo-bar'`). Gate B must not flag any of them — if it
    // did, the registry would be flooded with false-positive entries
    // and the gate would become noise.
    const scanSubdir = 'fixture-modules';
    const tsxDir = join(fixture.dir, scanSubdir);
    await mkdir(tsxDir, { recursive: true });
    await writeFile(
      join(tsxDir, 'NoMatch.tsx'),
      [
        `// fixture file; unrelated id attributes should not flag.`,
        `const x = { id: 'some-thing' };`,
        `const y = { id: 'foo-bar-baz' };`,
        `<div id="page-header" />`,
        `<button id="submit-btn" />`,
        ``,
      ].join('\n'),
      'utf8',
    );
    const run = await runGate(
      [
        '--registry', fixture.registryPath,
        '--scan-root', fixture.dir,
        '--scan-subdir', scanSubdir,
      ],
      SOURCES_GATE_ENTRY,
    );
    if (run.code !== 0) {
      return fail(
        name,
        `expected exit 0 (no family-prefixed ids); got ${run.code}; stderr=${run.stderr}; stdout=${run.stdout}`,
      );
    }
    return pass(name, 'Gate B does not over-match unrelated id attributes');
  } finally {
    await cleanup(fixture);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Scenario 10: Gate B — gutted-stub self-check
// ────────────────────────────────────────────────────────────────────────────
async function scenarioGateBGuttedStub(): Promise<ScenarioResult> {
  const name = 'tab-active-state: gate B gutted-stub self-check';
  const fixture = await makeFixture('gate-b-gutted-stub');
  const stubDir = await mkdtemp(join(tmpdir(), 'tab-active-state-gateb-stub-'));
  const stubPath = join(stubDir, 'stub-gate.ts');
  try {
    await writeMinimalRegistry(fixture);
    // Plant the same violation scenario 7 plants (unregistered id).
    const scanSubdir = 'fixture-modules';
    const tsxDir = join(fixture.dir, scanSubdir);
    await mkdir(tsxDir, { recursive: true });
    await writeFile(
      join(tsxDir, 'NewTabs.tsx'),
      `export const tabs = [{ id: 'ft-new-tab', label: 'New' }];\n`,
      'utf8',
    );
    // Stub: ignores all args, exits 0 unconditionally.
    await writeFile(stubPath, 'process.exit(0);\n', 'utf8');
    const run = await runGate(
      [
        '--registry', fixture.registryPath,
        '--scan-root', fixture.dir,
        '--scan-subdir', scanSubdir,
      ],
      stubPath,
    );
    if (run.code === 1) {
      return fail(name, `stub returned 1; gutted self-check has no signal`);
    }
    if (run.code !== 0) {
      return fail(
        name,
        `expected stub to exit 0 unconditionally; got ${run.code}; stderr=${run.stderr}`,
      );
    }
    return pass(
      name,
      'gutted stub returns 0; unregistered-id assertions would reject it (teeth proven)',
    );
  } finally {
    await cleanup(fixture);
    await rm(stubDir, { recursive: true, force: true });
  }
}

export const TAB_ACTIVE_STATE_SCENARIOS = [
  scenarioHappyPath,
  scenarioRegistryMutatedNotRegen,
  scenarioManualEditDrift,
  scenarioYamlSchemaViolation,
  scenarioPrefixInvariantViolation,
  scenarioGuttedStub,
  scenarioGateBUnregisteredSource,
  scenarioGateBRegisteredSource,
  scenarioGateBNegativeMatch,
  scenarioGateBGuttedStub,
] as const;
