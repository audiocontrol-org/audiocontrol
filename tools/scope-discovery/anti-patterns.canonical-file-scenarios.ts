/**
 * tools/scope-discovery/anti-patterns.canonical-file-scenarios.ts
 *
 * Adversarial-validator scenarios specifically targeting the AUDIT-
 * 20260524-08 failure mode (Part B): the T6.1 anti-pattern registry's
 * `excludes_paths:` field assumed the canonical primitive's path was
 * stable. When a primitive was git-renamed across modules, the
 * registry's `excludes_paths:` stayed pinned at the old path and the
 * NEW canonical file (whose body IS the legacy shape, by
 * construction) got flagged as a holdout against its own anti-
 * pattern.
 *
 * The fix:
 *   - `AntiPatternEntry` gains optional `canonicalImplementationFile`
 *     (CWD-relative POSIX string OR null).
 *   - Scanner auto-excludes the canonical file from the entry's
 *     shape match BEFORE applying `excludes_paths:` (both apply when
 *     set together — independent).
 *   - Scanner verifies the file exists at scan START; if missing,
 *     fails LOUD with an actionable error naming the entry id +
 *     missing path (typically caused by a git rename without
 *     registry update).
 *   - Parser accepts a non-empty string OR absent field; empty
 *     string / non-string → parse error.
 *
 * Lives in a sibling module to keep `anti-patterns.validate.ts`
 * under the 300-500 line cap. DRY: reuses scenario-runner helpers
 * inline (anti-patterns has no shared `fixtures.ts` like adopter-
 * manifests does, so the helpers are duplicated minimally here to
 * match the existing `anti-patterns.excludes-scenarios.ts` shape).
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runScannerSubprocess, type ScannerRun } from './util/run-scanner.js';

const SCANNER_ENTRY = 'tools/scope-discovery/check-anti-patterns.ts';

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
  readonly registryPath: string;
  readonly scanRoot: string;
  readonly dir: string;
}

async function makeFixture(slug: string): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), `anti-patterns-validator-${slug}-`));
  const scanRoot = join(root, 'src');
  await mkdir(scanRoot, { recursive: true });
  return { registryPath: join(root, 'registry.yaml'), scanRoot, dir: root };
}

async function writeRegistry(fixture: Fixture, yamlText: string): Promise<void> {
  await writeFile(fixture.registryPath, yamlText, 'utf8');
}

async function writeSource(fixture: Fixture, relPath: string, content: string): Promise<void> {
  const full = join(fixture.scanRoot, relPath);
  const lastSlash = full.lastIndexOf('/');
  if (lastSlash > fixture.scanRoot.length) {
    await mkdir(full.substring(0, lastSlash), { recursive: true });
  }
  await writeFile(full, content, 'utf8');
}

async function cleanup(fixture: Fixture): Promise<void> {
  await rm(fixture.dir, { recursive: true, force: true });
}

/**
 * Run the scanner with the fixture's scanRoot as CWD and `--root .`.
 * This makes file paths render as the fixture-relative tree, which
 * is what the CWD-relative `canonical_implementation_file:` and
 * `excludes_paths:` entries match against. Mirrors the harness used
 * by `anti-patterns.excludes-scenarios.ts`.
 */
function runFromScanRoot(fixture: Fixture): Promise<ScannerRun> {
  return runScannerSubprocess(
    SCANNER_ENTRY,
    ['--registry', fixture.registryPath, '--root', '.'],
    { cwd: fixture.scanRoot },
  );
}

// ---------------------------------------------------------------------------
// YAML fixtures
// ---------------------------------------------------------------------------

const CANONICAL_FILE_AUTO_EXCLUDE_REGISTRY = `anti_patterns:
  - id: page-title-row-inline
    added_in: c0ffee08
    primitive: PageTitleRow
    from: '@audiocontrol/editor-core'
    shape_regex: 'LEGACY_SHAPE_MARKER'
    canonical_implementation_file: 'lib/canonical.ts'
    message: |
      Replace inline LEGACY_SHAPE_MARKER with PageTitleRow from @audiocontrol/editor-core.
`;

const CANONICAL_FILE_MISSING_REGISTRY = `anti_patterns:
  - id: relocated-primitive-stale-registry
    added_in: c0ffee09
    primitive: RelocatedPrimitive
    from: '@audiocontrol/editor-core'
    shape_regex: 'LEGACY_SHAPE_MARKER'
    canonical_implementation_file: 'lib/moved-away.ts'
    message: |
      Replace inline LEGACY_SHAPE_MARKER with RelocatedPrimitive.
`;

