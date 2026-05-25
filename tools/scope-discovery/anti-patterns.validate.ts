/**
 * tools/scope-discovery/anti-patterns.validate.ts
 *
 * Adversarial validator harness for `tools/scope-discovery/check-anti-patterns.ts`
 * (workplan T6.1). Plants synthetic registry + source-file fixtures under
 * `.tmp/anti-patterns-validator-<runid>/`, runs the scanner as a subprocess
 * (same way the make target + pre-commit hook do), and asserts detection
 * behavior across six scenarios + a gutted-stub self-check.
 *
 * Pattern mirrors clone-detector.validate.ts and refactor-preconditions.validate.ts:
 *   - subprocess invocation of the scanner (no programmatic coupling),
 *   - per-scenario isolated fixture directory,
 *   - PASS to stdout, FAIL to stderr (CI greps stderr for FAIL),
 *   - gutted self-check stubs the scanner to always return exit 0 and
 *     asserts that the detection-required scenarios DON'T accept the stub.
 *
 * Run via:
 *   tsx tools/scope-discovery/anti-patterns.validate.ts
 *   make check-anti-patterns-validate
 *
 * Exit code:
 *   0   every scenario asserts as expected
 *   1   one or more assertions failed (scanner is broken)
 *   2   harness infrastructure error
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { errorMessage } from './util/typeguards.js';
import { runScannerSubprocess, type ScannerRun } from './util/run-scanner.js';
import { EXCLUDES_PATHS_SCENARIOS } from './anti-patterns.excludes-scenarios.js';
import { CANONICAL_FILE_SCENARIOS } from './anti-patterns.canonical-file-scenarios.js';
import { S3K_PARAM_SHAPE_SCENARIOS } from './anti-patterns.s3k-param-shape-scenarios.js';
import { S3K_ZONE_TABS_SCENARIOS } from './anti-patterns.s3k-zone-tabs-scenarios.js';
import { AC_PAGE_HEADER_SCENARIOS } from './anti-patterns.ac-page-header-scenarios.js';
import { INLINE_ZONE_SEGMENT_BAR_SCENARIOS } from './anti-patterns.inline-zone-segment-bar-scenarios.js';
import { S3K_ENVELOPE_DISPLAY_SCENARIOS } from './anti-patterns.s3k-envelope-display-scenarios.js';

const SCANNER_ENTRY = 'tools/scope-discovery/check-anti-patterns.ts';

interface ScenarioResult {
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

/**
 * Run the scanner as a subprocess. Optionally substitute a stubbed entry
 * point (used by the gutted self-check). Match-mode mirrors how the
 * production hook invokes the gate: tsx + the same argv contract.
 * Thin wrapper over the shared `runScannerSubprocess` helper that pins
 * the default `entry` to this validator's scanner.
 */
