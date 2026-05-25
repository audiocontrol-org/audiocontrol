/**
 * tools/scope-discovery/anti-patterns.ac-page-header-scenarios.ts
 *
 * Adversarial scenarios paired with the `ac-page-sticky-header-inline`
 * anti-pattern entry landed alongside this file in akai-harmonization
 * Phase 2 task 2.2 (harmonization-spec § 6 item 1 closure; PREVENTIVE
 * registration — no current akai file uses the legacy class family,
 * but the Phase 1 inventory named it as drift that must not re-emerge).
 *
 * Per the project's "Validator-paired changes" discipline in
 * .claude/rules/agent-discipline.md, every gate-semantic change ships
 * with a scenario that would have REJECTED the pre-change behavior.
 * The new registry entry is "production data" rather than a scanner-
 * shape change — its teeth come from this paired check:
 *
 *   Teeth test (revertable proof):
 *     1. Plant a fixture with the legacy shape:
 *        `<div className="ac-page-sticky-header">`.
 *     2. Plant a fixture with the canonical replacement:
 *        `<PageTitleRow ... />`.
 *     3. With a registry that contains the new entry, scanner MUST flag
 *        the legacy shape AND NOT flag the canonical shape.
 *     4. Gutted-stub self-check.
 *
 * Lives in a sibling module so `anti-patterns.validate.ts` stays under
 * the 300-500 line cap. Mirrors the shape of
 * `anti-patterns.s3k-zone-tabs-scenarios.ts` for consistency.
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
  const root = await mkdtemp(join(tmpdir(), `anti-patterns-page-header-${slug}-`));
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

// Mirror of the production entry — match the `ac-page-sticky-header`
// OR `ac-page-header` class families. Backtick template `\b` escape
// gotcha applies (see s3k-zone-tabs-scenarios.ts for the rationale).
const AC_PAGE_HEADER_REGISTRY_YAML = `anti_patterns:
  - id: ac-page-sticky-header-inline
    added_in: 0000aaaa
    primitive: PageTitleRow
    from: '@audiocontrol/editor-core'
    shape_regex: '\\bac-page-(sticky-header|header)\\b'
    message: |
      Legacy ac-page-sticky-header / ac-page-header chrome was replaced by PageTitleRow.
`;

async function scenarioFlagsStickyHeader(): Promise<ScenarioResult> {
  const name = 'ac-page-sticky-header-inline: flags `ac-page-sticky-header` class';
  const fixture = await makeFixture('sticky');
  try {
    await writeFile(fixture.registryPath, AC_PAGE_HEADER_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'LegacyStickyHeader.tsx',
      [
        'export function LegacyStickyHeader() {',
        '  return (',
        '    <div className="ac-page-sticky-header">',
        '      <h2>Programs</h2>',
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
    if (!run.stdout.includes('ac-page-sticky-header-inline')) {
      return fail(name, `stdout missing entry id; got: ${run.stdout}`);
    }
    return pass(name, 'legacy `ac-page-sticky-header` class flagged');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioFlagsPlainPageHeader(): Promise<ScenarioResult> {
  const name = 'ac-page-sticky-header-inline: flags `ac-page-header` class';
  const fixture = await makeFixture('plain');
  try {
    await writeFile(fixture.registryPath, AC_PAGE_HEADER_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'LegacyPageHeader.tsx',
      [
        'export function LegacyPageHeader() {',
        '  return (',
        '    <div className="ac-page-header">',
        '      <h2>Programs</h2>',
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
    if (!run.stdout.includes('ac-page-sticky-header-inline')) {
      return fail(name, `stdout missing entry id; got: ${run.stdout}`);
    }
    return pass(name, 'legacy `ac-page-header` class flagged');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioIgnoresCanonicalPageTitleRow(): Promise<ScenarioResult> {
  const name = 'ac-page-sticky-header-inline: ignores canonical PageTitleRow adoption';
  const fixture = await makeFixture('canonical');
  try {
    await writeFile(fixture.registryPath, AC_PAGE_HEADER_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'CanonicalPage.tsx',
      [
        "import { PageTitleRow } from '@audiocontrol/editor-core';",
        'export function CanonicalPage() {',
        '  return (',
        '    <PageTitleRow',
        '      headingId="programs"',
        '      headingText="Programs"',
        '      metric="50 / 64 slots"',
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
    return pass(name, 'canonical PageTitleRow adoption does NOT match the legacy entry');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioIgnoresUnrelatedAcPageClass(): Promise<ScenarioResult> {
  // \b word-boundary anchoring means `ac-page-title-row` should NOT
  // match (it does not end at "header"). Same for `ac-page-shell`,
  // `ac-page-actions`, etc. Guards against the regex being over-eager
  // and false-flagging the canonical sibling classes.
  const name = 'ac-page-sticky-header-inline: word-boundary anchoring rejects sibling `ac-page-*` classes';
  const fixture = await makeFixture('siblings');
  try {
    await writeFile(fixture.registryPath, AC_PAGE_HEADER_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'CanonicalSiblings.tsx',
      [
        'export function CanonicalSiblings() {',
        '  return (',
        '    <div className="ac-page-shell ac-page-title-row ac-page-actions-inline">',
        '      <h2 className="ac-page-title-heading">Programs</h2>',
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
    return pass(name, 'word-boundary regex correctly rejects sibling `ac-page-*` classes');
  } finally {
    await cleanup(fixture);
  }
}

/**
 * Gutted-stub self-check: prove the scanner is actually doing the
 * matching, not the harness rubber-stamping.
 */
async function scenarioGuttedStubForPageHeader(): Promise<ScenarioResult> {
  const name = 'ac-page-sticky-header-inline: gutted-stub self-check';
  const fixture = await makeFixture('gutted-stub');
  try {
    await writeFile(fixture.registryPath, AC_PAGE_HEADER_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'LegacyHeader.tsx',
      'export const X = <div className="ac-page-sticky-header" />;\n',
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

export const AC_PAGE_HEADER_SCENARIOS = [
  scenarioFlagsStickyHeader,
  scenarioFlagsPlainPageHeader,
  scenarioIgnoresCanonicalPageTitleRow,
  scenarioIgnoresUnrelatedAcPageClass,
  scenarioGuttedStubForPageHeader,
] as const;
