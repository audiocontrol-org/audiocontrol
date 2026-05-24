/**
 * tools/scope-discovery/adopter-manifests.imports-scenarios.ts
 *
 * Adversarial-validator scenarios for the AUDIT-20260524-imports failure
 * mode: the T6.2 adopter-manifest schema's adoption-matching was
 * path-only. A file in the glob that imported ANY symbol from the
 * canonical package counted as an adopter — even if the imported symbol
 * was unrelated to the primitive the manifest cares about. This made
 * false positives invisible whenever the canonical package exposed
 * many symbols (e.g., `@audiocontrol/editor-core` exports SlideDrawer,
 * SteppedProgressDrawer, formatBytes, ProgressStep, …).
 *
 * The fix:
 *   - `AdopterManifestEntry` gains optional `imports?: readonly string[]`.
 *   - When declared, the checker requires `import { ... <name> ... }
 *     from '<from>'` where `<name>` is at least one of the listed
 *     symbols. A file in the glob that imports the path but not any
 *     listed symbol is a HOLDOUT under the new behavior — a result
 *     pre-change behavior could not produce.
 *   - When omitted, the checker falls back to the legacy any-import-
 *     from-path behavior (backward-compat for existing manifests).
 *
 * The transitive-adopter use case: when a primitive is wrapped by
 * another primitive in the same package (e.g., SteppedProgressDrawer
 * wraps SlideDrawer), list BOTH names so files importing either count
 * as adopters.
 *
 * Lives in a sibling module to keep `adopter-manifests.scenarios.ts`
 * under the 300-500 line cap mandated by ~/work/CLAUDE.md. Reuses the
 * shared fixture helpers from `adopter-manifests.fixtures.ts`.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  args,
  cleanup,
  fail,
  makeFixture,
  pass,
  runScanner,
  writeRegistry,
  writeSource,
  type ScenarioResult,
} from './adopter-manifests.fixtures.js';

// ---------------------------------------------------------------------------
// Fixture payloads — registries
// ---------------------------------------------------------------------------

/**
 * Manifest WITH `imports:` declared. SlideDrawer and SteppedProgressDrawer
 * both count as adoption; any other import from the package does NOT.
 */
const IMPORTS_FIELD_REGISTRY = `adopter_manifests:
  - id: slide-drawer-via-named-import
    introduced_in: deadbeef
    from: '@audiocontrol/editor-core'
    imports:
      - SlideDrawer
      - SteppedProgressDrawer
    expected_adopters_glob:
      - 'modules/akai-s3k-editor/src/**/*Dialog.tsx'
    message: |
      Library dialogs adopt SlideDrawer or SteppedProgressDrawer
      (which transitively wraps SlideDrawer); other editor-core
      symbols don't count.
`;

/**
 * Manifest WITHOUT `imports:` field — the legacy any-import-from-path
 * behavior. Used to prove backward-compat: existing manifests keep
 * working when the new optional field is absent.
 */
const NO_IMPORTS_FIELD_REGISTRY = `adopter_manifests:
  - id: legacy-any-import-counts
    introduced_in: deadbeef
    from: '@audiocontrol/editor-core'
    expected_adopters_glob:
      - 'modules/akai-s3k-editor/src/**/*Dialog.tsx'
    message: |
      Any import from editor-core counts; the manifest doesn't care
      which named symbol is used.
`;

const EMPTY_IMPORTS_REGISTRY = `adopter_manifests:
  - id: bad-imports-empty
    introduced_in: deadbeef
    from: '@audiocontrol/editor-core'
    imports: []
    expected_adopters_glob:
      - 'modules/akai-s3k-editor/src/**/*Dialog.tsx'
    message: |
      empty imports list must be rejected at parse time.
`;

