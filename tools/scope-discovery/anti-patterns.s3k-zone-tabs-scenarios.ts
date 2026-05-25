/**
 * tools/scope-discovery/anti-patterns.s3k-zone-tabs-scenarios.ts
 *
 * Adversarial scenarios paired with the `s3k-zone-tabs-inline` anti-
 * pattern entry landed alongside this file in akai-harmonization
 * Phase 2 task 2.2 (harmonization-spec § 6 item 5 closure; AcRadioTabs
 * promotion sequence Commit 3).
 *
 * Per the project's "Validator-paired changes" discipline in
 * .claude/rules/agent-discipline.md, every gate-semantic change ships
 * with a scenario that would have REJECTED the pre-change behavior.
 * The new registry entry is "production data" rather than a scanner-
 * shape change — its teeth come from this paired check:
 *
 *   Teeth test (revertable proof):
 *     1. Plant a fixture with the legacy shape:
 *        `className="s3k-zone-tabs"` and `className="s3k-zone-tab"`.
 *     2. Plant a fixture with the canonical replacement: `<AcRadioTabs ...>`.
 *     3. With a registry that contains the new entry, scanner MUST flag
 *        the legacy shape AND NOT flag the canonical shape.
 *     4. Gutted-stub self-check: confirm a no-op scanner would PASS
 *        scenarios that the real scanner correctly fails.
 *
 * Lives in a sibling module so `anti-patterns.validate.ts` stays under
 * the 300-500 line cap. Wired in via the host's scenarios array.
 *
 * Mirrors the same shape as `anti-patterns.s3k-param-shape-scenarios.ts`
 * — boilerplate is intentional per the in-situ precedent rather than
 * sharing a helper (each scenario file is single-purpose).
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
  const root = await mkdtemp(join(tmpdir(), `anti-patterns-zone-tabs-${slug}-`));
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

// Registry slice paired with this scenario file. Mirrors the production
// entry in `docs/scope-discovery/anti-patterns.yaml` so a regression in
// either copy fails this scenario AND a CI re-run.
// NOTE: backtick template literal — `\b` would be the U+0008 backspace
// control character. Use `\\b` so the YAML carries a literal `\b` pair
// that the regex compiler treats as a word-boundary.
const S3K_ZONE_TABS_REGISTRY_YAML = `anti_patterns:
  - id: s3k-zone-tabs-inline
    added_in: 0000aaaa
    primitive: AcRadioTabs
    from: '@audiocontrol/editor-core'
    shape_regex: '\\bs3k-zone-tabs?\\b'
    message: |
      Legacy s3k-zone-tab* chrome was replaced by AcRadioTabs.
`;

async function scenarioFlagsContainerClass(): Promise<ScenarioResult> {
  const name = 's3k-zone-tabs-inline: flags `s3k-zone-tabs` container class';
  const fixture = await makeFixture('container');
  try {
    await writeFile(fixture.registryPath, S3K_ZONE_TABS_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'LegacyZoneContainer.tsx',
      [
        'export function LegacyZoneContainer() {',
        '  return (',
        '    <div className="s3k-zone-tabs">',
        '      <button type="button">Zone 1</button>',
        '    </div>',
        '  );',
        '}',
        '',
      ].join('\n'),
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 1) {
      return fail(name, `expected exit 1 (match); got ${run.code}; stdout=${run.stdout}`);
    }
    if (!run.stdout.includes('s3k-zone-tabs-inline')) {
      return fail(name, `stdout missing entry id; got: ${run.stdout}`);
    }
    return pass(name, 'legacy `s3k-zone-tabs` container class flagged');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioFlagsModifierClass(): Promise<ScenarioResult> {
  const name = 's3k-zone-tabs-inline: flags `s3k-zone-tab--active` modifier class';
  const fixture = await makeFixture('modifier');
  try {
    await writeFile(fixture.registryPath, S3K_ZONE_TABS_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'LegacyZoneButton.tsx',
      [
        'export function LegacyZoneButton({ active }: { active: boolean }) {',
        '  return (',
        '    <button',
        '      type="button"',
        '      className={`s3k-zone-tab ${active ? "s3k-zone-tab--active" : ""}`}',
        '    >',
        '      Zone 1',
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
    if (!run.stdout.includes('s3k-zone-tabs-inline')) {
      return fail(name, `stdout missing entry id; got: ${run.stdout}`);
    }
    return pass(name, 'legacy `s3k-zone-tab` + `s3k-zone-tab--active` modifier class flagged');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioIgnoresCanonicalAcRadioTabs(): Promise<ScenarioResult> {
  const name = 's3k-zone-tabs-inline: ignores canonical AcRadioTabs adoption';
  const fixture = await makeFixture('canonical');
  try {
    await writeFile(fixture.registryPath, S3K_ZONE_TABS_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'CanonicalVelocityZoneTabs.tsx',
      [
        "import { AcRadioTabs } from '@audiocontrol/editor-core';",
        'export function CanonicalVelocityZoneTabs() {',
        '  return (',
        '    <AcRadioTabs',
        '      tabs={[{ id: "vz-zone-1", label: "Zone 1" }]}',
        '      panels={{ "vz-zone-1": <div>Z1</div> }}',
        '      activeId="vz-zone-1"',
        '      onActiveIdChange={() => {}}',
        '      groupName="velocity-zone-tabs"',
        '      ariaLabel="Velocity zone selector"',
        '    />',
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
    return pass(name, 'canonical AcRadioTabs adoption does NOT match the legacy entry');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioIgnoresGenuinelyUnrelatedClasses(): Promise<ScenarioResult> {
  // Sibling akai chrome that is NOT in the legacy-tab-chrome family —
  // `s3k-zone-editor`, `s3k-zone-sample-panel`, `s3k-zone-params`,
  // `s3k-section-title`, `s3k-section-grid`, etc. The regex
  // `\bs3k-zone-tabs?\b` requires the identifier to END at "tab" or
  // "tabs" (`-` is a word boundary character; what matters is no `tab`
  // run anywhere). Guards against an over-eager rewrite of the regex
  // that would broaden to `s3k-zone-*`.
  const name = 's3k-zone-tabs-inline: ignores genuinely-unrelated sibling akai classes';
  const fixture = await makeFixture('siblings');
  try {
    await writeFile(fixture.registryPath, S3K_ZONE_TABS_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'CanonicalSiblings.tsx',
      [
        'export function CanonicalSiblings() {',
        '  return (',
        '    <div className="s3k-zone-editor">',
        '      <div className="s3k-zone-sample-panel">',
        '        <div className="s3k-section-title">Sample</div>',
        '      </div>',
        '      <div className="s3k-zone-params">',
        '        <div className="s3k-section-grid">params here</div>',
        '      </div>',
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
    return pass(name, 'regex correctly ignores `s3k-zone-editor` / `s3k-zone-sample-panel` / `s3k-zone-params` / `s3k-section-*` siblings');
  } finally {
    await cleanup(fixture);
  }
}

/**
 * Gutted-stub self-check: prove the scanner is actually doing the
 * matching, not the harness rubber-stamping. Substituting a stub
 * scanner that always exits 0 must cause the flag scenarios to FAIL
 * (their assertion is `exit code 1`). If the stub-swap doesn't break
 * the legacy-shape scenarios, those scenarios have no teeth.
 */
