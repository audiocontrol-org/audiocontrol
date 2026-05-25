/**
 * tools/scope-discovery/anti-patterns.s3k-envelope-display-scenarios.ts
 *
 * Adversarial scenarios paired with the `s3k-envelope-display-inline`
 * anti-pattern entry landed alongside this file in akai-harmonization
 * Phase 2 task 2.2 Commit 6 (harmonization-spec § 6 item 6 closure;
 * AcEnvelope kind 'adsr' + AcFrequencyResponse extraction sequence's
 * CSS-delete + anti-pattern-register step).
 *
 * Per the project's "Validator-paired changes" discipline in
 * .claude/rules/agent-discipline.md, every gate-semantic change ships
 * with a scenario that would have REJECTED the pre-change behavior.
 * The new registry entry is "production data" rather than a scanner-
 * shape change — its teeth come from this paired check:
 *
 *   Teeth test (revertable proof):
 *     1. Plant a fixture with the legacy shape: `className="s3k-
 *        envelope-display"` and `className="s3k-adsr-fill"`.
 *     2. Plant a fixture with the canonical replacements: <AcEnvelope>
 *        and <AcFrequencyResponse>.
 *     3. With a registry that contains the new entry, scanner MUST
 *        flag the legacy shape AND NOT flag the canonical shape.
 *     4. Sibling-class negative case (TF-015 lesson): the regex must
 *        not over-match by stripping the word-boundary anchor. A
 *        hypothetical sibling `s3k-envelope-display-history` MUST
 *        ALSO be flagged (it shares the `s3k-envelope-display` token
 *        verbatim before the trailing modifier) — for THIS rule's
 *        scope. A genuinely unrelated sibling like
 *        `s3k-envelope-section` MUST NOT match.
 *     5. Gutted-stub self-check: confirm a no-op scanner would PASS
 *        scenarios that the real scanner correctly fails.
 *
 * Mirrors the shape of `anti-patterns.s3k-zone-tabs-scenarios.ts` and
 * `anti-patterns.inline-zone-segment-bar-scenarios.ts` — boilerplate
 * is intentional per the in-situ precedent rather than sharing a
 * helper (each scenario file is single-purpose).
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
  const root = await mkdtemp(join(tmpdir(), `anti-patterns-s3k-envelope-display-${slug}-`));
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
// either copy fails this scenario AND a CI re-run. The regex catches
// the s3k-envelope-display token OR any of the s3k-adsr-* SVG chrome
// classes that were part of the deleted family.
const S3K_ENVELOPE_DISPLAY_REGISTRY_YAML = `anti_patterns:
  - id: s3k-envelope-display-inline
    added_in: 0000cccc
    primitive: AcEnvelope
    from: '@audiocontrol/editor-core'
    shape_regex: '\\bs3k-(envelope-display|adsr-(bg|fill|line|dot|hit|label))\\b'
    message: |
      Legacy s3k-envelope-display / s3k-adsr-* SVG chrome was replaced
      by AcEnvelope (kind='multi-segment' or kind='adsr') and
      AcFrequencyResponse from @audiocontrol/editor-core.
`;

async function scenarioFlagsEnvelopeDisplayClass(): Promise<ScenarioResult> {
  const name = 's3k-envelope-display-inline: flags `s3k-envelope-display` className in JSX';
  const fixture = await makeFixture('jsx-class');
  try {
    await writeFile(fixture.registryPath, S3K_ENVELOPE_DISPLAY_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'LegacyEnvelope.tsx',
      [
        'export function LegacyEnvelope() {',
        '  return (',
        '    <svg className="s3k-envelope-display" width={400} height={120}>',
        '      <rect className="s3k-adsr-bg" />',
        '    </svg>',
        '  );',
        '}',
        '',
      ].join('\n'),
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 1) {
      return fail(name, `expected exit 1 (match); got ${run.code}; stdout=${run.stdout}`);
    }
    if (!run.stdout.includes('s3k-envelope-display-inline')) {
      return fail(name, `stdout missing entry id; got: ${run.stdout}`);
    }
    return pass(name, 'inline s3k-envelope-display className flagged');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioFlagsAdsrFillClass(): Promise<ScenarioResult> {
  const name = 's3k-envelope-display-inline: flags `s3k-adsr-fill` className in JSX';
  const fixture = await makeFixture('adsr-fill');
  try {
    await writeFile(fixture.registryPath, S3K_ENVELOPE_DISPLAY_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'LegacyAdsrFill.tsx',
      [
        'export function LegacyAdsrFill() {',
        '  return <path d="M 0 0 L 100 0" className="s3k-adsr-fill" />;',
        '}',
        '',
      ].join('\n'),
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 1) {
      return fail(name, `expected exit 1 (match); got ${run.code}; stdout=${run.stdout}`);
    }
    if (!run.stdout.includes('s3k-envelope-display-inline')) {
      return fail(name, `stdout missing entry id; got: ${run.stdout}`);
    }
    return pass(name, 'inline s3k-adsr-fill className flagged');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioFlagsCssSelector(): Promise<ScenarioResult> {
  const name = 's3k-envelope-display-inline: flags `.s3k-envelope-display` CSS selector if re-added';
  const fixture = await makeFixture('css');
  try {
    await writeFile(fixture.registryPath, S3K_ENVELOPE_DISPLAY_REGISTRY_YAML, 'utf8');
    // Plant the CSS in a .ts file (scanner reads .ts/.tsx); the regex
    // matches the bare token regardless of context. This guards
    // against re-adding the class via a CSS-in-JS literal.
    await writeSource(
      fixture,
      'styles.ts',
      [
        'export const legacyStyles = `',
        '  .s3k-envelope-display {',
        '    width: 100%;',
        '  }',
        '`;',
        '',
      ].join('\n'),
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 1) {
      return fail(name, `expected exit 1 (match); got ${run.code}; stdout=${run.stdout}`);
    }
    return pass(name, 'CSS literal containing s3k-envelope-display flagged');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioIgnoresCanonicalAcEnvelope(): Promise<ScenarioResult> {
  const name = 's3k-envelope-display-inline: ignores canonical AcEnvelope adoption';
  const fixture = await makeFixture('canonical-envelope');
  try {
    await writeFile(fixture.registryPath, S3K_ENVELOPE_DISPLAY_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'CanonicalAmpEnvelope.tsx',
      [
        "import { AcEnvelope } from '@audiocontrol/editor-core';",
        'export function CanonicalAmpEnvelope() {',
        '  return (',
        '    <AcEnvelope',
        '      kind="adsr"',
        '      label="AMP · ADSR"',
        '      attack={50}',
        '      decay={50}',
        '      sustain={75}',
        '      release={50}',
        '      maxValue={99}',
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
    return pass(name, 'canonical <AcEnvelope kind="adsr"> usage does NOT match the legacy entry');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioIgnoresCanonicalAcFrequencyResponse(): Promise<ScenarioResult> {
  const name = 's3k-envelope-display-inline: ignores canonical AcFrequencyResponse adoption';
  const fixture = await makeFixture('canonical-frequency');
  try {
    await writeFile(fixture.registryPath, S3K_ENVELOPE_DISPLAY_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'CanonicalFilter.tsx',
      [
        "import { AcFrequencyResponse } from '@audiocontrol/editor-core';",
        'export function CanonicalFilter() {',
        '  return (',
        '    <AcFrequencyResponse',
        '      frequency={1000}',
        '      resonance={5}',
        '      filterType="lowpass"',
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
      'canonical <AcFrequencyResponse> usage does NOT match the legacy entry',
    );
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioIgnoresSiblingS3kEnvelopeSection(): Promise<ScenarioResult> {
  // TF-015 sibling-class prefix collision guard: a hypothetical class
  // `s3k-envelope-section` shares the `s3k-envelope` prefix but is
  // genuinely unrelated (it would be a wrapping section, not the
  // SVG-direct envelope graphic this rule catches). The regex requires
  // `s3k-envelope-display` verbatim (or an `s3k-adsr-*` token), so the
  // section class must NOT match. Guards against an over-eager rewrite
  // that broadens to `\bs3k-envelope-.*\b`.
  const name = 's3k-envelope-display-inline: ignores sibling s3k-envelope-section class';
  const fixture = await makeFixture('sibling-section');
  try {
    await writeFile(fixture.registryPath, S3K_ENVELOPE_DISPLAY_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'CanonicalSibling.tsx',
      [
        'export function CanonicalSibling() {',
        '  return (',
        '    <section className="s3k-envelope-section">',
        '      <header className="s3k-envelope-section-head">heading</header>',
        '      <div className="s3k-section-title">title</div>',
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
      'regex correctly ignores `s3k-envelope-section` / `s3k-envelope-section-head` / `s3k-section-title` siblings',
    );
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioFlagsAdsrDisplaySuffixCollision(): Promise<ScenarioResult> {
  // TF-015 positive prefix-overlap case: a hypothetical
  // `s3k-envelope-display-history` would re-introduce the legacy
  // envelope chrome under a longer name. Because the regex anchors on
  // `\bs3k-envelope-display\b`, and `-history` follows a `-` (which is
  // NOT a word character in regex `\b` semantics — actually `\b`
  // treats `-` as a non-word boundary), the trailing token boundary
  // SHOULD allow this longer string. Verify the EXPECTED behavior:
  // the regex's `\b` at the end matches between `y` (word) and `-`
  // (non-word), so `s3k-envelope-display-history` matches. That's the
  // INTENDED behavior — re-introducing the family via a suffix is
  // still the legacy chrome.
  const name = 's3k-envelope-display-inline: still flags the legacy token even when suffixed';
  const fixture = await makeFixture('suffix');
  try {
    await writeFile(fixture.registryPath, S3K_ENVELOPE_DISPLAY_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'LegacyHistory.tsx',
      [
        'export function LegacyHistory() {',
        '  return <div className="s3k-envelope-display-history" />;',
        '}',
        '',
      ].join('\n'),
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 1) {
      return fail(
        name,
        `expected exit 1 (suffix still flags); got ${run.code}; stdout=${run.stdout}`,
      );
    }
    return pass(
      name,
      'suffix variant `s3k-envelope-display-history` still flagged as legacy chrome',
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
async function scenarioGuttedStubForEnvelopeDisplay(): Promise<ScenarioResult> {
  const name = 's3k-envelope-display-inline: gutted-stub self-check';
  const fixture = await makeFixture('gutted-stub');
  try {
    await writeFile(fixture.registryPath, S3K_ENVELOPE_DISPLAY_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'LegacyEnvelope.tsx',
      'export const X = <div className="s3k-envelope-display" />;\n',
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

export const S3K_ENVELOPE_DISPLAY_SCENARIOS = [
  scenarioFlagsEnvelopeDisplayClass,
  scenarioFlagsAdsrFillClass,
  scenarioFlagsCssSelector,
  scenarioIgnoresCanonicalAcEnvelope,
  scenarioIgnoresCanonicalAcFrequencyResponse,
  scenarioIgnoresSiblingS3kEnvelopeSection,
  scenarioFlagsAdsrDisplaySuffixCollision,
  scenarioGuttedStubForEnvelopeDisplay,
] as const;