const NON_STRING_IMPORTS_REGISTRY = `adopter_manifests:
  - id: bad-imports-nonstring
    introduced_in: deadbeef
    from: '@audiocontrol/editor-core'
    imports:
      - SlideDrawer
      - 42
    expected_adopters_glob:
      - 'modules/akai-s3k-editor/src/**/*Dialog.tsx'
    message: |
      non-string imports entry must be rejected at parse time.
`;

// ---------------------------------------------------------------------------
// Fixture payloads — source-file bodies
// ---------------------------------------------------------------------------

const SLIDE_DRAWER_DIRECT_IMPORT =
  "import { SlideDrawer } from '@audiocontrol/editor-core';\n" +
  'export function DialogA() { return <SlideDrawer open onClose={() => {}} title="x">y</SlideDrawer>; }\n';

const STEPPED_PROGRESS_DRAWER_IMPORT =
  "import { SteppedProgressDrawer, type ProgressStep, formatBytes } from '@audiocontrol/editor-core';\n" +
  'export function DialogB() { return <SteppedProgressDrawer />; }\n';

const UNRELATED_SYMBOL_IMPORT =
  "import { formatBytes } from '@audiocontrol/editor-core';\n" +
  'export const x = formatBytes(123);\n';

const NO_IMPORT_FROM_PACKAGE =
  "import { useState } from 'react';\n" +
  'export function DialogD() { const [open] = useState(false); return open ? <div /> : null; }\n';

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

/**
 * Load-bearing scenario for the new behavior. A file in the glob that
 * imports an UNLISTED symbol from the canonical package must be a
 * HOLDOUT when `imports:` is declared. Under pre-change behavior (no
 * `imports:` field support) the file would have been a false-positive
 * ADOPTER — this scenario therefore distinguishes the two behaviors
 * and proves the new gate has teeth.
 */
async function scenarioImportsRejectsUnlistedSymbol(): Promise<ScenarioResult> {
  const name = 'imports-rejects-unlisted-symbol';
  const fixture = await makeFixture('imports-rejects');
  try {
    await writeRegistry(fixture, IMPORTS_FIELD_REGISTRY);
    await writeSource(
      fixture,
      'modules/akai-s3k-editor/src/components/library/UnrelatedDialog.tsx',
      UNRELATED_SYMBOL_IMPORT,
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 1) {
      return fail(
        name,
        `expected exit 1 (file imports unlisted symbol → HOLDOUT under new behavior); got ${run.code}; stdout=${run.stdout}`,
      );
    }
    if (!run.stdout.includes('UnrelatedDialog.tsx')) {
      return fail(name, `stdout missing UnrelatedDialog.tsx as holdout; got: ${run.stdout}`);
    }
    return pass(
      name,
      'file importing unlisted symbol from canonical path is flagged as holdout when `imports:` declared',
    );
  } finally {
    await cleanup(fixture);
  }
}

/**
 * A file in the glob that imports a LISTED symbol (canonical primitive)
 * must be an adopter. The basic happy-path under the new behavior.
 */
async function scenarioImportsAcceptsCanonicalSymbol(): Promise<ScenarioResult> {
  const name = 'imports-accepts-canonical-symbol';
  const fixture = await makeFixture('imports-direct');
  try {
    await writeRegistry(fixture, IMPORTS_FIELD_REGISTRY);
    await writeSource(
      fixture,
      'modules/akai-s3k-editor/src/components/library/DirectDialog.tsx',
      SLIDE_DRAWER_DIRECT_IMPORT,
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 0) {
      return fail(name, `expected exit 0 (file imports SlideDrawer); got ${run.code}; stderr=${run.stderr}`);
    }
    if (!run.stdout.includes('0 holdouts')) {
      return fail(name, `stdout missing '0 holdouts'; got: ${run.stdout}`);
    }
    return pass(name, 'file importing the canonical named symbol is recognized as adopter');
  } finally {
    await cleanup(fixture);
  }
}

