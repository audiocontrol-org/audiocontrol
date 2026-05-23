/**
 * tools/scope-discovery/editor-symmetry.scenarios.ts
 *
 * Scenario library for the T6.3 cross-editor symmetry adversarial
 * validator. Fixture builders + canned payloads live in
 * `editor-symmetry.fixtures.ts` (so this file stays under the cap).
 *
 * Each scenario:
 *   - builds a per-scenario temp dir via `makeFixture`,
 *   - plants synthetic registry + source files,
 *   - invokes the scanner via `runScanner`,
 *   - asserts exit code + stdout substrings,
 *   - cleans up in a `finally`.
 *
 * The validator entry-point (`editor-symmetry.validate.ts`) imports
 * `SCENARIOS` and runs each in sequence; this module is otherwise
 * side-effect-free.
 */

import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  cleanup,
  makeFixture,
  payloads,
  runScanner,
  scannerArgs as args,
  writeRegistry,
  writeSource,
} from './editor-symmetry.fixtures.js';

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

const EDITORS_TWO = ['roland-sxx0-editor', 'akai-s3k-editor'];
const EDITORS_THREE = ['roland-sxx0-editor', 'akai-s3k-editor', 'jv1080-editor'];

async function scenarioEmptyRegistry(): Promise<ScenarioResult> {
  const name = 'empty-registry-empty-matrix';
  const fixture = await makeFixture('empty', EDITORS_TWO);
  try {
    await writeRegistry(fixture, payloads.EMPTY_REGISTRY_YAML);
    const run = await runScanner(args(fixture));
    if (run.code !== 0) {
      return fail(name, `expected exit 0; got ${run.code}; stderr=${run.stderr}`);
    }
    if (
      !run.stdout.includes('matrix is empty') &&
      !run.stdout.includes('No adopter-manifest entries')
    ) {
      return fail(name, `stdout missing 'no manifests' placeholder; got: ${run.stdout}`);
    }
    if (!run.stdout.includes('registry empty')) {
      return fail(name, `stdout missing summary line; got: ${run.stdout}`);
    }
    return pass(name, 'empty registry → exit 0; placeholder body emitted; no rows');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioSingleEditorOk(): Promise<ScenarioResult> {
  const name = 'single-editor-all-adopt';
  const fixture = await makeFixture('single-ok', EDITORS_TWO);
  try {
    await writeRegistry(fixture, payloads.SINGLE_EDITOR_REGISTRY);
    await writeSource(
      fixture,
      'modules/roland-sxx0-editor/src/PatchEditor.tsx',
      payloads.IMPORTING_SOURCE,
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 0) {
      return fail(name, `expected exit 0; got ${run.code}; stdout=${run.stdout}`);
    }
    if (!run.stdout.includes('✓ 1/1')) {
      return fail(name, `expected '✓ 1/1' cell for roland; got: ${run.stdout}`);
    }
    if (!run.stdout.includes('| —')) {
      return fail(
        name,
        `expected n/a cell for akai (manifest targets only roland); got: ${run.stdout}`,
      );
    }
    return pass(name, 'single-editor entry: roland ✓ 1/1; akai —');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioSingleEditorPartial(): Promise<ScenarioResult> {
  const name = 'single-editor-partial-adoption';
  const fixture = await makeFixture('single-partial', EDITORS_TWO);
  try {
    await writeRegistry(fixture, payloads.SINGLE_EDITOR_REGISTRY);
    await writeSource(
      fixture,
      'modules/roland-sxx0-editor/src/AdoptEditor.tsx',
      payloads.IMPORTING_SOURCE,
    );
    await writeSource(
      fixture,
      'modules/roland-sxx0-editor/src/HoldoutEditor.tsx',
      payloads.HOLDOUT_SOURCE,
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 1) {
      return fail(name, `expected exit 1 (one ⚠ cell); got ${run.code}; stdout=${run.stdout}`);
    }
    if (!run.stdout.includes('⚠ 1/2 (1 holdout)')) {
      return fail(name, `expected '⚠ 1/2 (1 holdout)' cell; got: ${run.stdout}`);
    }
    return pass(name, 'single-editor entry, 1 of 2 files adopts → ⚠ cell surfaces; exit 1');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioMultiEditorAllAdopt(): Promise<ScenarioResult> {
  const name = 'multi-editor-all-adopt';
  const fixture = await makeFixture('multi-ok', EDITORS_TWO);
  try {
    await writeRegistry(fixture, payloads.MULTI_EDITOR_REGISTRY);
    await writeSource(
      fixture,
      'modules/roland-sxx0-editor/src/PatchesPage.tsx',
      payloads.LIST_BANK_IMPORT_SOURCE,
    );
    await writeSource(
      fixture,
      'modules/akai-s3k-editor/src/ProgramsPage.tsx',
      payloads.LIST_BANK_IMPORT_SOURCE,
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 0) {
      return fail(name, `expected exit 0; got ${run.code}; stdout=${run.stdout}`);
    }
    const okCells = (run.stdout.match(/✓ 1\/1/g) ?? []).length;
    if (okCells !== 2) {
      return fail(
        name,
        `expected 2 '✓ 1/1' cells (one per editor); got ${okCells} in: ${run.stdout}`,
      );
    }
    return pass(name, 'multi-editor entry, all editors adopt → two ✓ cells; exit 0');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioMultiEditorPartial(): Promise<ScenarioResult> {
  const name = 'multi-editor-n-minus-1-adopt';
  const fixture = await makeFixture('multi-partial', EDITORS_TWO);
  try {
    await writeRegistry(fixture, payloads.MULTI_EDITOR_REGISTRY);
    await writeSource(
      fixture,
      'modules/roland-sxx0-editor/src/PatchesPage.tsx',
      payloads.LIST_BANK_IMPORT_SOURCE,
    );
    await writeSource(
      fixture,
      'modules/akai-s3k-editor/src/ProgramsPage.tsx',
      payloads.HOLDOUT_SOURCE,
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 1) {
      return fail(name, `expected exit 1 (akai missing); got ${run.code}; stdout=${run.stdout}`);
    }
    if (!run.stdout.includes('✓ 1/1')) {
      return fail(name, `expected '✓ 1/1' for roland; got: ${run.stdout}`);
    }
    if (!(run.stdout.includes('✗ 0/1') || run.stdout.includes('⚠'))) {
      return fail(
        name,
        `expected ✗ or ⚠ cell for akai (file matches glob but no adopter); got: ${run.stdout}`,
      );
    }
    return pass(
      name,
      'multi-editor entry, N-1 adopt → adopting editor ✓; missing editor surfaces as ✗/⚠',
    );
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioMultiEditorMissingNoFiles(): Promise<ScenarioResult> {
  const name = 'multi-editor-missing-editor-no-files';
  const fixture = await makeFixture('multi-missing', EDITORS_TWO);
  try {
    await writeRegistry(fixture, payloads.MULTI_EDITOR_REGISTRY);
    await writeSource(
      fixture,
      'modules/roland-sxx0-editor/src/PatchesPage.tsx',
      payloads.LIST_BANK_IMPORT_SOURCE,
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 1) {
      return fail(
        name,
        `expected exit 1 (akai has zero matching files); got ${run.code}; stdout=${run.stdout}`,
      );
    }
    if (!run.stdout.includes('✓ 1/1')) {
      return fail(name, `expected '✓ 1/1' for roland; got: ${run.stdout}`);
    }
    if (!run.stdout.includes('✗ no matching files')) {
      return fail(
        name,
        `expected '✗ no matching files' for akai (targeted but zero files); got: ${run.stdout}`,
      );
    }
    return pass(name, 'targeted editor with zero glob-matched files → ✗ no matching files');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioNotTargetedEditorIsNa(): Promise<ScenarioResult> {
  const name = 'editor-not-in-glob-is-na';
  const fixture = await makeFixture('na', EDITORS_THREE);
  try {
    await writeRegistry(fixture, payloads.SINGLE_EDITOR_REGISTRY);
    await writeSource(
      fixture,
      'modules/roland-sxx0-editor/src/AnEditor.tsx',
      payloads.IMPORTING_SOURCE,
    );
    await writeSource(fixture, 'modules/jv1080-editor/src/Other.tsx', 'export const x = 1;\n');
    const run = await runScanner(args(fixture));
    if (run.code !== 0) {
      return fail(name, `expected exit 0; got ${run.code}; stdout=${run.stdout}`);
    }
    const dataRow = run.stdout
      .split('\n')
      .find((l) => l.includes('slide-drawer-promotion') && l.startsWith('|'));
    if (dataRow === undefined) {
      return fail(name, `data row not found in stdout: ${run.stdout}`);
    }
    const naCount = (dataRow.match(/\| —/g) ?? []).length;
    if (naCount !== 2) {
      return fail(name, `expected 2 n/a cells in row; got ${naCount} in '${dataRow}'`);
    }
    return pass(name, 'editors not in glob render as — (n/a); not as ✗');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioExceptionHonored(): Promise<ScenarioResult> {
  const name = 'exception-counts-toward-expected';
  const fixture = await makeFixture('except', EDITORS_TWO);
  try {
    await writeRegistry(fixture, payloads.WITH_EXCEPTION_REGISTRY);
    await writeSource(
      fixture,
      'modules/roland-sxx0-editor/src/SpecialEditor.tsx',
      payloads.HOLDOUT_SOURCE,
    );
    await writeSource(
      fixture,
      'modules/roland-sxx0-editor/src/CleanEditor.tsx',
      payloads.IMPORTING_SOURCE,
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 0) {
      return fail(
        name,
        `expected exit 0 (exception + adopter = 2/2, no holdouts); got ${run.code}; stdout=${run.stdout}`,
      );
    }
    if (!run.stdout.includes('✓ 2/2')) {
      return fail(
        name,
        `expected '✓ 2/2' cell (1 adopter + 1 exception = 2/2); got: ${run.stdout}`,
      );
    }
    return pass(name, 'exception path counts toward expected; matrix shows ✓ 2/2; exit 0');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioMarkdownStructure(): Promise<ScenarioResult> {
  const name = 'matrix-is-valid-markdown';
  const fixture = await makeFixture('md', EDITORS_TWO);
  try {
    await writeRegistry(fixture, payloads.MULTI_EDITOR_REGISTRY);
    await writeSource(
      fixture,
      'modules/roland-sxx0-editor/src/PatchesPage.tsx',
      payloads.LIST_BANK_IMPORT_SOURCE,
    );
    await writeSource(
      fixture,
      'modules/akai-s3k-editor/src/ProgramsPage.tsx',
      payloads.LIST_BANK_IMPORT_SOURCE,
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 0) {
      return fail(name, `expected exit 0; got ${run.code}; stdout=${run.stdout}`);
    }
    const lines = run.stdout.split('\n');
    const headerIdx = lines.findIndex((l) => l.startsWith('| Convention |'));
    if (headerIdx === -1) {
      return fail(name, `markdown header row not found; got:\n${run.stdout}`);
    }
    const sepLine = lines[headerIdx + 1];
    if (sepLine === undefined || !/^\|(?:\s*---\s*\|)+$/.test(sepLine)) {
      return fail(name, `markdown separator row malformed: '${sepLine}'`);
    }
    const dataLine = lines[headerIdx + 2];
    if (dataLine === undefined || !dataLine.startsWith('|')) {
      return fail(name, `expected data row after separator; got: '${dataLine}'`);
    }
    const headerCells = lines[headerIdx].split('|').length;
    const dataCells = dataLine.split('|').length;
    if (headerCells !== dataCells) {
      return fail(name, `header has ${headerCells} cells; data has ${dataCells}`);
    }
    return pass(
      name,
      'matrix renders as a syntactically valid GFM table (header + separator + data, column-count parity)',
    );
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioWriteArtifact(): Promise<ScenarioResult> {
  const name = 'write-flag-creates-artifact';
  const fixture = await makeFixture('write', EDITORS_TWO);
  try {
    await writeRegistry(fixture, payloads.SINGLE_EDITOR_REGISTRY);
    await writeSource(
      fixture,
      'modules/roland-sxx0-editor/src/AnEditor.tsx',
      payloads.IMPORTING_SOURCE,
    );
    const artifactPath = 'editor-symmetry-test.md';
    const run = await runScanner(
      args(fixture, ['--write', '--artifact', artifactPath, '--quiet']),
    );
    if (run.code !== 0) {
      return fail(name, `expected exit 0; got ${run.code}; stdout=${run.stdout}`);
    }
    const artifactBody = await readFile(join(fixture.scanRoot, artifactPath), 'utf8');
    if (!artifactBody.startsWith('# Cross-editor symmetry matrix')) {
      return fail(
        name,
        `artifact missing expected header; got: ${artifactBody.slice(0, 100)}`,
      );
    }
    if (!artifactBody.includes('✓ 1/1')) {
      return fail(name, `artifact missing expected cell; got: ${artifactBody.slice(0, 200)}`);
    }
    return pass(name, '--write produces artifact at --artifact path with rendered matrix');
  } finally {
    await cleanup(fixture);
  }
}

/**
 * Gutted-stub self-check. Plants a stub that always emits a ✓ matrix
 * (i.e., never surfaces a missing editor). Runs the missing-editor
 * assertion against the stub; the stub returns 0 with no ✗ — so the
 * harness's assertion MUST reject it. Confirms the multi-editor-
 * missing assertion has real signal.
 */
async function scenarioGuttedStub(): Promise<ScenarioResult> {
  const name = 'gutted-stub-self-check';
  const fixture = await makeFixture('gutted', EDITORS_TWO);
  const stubDir = await mkdtemp(join(tmpdir(), 'editor-symmetry-stub-'));
  const stubPath = join(stubDir, 'stub.ts');
  try {
    await writeFile(
      stubPath,
      "process.stdout.write('| Convention | roland-sxx0-editor | akai-s3k-editor |\\n');\n" +
        "process.stdout.write('| --- | --- | --- |\\n');\n" +
        "process.stdout.write('| shared-list-bank | ✓ 1/1 | ✓ 1/1 |\\n');\n" +
        'process.exit(0);\n',
      'utf8',
    );
    await writeRegistry(fixture, payloads.MULTI_EDITOR_REGISTRY);
    await writeSource(
      fixture,
      'modules/roland-sxx0-editor/src/PatchesPage.tsx',
      payloads.LIST_BANK_IMPORT_SOURCE,
    );
    const run = await runScanner(args(fixture), stubPath);
    if (run.code === 1 && run.stdout.includes('✗ no matching files')) {
      return fail(name, 'stub matched the assertion exactly; gutted self-check has no signal');
    }
    if (run.code === 0 && !run.stdout.includes('✗ no matching files')) {
      return pass(
        name,
        'gutted stub returns 0 with all-✓ matrix; the real assertion (expects ✗ + exit 1) would reject it',
      );
    }
    return fail(name, `unexpected stub exit code ${run.code}; stdout=${run.stdout}`);
  } finally {
    await cleanup(fixture);
    await rm(stubDir, { recursive: true, force: true });
  }
}

/** All scenarios in execution order. */
export const SCENARIOS: ReadonlyArray<() => Promise<ScenarioResult>> = [
  scenarioEmptyRegistry,
  scenarioSingleEditorOk,
  scenarioSingleEditorPartial,
  scenarioMultiEditorAllAdopt,
  scenarioMultiEditorPartial,
  scenarioMultiEditorMissingNoFiles,
  scenarioNotTargetedEditorIsNa,
  scenarioExceptionHonored,
  scenarioMarkdownStructure,
  scenarioWriteArtifact,
  scenarioGuttedStub,
];
