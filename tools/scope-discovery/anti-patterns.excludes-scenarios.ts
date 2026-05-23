/**
 * tools/scope-discovery/anti-patterns.excludes-scenarios.ts
 *
 * Adversarial-validator scenarios specifically targeting the AUDIT-
 * 20260522-04 failure mode: the T6.1 anti-pattern registry had no
 * path-exclude mechanism, so any entry whose canonical primitive's
 * own file BODY matched the legacy shape would flag the canonical
 * file as a holdout against its own anti-pattern (the gate could not
 * be satisfied).
 *
 * The fix:
 *   - `AntiPatternEntry` gains optional `excludesPaths: ExcludePath[]`
 *     (compiled glob regexes).
 *   - Scanner filters each candidate file against every entry's
 *     exclude list BEFORE running the shape patterns.
 *   - Empty array OR missing field preserves existing behavior.
 *   - Match against CWD-relative POSIX path (matches how findings
 *     render in the report, so an operator can copy a flagged path
 *     into `excludes_paths:` as-is).
 *
 * Lives in a sibling module to keep `anti-patterns.validate.ts` under
 * the 300-500 line cap mandated by ~/work/CLAUDE.md.
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
 * This makes file paths render as the fixture-relative tree (e.g.,
 * `lib/canonical.ts`), which is what the literal-path
 * `excludes_paths:` entries match against. The shared run-scanner
 * helper resolves the entry against the parent's CWD before changing
 * directories, so the canonical scanner path keeps working.
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

const EXCLUDES_LITERAL_REGISTRY = `anti_patterns:
  - id: canonical-shape-with-literal-exclude
    added_in: c0ffee01
    primitive: useCanonical
    from: '@/hooks/useCanonical'
    shape_regex: 'LEGACY_SHAPE_MARKER'
    excludes_paths:
      - 'lib/canonical.ts'
    message: |
      Replace LEGACY_SHAPE_MARKER body with useCanonical.
`;

const EXCLUDES_LITERAL_NO_EXCLUDE_REGISTRY = `anti_patterns:
  - id: canonical-shape-without-exclude
    added_in: c0ffee02
    primitive: useCanonical
    from: '@/hooks/useCanonical'
    shape_regex: 'LEGACY_SHAPE_MARKER'
    message: |
      Replace LEGACY_SHAPE_MARKER body with useCanonical.
`;

const EXCLUDES_GLOB_REGISTRY = `anti_patterns:
  - id: canonical-shape-with-glob-exclude
    added_in: c0ffee03
    primitive: useCanonical
    from: '@/hooks/useCanonical'
    shape_regex: 'LEGACY_SHAPE_MARKER'
    excludes_paths:
      - 'canonical/**/*.ts'
    message: |
      Replace LEGACY_SHAPE_MARKER body with useCanonical.
`;

const EXCLUDES_EMPTY_REGISTRY = `anti_patterns:
  - id: canonical-shape-with-empty-exclude
    added_in: c0ffee04
    primitive: useCanonical
    from: '@/hooks/useCanonical'
    shape_regex: 'LEGACY_SHAPE_MARKER'
    excludes_paths: []
    message: |
      Replace LEGACY_SHAPE_MARKER body with useCanonical.
`;

const EXCLUDES_MALFORMED_REGISTRY = `anti_patterns:
  - id: canonical-shape-malformed-exclude
    added_in: c0ffee05
    primitive: useCanonical
    from: '@/hooks/useCanonical'
    shape_regex: 'LEGACY_SHAPE_MARKER'
    excludes_paths:
      - 123
    message: |
      Replace LEGACY_SHAPE_MARKER body with useCanonical.
`;

const EXCLUDES_NO_MATCH_REGISTRY = `anti_patterns:
  - id: canonical-shape-exclude-no-match
    added_in: c0ffee06
    primitive: useCanonical
    from: '@/hooks/useCanonical'
    shape_regex: 'LEGACY_SHAPE_MARKER'
    excludes_paths:
      - 'nonexistent/path/**/*.ts'
    message: |
      Replace LEGACY_SHAPE_MARKER body with useCanonical.
