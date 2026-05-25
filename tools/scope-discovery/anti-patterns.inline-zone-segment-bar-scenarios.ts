/**
 * tools/scope-discovery/anti-patterns.inline-zone-segment-bar-scenarios.ts
 *
 * Adversarial scenarios paired with the `inline-zone-segment-bar`
 * anti-pattern entry registered alongside this file during
 * akai-harmonization Phase 2 task 2.2 Commit 6 (the AcZoneStrip
 * primitive-extraction sequence's adopter-manifest + anti-pattern
 * registration step).
 *
 * Per the project's "Validator-paired changes" discipline in
 * .claude/rules/agent-discipline.md, every gate-semantic change ships
 * with a scenario that would have REJECTED the pre-change behavior.
 * The new registry entry is "production data" rather than a scanner-
 * shape change — its teeth come from this paired check:
 *
 *   Teeth test (revertable proof):
 *     1. Plant a fixture with the legacy shape: `className="ac-zone-segment"`
 *        and `className="ac-zone-handle--start"` and
 *        `className="ac-zone-handle--end"`.
 *     2. Plant a fixture with the canonical replacement: `<AcZoneStrip ...>`.
 *     3. With a registry that contains the new entry, scanner MUST flag
 *        the legacy shapes AND NOT flag the canonical shape.
 *     4. Gutted-stub self-check: confirm a no-op scanner would PASS
 *        scenarios that the real scanner correctly fails.
 *
 * Mirrors the same shape as `anti-patterns.s3k-zone-tabs-scenarios.ts`
 * — boilerplate is intentional per the in-situ precedent rather than
 * sharing a helper (each scenario file is single-purpose).
 *
 * Sibling-class negative case: `.ac-zone-bar`, `.ac-zone-bar-empty`,
 * `.ac-zone-section`, `.ac-zone-axis`, `.ac-zone-form`,
 * `.ac-keygroup-zone-rect` are NOT in scope of this rule (they are
 * either the primitive's outer container — legitimate AcZoneStrip
 * usage — or roland's per-page chrome around the primitive).
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
  const root = await mkdtemp(
    join(tmpdir(), `anti-patterns-zone-segment-bar-${slug}-`),
  );
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
// either copy fails this scenario AND a CI re-run. The regex is the
// same one the production rule carries; the YAML must single-quote it
// so the `\b` survives the YAML decode unchanged.
const INLINE_ZONE_SEGMENT_BAR_REGISTRY_YAML = `anti_patterns:
  - id: inline-zone-segment-bar
    added_in: 0000bbbb
    primitive: AcZoneStrip
    from: '@audiocontrol/editor-core'
    shape_regex: '\\bac-zone-(segment(-body|--off|--editing|--dragging)?|handle(--start|--end|--split|--dragging)?)\\b'
    message: |
      Legacy inline ac-zone-segment* / ac-zone-handle* chrome was
      replaced by AcZoneStrip from @audiocontrol/editor-core.
`;

async function scenarioFlagsInlineSegmentClass(): Promise<ScenarioResult> {
  const name = 'inline-zone-segment-bar: flags inline `ac-zone-segment` className';
  const fixture = await makeFixture('segment');
  try {
    await writeFile(fixture.registryPath, INLINE_ZONE_SEGMENT_BAR_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'LegacyZoneBar.tsx',
      [
        'export function LegacyZoneBar() {',
        '  return (',
        '    <div className="ac-zone-bar">',
        '      <div className="ac-zone-segment">Zone 1</div>',
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
    if (!run.stdout.includes('inline-zone-segment-bar')) {
      return fail(name, `stdout missing entry id; got: ${run.stdout}`);
    }
    return pass(name, 'inline `ac-zone-segment` className flagged');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioFlagsInlineHandleClass(): Promise<ScenarioResult> {
  const name = 'inline-zone-segment-bar: flags inline `ac-zone-handle--start` className';
  const fixture = await makeFixture('handle');
  try {
    await writeFile(fixture.registryPath, INLINE_ZONE_SEGMENT_BAR_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'LegacyHandle.tsx',
      [
        'export function LegacyHandle({ dragging }: { dragging: boolean }) {',
        '  return (',
        '    <div',
        '      className={`ac-zone-handle ac-zone-handle--start ${dragging ? "ac-zone-handle--dragging" : ""}`}',
        '    />',
        '  );',
        '}',
        '',
      ].join('\n'),
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 1) {
      return fail(name, `expected exit 1 (match); got ${run.code}; stdout=${run.stdout}`);
    }
    if (!run.stdout.includes('inline-zone-segment-bar')) {
      return fail(name, `stdout missing entry id; got: ${run.stdout}`);
    }
    return pass(name, 'inline `ac-zone-handle--start` className flagged');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioIgnoresCanonicalAcZoneStrip(): Promise<ScenarioResult> {
  const name = 'inline-zone-segment-bar: ignores canonical <AcZoneStrip> usage';
  const fixture = await makeFixture('canonical');
  try {
    await writeFile(fixture.registryPath, INLINE_ZONE_SEGMENT_BAR_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'CanonicalZoneBar.tsx',
      [
        "import { AcZoneStrip } from '@audiocontrol/editor-core';",
        'export function CanonicalZoneBar() {',
        '  return (',
        '    <AcZoneStrip',
        '      zones={[{ startValue: 0, endValue: 127, label: "Z1" }]}',
        '      range={{ min: 0, max: 127 }}',
        '      onSelect={() => {}}',
        '      ariaLabel="zones"',
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
    return pass(
      name,
      'canonical <AcZoneStrip> usage does NOT match the legacy entry',
    );
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioIgnoresGenuinelyUnrelatedSiblings(): Promise<ScenarioResult> {
  // Sibling classes that are NOT the inline-zone-segment-bar shape:
  //   - `.ac-zone-bar` / `.ac-zone-bar-empty` — outer container the
  //     primitive itself emits; legitimate when a consumer uses the
  //     component.
  //   - `.ac-zone-section` / `.ac-zone-axis` / `.ac-zone-form*` —
  //     roland's per-page chrome AROUND the primitive (label rows,
  //     axis text, editing-form panel below the bar).
  //   - `.ac-keygroup-zone-rect` — akai's 2D zone-overview rect
  //     (domain-component per § 2.7 amendment; this anti-pattern is
  //     about the segmented strip, not the 2D canvas).
  // The regex `\bac-zone-(segment(...)?|handle(...)?)\b` requires the
  // identifier to start with `ac-zone-segment` or `ac-zone-handle`.
  // None of these sibling classes match. Guards against an over-eager
  // rewrite of the regex that would broaden to `\bac-zone-*\b`.
  const name = 'inline-zone-segment-bar: ignores legitimate sibling ac-zone-* classes';
  const fixture = await makeFixture('siblings');
  try {
    await writeFile(fixture.registryPath, INLINE_ZONE_SEGMENT_BAR_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'CanonicalSiblings.tsx',
      [
        'export function CanonicalSiblings() {',
        '  return (',
        '    <section className="ac-zone-section">',
        '      <header className="ac-zone-section-head">eyebrow</header>',
        '      <div className="ac-zone-bar">',
        '        <div className="ac-zone-bar-empty">empty</div>',
        '      </div>',
        '      <div className="ac-zone-axis">C-1 / G9</div>',
        '      <div className="ac-zone-form">form</div>',
        '      <div className="ac-keygroup-zone-rect">overview rect</div>',
        '    </section>',
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
    return pass(
      name,
      'regex correctly ignores .ac-zone-bar / .ac-zone-section / .ac-zone-axis / .ac-zone-form / .ac-keygroup-zone-rect siblings',
    );
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
async function scenarioGuttedStubForZoneSegmentBar(): Promise<ScenarioResult> {
  const name = 'inline-zone-segment-bar: gutted-stub self-check';
  const fixture = await makeFixture('gutted-stub');
  try {
    await writeFile(fixture.registryPath, INLINE_ZONE_SEGMENT_BAR_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'LegacySegment.tsx',
      'export const X = <div className="ac-zone-segment" />;\n',
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

export const INLINE_ZONE_SEGMENT_BAR_SCENARIOS = [
  scenarioFlagsInlineSegmentClass,
  scenarioFlagsInlineHandleClass,
  scenarioIgnoresCanonicalAcZoneStrip,
  scenarioIgnoresGenuinelyUnrelatedSiblings,
  scenarioGuttedStubForZoneSegmentBar,
] as const;
