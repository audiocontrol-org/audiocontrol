/**
 * tools/scope-discovery/adopter-manifests.scenarios.ts
 *
 * Scenario library + fixture payloads for the T6.2 adopter-manifests
 * adversarial validator. Split out of `adopter-manifests.validate.ts`
 * to keep the validator entry-point + runner under the 300-500 line
 * cap mandated by ~/work/CLAUDE.md.
 *
 * Each `scenarioXxx` function:
 *   - sets up a per-scenario temp directory via the shared fixture
 *     helpers,
 *   - invokes the scanner under test as a subprocess via `runScanner`,
 *   - asserts the expected exit code + stdout/stderr substrings,
 *   - returns a `ScenarioResult` (PASS or FAIL with a detail string),
 *   - cleans up its temp directory in a `finally` block.
 *
 * The validator entry-point imports `SCENARIOS` and runs each in
 * sequence; this module is otherwise side-effect-free.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  SOURCE_PAYLOADS,
  args,
  cleanup,
  fail,
  makeFixture,
  pass,
  runScanner,
  writeRegistry,
  writeSource,
  type ScannerRun,
  type ScenarioResult,
} from './adopter-manifests.fixtures.js';

export type { ScannerRun, ScenarioResult };

// ---------------------------------------------------------------------------
// Fixture payloads (registry YAML + source-file bodies)
// ---------------------------------------------------------------------------

const EMPTY_REGISTRY_YAML = `adopter_manifests: []\n`;

const SLIDE_DRAWER_REGISTRY = `adopter_manifests:
  - id: slide-drawer-promotion
    introduced_in: deadbeef
    from: '@/components/SlideDrawer'
    expected_adopters_glob:
      - 'modules/{roland-sxx0,akai-s3k}-editor/src/**/*Editor*.tsx'
    message: |
      Replace the per-editor inline drawer with @/components/SlideDrawer;
      the canonical primitive owns the open/close/backdrop/scroll-lock
      contract.
`;

const MULTI_GLOB_REGISTRY = `adopter_manifests:
  - id: shared-list-bank
    introduced_in: cafef00d
    from: '@/components/ListBank'
    expected_adopters_glob:
      - 'modules/roland-sxx0-editor/src/**/*Page.tsx'
      - 'modules/akai-s3k-editor/src/**/*Page.tsx'
    message: |
      Use the shared @/components/ListBank widget across editor pages
      so virtualization + accent state stay consistent.
`;

const WITH_EXCEPTION_REGISTRY = `adopter_manifests:
  - id: slide-drawer-promotion
    introduced_in: deadbeef
    from: '@/components/SlideDrawer'
    expected_adopters_glob:
      - 'modules/roland-sxx0-editor/src/**/*Editor*.tsx'
    exceptions:
      - path: modules/roland-sxx0-editor/src/SpecialEditor.tsx
        reason: |
          Needs frame-rate scroll-lock that SlideDrawer does not expose;
          tracked separately in docs/scope-discovery/.
    message: |
      Replace the per-editor inline drawer with @/components/SlideDrawer.
`;

const BAD_EXCEPTION_REGISTRY = `adopter_manifests:
  - id: bad-exception
    introduced_in: deadbeef
    from: '@/components/SlideDrawer'
    expected_adopters_glob:
      - 'modules/roland-sxx0-editor/src/**/*Editor*.tsx'
    exceptions:
      - path: somewhere/else/Unrelated.tsx
        reason: |
          path does not match any glob; exception would be inert.
    message: |
      Replace the per-editor inline drawer with @/components/SlideDrawer.
`;

// Missing `expected_adopters_glob`. All other required fields are
// present so the parser fails specifically on the glob field.
const MALFORMED_REGISTRY = `adopter_manifests:
  - id: missing-required-fields
    introduced_in: deadbeef
    from: '@/components/SlideDrawer'
    message: |
      missing 'expected_adopters_glob' on purpose.