`;

const LEGACY_SHAPE_SOURCE = 'export const x = "LEGACY_SHAPE_MARKER";\n';

async function plantTwoLegacyFiles(fixture: Fixture): Promise<void> {
  await writeSource(fixture, 'lib/canonical.ts', LEGACY_SHAPE_SOURCE);
  await writeSource(fixture, 'lib/holdout.ts', LEGACY_SHAPE_SOURCE);
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

async function scenarioExcludesPathsLiteral(): Promise<ScenarioResult> {
  const name = 'excludes-paths-literal-skips-canonical-file';
  const fixture = await makeFixture('excludes-literal');
  try {
    await writeRegistry(fixture, EXCLUDES_LITERAL_REGISTRY);
    await plantTwoLegacyFiles(fixture);
    const run = await runFromScanRoot(fixture);
    if (run.code !== 1) {
      return fail(name, `expected exit 1 (1 finding); got ${run.code}; stdout=${run.stdout}`);
    }
    if (run.stdout.includes('lib/canonical.ts')) {
      return fail(name, `canonical.ts should be excluded; stdout=${run.stdout}`);
    }
    if (!run.stdout.includes('lib/holdout.ts')) {
      return fail(name, `holdout.ts should be flagged; stdout=${run.stdout}`);
    }
    // Sanity-control: same fixture, no excludes_paths → both files flagged.
    // Proves the exclusion (not some other condition) is what produced the
    // single-finding result. If the production exclusion logic regressed to
    // a no-op, the primary assertion above would already trip; this control
    // makes the "before vs after" delta legible in the test output.
    const controlFixture = await makeFixture('excludes-literal-control');
    try {
      await writeRegistry(controlFixture, EXCLUDES_LITERAL_NO_EXCLUDE_REGISTRY);
      await plantTwoLegacyFiles(controlFixture);
      const control = await runFromScanRoot(controlFixture);
      if (control.code !== 1) {
        return fail(name, `control: expected exit 1; got ${control.code}`);
      }
      const findings = (control.stdout.match(/matches anti-pattern/g) ?? []).length;
      if (findings !== 2) {
        return fail(
          name,
          `control: expected 2 findings without excludes_paths; got ${findings}; stdout=${control.stdout}`,
        );
      }
    } finally {
      await cleanup(controlFixture);
    }
    return pass(
      name,
      'literal excludes_paths skips canonical file (1 finding); control without excludes produces 2',
    );
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioExcludesPathsGlob(): Promise<ScenarioResult> {
  const name = 'excludes-paths-glob-skips-tree';
  const fixture = await makeFixture('excludes-glob');
  try {
    await writeRegistry(fixture, EXCLUDES_GLOB_REGISTRY);
    await writeSource(fixture, 'canonical/a.ts', LEGACY_SHAPE_SOURCE);
    await writeSource(fixture, 'canonical/sub/b.ts', LEGACY_SHAPE_SOURCE);
    await writeSource(fixture, 'holdouts/c.ts', LEGACY_SHAPE_SOURCE);
    const run = await runFromScanRoot(fixture);
    if (run.code !== 1) {
      return fail(name, `expected exit 1; got ${run.code}; stdout=${run.stdout}`);
    }
    if (run.stdout.includes('canonical/a.ts') || run.stdout.includes('canonical/sub/b.ts')) {
      return fail(name, `canonical/** should be excluded by glob; stdout=${run.stdout}`);
    }
    if (!run.stdout.includes('holdouts/c.ts')) {
      return fail(name, `holdouts/c.ts should be flagged; stdout=${run.stdout}`);
    }
    return pass(name, 'glob excludes_paths skips matching tree; non-matching files still surface');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioExcludesPathsEmpty(): Promise<ScenarioResult> {
  const name = 'excludes-paths-empty-array-behaves-as-absent';
  const fixture = await makeFixture('excludes-empty');
  try {
    await writeRegistry(fixture, EXCLUDES_EMPTY_REGISTRY);
    await plantTwoLegacyFiles(fixture);
    const run = await runFromScanRoot(fixture);
    if (run.code !== 1) {
      return fail(name, `expected exit 1; got ${run.code}; stdout=${run.stdout}`);
    }
    const findings = (run.stdout.match(/matches anti-pattern/g) ?? []).length;
    if (findings !== 2) {
      return fail(
        name,
        `expected 2 findings (empty exclude list); got ${findings}; stdout=${run.stdout}`,
      );
    }
    return pass(name, 'empty excludes_paths array behaves identically to missing field (2 findings)');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioExcludesPathsMalformed(): Promise<ScenarioResult> {
  const name = 'excludes-paths-malformed-element-rejected';
  const fixture = await makeFixture('excludes-malformed');
  try {
    await writeRegistry(fixture, EXCLUDES_MALFORMED_REGISTRY);
    await writeSource(fixture, 'a.ts', LEGACY_SHAPE_SOURCE);
    const run = await runScannerSubprocess(SCANNER_ENTRY, [
      '--registry',
      fixture.registryPath,
      '--root',
      fixture.scanRoot,
    ]);
    if (run.code !== 2) {
      return fail(
        name,
        `expected exit 2 (registry parse error); got ${run.code}; stderr=${run.stderr}`,
      );
    }
    if (!run.stderr.includes('excludes_paths')) {
      return fail(name, `expected error to mention 'excludes_paths'; stderr=${run.stderr}`);
    }
    return pass(name, 'non-string excludes_paths element → exit 2 with descriptive parse error');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioExcludesPathsNoMatch(): Promise<ScenarioResult> {
  const name = 'excludes-paths-no-match-not-an-error';
  const fixture = await makeFixture('excludes-no-match');
  try {
    await writeRegistry(fixture, EXCLUDES_NO_MATCH_REGISTRY);
    await plantTwoLegacyFiles(fixture);
    const run = await runFromScanRoot(fixture);
    if (run.code !== 1) {
      return fail(name, `expected exit 1 (2 findings); got ${run.code}; stdout=${run.stdout}`);
    }
    const findings = (run.stdout.match(/matches anti-pattern/g) ?? []).length;
    if (findings !== 2) {
      return fail(
        name,
        `expected 2 findings (exclude matched nothing); got ${findings}; stdout=${run.stdout}`,
      );
    }
    return pass(name, 'excludes_paths glob matching nothing is not an error; both files surface');
  } finally {
    await cleanup(fixture);
  }
}

export const EXCLUDES_PATHS_SCENARIOS = [
  scenarioExcludesPathsLiteral,
  scenarioExcludesPathsGlob,
  scenarioExcludesPathsEmpty,
  scenarioExcludesPathsMalformed,
  scenarioExcludesPathsNoMatch,
] as const;
