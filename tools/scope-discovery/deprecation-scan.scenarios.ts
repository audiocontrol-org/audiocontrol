/**
 * tools/scope-discovery/deprecation-scan.scenarios.ts
 *
 * Adversarial validator scenarios for the T6.4 deprecation scan. Each
 * scenario:
 *   - builds a per-scenario temp-dir fixture via `makeFixture`,
 *   - plants synthetic source files (some with deprecation markers,
 *     some with importer references),
 *   - invokes the scanner via `runScanner` (a thin wrapper around
 *     `util/run-scanner.ts`'s subprocess helper),
 *   - asserts exit code + stdout substrings,
 *   - cleans up in a `finally`.
 *
 * Scenarios cover the v1 marker grammar (file-level JSDoc + inline
 * line-comment), the importer-detection regex (alias + relative
 * paths), the self-importer exclusion, the queue-bucket assignment,
 * the `--write` artifact, and a gutted-stub self-check that confirms
 * the harness's assertions have signal.
 *
 * The validator entry-point (`deprecation-scan.validate.ts`) imports
 * `SCENARIOS` and runs each in sequence; this module is otherwise
 * side-effect-free.
 */

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runScannerSubprocess, type ScannerRun } from './util/run-scanner.js';

const SCANNER_ENTRY = 'tools/scope-discovery/check-deprecations.ts';

export interface ScenarioResult {
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
}

interface Fixture {
  readonly scanRoot: string;
  readonly dir: string;
}

async function makeFixture(slug: string): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), `deprecation-scan-${slug}-`));
  const scanRoot = join(root, 'repo');
  await mkdir(scanRoot, { recursive: true });
  return { scanRoot, dir: root };
}

async function cleanup(fixture: Fixture): Promise<void> {
  await rm(fixture.dir, { recursive: true, force: true });
}

async function writeSource(
  fixture: Fixture,
  relPath: string,
  content: string,
): Promise<void> {
  const full = join(fixture.scanRoot, relPath);
  const lastSlash = full.lastIndexOf('/');
  if (lastSlash > fixture.scanRoot.length) {
    await mkdir(full.substring(0, lastSlash), { recursive: true });
  }
  await writeFile(full, content, 'utf8');
}

function scannerArgs(
  fixture: Fixture,
  extra: readonly string[] = [],
): string[] {
  return ['--root', fixture.scanRoot, ...extra];
}

function runScanner(args: readonly string[], entry = SCANNER_ENTRY): Promise<ScannerRun> {
  return runScannerSubprocess(entry, args);
}

function pass(name: string, detail: string): ScenarioResult {
  return { name, passed: true, detail };
}

function fail(name: string, detail: string): ScenarioResult {
  return { name, passed: false, detail };
}

// ---------------------------------------------------------------------------
// Canned source payloads
// ---------------------------------------------------------------------------

const DEPRECATED_JSDOC_TOP =
  '/**\n' +
  ' * Old envelope display — superseded.\n' +
  ' *\n' +
  ' * @deprecated Use AcEnvelope from editor-core; this file is the\n' +
  " *   audit-and-delete candidate for the next refactor commit.\n" +
  ' */\n' +
  '\n' +
  'export function OldEnvelope() { return null; }\n';

const DEPRECATED_INLINE_TOP =
  '// DEPRECATED: Replaced by AcEnvelope; delete in the next refactor commit.\n' +
  '\n' +
  'export function OldInlineComponent() { return null; }\n';

const DEPRECATED_TOP_NO_MESSAGE =
  '/**\n' +
  ' * @deprecated\n' +
  ' */\n' +
  '\n' +
  'export const x = 1;\n';

const NOT_DEPRECATED_TOP =
  '/**\n' +
  ' * Regular file, no deprecation tag.\n' +
  ' */\n' +
  '\n' +
  'export const live = 1;\n';

// Symbol-level only — should NOT count as file-level deprecation.
const SYMBOL_LEVEL_DEPRECATED =
  '/**\n' +
  ' * Mixed-export file — most exports live, one symbol deprecated.\n' +
  ' */\n' +
  '\n' +
  'export function live() { return 1; }\n' +
  '\n' +
  '/**\n' +
  ' * @deprecated Use live() instead.\n' +
  ' */\n' +
  'export function legacy() { return 2; }\n';

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