async function scenarioGuttedStubForZoneTabs(): Promise<ScenarioResult> {
  const name = 's3k-zone-tabs-inline: gutted-stub self-check';
  const fixture = await makeFixture('gutted-stub');
  try {
    await writeFile(fixture.registryPath, S3K_ZONE_TABS_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'LegacyContainer.tsx',
      'export const X = <div className="s3k-zone-tabs" />;\n',
    );
    const stubPath = join(fixture.dir, 'stub-scanner.ts');
    await writeFile(stubPath, 'process.exit(0);\n', 'utf8');
    const run = await runScannerSubprocess(stubPath, args(fixture));
    if (run.code !== 0) {
      return fail(
        name,
        `gutted stub should exit 0 unconditionally; got ${run.code}; stderr=${run.stderr}`,
      );
    }
    return pass(
      name,
      'stub scanner exits 0; production-shape assertions would correctly fail against it (teeth proven)',
    );
  } finally {
    await cleanup(fixture);
  }
}

export const S3K_ZONE_TABS_SCENARIOS = [
  scenarioFlagsContainerClass,
  scenarioFlagsModifierClass,
  scenarioIgnoresCanonicalAcRadioTabs,
  scenarioIgnoresGenuinelyUnrelatedClasses,
  scenarioGuttedStubForZoneTabs,
] as const;