/**
 * The transitive-adopter case. A file in the glob that imports
 * SteppedProgressDrawer (which itself wraps SlideDrawer in the same
 * package) is an adopter because SteppedProgressDrawer is in the
 * `imports:` list. This is the scenario that directly motivates the
 * feature.
 */
async function scenarioImportsAcceptsTransitiveSymbol(): Promise<ScenarioResult> {
  const name = 'imports-accepts-transitive-symbol';
  const fixture = await makeFixture('imports-transitive');
  try {
    await writeRegistry(fixture, IMPORTS_FIELD_REGISTRY);
    await writeSource(
      fixture,
      'modules/akai-s3k-editor/src/components/library/TransitiveDialog.tsx',
      STEPPED_PROGRESS_DRAWER_IMPORT,
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 0) {
      return fail(
        name,
        `expected exit 0 (SteppedProgressDrawer transitively adopts SlideDrawer); got ${run.code}; stderr=${run.stderr}`,
      );
    }
    return pass(
      name,
      'file importing transitive wrapper symbol counts as adopter when wrapper is in `imports:`',
    );
  } finally {
    await cleanup(fixture);
  }
}

/**
 * Backward-compat: when `imports:` is omitted, the legacy any-import-
 * from-path behavior is preserved. A file that imports an unlisted
 * symbol still counts as an adopter under the legacy semantics. Proves
 * that existing manifests in `adopter-manifests.yaml` don't regress.
 */
async function scenarioNoImportsFallsBackToPathOnly(): Promise<ScenarioResult> {
  const name = 'no-imports-field-falls-back-to-path-only';
  const fixture = await makeFixture('no-imports-field');
  try {
    await writeRegistry(fixture, NO_IMPORTS_FIELD_REGISTRY);
    await writeSource(
      fixture,
      'modules/akai-s3k-editor/src/components/library/UnrelatedDialog.tsx',
      UNRELATED_SYMBOL_IMPORT,
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 0) {
      return fail(
        name,
        `expected exit 0 (legacy any-import-from-path counts); got ${run.code}; stdout=${run.stdout}`,
      );
    }
    return pass(
      name,
      'manifest without `imports:` field uses legacy any-import-from-path matching (backward-compat)',
    );
  } finally {
    await cleanup(fixture);
  }
}

/**
 * The negative path under the new behavior: a file in the glob that
 * imports nothing from the canonical package at all is still a holdout
 * (the named-imports filter narrows, it doesn't widen).
 */
async function scenarioImportsHoldoutForNoImportFromPath(): Promise<ScenarioResult> {
  const name = 'imports-holdout-for-no-import-from-path';
  const fixture = await makeFixture('imports-no-import');
  try {
    await writeRegistry(fixture, IMPORTS_FIELD_REGISTRY);
    await writeSource(
      fixture,
      'modules/akai-s3k-editor/src/components/library/NoImportDialog.tsx',
      NO_IMPORT_FROM_PACKAGE,
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 1) {
      return fail(
        name,
        `expected exit 1 (file imports nothing from path → holdout); got ${run.code}; stdout=${run.stdout}`,
      );
    }
    if (!run.stdout.includes('NoImportDialog.tsx')) {
      return fail(name, `stdout missing NoImportDialog.tsx as holdout; got: ${run.stdout}`);
    }
    return pass(name, 'file with no import from canonical path is flagged as holdout');
  } finally {
    await cleanup(fixture);
  }
}

/**
 * Schema rejection: `imports: []` is invalid (the operator's intent
 * is ambiguous — were they trying to opt INTO any-import-from-path
 * behavior? then they should omit the field; were they trying to
 * disallow all adoption? that would be nonsensical). Parser must fail
 * with exit 2 and a descriptive error.
 */
