/**
 * tools/scope-discovery/discovery-agents/regime-holdout-detector.fixtures.ts
 *
 * Fixture builders + canned YAML/source payloads for the T6.5 regime-
 * holdout-detector adversarial validator. Split out of
 * `regime-holdout-detector.scenarios.ts` so each file stays under the
 * 300-500 line cap (mirrors the T6.3 editor-symmetry split).
 *
 * The validator's scenarios consume:
 *   - `makeFixture` to set up a per-scenario temp directory with a
 *     stripped-down `repo/` layout (modules/ + docs/scope-discovery/ +
 *     prd.md).
 *   - `writeAntiPatterns` / `writeAdopterManifests` / `writeSource` to
 *     plant registry + source files into the fixture's repo root.
 *   - `invokeAgent` to subprocess the regime-holdout-detector against
 *     the planted fixture and return the parsed JSON payload.
 *   - the canned YAML and source payloads from this module's `payloads`
 *     export.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runScannerSubprocess, type ScannerRun } from '../util/run-scanner.js';

const AGENT_ENTRY =
  'tools/scope-discovery/discovery-agents/regime-holdout-detector.ts';

export type { ScannerRun };

export interface Fixture {
  readonly dir: string;
  readonly repoRoot: string;
  readonly prdPath: string;
}

/**
 * Build a fresh per-scenario temp fixture. Creates `repo/modules/`,
 * `repo/docs/scope-discovery/`, and a trivial `prd.md`. The agent's
 * CLI requires `--prd-path` to exist but does NOT read the PRD itself
 * — content is intentionally minimal so no module name accidentally
 * pattern-matches.
 */
export async function makeFixture(slug: string): Promise<Fixture> {
  const dir = await mkdtemp(join(tmpdir(), `regime-holdout-${slug}-`));
  const repoRoot = join(dir, 'repo');
  await mkdir(join(repoRoot, 'modules'), { recursive: true });
  await mkdir(join(repoRoot, 'docs', 'scope-discovery'), { recursive: true });
  const prdPath = join(repoRoot, 'prd.md');
  await writeFile(prdPath, '# Test PRD\n\nNothing significant.\n', 'utf8');
  return { dir, repoRoot, prdPath };
}

export async function cleanup(fixture: Fixture): Promise<void> {
  await rm(fixture.dir, { recursive: true, force: true });
}

export async function writeSource(
  fixture: Fixture,
  relPath: string,
  content: string,
): Promise<void> {
  const full = join(fixture.repoRoot, relPath);
  const lastSlash = full.lastIndexOf('/');
  if (lastSlash > fixture.repoRoot.length) {
    await mkdir(full.substring(0, lastSlash), { recursive: true });
  }
  await writeFile(full, content, 'utf8');
}

export async function writeAntiPatterns(
  fixture: Fixture,
  yamlText: string,
): Promise<void> {
  await writeFile(
    join(fixture.repoRoot, 'docs', 'scope-discovery', 'anti-patterns.yaml'),
    yamlText,
    'utf8',
  );
}

export async function writeAdopterManifests(
  fixture: Fixture,
  yamlText: string,
): Promise<void> {
  await writeFile(
    join(fixture.repoRoot, 'docs', 'scope-discovery', 'adopter-manifests.yaml'),
    yamlText,
    'utf8',
  );
}

/**
 * Plant the two empty registry stubs the agent's scanners require by
 * default. Scenarios that need a populated registry overwrite via
 * `writeAntiPatterns` / `writeAdopterManifests` after calling this.
 */
export async function plantEmptyRegistries(fixture: Fixture): Promise<void> {
  await writeAntiPatterns(fixture, 'anti_patterns: []\n');
  await writeAdopterManifests(fixture, 'adopter_manifests: []\n');
}

export function agentArgs(fixture: Fixture): string[] {
  return [
    '--feature',
    'test-feature',
    '--prd-path',
    fixture.prdPath,
    '--repo-root',
    fixture.repoRoot,
  ];
}

export interface ParsedAgentRun {
  readonly run: ScannerRun;
  readonly payload: unknown;
}

/**
 * Subprocess the regime-holdout-detector against `fixture`, parse its
 * stdout as JSON, and return the parsed payload (or null on parse
 * error). The scenarios then narrow the payload via the type-predicate
 * `isRegimeHoldoutFindings` for typed assertions without `as` casts.
 *
 * `entry` defaults to the real agent path; the gutted-stub self-check
 * passes its stub path instead.
 */
export async function invokeAgent(
  fixture: Fixture,
  entry: string = AGENT_ENTRY,
): Promise<ParsedAgentRun> {
  const run = await runScannerSubprocess(entry, agentArgs(fixture));
  let payload: unknown = null;
  if (run.stdout.length > 0) {
    try {
      payload = JSON.parse(run.stdout);
    } catch {
      payload = null;
    }
  }
  return { run, payload };
}

// ---------------------------------------------------------------------------
// Canned payloads
// ---------------------------------------------------------------------------

export const payloads = {
  ANTI_PATTERN_REGISTRY_ONE: `anti_patterns:
  - id: legacy-slide-drawer
    added_in: deadbeef
    primitive: SlideDrawer
    from: '@/components/SlideDrawer'
    shape_regex: 'className="inline-drawer"'
    message: |
      Replace inline drawer with @/components/SlideDrawer.
`,

  ANTI_PATTERN_SOURCE_MATCH:
    'export function PatchEditor() {\n' +
    '  return <div className="inline-drawer" />;\n' +
    '}\n',

  ANTI_PATTERN_SOURCE_OK:
    "import { SlideDrawer } from '@/components/SlideDrawer';\n" +
    'export function PatchEditor() { return <SlideDrawer />; }\n',

  ADOPTER_MANIFEST_REGISTRY_ONE: `adopter_manifests:
  - id: slide-drawer-adoption
    introduced_in: deadbeef
    from: '@/components/SlideDrawer'
    expected_adopters_glob:
      - 'modules/foo-editor/src/**/*Editor*.tsx'
    message: |
      Use @/components/SlideDrawer in every editor surface.
`,

  ADOPTER_HOLDOUT_SOURCE:
    "import { useState } from 'react';\n" +
    'export function PatchEditor() {\n' +
    '  const [open] = useState(false);\n' +
    '  return open ? <div /> : null;\n' +
    '}\n',

  ADOPTER_ADOPTING_SOURCE:
    "import { SlideDrawer } from '@/components/SlideDrawer';\n" +
    'export function PatchEditor() { return <SlideDrawer />; }\n',

  SYMMETRY_REGISTRY_TWO_EDITORS: `adopter_manifests:
  - id: list-bank-shared
    introduced_in: cafef00d
    from: '@/components/ListBank'
    expected_adopters_glob:
      - 'modules/foo-editor/src/**/*Page.tsx'
      - 'modules/bar-editor/src/**/*Page.tsx'
    message: |
      Use @/components/ListBank for shared virtualization.
`,

  LIST_BANK_IMPORT:
    "import { ListBank } from '@/components/ListBank';\nexport const x = ListBank;\n",

  LIST_BANK_HOLDOUT: 'export const x = 1;\n',

  DEPRECATED_FILE_CONTENT:
    '/**\n' +
    ' * @deprecated Use the new module — this is the audit candidate.\n' +
    ' */\n' +
    '\n' +
    'export function OldEnvelope() { return null; }\n',

  DEPRECATED_IMPORTER_CONTENT:
    "import { OldEnvelope } from '@/components/OldEnvelope';\n" +
    'export const x = OldEnvelope;\n',
} as const;