`;

const MULTI_GLOB_WITH_EXCEPTION_REGISTRY = `adopter_manifests:
  - id: shared-list-bank
    introduced_in: cafef00d
    from: '@/components/ListBank'
    expected_adopters_glob:
      - 'modules/roland-sxx0-editor/src/**/*Page.tsx'
      - 'modules/akai-s3k-editor/src/**/*Page.tsx'
    exceptions:
      - path: modules/roland-sxx0-editor/src/SpecialPage.tsx
        reason: needs custom bank layout.
    message: |
      Use @/components/ListBank for consistent virtualization.
`;

const IMPORTING_SOURCE = SOURCE_PAYLOADS.IMPORTING;
const HOLDOUT_SOURCE = SOURCE_PAYLOADS.HOLDOUT;

const LIST_BANK_IMPORT_SOURCE =
  "import { ListBank } from '@/components/ListBank';\nexport const x = ListBank;\n";

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

async function scenarioEmptyRegistry(): Promise<ScenarioResult> {
  const name = 'empty-registry-exit-zero';
  const fixture = await makeFixture('empty');
  try {
    await writeRegistry(fixture, EMPTY_REGISTRY_YAML);
    await writeSource(
      fixture,
      'modules/roland-sxx0-editor/src/PatchEditor.tsx',
      HOLDOUT_SOURCE,
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 0) {
      return fail(name, `expected exit 0; got ${run.code}; stderr=${run.stderr}`);
    }
    return pass(name, 'empty registry exits 0 even with non-adopting source files present');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioNoHoldouts(): Promise<ScenarioResult> {
  const name = 'no-holdouts-exits-zero';
  const fixture = await makeFixture('clean');
  try {
    await writeRegistry(fixture, SLIDE_DRAWER_REGISTRY);
    await writeSource(fixture, 'modules/roland-sxx0-editor/src/PatchEditor.tsx', IMPORTING_SOURCE);
    await writeSource(fixture, 'modules/akai-s3k-editor/src/ProgramEditor.tsx', IMPORTING_SOURCE);
    const run = await runScanner(args(fixture));
    if (run.code !== 0) {
      return fail(name, `expected exit 0; got ${run.code}; stdout=${run.stdout}`);
    }
    if (!run.stdout.includes('0 holdouts')) {
      return fail(name, `stdout missing '0 holdouts'; got: ${run.stdout}`);
    }
    return pass(name, 'every glob-matched file imports canonical path → exit 0');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioHoldoutDetected(): Promise<ScenarioResult> {
  const name = 'holdout-detected-exits-one';
  const fixture = await makeFixture('holdout');
  try {
    await writeRegistry(fixture, SLIDE_DRAWER_REGISTRY);
    await writeSource(fixture, 'modules/roland-sxx0-editor/src/PatchEditor.tsx', HOLDOUT_SOURCE);
    const run = await runScanner(args(fixture));
    if (run.code !== 1) {
      return fail(name, `expected exit 1; got ${run.code}; stdout=${run.stdout}`);
    }
    if (!run.stdout.includes('PatchEditor.tsx')) {
      return fail(name, `stdout missing holdout file path; got: ${run.stdout}`);
    }
    if (!run.stdout.includes('@/components/SlideDrawer')) {
      return fail(name, `stdout missing canonical 'from' path; got: ${run.stdout}`);
    }
    if (!run.stdout.includes('slide-drawer-promotion')) {
      return fail(name, `stdout missing manifest id; got: ${run.stdout}`);
    }
    return pass(name, 'holdout reported with file + manifest id + canonical from + message');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioExceptionHonored(): Promise<ScenarioResult> {
  const name = 'exception-honored';
  const fixture = await makeFixture('exception');
  try {
    await writeRegistry(fixture, WITH_EXCEPTION_REGISTRY);
    // SpecialEditor.tsx is exempted (no import) → must NOT be a holdout.
    await writeSource(fixture, 'modules/roland-sxx0-editor/src/SpecialEditor.tsx', HOLDOUT_SOURCE);
    // RegularEditor.tsx is NOT exempted and doesn't import → MUST be a holdout.
    await writeSource(fixture, 'modules/roland-sxx0-editor/src/RegularEditor.tsx', HOLDOUT_SOURCE);
    // CleanEditor.tsx imports the canonical path → must be an adopter.
    await writeSource(fixture, 'modules/roland-sxx0-editor/src/CleanEditor.tsx', IMPORTING_SOURCE);
    const run = await runScanner(args(fixture));
    if (run.code !== 1) {
      return fail(name, `expected exit 1 (one holdout); got ${run.code}; stdout=${run.stdout}`);
    }
    if (run.stdout.includes('SpecialEditor.tsx')) {
      return fail(name, `SpecialEditor.tsx should be exempted; got: ${run.stdout}`);
    }
    if (!run.stdout.includes('RegularEditor.tsx')) {
      return fail(name, `RegularEditor.tsx should be flagged as a holdout; got: ${run.stdout}`);
    }
    if (run.stdout.includes('CleanEditor.tsx')) {
      return fail(
        name,
        `CleanEditor.tsx imports the canonical path; should not appear: ${run.stdout}`,
      );
    }
    return pass(
      name,
      'exception path excluded from holdouts; non-exempted non-importer still flagged; adopter not flagged',
    );
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioBadException(): Promise<ScenarioResult> {
  const name = 'exception-path-not-in-glob-exits-two';
  const fixture = await makeFixture('badexcept');
  try {
    await writeRegistry(fixture, BAD_EXCEPTION_REGISTRY);
    await writeSource(fixture, 'modules/roland-sxx0-editor/src/AnyEditor.tsx', IMPORTING_SOURCE);
    const run = await runScanner(args(fixture));
    if (run.code !== 2) {
      return fail(
        name,
        `expected exit 2 (malformed: exception path doesn't match any glob); got ${run.code}; stderr=${run.stderr}`,
      );
    }
    if (!run.stderr.includes('somewhere/else/Unrelated.tsx')) {
      return fail(name, `stderr should name the bad exception path; got: ${run.stderr}`);
    }
    return pass(name, 'exception path outside any glob → exit 2 with descriptive error');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioMalformedRegistry(): Promise<ScenarioResult> {
  const name = 'malformed-registry-exits-two';
  const fixture = await makeFixture('malformed');
  try {
    await writeRegistry(fixture, MALFORMED_REGISTRY);
    await writeSource(fixture, 'modules/roland-sxx0-editor/src/a.tsx', 'export {};\n');
    const run = await runScanner(args(fixture));
    if (run.code !== 2) {
      return fail(name, `expected exit 2 (infra error); got ${run.code}; stderr=${run.stderr}`);
    }
    if (!run.stderr.includes('expected_adopters_glob')) {
      return fail(
        name,
        `expected error to mention missing field 'expected_adopters_glob'; stderr=${run.stderr}`,
      );
    }
    return pass(name, 'malformed registry → exit 2 with descriptive error');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioMultiGlob(): Promise<ScenarioResult> {
  const name = 'multi-glob-entry';
  const fixture = await makeFixture('multiglob');
  try {
    await writeRegistry(fixture, MULTI_GLOB_REGISTRY);
    // Holdout via glob #1.
    await writeSource(fixture, 'modules/roland-sxx0-editor/src/PatchesPage.tsx', HOLDOUT_SOURCE);
    // Adopter via glob #2.
    await writeSource(
      fixture,
      'modules/akai-s3k-editor/src/ProgramsPage.tsx',
      LIST_BANK_IMPORT_SOURCE,
    );
    // Holdout via glob #2.
    await writeSource(fixture, 'modules/akai-s3k-editor/src/SamplesPage.tsx', HOLDOUT_SOURCE);
    // Non-match (no glob hit at all).
    await writeSource(fixture, 'modules/unrelated-module/src/Something.tsx', HOLDOUT_SOURCE);
    const run = await runScanner(args(fixture));
    if (run.code !== 1) {
      return fail(name, `expected exit 1; got ${run.code}; stdout=${run.stdout}`);
    }
    if (!run.stdout.includes('PatchesPage.tsx')) {
      return fail(name, `expected PatchesPage.tsx (glob #1) to be flagged; stdout=${run.stdout}`);
    }
    if (!run.stdout.includes('SamplesPage.tsx')) {
      return fail(name, `expected SamplesPage.tsx (glob #2) to be flagged; stdout=${run.stdout}`);
    }
    if (run.stdout.includes('ProgramsPage.tsx')) {
      return fail(name, `ProgramsPage.tsx is an adopter; should not be flagged; stdout=${run.stdout}`);
    }
    if (run.stdout.includes('Something.tsx')) {
      return fail(
        name,
        `Something.tsx is outside both globs; should not be considered; stdout=${run.stdout}`,
      );
    }
    return pass(name, 'multi-glob entry flags holdouts across both globs; non-matching paths ignored');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioMultiGlobWithException(): Promise<ScenarioResult> {
  const name = 'multi-glob-with-exception';
  const fixture = await makeFixture('multiglobexc');
  try {
    await writeRegistry(fixture, MULTI_GLOB_WITH_EXCEPTION_REGISTRY);
    // Exempted in glob #1.
    await writeSource(fixture, 'modules/roland-sxx0-editor/src/SpecialPage.tsx', HOLDOUT_SOURCE);
    // Holdout in glob #2 (not exempted).
    await writeSource(fixture, 'modules/akai-s3k-editor/src/SamplesPage.tsx', HOLDOUT_SOURCE);
    const run = await runScanner(args(fixture));
    if (run.code !== 1) {
      return fail(name, `expected exit 1; got ${run.code}; stdout=${run.stdout}`);
    }
    if (run.stdout.includes('SpecialPage.tsx')) {
      return fail(name, `exempted file in glob #1 should not appear; stdout=${run.stdout}`);
    }
    if (!run.stdout.includes('SamplesPage.tsx')) {
      return fail(name, `expected non-exempted file in glob #2 to be flagged; stdout=${run.stdout}`);
    }
    return pass(name, 'exception applied across multi-glob entries; non-exempted holdouts surface');
  } finally {
    await cleanup(fixture);
  }
}

/**
 * Gutted-stub self-check. Plants a scanner stub that always exits 0,
 * then runs the holdout-detected assertion against the stub. The
 * assertion expects exit 1; the stub returns 0; the harness's
 * assertion MUST reject the stub.
 */
async function scenarioGuttedStub(): Promise<ScenarioResult> {
  const name = 'gutted-stub-self-check';
  const fixture = await makeFixture('gutted');
  const stubDir = await mkdtemp(join(tmpdir(), 'adopter-manifests-stub-'));
  const stubPath = join(stubDir, 'stub.ts');
  try {
    await writeFile(stubPath, 'process.exit(0);\n', 'utf8');
    await writeRegistry(fixture, SLIDE_DRAWER_REGISTRY);
    await writeSource(fixture, 'modules/roland-sxx0-editor/src/PatchEditor.tsx', HOLDOUT_SOURCE);
    const run = await runScanner(args(fixture), stubPath);
    if (run.code === 1) {
      return fail(name, 'stub returned 1; gutted self-check has no signal');
    }
    if (run.code === 0) {
      return pass(name, 'gutted stub returns 0; real assertion (expects 1) would reject it');
    }
    return fail(name, `unexpected stub exit code ${run.code}`);
  } finally {
    await cleanup(fixture);
    await rm(stubDir, { recursive: true, force: true });
  }
}

/** All scenarios in execution order. The validator entry-point runs each in sequence. */
export const SCENARIOS: ReadonlyArray<() => Promise<ScenarioResult>> = [
  scenarioEmptyRegistry,
  scenarioNoHoldouts,
  scenarioHoldoutDetected,
  scenarioExceptionHonored,
  scenarioBadException,
  scenarioMalformedRegistry,
  scenarioMultiGlob,
  scenarioMultiGlobWithException,
  scenarioGuttedStub,
];