const CANONICAL_FILE_PLUS_EXCLUDES_REGISTRY = `anti_patterns:
  - id: canonical-plus-excludes
    added_in: c0ffee0a
    primitive: BothExclusionsApply
    from: '@audiocontrol/editor-core'
    shape_regex: 'LEGACY_SHAPE_MARKER'
    canonical_implementation_file: 'lib/A.ts'
    excludes_paths:
      - 'lib/B.ts'
    message: |
      Replace inline LEGACY_SHAPE_MARKER with BothExclusionsApply.
`;

const CANONICAL_FILE_ABSENT_REGISTRY = `anti_patterns:
  - id: pre-audit-08-behavior
    added_in: c0ffee0b
    primitive: PreAudit
    from: '@audiocontrol/editor-core'
    shape_regex: 'LEGACY_SHAPE_MARKER'
    excludes_paths:
      - 'lib/canonical.ts'
    message: |
      Replace inline LEGACY_SHAPE_MARKER with PreAudit.
`;

const CANONICAL_FILE_EMPTY_STRING_REGISTRY = `anti_patterns:
  - id: empty-canonical
    added_in: c0ffee0c
    primitive: BadCanonical
    from: '@audiocontrol/editor-core'
    shape_regex: 'LEGACY_SHAPE_MARKER'
    canonical_implementation_file: ''
    message: |
      Replace LEGACY_SHAPE_MARKER with BadCanonical.
`;

const LEGACY_SHAPE_SOURCE = 'export const x = "LEGACY_SHAPE_MARKER";\n';

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

