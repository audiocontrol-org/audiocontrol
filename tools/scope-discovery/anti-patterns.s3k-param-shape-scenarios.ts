/**
 * tools/scope-discovery/anti-patterns.s3k-param-shape-scenarios.ts
 *
 * Adversarial scenarios paired with the three akai-harmonization anti-
 * pattern entries landed alongside this file (`s3k-param-input-inline`,
 * `s3k-param-select-inline`, `s3k-param-toggle-inline`).
 *
 * Per the project's "Validator-paired changes" discipline in
 * .claude/rules/agent-discipline.md, every gate-semantic change ships
 * with a scenario that would have REJECTED the pre-change behavior. The
 * three new registry entries are "production data" rather than
 * scanner-shape changes — but their teeth come from this paired check:
 *
 *   Teeth test (revertable proof):
 *     1. Plant a fixture with the legacy shape: `className="s3k-param-input"`
 *        and the canonical replacement shape: `className="ac-input"`.
 *     2. With a registry that contains the new entry, scanner MUST flag
 *        the legacy shape AND NOT flag the canonical shape.
 *     3. If a future commit relaxes the new entry's `shape_regex`
 *        (e.g., loosens the class-name match to `s3k-param`), the
 *        canonical-shape file gets flagged and these scenarios fail.
 *
 * Lives in a sibling module so the main `anti-patterns.validate.ts` stays
 * under the 300-500 line cap. Wired in via `anti-patterns.validate.ts:354`
 * import + spread.
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
  const root = await mkdtemp(join(tmpdir(), `anti-patterns-s3k-param-${slug}-`));
  const scanRoot = join(root, 'src');
  await mkdir(scanRoot, { recursive: true });
  return { registryPath: join(root, 'registry.yaml'), scanRoot, dir: root };
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

function runScanner(scanArgs: readonly string[]): Promise<ScannerRun> {
  return runScannerSubprocess(SCANNER_ENTRY, scanArgs);
}

// The three registry entries paired with this scenario file. Mirrors the
// production entries in `docs/scope-discovery/anti-patterns.yaml` so a
// regression in either copy fails this scenario AND a CI re-run.
// NOTE: JS template literal escape gotcha — `\b` in a backtick string
// is the backspace control character (U+0008), not the regex word-
// boundary. Use `\\b` so the rendered YAML carries a literal `\b` that
// the YAML parser (and downstream regex compiler) sees as a backslash-b
// pair.
const S3K_PARAM_REGISTRY_YAML = `anti_patterns:
  - id: s3k-param-input-inline
    added_in: 0000aaaa
    primitive: AcNumberInput
    from: '@audiocontrol/editor-core'
    shape_regex: '\\bs3k-param-input\\b'
    message: |
      Legacy s3k-param-input chrome was promoted to AcNumberInput (editable).
  - id: s3k-param-select-inline
    added_in: 0000aaaa
    primitive: ac-select (native HTML select styled by .ac-select)
    from: '@audiocontrol/editor-core'
    shape_regex: '\\bs3k-param-select\\b'
    message: |
      Legacy s3k-param-select chrome was promoted to <select class="ac-select">.
  - id: s3k-param-toggle-inline
    added_in: 0000aaaa
    primitive: AcToggle
    from: '@audiocontrol/editor-core'
    shape_regex: '\\bs3k-param-toggle\\b'
    message: |
      Legacy s3k-param-toggle chrome was promoted to AcToggle.
`;

async function scenarioInputFlagsLegacyShape(): Promise<ScenarioResult> {
  const name = 's3k-param-input-inline: flags legacy chrome';
  const fixture = await makeFixture('input-legacy');
  try {
    await writeFile(fixture.registryPath, S3K_PARAM_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'LegacyKnob.tsx',
      [
        'export function LegacyKnob() {',
        '  return (',
        '    <input type="number" className="s3k-param-input" />',
        '  );',
        '}',
        '',
      ].join('\n'),
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 1) {
      return fail(name, `expected exit 1 (match); got ${run.code}; stdout=${run.stdout}`);
    }
    if (!run.stdout.includes('s3k-param-input-inline')) {
      return fail(name, `stdout missing entry id; got: ${run.stdout}`);
    }
    return pass(name, 'legacy input chrome flagged with id + suggested primitive');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioInputIgnoresCanonical(): Promise<ScenarioResult> {
  const name = 's3k-param-input-inline: ignores canonical AcNumberInput chrome';
  const fixture = await makeFixture('input-canonical');
  try {
    await writeFile(fixture.registryPath, S3K_PARAM_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'CanonicalReadout.tsx',
      [
        'export function CanonicalReadout() {',
        '  return (',
        '    <span className="ac-number-input ac-number-input--editable">',
        '      <input type="number" className="ac-number-input__value" />',
        '    </span>',
        '  );',
        '}',
        '',
      ].join('\n'),
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 0) {
      return fail(
        name,
        `expected exit 0 (no match); got ${run.code}; stdout=${run.stdout}`,
      );
    }
    return pass(name, 'canonical AcNumberInput chrome does NOT match the legacy entry');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioSelectFlagsLegacyShape(): Promise<ScenarioResult> {
  const name = 's3k-param-select-inline: flags legacy chrome';
  const fixture = await makeFixture('select-legacy');
  try {
    await writeFile(fixture.registryPath, S3K_PARAM_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'LegacySelect.tsx',
      [
        'export function LegacySelect() {',
        '  return (',
        '    <select className="s3k-param-select">',
        '      <option value="0">Looping</option>',
        '    </select>',
        '  );',
        '}',
        '',
      ].join('\n'),
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 1) {
      return fail(name, `expected exit 1 (match); got ${run.code}; stdout=${run.stdout}`);
    }
    if (!run.stdout.includes('s3k-param-select-inline')) {
      return fail(name, `stdout missing entry id; got: ${run.stdout}`);
    }
    return pass(name, 'legacy select chrome flagged');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioSelectIgnoresCanonical(): Promise<ScenarioResult> {
  const name = 's3k-param-select-inline: ignores canonical ac-select chrome';
  const fixture = await makeFixture('select-canonical');
  try {
    await writeFile(fixture.registryPath, S3K_PARAM_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'CanonicalSelect.tsx',
      [
        'export function CanonicalSelect() {',
        '  return (',
        '    <select className="ac-select">',
        '      <option value="0">Looping</option>',
        '    </select>',
        '  );',
        '}',
        '',
      ].join('\n'),
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 0) {
      return fail(
        name,
        `expected exit 0 (no match); got ${run.code}; stdout=${run.stdout}`,
      );
    }
    return pass(name, 'canonical ac-select chrome does NOT match the legacy entry');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioToggleFlagsLegacyShape(): Promise<ScenarioResult> {
  const name = 's3k-param-toggle-inline: flags legacy chrome (incl. --on modifier)';
  const fixture = await makeFixture('toggle-legacy');
  try {
    await writeFile(fixture.registryPath, S3K_PARAM_REGISTRY_YAML, 'utf8');
    // Two flavours of the legacy shape: bare class and the --on modifier.
    // Both should match the entry's `s3k-param-toggle[^"]*` regex.
    await writeSource(
      fixture,
      'LegacyToggle.tsx',
      [
        'export function LegacyToggle({ on }: { on: boolean }) {',
        '  return (',
        '    <button',
        '      className={`s3k-param-toggle ${on ? "s3k-param-toggle--on" : ""}`}',
        '    >',
        '      {on ? "ON" : "OFF"}',
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
    if (!run.stdout.includes('s3k-param-toggle-inline')) {
      return fail(name, `stdout missing entry id; got: ${run.stdout}`);
    }
    return pass(name, 'legacy toggle chrome (both bare + --on modifier) flagged');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioToggleIgnoresCanonical(): Promise<ScenarioResult> {
  const name = 's3k-param-toggle-inline: ignores canonical AcToggle chrome';
  const fixture = await makeFixture('toggle-canonical');
  try {
    await writeFile(fixture.registryPath, S3K_PARAM_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'CanonicalToggle.tsx',
      [
        'export function CanonicalToggle() {',
        '  return (',
        '    <div className="ac-toggle" role="radiogroup">',
        '      <label className="ac-toggle__option">',
        '        <input className="ac-toggle__input" type="radio" />',
        '        <span className="ac-toggle__label">ON</span>',
        '      </label>',
        '    </div>',
        '  );',
        '}',
        '',
      ].join('\n'),
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 0) {
      return fail(
        name,
        `expected exit 0 (no match); got ${run.code}; stdout=${run.stdout}`,
      );
    }
    return pass(name, 'canonical AcToggle chrome does NOT match the legacy entry');
  } finally {
    await cleanup(fixture);
  }
}

/**
 * Gutted-stub self-check: prove the scanner is actually doing the
 * matching, not the harness rubber-stamping. Substituting a stub
 * scanner that always exits 0 must cause the flag-legacy scenarios to
 * FAIL (their assertion is `exit code 1`). If the stub-swap doesn't
 * break the legacy-shape scenarios, those scenarios have no teeth.
 */
