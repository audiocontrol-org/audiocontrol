/**
 * tools/scope-discovery/anti-patterns.tailwind-button-chrome-scenarios.ts
 *
 * Adversarial scenarios paired with the `tailwind-button-chrome-inline`
 * anti-pattern entry landed alongside this file in akai-harmonization
 * Phase 2 task 2.5 (harmonization-spec § 6 item 2 closure).
 *
 * Per the project's "Validator-paired changes" discipline in
 * .claude/rules/agent-discipline.md, every gate-semantic change ships
 * with a scenario that would have REJECTED the pre-change behavior.
 * The new registry entry is "production data" rather than a scanner-
 * shape change — its teeth come from this paired check:
 *
 *   Teeth test (revertable proof):
 *     1. Plant a fixture with the legacy shape: a `<button>` element
 *        with inline `bg-(gray|blue|amber|red)-N + (px-N|py-N|rounded)`
 *        tailwind chrome.
 *     2. Plant a fixture with the canonical replacement:
 *        `<button className="ac-btn">` / `.ac-btn .ac-btn-primary` /
 *        `.ac-btn .ac-btn-sm` / `.ac-btn .ac-btn-danger`.
 *     3. With a registry that contains the new entry, scanner MUST flag
 *        the legacy shape AND NOT flag the canonical shape.
 *     4. TF-015 sibling-class negative scenarios:
 *        a. A `<div bg-red-900 rounded>` containing a sibling
 *           `<button>` with minimal styling MUST NOT match — the
 *           regex is anchored to `<button` then the SAME element's
 *           className, NOT the surrounding parent's className.
 *        b. A `<button>` with layout utilities (flex, gap-2) AND the
 *           canonical `.ac-btn` class MUST NOT match.
 *        c. A non-button element (`<div>` / `<span>`) with bg-X
 *           chrome MUST NOT match — the regex is anchored to
 *           `<button`.
 *     5. Gutted-stub self-check: confirm a no-op scanner would PASS
 *        scenarios that the real scanner correctly fails.
 *
 * Mirrors the same shape as `anti-patterns.tailwind-link-chrome-scenarios.ts`
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
  const root = await mkdtemp(join(tmpdir(), `anti-patterns-button-chrome-${slug}-`));
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
// Single-regex anchored on `<button\b` + bounded `[^<]{0,400}` gap +
// className attribute carrying `bg-(gray|blue|amber|red)-N` AND
// `(px-N|py-N|rounded)` in EITHER order. The `[^<]` constraint
// prevents the regex from crossing element boundaries (a `<`
// character ends the opening tag's region), critical for skipping
// false positives on adjacent sibling elements carrying tailwind
// chrome. The bg+px alternation handles both
// `px-X py-Y rounded bg-Z` (rounded-first) and
// `bg-Z px-X py-Y rounded` (bg-first) class orderings present in
// the akai codebase pre-migration. This shape is preferable to a
// multi-pattern fingerprint because the latter false-positives when
// a parent `<div bg-X rounded>` wraps a `<button>` with minimal
// styling — the parent's className matches the chrome shape but the
// button itself does not.
//
// NOTE: JS template literal — `\b` would be U+0008 backspace.
// Use `\\b` so the YAML carries a literal `\b` pair that the regex
// compiler treats as a word-boundary.
const TAILWIND_BUTTON_CHROME_REGISTRY_YAML = `anti_patterns:
  - id: tailwind-button-chrome-inline
    added_in: 0000ffff
    primitive: ac-btn
    from: '@audiocontrol/editor-core'
    shape_regex: '<button\\b[^<]{0,400}?className=["''\`](?:[^"''\`]*\\bbg-(?:gray|blue|amber|red)-\\d+\\b[^"''\`]*\\b(?:px-\\d+|py-\\d+|rounded)\\b|[^"''\`]*\\b(?:px-\\d+|py-\\d+|rounded)\\b[^"''\`]*\\bbg-(?:gray|blue|amber|red)-\\d+\\b)'
    message: |
      Tailwind utility chrome on <button> elements is an anti-pattern.
      Replace with <button className="ac-btn"> or variant primitives.
`;

async function scenarioFlagsBasicButtonChrome(): Promise<ScenarioResult> {
  const name = 'tailwind-button-chrome-inline: flags <button bg-gray-700 px-3 py-1 rounded>';
  const fixture = await makeFixture('basic');
  try {
    await writeFile(fixture.registryPath, TAILWIND_BUTTON_CHROME_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'LegacyButton.tsx',
      [
        'export function LegacyButton() {',
        '  return (',
        '    <button className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded">',
        '      Click',
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
    if (!run.stdout.includes('tailwind-button-chrome-inline')) {
      return fail(name, `stdout missing entry id; got: ${run.stdout}`);
    }
    return pass(name, 'legacy <button bg-gray-700 px-3 py-1 rounded> flagged');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioFlagsPrimaryActionShape(): Promise<ScenarioResult> {
  const name = 'tailwind-button-chrome-inline: flags <button bg-blue-600 px-3 py-1.5 rounded> primary action';
  const fixture = await makeFixture('primary');
  try {
    await writeFile(fixture.registryPath, TAILWIND_BUTTON_CHROME_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'LegacyPrimary.tsx',
      [
        'export function LegacyPrimary() {',
        '  return (',
        '    <button className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded">',
        '      Save',
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
    if (!run.stdout.includes('tailwind-button-chrome-inline')) {
      return fail(name, `stdout missing entry id; got: ${run.stdout}`);
    }
    return pass(name, 'legacy <button bg-blue-600 + px + rounded> primary chrome flagged (bg-first order)');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioFlagsRoundedFirstOrdering(): Promise<ScenarioResult> {
  // Akai sites have `rounded bg-X` ordering as well as `bg-X rounded`.
  // The regex's alternation must catch BOTH orderings or the migration
  // is incomplete.
  const name = 'tailwind-button-chrome-inline: flags <button rounded ... bg-amber-600> rounded-first ordering';
  const fixture = await makeFixture('rounded-first');
  try {
    await writeFile(fixture.registryPath, TAILWIND_BUTTON_CHROME_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'LegacyRoundedFirst.tsx',
      [
        'export function LegacyRoundedFirst() {',
        '  return (',
        '    <button className="px-3 py-1.5 text-sm rounded bg-amber-600 hover:bg-amber-500 text-white font-medium">',
        '      Save',
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
    if (!run.stdout.includes('tailwind-button-chrome-inline')) {
      return fail(name, `stdout missing entry id; got: ${run.stdout}`);
    }
    return pass(name, 'legacy <button rounded bg-amber-600> rounded-first ordering flagged');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioIgnoresCanonicalAcBtn(): Promise<ScenarioResult> {
  const name = 'tailwind-button-chrome-inline: ignores canonical .ac-btn adoption';
  const fixture = await makeFixture('canonical');
  try {
    await writeFile(fixture.registryPath, TAILWIND_BUTTON_CHROME_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'CanonicalButton.tsx',
      [
        'export function CanonicalButton() {',
        '  return (',
        '    <>',
        '      <button className="ac-btn">Cancel</button>',
        '      <button className="ac-btn ac-btn-primary">Save</button>',
        '      <button className="ac-btn ac-btn-sm">Compact</button>',
        '      <button className="ac-btn ac-btn-danger">Delete</button>',
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
    return pass(name, 'canonical .ac-btn / .ac-btn-primary / .ac-btn-sm / .ac-btn-danger does NOT match');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioIgnoresParentDivWithChromeButButtonWithoutChrome(): Promise<ScenarioResult> {
  // TF-015 sibling-class negative — a multi-pattern co-occurrence regex
  // would false-positive here because both `<button` AND a `bg-X +
  // rounded` className appear within 5 lines. But the parent `<div>`
  // carries the chrome; the `<button>` itself has only `text-red-400`
  // (no bg color). The single-regex form anchored on `<button` then
  // SAME-element className correctly skips this case.
  const name = 'tailwind-button-chrome-inline: ignores <div bg-red-900 rounded> wrapping minimal-style <button>';
  const fixture = await makeFixture('parent-chrome');
  try {
    await writeFile(fixture.registryPath, TAILWIND_BUTTON_CHROME_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'ParentDivChrome.tsx',
      [
        'export function ParentDivChrome({ saveError, setSaveError }: { saveError: string | null; setSaveError: (e: string | null) => void }) {',
        '  if (!saveError) return null;',
        '  return (',
        '    <div className="mb-2 px-2 py-1.5 bg-red-900/50 border border-red-700 rounded text-sm text-red-300">',
        '      {saveError}',
        '      <button',
        '        type="button"',
        '        className="ml-2 text-red-400 hover:text-red-200 underline"',
        '        onClick={() => setSaveError(null)}',
        '      >',
        '        dismiss',
        '      </button>',
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
    return pass(
      name,
      'parent <div bg-red-900 rounded> wrapping <button text-red-400> (no chrome on the button itself) does NOT match',
    );
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioIgnoresLayoutUtilitiesOnAcBtn(): Promise<ScenarioResult> {
  // A `<button>` with layout utilities (flex, gap-2) AND the canonical
  // `.ac-btn` class must NOT match — layout utilities are legitimate
  // composition with the canonical primitive (matches the `flex
  // items-center gap-2 ac-btn` shape seen in the spec).
  const name = 'tailwind-button-chrome-inline: ignores <button> with layout utilities + ac-btn';
  const fixture = await makeFixture('layout-utils');
  try {
    await writeFile(fixture.registryPath, TAILWIND_BUTTON_CHROME_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'LayoutUtilsButton.tsx',
      [
        'export function LayoutUtilsButton() {',
        '  return (',
        '    <button className="flex items-center gap-2 ac-btn">Click</button>',
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
    return pass(name, '<button flex items-center gap-2 ac-btn> does NOT match (no bg-color)');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioIgnoresNonButtonElements(): Promise<ScenarioResult> {
  // TF-015 sibling-class negative — `<div>` and `<span>` with chrome
  // shape MUST NOT match because the regex is anchored on `<button`.
  // This guards against an over-eager rewrite that drops the
  // element-tag anchor.
  const name = 'tailwind-button-chrome-inline: ignores <div> / <span> with chrome shape';
  const fixture = await makeFixture('non-button');
  try {
    await writeFile(fixture.registryPath, TAILWIND_BUTTON_CHROME_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'NonButtonElements.tsx',
      [
        'export function NonButtonElements() {',
        '  return (',
        '    <>',
        '      <div className="bg-gray-700 px-3 py-1 rounded">div label</div>',
        '      <span className="bg-blue-600 px-2 rounded">span chip</span>',
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
    return pass(name, '<div bg-gray-700 px-3 rounded> and <span bg-blue-600 px-2 rounded> do NOT match (regex anchored to <button)');
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
async function scenarioGuttedStubForButtonChrome(): Promise<ScenarioResult> {
  const name = 'tailwind-button-chrome-inline: gutted-stub self-check';
  const fixture = await makeFixture('gutted-stub');
  try {
    await writeFile(fixture.registryPath, TAILWIND_BUTTON_CHROME_REGISTRY_YAML, 'utf8');
    await writeSource(
      fixture,
      'LegacyShape.tsx',
      'export const X = <button className="bg-blue-600 px-3 rounded">save</button>;\n',
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

export const TAILWIND_BUTTON_CHROME_SCENARIOS = [
  scenarioFlagsBasicButtonChrome,
  scenarioFlagsPrimaryActionShape,
  scenarioFlagsRoundedFirstOrdering,
  scenarioIgnoresCanonicalAcBtn,
  scenarioIgnoresParentDivWithChromeButButtonWithoutChrome,
  scenarioIgnoresLayoutUtilitiesOnAcBtn,
  scenarioIgnoresNonButtonElements,
  scenarioGuttedStubForButtonChrome,
] as const;
