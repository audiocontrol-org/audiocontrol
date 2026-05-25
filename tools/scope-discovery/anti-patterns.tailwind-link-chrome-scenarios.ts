/**
 * tools/scope-discovery/anti-patterns.tailwind-link-chrome-scenarios.ts
 *
 * Adversarial scenarios paired with the `tailwind-link-chrome-inline`
 * anti-pattern entry landed alongside this file in akai-harmonization
 * Phase 2 task 2.5 (harmonization-spec § 6 item 3 closure).
 *
 * Per the project's "Validator-paired changes" discipline in
 * .claude/rules/agent-discipline.md, every gate-semantic change ships
 * with a scenario that would have REJECTED the pre-change behavior.
 * The new registry entry is "production data" rather than a scanner-
 * shape change — its teeth come from this paired check:
 *
 *   Teeth test (revertable proof):
 *     1. Plant a fixture with the legacy shape: a `<button>` or `<a>`
 *        element using inline `text-blue-*` + `hover:underline`
 *        tailwind utilities.
 *     2. Plant a fixture with the canonical replacement:
 *        `<button className="ac-link">` / `<a className="ac-link">`.
 *     3. With a registry that contains the new entry, scanner MUST flag
 *        the legacy shape AND NOT flag the canonical shape.
 *     4. TF-015 sibling-class negative scenarios: spans + divs carrying
 *        `text-blue-*` without an adjacent `<a/button>` element AND
 *        without the `hover:underline` co-occurrence MUST NOT flag —
 *        the registry uses a multi-pattern fingerprint to disambiguate
 *        "link chrome on a link element" from "informational blue
 *        text on a non-link element."
 *     5. Gutted-stub self-check: confirm a no-op scanner would PASS
 *        scenarios that the real scanner correctly fails.
 *
 * Mirrors the same shape as `anti-patterns.s3k-zone-tabs-scenarios.ts`
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
  const root = await mkdtemp(join(tmpdir(), `anti-patterns-link-chrome-${slug}-`));
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
//
// Multi-pattern fingerprint with min_distance: 5 — the JSX
// `onClick={() => ...}` arrow contains `>` characters that defeat a
// single-regex `<a|button[^>]+className=...` match. The two-pattern
// approach co-locates `<a|button` with the `text-blue/cyan +
// hover:underline` className shape within 5 source lines, which
// disambiguates "link chrome on a link element" from "non-link
// informational blue text" without parsing JSX expression syntax.
// NOTE: YAML escaping notes for the embedded regex —
//   - This is a JS template literal (backtick). `\b` would be U+0008
//     backspace; `\\b` lands as the literal `\b` pair that the YAML
//     single-quoted string passes through verbatim to the regex
//     engine as a word-boundary anchor.
//   - YAML single-quoted strings represent a literal single quote as
//     `''` (doubled). The character class `["'`]` therefore appears
//     as `["''`]` in the YAML source.
//   - Backticks (`` ` ``) are literal in single-quoted YAML; the JS
//     template literal needs them escaped as `` \` `` so the JS
//     string carries a literal backtick.
//   - Backslash before the character class quote (`\\`) is used to
//     keep ESLint / lint passes happy about template literal escapes;
//     it lands as a literal backslash inside the YAML string body
//     (then the YAML parser reads it back, which the regex engine
//     interprets as `\` — harmless here since the character class
//     accepts the quote characters literally regardless).
const TAILWIND_LINK_CHROME_REGISTRY_YAML = `anti_patterns:
  - id: tailwind-link-chrome-inline
    added_in: 0000eeee
    primitive: ac-link
    from: '@audiocontrol/editor-core'
    shape_regex:
      - '<(a|button)\\b'
      - 'className=["''\`][^"''\`]*\\b(text-blue-\\d+|text-cyan-\\d+)\\b[^"''\`]*\\bhover:underline\\b'
    min_distance: 5
    message: |
      Tailwind text-blue-* + hover:underline link chrome on <a> or
      <button> is the legacy shape. Replace with <a className="ac-link">
      or <button className="ac-link"> imported via editor-core's
      primitives.css.
`;

async function scenarioFlagsAnchorLinkChrome(): Promise<ScenarioResult> {
  const name = 'tailwind-link-chrome-inline: flags anchor with text-blue + hover:underline';
  const fixture = await makeFixture('anchor');
  try {
    await writeFile(fixture.registryPath, TAILWIND_LINK_CHROME_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'LegacyAnchor.tsx',
      [
        'export function LegacyAnchor() {',
        '  return (',
        '    <a href="/foo" className="text-blue-400 hover:underline">Foo</a>',
        '  );',
        '}',
        '',
      ].join('\n'),
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 1) {
      return fail(name, `expected exit 1 (match); got ${run.code}; stdout=${run.stdout}`);
    }
    if (!run.stdout.includes('tailwind-link-chrome-inline')) {
      return fail(name, `stdout missing entry id; got: ${run.stdout}`);
    }
    return pass(name, 'legacy <a text-blue-400 hover:underline> flagged');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioFlagsButtonLinkChrome(): Promise<ScenarioResult> {
  const name = 'tailwind-link-chrome-inline: flags <button> with text-blue + hover:underline';
  const fixture = await makeFixture('button');
  try {
    await writeFile(fixture.registryPath, TAILWIND_LINK_CHROME_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'LegacyButton.tsx',
      [
        'export function LegacyButton() {',
        '  return (',
        '    <button onClick={() => alert("hi")} className="text-blue-400 hover:underline">',
        '      Connect',
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
    if (!run.stdout.includes('tailwind-link-chrome-inline')) {
      return fail(name, `stdout missing entry id; got: ${run.stdout}`);
    }
    return pass(name, 'legacy <button text-blue + hover:underline> flagged even with onClick={() => ...} arrow');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioIgnoresCanonicalAcLink(): Promise<ScenarioResult> {
  const name = 'tailwind-link-chrome-inline: ignores canonical .ac-link adoption';
  const fixture = await makeFixture('canonical');
  try {
    await writeFile(fixture.registryPath, TAILWIND_LINK_CHROME_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'CanonicalLinkChrome.tsx',
      [
        'export function CanonicalLinkChrome() {',
        '  return (',
        '    <>',
        '      <a href="/foo" className="ac-link">Foo</a>',
        '      <button onClick={() => alert("hi")} className="ac-link">Connect</button>',
        '    </>',
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
    return pass(name, 'canonical .ac-link adoption does NOT match the legacy entry');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioIgnoresInformationalBlueText(): Promise<ScenarioResult> {
  // TF-015 sibling-class negative — guard against an over-eager
  // rewrite that flags any `text-blue-*` instance. The akai codebase
  // has legitimate non-link spans + divs carrying `text-blue-200` /
  // `text-blue-400` for informational tinting (selection state,
  // drop-target callouts) WITHOUT `hover:underline`. The registry
  // entry requires BOTH the `<(a|button)` element token AND the
  // `text-blue + hover:underline` className shape within 5 lines.
  // A bare `<span text-blue-400>` should NOT flag.
  const name = 'tailwind-link-chrome-inline: ignores informational <span text-blue-*> without hover:underline';
  const fixture = await makeFixture('span-info');
  try {
    await writeFile(fixture.registryPath, TAILWIND_LINK_CHROME_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'InformationalSpan.tsx',
      [
        'export function InformationalSpan({ isSelected }: { isSelected: boolean }) {',
        '  return (',
        '    <div className="text-xs text-blue-400 text-center py-2">',
        '      <span className={isSelected ? "text-blue-200" : "text-gray-500"}>info</span>',
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
    return pass(name, 'informational <span text-blue-*> without hover:underline does NOT match');
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
async function scenarioGuttedStubForLinkChrome(): Promise<ScenarioResult> {
  const name = 'tailwind-link-chrome-inline: gutted-stub self-check';
  const fixture = await makeFixture('gutted-stub');
  try {
    await writeFile(fixture.registryPath, TAILWIND_LINK_CHROME_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'LegacyShape.tsx',
      'export const X = <a className="text-blue-400 hover:underline">link</a>;\n',
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

export const TAILWIND_LINK_CHROME_SCENARIOS = [
  scenarioFlagsAnchorLinkChrome,
  scenarioFlagsButtonLinkChrome,
  scenarioIgnoresCanonicalAcLink,
  scenarioIgnoresInformationalBlueText,
  scenarioGuttedStubForLinkChrome,
] as const;