async function scenarioCanonicalFileAutoExcluded(): Promise<ScenarioResult> {
  const name = 'canonical-file-auto-excluded';
  const fixture = await makeFixture('canonical-auto');
  try {
    await writeRegistry(fixture, CANONICAL_FILE_AUTO_EXCLUDE_REGISTRY);
    // Two files BOTH carry the legacy shape. canonical.ts is the
    // primitive's source-of-truth (its body IS the shape, by
    // construction). holdout.ts is a real holdout.
    await writeSource(fixture, 'lib/canonical.ts', LEGACY_SHAPE_SOURCE);
    await writeSource(fixture, 'lib/holdout.ts', LEGACY_SHAPE_SOURCE);
    const run = await runFromScanRoot(fixture);
    if (run.code !== 1) {
      return fail(
        name,
        `expected exit 1 (one finding); got ${run.code}; stdout=${run.stdout}; stderr=${run.stderr}`,
      );
    }
    if (run.stdout.includes('lib/canonical.ts')) {
      return fail(
        name,
        `canonical.ts should be auto-excluded; stdout=${run.stdout}`,
      );
    }
    if (!run.stdout.includes('lib/holdout.ts')) {
      return fail(
        name,
        `holdout.ts should be flagged; stdout=${run.stdout}`,
      );
    }
    const findings = (run.stdout.match(/matches anti-pattern/g) ?? []).length;
    if (findings !== 1) {
      return fail(
        name,
        `expected exactly 1 finding (holdout only); got ${findings}; stdout=${run.stdout}`,
      );
    }
    return pass(
      name,
      'canonical_implementation_file auto-excludes the canonical (1 finding for holdout only)',
    );
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioCanonicalFileMissingFailsLoud(): Promise<ScenarioResult> {
  const name = 'canonical-file-missing-fails-loud';
  const fixture = await makeFixture('canonical-missing');
  try {
    await writeRegistry(fixture, CANONICAL_FILE_MISSING_REGISTRY);
    // Plant the holdout but NOT the canonical the registry expects.
    // Mimics the git-rename failure mode: operator moved the primitive
    // to a new location and forgot to update the registry.
    await writeSource(fixture, 'lib/holdout.ts', LEGACY_SHAPE_SOURCE);
    const run = await runFromScanRoot(fixture);
    if (run.code !== 2) {
      return fail(
        name,
        `expected exit 2 (scan-time canonical-missing failure); got ${run.code}; stderr=${run.stderr}`,
      );
    }
    if (!run.stderr.includes('relocated-primitive-stale-registry')) {
      return fail(
        name,
        `stderr should name the entry id; got: ${run.stderr}`,
      );
    }
    if (!run.stderr.includes('lib/moved-away.ts')) {
      return fail(
        name,
        `stderr should name the missing file path; got: ${run.stderr}`,
      );
    }
    if (!run.stderr.includes('does not exist')) {
      return fail(
        name,
        `stderr should explain the missing-canonical failure; got: ${run.stderr}`,
      );
    }
    if (!run.stderr.includes('canonical_implementation_file')) {
      return fail(
        name,
        `stderr should reference the canonical_implementation_file field; got: ${run.stderr}`,
      );
    }
    return pass(
      name,
      'missing canonical_implementation_file → exit 2; stderr names the entry id + missing path',
    );
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioCanonicalPlusExcludesPathsCombine(): Promise<ScenarioResult> {
  const name = 'canonical-file-plus-excludes-paths-combine';
  const fixture = await makeFixture('canonical-plus-excludes');
  try {
    await writeRegistry(fixture, CANONICAL_FILE_PLUS_EXCLUDES_REGISTRY);
    // A.ts is the canonical (auto-excluded); B.ts is matched by
    // excludes_paths; C.ts is a real holdout. All three carry the
    // legacy shape; only C should surface.
    await writeSource(fixture, 'lib/A.ts', LEGACY_SHAPE_SOURCE);
    await writeSource(fixture, 'lib/B.ts', LEGACY_SHAPE_SOURCE);
    await writeSource(fixture, 'lib/C.ts', LEGACY_SHAPE_SOURCE);
    const run = await runFromScanRoot(fixture);
    if (run.code !== 1) {
      return fail(
        name,
        `expected exit 1 (one finding); got ${run.code}; stdout=${run.stdout}; stderr=${run.stderr}`,
      );
    }
    if (run.stdout.includes('lib/A.ts')) {
      return fail(
        name,
        `A.ts (canonical) should be auto-excluded; stdout=${run.stdout}`,
      );
    }
    if (run.stdout.includes('lib/B.ts')) {
      return fail(
        name,
        `B.ts should be excluded via excludes_paths; stdout=${run.stdout}`,
      );
    }
    if (!run.stdout.includes('lib/C.ts')) {
      return fail(
        name,
        `C.ts should still be flagged; stdout=${run.stdout}`,
      );
    }
    const findings = (run.stdout.match(/matches anti-pattern/g) ?? []).length;
    if (findings !== 1) {
      return fail(
        name,
        `expected exactly 1 finding (C.ts only); got ${findings}; stdout=${run.stdout}`,
      );
    }
    return pass(
      name,
      'canonical_implementation_file + excludes_paths apply together; both skip their targets; C.ts still surfaces',
    );
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioCanonicalFileAbsentNoRegression(): Promise<ScenarioResult> {
  const name = 'canonical-file-absent-field-no-regression';
  const fixture = await makeFixture('canonical-absent');
  try {
    // Pre-AUDIT-08 entry shape: no `canonical_implementation_file:`
    // field; relies on `excludes_paths:` alone. Behavior must be
    // identical to the existing `excludes-paths-literal-skips-canonical-file`
    // scenario in `anti-patterns.excludes-scenarios.ts`: the legacy
    // file at `lib/canonical.ts` is excluded; holdout.ts surfaces.
    await writeRegistry(fixture, CANONICAL_FILE_ABSENT_REGISTRY);
    await writeSource(fixture, 'lib/canonical.ts', LEGACY_SHAPE_SOURCE);
    await writeSource(fixture, 'lib/holdout.ts', LEGACY_SHAPE_SOURCE);
    const run = await runFromScanRoot(fixture);
    if (run.code !== 1) {
      return fail(
        name,
        `expected exit 1 (one finding); got ${run.code}; stdout=${run.stdout}; stderr=${run.stderr}`,
      );
    }
    if (run.stdout.includes('lib/canonical.ts')) {
      return fail(
        name,
        `canonical.ts should be excluded via excludes_paths (pre-AUDIT-08 mechanism still works); stdout=${run.stdout}`,
      );
    }
    if (!run.stdout.includes('lib/holdout.ts')) {
      return fail(
        name,
        `holdout.ts should be flagged; stdout=${run.stdout}`,
      );
    }
    return pass(
      name,
      'entry without canonical_implementation_file behaves identically to pre-AUDIT-08 (excludes_paths still drives the skip)',
    );
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioCanonicalFileEmptyStringRejected(): Promise<ScenarioResult> {
  const name = 'canonical-file-empty-string-rejected';
  const fixture = await makeFixture('canonical-empty-string');
  try {
    await writeRegistry(fixture, CANONICAL_FILE_EMPTY_STRING_REGISTRY);
    await writeSource(fixture, 'lib/canonical.ts', LEGACY_SHAPE_SOURCE);
    const run = await runFromScanRoot(fixture);
    if (run.code !== 2) {
      return fail(
        name,
        `expected exit 2 (parse error: empty canonical_implementation_file); got ${run.code}; stderr=${run.stderr}`,
      );
    }
    if (!run.stderr.includes('canonical_implementation_file')) {
      return fail(
        name,
        `stderr should mention the canonical_implementation_file field; got: ${run.stderr}`,
      );
    }
    return pass(
      name,
      'empty-string canonical_implementation_file → exit 2 with descriptive parse error',
    );
  } finally {
    await cleanup(fixture);
  }
}

export const CANONICAL_FILE_SCENARIOS = [
  scenarioCanonicalFileAutoExcluded,
  scenarioCanonicalFileMissingFailsLoud,
  scenarioCanonicalPlusExcludesPathsCombine,
  scenarioCanonicalFileAbsentNoRegression,
  scenarioCanonicalFileEmptyStringRejected,
] as const;