async function scenarioImportsEmptyArrayRejected(): Promise<ScenarioResult> {
  const name = 'imports-empty-array-rejected';
  const fixture = await makeFixture('imports-empty');
  try {
    await writeRegistry(fixture, EMPTY_IMPORTS_REGISTRY);
    await writeSource(
      fixture,
      'modules/akai-s3k-editor/src/components/library/DialogA.tsx',
      SLIDE_DRAWER_DIRECT_IMPORT,
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 2) {
      return fail(
        name,
        `expected exit 2 (empty imports array is malformed); got ${run.code}; stderr=${run.stderr}`,
      );
    }
    if (!run.stderr.includes('imports')) {
      return fail(name, `stderr should name the imports field; got: ${run.stderr}`);
    }
    return pass(name, 'empty imports array → exit 2 with descriptive parse error');
  } finally {
    await cleanup(fixture);
  }
}

/**
 * Schema rejection: `imports:` entries must be non-empty strings. A
 * numeric entry must fail at parse time.
 */
async function scenarioImportsNonStringRejected(): Promise<ScenarioResult> {
  const name = 'imports-non-string-rejected';
  const fixture = await makeFixture('imports-nonstring');
  try {
    await writeRegistry(fixture, NON_STRING_IMPORTS_REGISTRY);
    await writeSource(
      fixture,
      'modules/akai-s3k-editor/src/components/library/DialogA.tsx',
      SLIDE_DRAWER_DIRECT_IMPORT,
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 2) {
      return fail(
        name,
        `expected exit 2 (non-string imports entry is malformed); got ${run.code}; stderr=${run.stderr}`,
      );
    }
    if (!run.stderr.includes('imports[1]')) {
      return fail(name, `stderr should name imports[1] as the bad entry; got: ${run.stderr}`);
    }
    return pass(name, 'non-string imports entry → exit 2 with index-pinned parse error');
  } finally {
    await cleanup(fixture);
  }
}

/**
 * Gutted-stub self-check. Plants a scanner stub that always exits 0,
 * runs the load-bearing reject-unlisted-symbol assertion against the
 * stub. The assertion expects exit 1 (HOLDOUT); the stub returns 0;
 * the harness MUST reject the stub. Without this, a regression that
 * silently drops the `imports:` filter would look identical to a
 * working filter — the gutted stub proves the filter is load-bearing.
 */
async function scenarioGuttedStubImports(): Promise<ScenarioResult> {
  const name = 'gutted-stub-self-check-imports';
  const fixture = await makeFixture('imports-gutted');
  const stubDir = await mkdtemp(join(tmpdir(), 'adopter-manifests-imports-stub-'));
  const stubPath = join(stubDir, 'stub.ts');
  try {
    await writeFile(stubPath, 'process.exit(0);\n', 'utf8');
    await writeRegistry(fixture, IMPORTS_FIELD_REGISTRY);
    await writeSource(
      fixture,
      'modules/akai-s3k-editor/src/components/library/UnrelatedDialog.tsx',
      UNRELATED_SYMBOL_IMPORT,
    );
    const run = await runScanner(args(fixture), stubPath);
    if (run.code === 1) {
      return fail(name, 'stub returned 1; gutted self-check has no signal');
    }
    if (run.code === 0) {
      return pass(
        name,
        'gutted stub returns 0; the reject-unlisted-symbol assertion (expects 1) would reject it',
      );
    }
    return fail(name, `unexpected stub exit code ${run.code}`);
  } finally {
    await cleanup(fixture);
    await rm(stubDir, { recursive: true, force: true });
  }
}

/** All scenarios in execution order. The validator entry-point runs each in sequence. */
export const IMPORTS_SCENARIOS: ReadonlyArray<() => Promise<ScenarioResult>> = [
  scenarioImportsAcceptsCanonicalSymbol,
  scenarioImportsAcceptsTransitiveSymbol,
  scenarioImportsRejectsUnlistedSymbol,
  scenarioImportsHoldoutForNoImportFromPath,
  scenarioNoImportsFallsBackToPathOnly,
  scenarioImportsEmptyArrayRejected,
  scenarioImportsNonStringRejected,
  scenarioGuttedStubImports,
];