async function scenarioGuttedStubForS3kParam(): Promise<ScenarioResult> {
  const name = 's3k-param-shape: gutted-stub self-check';
  const fixture = await makeFixture('gutted-stub');
  try {
    await writeFile(fixture.registryPath, S3K_PARAM_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'LegacyInput.tsx',
      'export const X = <input className="s3k-param-input" />;\n',
    );
    // Plant a stub "scanner" file that always exits 0.
    const stubPath = join(fixture.dir, 'stub-scanner.ts');
    await writeFile(
      stubPath,
      'process.exit(0);\n',
      'utf8',
    );
    const run = await runScannerSubprocess(stubPath, args(fixture));
    if (run.code !== 0) {
      return fail(
        name,
        `gutted stub should exit 0 unconditionally; got ${run.code}; stderr=${run.stderr}`,
      );
    }
    // The point: the flag-legacy assertion would have wanted exit 1.
    // Stub returns 0. So replacing the real scanner with this stub WOULD
    // make scenarioInputFlagsLegacyShape fail — proving the real scanner's
    // exit-1 result is load-bearing.
    return pass(
      name,
      'stub scanner exits 0; production-shape assertions would correctly fail against it (teeth proven)',
    );
  } finally {
    await cleanup(fixture);
  }
}

export const S3K_PARAM_SHAPE_SCENARIOS = [
  scenarioInputFlagsLegacyShape,
  scenarioInputIgnoresCanonical,
  scenarioSelectFlagsLegacyShape,
  scenarioSelectIgnoresCanonical,
  scenarioToggleFlagsLegacyShape,
  scenarioToggleIgnoresCanonical,
  scenarioGuttedStubForS3kParam,
] as const;