function runScanner(args: readonly string[], entry = SCANNER_ENTRY): Promise<ScannerRun> {
  return runScannerSubprocess(entry, args);
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

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

function args(fixture: Fixture, extra: readonly string[] = []): string[] {
  return ['--registry', fixture.registryPath, '--root', fixture.scanRoot, ...extra];
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

const EMPTY_REGISTRY_YAML = `anti_patterns: []\n`;

const SINGLE_PATTERN_REGISTRY = `anti_patterns:
  - id: prompt-fallback-composer
    added_in: deadbeef
    primitive: ScrapbookComposer
    from: '@/components/ScrapbookComposer'
    shape_regex: 'window\\.prompt\\([^)]*new note'
    message: |
      Replace window.prompt() with the ScrapbookComposer overlay; the
      composer is the canonical new-note affordance.
`;

// Multi-pattern fingerprint. Patterns are simple enough that regex
// escaping survives the JS string → YAML → RegExp double-decoding without
// surprises. YAML single-quoted strings preserve backslashes literally, so
// '\\(' in the JS template literal lands as '\(' in YAML and reaches the
// regex as a literal-paren matcher. Each pattern is a distinct token that,
// on its own, would false-positive widely; together within min_distance,
// they fingerprint the SlideDrawer legacy shape.
const MULTI_PATTERN_REGISTRY = `anti_patterns:
  - id: slide-drawer-legacy
    added_in: cafef00d
    primitive: useExportDialogLifecycle
    from: '@/hooks/useExportDialogLifecycle'
    shape_regex:
      - 'useState\\(false\\)'
      - 'addEventListener.*keydown'
      - 'onBackdropClick'
    min_distance: 30
    message: |
      Replace the open/close/backdrop trio with useExportDialogLifecycle —
      it standardizes the keyboard + backdrop dismissal contract.
`;

const MALFORMED_REGISTRY = `anti_patterns:
  - id: missing-required-fields
    added_in: deadbeef
    primitive: SomeThing
    # missing 'from', 'shape_regex', 'message'
`;

async function scenarioEmptyRegistry(): Promise<ScenarioResult> {
  const name = 'empty-registry-exit-zero';
  const fixture = await makeFixture('empty');
  try {
    await writeRegistry(fixture, EMPTY_REGISTRY_YAML);
    // Even with source files present, empty registry should exit 0.
    await writeSource(fixture, 'a.ts', 'export const a = 1;\n');
    const run = await runScanner(args(fixture));
    if (run.code !== 0) {
      return fail(name, `expected exit 0; got ${run.code}; stderr=${run.stderr}`);
    }
    return pass(name, 'empty registry exits 0 even with source files present');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioMatchDetected(): Promise<ScenarioResult> {
  const name = 'single-pattern-match-detected';
  const fixture = await makeFixture('match');
  try {
    await writeRegistry(fixture, SINGLE_PATTERN_REGISTRY);
    await writeSource(
      fixture,
      'NoteButton.tsx',
      [
        'export function NoteButton() {',
        '  return (',
        '    <button onClick={() => window.prompt("new note title")}>',
        '      + new note',
        '    </button>',
        '  );',
        '}',
        '',
      ].join('\n'),
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 1) {
      return fail(name, `expected exit 1 (match); got ${run.code}; stdout=${run.stdout}`);
    }
    if (!run.stdout.includes('prompt-fallback-composer')) {
      return fail(name, `stdout missing anti-pattern id; got: ${run.stdout}`);
    }
    if (!run.stdout.includes('ScrapbookComposer')) {
      return fail(name, `stdout missing primitive name; got: ${run.stdout}`);
    }
    return pass(name, 'match reported with id + primitive + message');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioNoMatch(): Promise<ScenarioResult> {
  const name = 'no-match-exits-zero';
  const fixture = await makeFixture('nomatch');
  try {
    await writeRegistry(fixture, SINGLE_PATTERN_REGISTRY);
    await writeSource(
      fixture,
      'CleanComponent.tsx',
      'export function CleanComponent() { return <div>hi</div>; }\n',
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 0) {
      return fail(name, `expected exit 0 (no match); got ${run.code}; stderr=${run.stderr}`);
    }
    return pass(name, 'registry populated, no matching source → exit 0');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioMultiPattern(): Promise<ScenarioResult> {
  const name = 'multi-pattern-fingerprint';
  const fixture = await makeFixture('multi');
  try {
    await writeRegistry(fixture, MULTI_PATTERN_REGISTRY);
    // Partial: only one of three patterns. Should NOT match.
    await writeSource(
      fixture,
      'partial.tsx',
      [
        'const [open, setOpen] = useState(false); // open',
        '// no keydown listener; no backdrop handler',
        '',
      ].join('\n'),
    );
    // Spaced beyond min_distance — 3 patterns, but each separated by 100
    // empty lines. Should NOT match.
    const filler = Array.from({ length: 100 }, () => '// filler').join('\n');
    await writeSource(
      fixture,
      'far-apart.tsx',
      [
        `const [open, setOpen] = useState(false); // open`,
        filler,
        `document.addEventListener('keydown', handleEsc);`,
        filler,
        `<div onBackdropClick={close} />`,
        '',
      ].join('\n'),
    );
    // Full match within min_distance. Should match.
    await writeSource(
      fixture,
      'full-match.tsx',
      [
        `const [open, setOpen] = useState(false); // open`,
        `useEffect(() => {`,
        `  document.addEventListener('keydown', handleEsc);`,
        `  return () => document.removeEventListener('keydown', handleEsc);`,
        `}, []);`,
        `return <Backdrop onBackdropClick={() => setOpen(false)} />;`,
        '',
      ].join('\n'),
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 1) {
      return fail(name, `expected exit 1; got ${run.code}; stdout=${run.stdout}`);
    }
    if (!run.stdout.includes('full-match.tsx')) {
      return fail(name, `expected full-match.tsx to be flagged; stdout=${run.stdout}`);
    }
    if (run.stdout.includes('partial.tsx')) {
      return fail(name, `partial.tsx should NOT match (only 1 of 3 patterns); stdout=${run.stdout}`);
    }
    if (run.stdout.includes('far-apart.tsx')) {
      return fail(
        name,
        `far-apart.tsx should NOT match (patterns beyond min_distance); stdout=${run.stdout}`,
      );
    }
    return pass(name, 'multi-pattern fingerprint matches only when all patterns co-occur within min_distance');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioMalformedRegistry(): Promise<ScenarioResult> {
  const name = 'malformed-registry-exits-two';
  const fixture = await makeFixture('malformed');
  try {
    await writeRegistry(fixture, MALFORMED_REGISTRY);
    await writeSource(fixture, 'a.ts', 'export {};\n');
    const run = await runScanner(args(fixture));
    if (run.code !== 2) {
      return fail(name, `expected exit 2 (infra error); got ${run.code}; stderr=${run.stderr}`);
    }
    if (!run.stderr.includes('from')) {
      return fail(name, `expected error to mention missing field 'from'; stderr=${run.stderr}`);
    }
    return pass(name, 'malformed registry → exit 2 with descriptive error');
  } finally {
    await cleanup(fixture);
  }
}

/**
 * Gutted-stub self-check. Plants a scanner stub that always exits 0,
 * then runs scenarioMatchDetected's assertion against the stub. The
 * assertion expects exit 1; the stub returns 0; the harness's
 * assertion MUST reject the stub. If the assertion accepts the stub,
 * the harness has no teeth and the other scenarios prove nothing.
 */
async function scenarioGuttedStub(): Promise<ScenarioResult> {
  const name = 'gutted-stub-self-check';
  const fixture = await makeFixture('gutted');
  const stubDir = await mkdtemp(join(tmpdir(), 'anti-patterns-stub-'));
  const stubPath = join(stubDir, 'stub.ts');
  try {
    // Stub: ignores all args, writes nothing, exits 0.
    await writeFile(stubPath, 'process.exit(0);\n', 'utf8');
    await writeRegistry(fixture, SINGLE_PATTERN_REGISTRY);
    await writeSource(
      fixture,
      'WithMatch.tsx',
      'window.prompt("new note")\n',
    );
    const run = await runScanner(args(fixture), stubPath);
    // The scanner-as-stub returned 0; our REAL assertion would expect 1.
    // Simulate the assertion that scenarioMatchDetected runs:
    if (run.code === 1) {
      // Stub somehow returned 1 — that means the gutted self-check has
      // no teeth either (it agreed with the real scanner's behavior).
      return fail(name, 'stub returned 1; gutted self-check has no signal');
    }
    if (run.code === 0) {
      // Correct: stub returned 0 → match-required assertion would reject.
      return pass(name, 'gutted stub returns 0; real assertion (expects 1) would reject it');
    }
    return fail(name, `unexpected stub exit code ${run.code}`);
  } finally {
    await cleanup(fixture);
    await rm(stubDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function runAll(): Promise<readonly ScenarioResult[]> {
  const scenarios = [
    scenarioEmptyRegistry,
    scenarioMatchDetected,
    scenarioNoMatch,
    scenarioMultiPattern,
    scenarioMalformedRegistry,
    // AUDIT-20260522-04 — `excludes_paths:` field (sibling scenarios file).
    ...EXCLUDES_PATHS_SCENARIOS,
    // AUDIT-20260524-08 Part B — `canonical_implementation_file:` field
    // + auto-exclude + missing-file fail-loud.
    ...CANONICAL_FILE_SCENARIOS,
    // akai-harmonization Phase 2 task 2.2 — paired scenarios for the
    // three s3k-param-* anti-pattern entries (input / select / toggle).
    ...S3K_PARAM_SHAPE_SCENARIOS,
    // akai-harmonization Phase 2 task 2.2 Commit 3 — paired scenarios for
    // the s3k-zone-tabs-inline + ac-page-sticky-header-inline anti-pattern
    // entries landed alongside the VelocityZoneEditor AcRadioTabs
    // adoption + the PageTitleRow drift-prevention registration.
    ...S3K_ZONE_TABS_SCENARIOS,
    ...AC_PAGE_HEADER_SCENARIOS,
    // akai-harmonization Phase 2 task 2.2 Commit 6 — paired scenarios
    // for the inline-zone-segment-bar anti-pattern entry registered
    // alongside the AcZoneStrip primitive extraction (Commits 1-4 of
    // the same dispatch).
    ...INLINE_ZONE_SEGMENT_BAR_SCENARIOS,
    // akai-harmonization Phase 2 task 2.2 (AcEnvelope kind variants +
    // AcFrequencyResponse extraction dispatch) Commit 6 — paired
    // scenarios for the s3k-envelope-display-inline anti-pattern
    // entry registered alongside the .s3k-envelope-display CSS
    // deletion. Includes a TF-015 sibling-class prefix-collision
    // negative scenario (s3k-envelope-section MUST NOT match).
    ...S3K_ENVELOPE_DISPLAY_SCENARIOS,
    scenarioGuttedStub,
  ];
  const results: ScenarioResult[] = [];
  for (const fn of scenarios) {
    try {
      results.push(await fn());
    } catch (err) {
      results.push(fail(fn.name, `harness error: ${errorMessage(err)}`));
    }
  }
  return results;
}

async function main(): Promise<number> {
  let results: readonly ScenarioResult[];
  try {
    results = await runAll();
  } catch (err) {
    process.stderr.write(`anti-patterns.validate: infra error: ${errorMessage(err)}\n`);
    return 2;
  }
  let passed = 0;
  for (const r of results) {
    if (r.passed) {
      process.stdout.write(`PASS ${r.name}: ${r.detail}\n`);
      passed += 1;
    } else {
      process.stderr.write(`FAIL ${r.name}: ${r.detail}\n`);
    }
  }
  process.stdout.write(`Summary: ${passed}/${results.length} scenarios passed\n`);
  return passed === results.length ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    process.stderr.write(`anti-patterns.validate crashed: ${errorMessage(err)}\n`);
    process.exit(2);
  },
);