async function scenarioNoDeprecatedFiles(): Promise<ScenarioResult> {
  const name = 'no-deprecated-files';
  const fixture = await makeFixture('empty');
  try {
    await writeSource(fixture, 'modules/foo-editor/src/Live.ts', NOT_DEPRECATED_TOP);
    const run = await runScanner(scannerArgs(fixture));
    if (run.code !== 0) {
      return fail(name, `expected exit 0; got ${run.code}; stderr=${run.stderr}`);
    }
    if (!run.stdout.includes('nothing to track')) {
      return fail(name, `summary missing 'nothing to track'; got: ${run.stdout}`);
    }
    if (!run.stdout.includes('0 deprecated files')) {
      return fail(name, `summary missing '0 deprecated files'; got: ${run.stdout}`);
    }
    return pass(name, 'no markers → exit 0; summary names zero deprecated files');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioSafeToDelete(): Promise<ScenarioResult> {
  const name = 'zero-importers-safe-to-delete';
  const fixture = await makeFixture('safe');
  try {
    await writeSource(
      fixture,
      'modules/foo-editor/src/components/OldThing.ts',
      DEPRECATED_JSDOC_TOP,
    );
    const run = await runScanner(scannerArgs(fixture));
    if (run.code !== 0) {
      return fail(name, `expected exit 0; got ${run.code}; stderr=${run.stderr}`);
    }
    if (!run.stdout.includes('Safe to delete (importers === 0): 1')) {
      return fail(name, `report missing safe-to-delete count; got: ${run.stdout}`);
    }
    if (!run.stdout.includes('modules/foo-editor/src/components/OldThing.ts')) {
      return fail(name, `report missing deprecated file path; got: ${run.stdout}`);
    }
    if (!run.stdout.includes('Blocked (importers > 0): 0')) {
      return fail(name, `expected zero blocked files; got: ${run.stdout}`);
    }
    return pass(name, 'deprecated file with zero importers → safe-to-delete queue');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioBlockedWithImporters(): Promise<ScenarioResult> {
  const name = 'n-importers-all-named';
  const fixture = await makeFixture('blocked');
  try {
    await writeSource(
      fixture,
      'modules/foo-editor/src/hooks/useOld.ts',
      DEPRECATED_JSDOC_TOP,
    );
    // Three external importers — alias form, relative form, and dynamic import.
    await writeSource(
      fixture,
      'modules/foo-editor/src/A.tsx',
      "import { useOld } from '@/hooks/useOld';\nexport const a = useOld;\n",
    );
    await writeSource(
      fixture,
      'modules/foo-editor/src/B.tsx',
      "import { useOld } from './hooks/useOld';\nexport const b = useOld;\n",
    );
    await writeSource(
      fixture,
      'modules/foo-editor/src/sub/C.tsx',
      "const m = await import('../hooks/useOld');\nexport const c = m;\n",
    );
    const run = await runScanner(scannerArgs(fixture));
    if (run.code !== 0) {
      return fail(name, `expected exit 0; got ${run.code}; stderr=${run.stderr}`);
    }
    if (!run.stdout.includes('Blocked (importers > 0): 1')) {
      return fail(name, `expected 1 blocked file; got: ${run.stdout}`);
    }
    if (!run.stdout.includes('importers: 3')) {
      return fail(name, `expected importers: 3; got: ${run.stdout}`);
    }
    for (const importer of ['src/A.tsx', 'src/B.tsx', 'src/sub/C.tsx']) {
      if (!run.stdout.includes(importer)) {
        return fail(name, `expected importer '${importer}' in report; got: ${run.stdout}`);
      }
    }
    return pass(name, 'deprecated file with 3 importers → all named under blocked queue');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioMixedQueues(): Promise<ScenarioResult> {
  const name = 'mixed-blocked-and-safe';
  const fixture = await makeFixture('mixed');
  try {
    await writeSource(
      fixture,
      'modules/foo-editor/src/hooks/useOld.ts',
      DEPRECATED_JSDOC_TOP,
    );
    await writeSource(
      fixture,
      'modules/foo-editor/src/hooks/useUnused.ts',
      DEPRECATED_JSDOC_TOP,
    );
    await writeSource(
      fixture,
      'modules/foo-editor/src/A.tsx',
      "import { useOld } from '@/hooks/useOld';\nexport const a = useOld;\n",
    );
    const run = await runScanner(scannerArgs(fixture));
    if (run.code !== 0) {
      return fail(name, `expected exit 0; got ${run.code}; stderr=${run.stderr}`);
    }
    if (!run.stdout.includes('Blocked (importers > 0): 1')) {
      return fail(name, `expected 1 blocked file; got: ${run.stdout}`);
    }
    if (!run.stdout.includes('Safe to delete (importers === 0): 1')) {
      return fail(name, `expected 1 safe-to-delete file; got: ${run.stdout}`);
    }
    if (!run.stdout.includes('Total: 2 deprecated file(s); 1 blocked; 1 safe to delete')) {
      return fail(name, `expected combined total; got: ${run.stdout}`);
    }
    return pass(name, 'two deprecated files split correctly between blocked + safe-to-delete');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioJsdocFormRecognized(): Promise<ScenarioResult> {
  const name = 'jsdoc-deprecated-tag-recognized';
  const fixture = await makeFixture('jsdoc');
  try {
    await writeSource(
      fixture,
      'modules/foo-editor/src/Old.ts',
      DEPRECATED_JSDOC_TOP,
    );
    const run = await runScanner(scannerArgs(fixture));
    if (run.code !== 0) return fail(name, `expected exit 0; got ${run.code}`);
    if (!run.stdout.includes('`@deprecated')) {
      return fail(name, `expected JSDoc marker formatting in report; got: ${run.stdout}`);
    }
    return pass(name, 'JSDoc @deprecated form picked up and tagged in output');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioInlineFormRecognized(): Promise<ScenarioResult> {
  const name = 'inline-DEPRECATED-marker-recognized';
  const fixture = await makeFixture('inline');
  try {
    await writeSource(
      fixture,
      'modules/foo-editor/src/Old.ts',
      DEPRECATED_INLINE_TOP,
    );
    const run = await runScanner(scannerArgs(fixture));
    if (run.code !== 0) return fail(name, `expected exit 0; got ${run.code}`);
    if (!run.stdout.includes('`// DEPRECATED:')) {
      return fail(name, `expected inline marker formatting in report; got: ${run.stdout}`);
    }
    return pass(name, 'inline // DEPRECATED: marker picked up and tagged in output');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioMessageExtracted(): Promise<ScenarioResult> {
  const name = 'deprecation-message-surfaces';
  const fixture = await makeFixture('msg');
  try {
    await writeSource(
      fixture,
      'modules/foo-editor/src/Old.ts',
      DEPRECATED_JSDOC_TOP,
    );
    const run = await runScanner(scannerArgs(fixture));
    if (run.code !== 0) return fail(name, `expected exit 0; got ${run.code}`);
    if (!run.stdout.includes('Use AcEnvelope from editor-core')) {
      return fail(name, `expected deprecation message in output; got: ${run.stdout}`);
    }
    return pass(name, 'message body after @deprecated reaches the report');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioSelfImporterIgnored(): Promise<ScenarioResult> {
  const name = 'self-importer-ignored';
  const fixture = await makeFixture('self');
  try {
    // A deprecated file that re-exports its own contents under a
    // different name. The scanner must NOT count this self-reference
    // as an external importer.
    const SELF_REEXPORT =
      '/**\n' +
      ' * @deprecated Use the new module.\n' +
      ' */\n' +
      '\n' +
      "export { OldThing as Renamed } from './Old';\n";
    await writeSource(fixture, 'modules/foo-editor/src/Old.ts', SELF_REEXPORT);
    const run = await runScanner(scannerArgs(fixture));
    if (run.code !== 0) return fail(name, `expected exit 0; got ${run.code}`);
    if (!run.stdout.includes('Safe to delete (importers === 0): 1')) {
      return fail(name, `self-importer not ignored; got: ${run.stdout}`);
    }
    return pass(name, "file's own re-export of itself does not count as an external importer");
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioSymbolLevelIgnored(): Promise<ScenarioResult> {
  const name = 'symbol-level-deprecation-not-flagged';
  const fixture = await makeFixture('symbol');
  try {
    // File-level docblock has no @deprecated; the @deprecated tag is
    // on a single exported function. v1 grammar is file-level only,
    // so this file MUST NOT appear in the report.
    await writeSource(
      fixture,
      'modules/foo-editor/src/Mixed.ts',
      SYMBOL_LEVEL_DEPRECATED,
    );
    const run = await runScanner(scannerArgs(fixture));
    if (run.code !== 0) return fail(name, `expected exit 0; got ${run.code}`);
    if (!run.stdout.includes('nothing to track')) {
      return fail(
        name,
        `symbol-level @deprecated incorrectly flagged as file-level; got: ${run.stdout}`,
      );
    }
    return pass(name, 'symbol-level @deprecated is out of v1 scope; file does not surface');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioEmptyMessageOk(): Promise<ScenarioResult> {
  const name = 'empty-message-allowed';
  const fixture = await makeFixture('empty-msg');
  try {
    await writeSource(
      fixture,
      'modules/foo-editor/src/Old.ts',
      DEPRECATED_TOP_NO_MESSAGE,
    );
    const run = await runScanner(scannerArgs(fixture));
    if (run.code !== 0) return fail(name, `expected exit 0; got ${run.code}`);
    if (!run.stdout.includes('modules/foo-editor/src/Old.ts')) {
      return fail(name, `file with bare @deprecated not surfaced; got: ${run.stdout}`);
    }
    if (!run.stdout.includes('`@deprecated`')) {
      return fail(name, `bare @deprecated (no message) rendering wrong; got: ${run.stdout}`);
    }
    return pass(name, 'bare @deprecated (no inline message) still surfaces');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioWriteArtifact(): Promise<ScenarioResult> {
  const name = 'write-flag-creates-markdown';
  const fixture = await makeFixture('write');
  try {
    await writeSource(
      fixture,
      'modules/foo-editor/src/Old.ts',
      DEPRECATED_JSDOC_TOP,
    );
    const artifactRel = 'deprecation-queue.md';
    const run = await runScanner(
      scannerArgs(fixture, ['--write', '--artifact', artifactRel, '--quiet']),
    );
    if (run.code !== 0) {
      return fail(name, `expected exit 0; got ${run.code}; stderr=${run.stderr}`);
    }
    const body = await readFile(join(fixture.scanRoot, artifactRel), 'utf8');
    if (!body.startsWith('# Deprecation queue')) {
      return fail(name, `artifact missing expected header; got: ${body.slice(0, 100)}`);
    }
    if (!body.includes('Safe to delete (importers === 0): 1')) {
      return fail(name, `artifact missing safe-to-delete count; got: ${body.slice(0, 400)}`);
    }
    if (!body.includes('modules/foo-editor/src/Old.ts')) {
      return fail(name, `artifact missing deprecated path; got: ${body.slice(0, 400)}`);
    }
    return pass(name, '--write produces well-formed markdown artifact at --artifact path');
  } finally {
    await cleanup(fixture);
  }
}

/**
 * Gutted-stub self-check. Plants a stub that always reports "no
 * deprecated files." Runs the N-importers scenario against the stub;
 * the stub returns 0 with no blocked queue — so the harness's
 * assertion MUST reject it. Confirms the blocked-with-importers
 * assertion has real signal.
 */
async function scenarioGuttedStub(): Promise<ScenarioResult> {
  const name = 'gutted-stub-self-check';
  const fixture = await makeFixture('gutted');
  const stubDir = await mkdtemp(join(tmpdir(), 'deprecation-stub-'));
  const stubPath = join(stubDir, 'stub.ts');
  try {
    await writeFile(
      stubPath,
      "process.stdout.write('# Deprecation queue\\n\\n');\n" +
        "process.stdout.write('Nothing to track.\\n');\n" +
        "process.stdout.write('deprecation-scan: 0 deprecated files; nothing to track.\\n');\n" +
        'process.exit(0);\n',
      'utf8',
    );
    // Plant a file the REAL scanner would surface — to make sure the
    // stub diverges from the real scanner's output.
    await writeSource(
      fixture,
      'modules/foo-editor/src/hooks/useOld.ts',
      DEPRECATED_JSDOC_TOP,
    );
    await writeSource(
      fixture,
      'modules/foo-editor/src/A.tsx',
      "import { useOld } from '@/hooks/useOld';\nexport const a = useOld;\n",
    );
    const run = await runScanner(scannerArgs(fixture), stubPath);
    // The real-scanner assertion (scenarioBlockedWithImporters) expects
    // "Blocked (importers > 0): 1" + "importers: 3" — the stub emits
    // neither. We assert here that the stub fails those checks; that's
    // the signal the harness has.
    if (run.code === 0 && !run.stdout.includes('Blocked (importers > 0): 1')) {
      return pass(
        name,
        'gutted stub returns 0 with no blocked queue; the real assertion would reject it',
      );
    }
    return fail(name, `stub diverged unexpectedly; code=${run.code}; stdout=${run.stdout}`);
  } finally {
    await cleanup(fixture);
    await rm(stubDir, { recursive: true, force: true });
  }
}

/** All scenarios in execution order. */
export const SCENARIOS: ReadonlyArray<() => Promise<ScenarioResult>> = [
  scenarioNoDeprecatedFiles,
  scenarioSafeToDelete,
  scenarioBlockedWithImporters,
  scenarioMixedQueues,
  scenarioJsdocFormRecognized,
  scenarioInlineFormRecognized,
  scenarioMessageExtracted,
  scenarioSelfImporterIgnored,
  scenarioSymbolLevelIgnored,
  scenarioEmptyMessageOk,
  scenarioWriteArtifact,
  scenarioGuttedStub,
];
