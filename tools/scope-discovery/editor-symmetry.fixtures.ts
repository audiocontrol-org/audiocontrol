/**
 * tools/scope-discovery/editor-symmetry.fixtures.ts
 *
 * Fixture builders + canned YAML/source payloads for the T6.3
 * cross-editor symmetry validator. Split out of
 * `editor-symmetry.scenarios.ts` so each file stays under the
 * 300-500 line cap.
 *
 * The validator's scenarios consume:
 *   - `makeFixture` to set up a per-scenario temp directory with
 *     synthetic editor module roots.
 *   - `writeRegistry` / `writeSource` to plant registry + source files.
 *   - `runScanner` to invoke the scanner-under-test as a subprocess.
 *   - the canned YAML and source payloads from this module's `payloads`
 *     export.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runScannerSubprocess, type ScannerRun } from './util/run-scanner.js';

const SCANNER_ENTRY = 'tools/scope-discovery/check-editor-symmetry.ts';

export type { ScannerRun };

export interface Fixture {
  readonly registryPath: string;
  readonly scanRoot: string;
  readonly dir: string;
}

export async function makeFixture(
  slug: string,
  editors: readonly string[],
): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), `editor-symmetry-${slug}-`));
  const scanRoot = join(root, 'repo');
  await mkdir(join(scanRoot, 'modules'), { recursive: true });
  for (const editor of editors) {
    await mkdir(join(scanRoot, 'modules', editor, 'src'), { recursive: true });
  }
  return { registryPath: join(root, 'registry.yaml'), scanRoot, dir: root };
}

export async function writeRegistry(fixture: Fixture, yamlText: string): Promise<void> {
  await writeFile(fixture.registryPath, yamlText, 'utf8');
}

export async function writeSource(
  fixture: Fixture,
  relPath: string,
  content: string,
): Promise<void> {
  const full = join(fixture.scanRoot, relPath);
  const lastSlash = full.lastIndexOf('/');
  if (lastSlash > fixture.scanRoot.length) {
    await mkdir(full.substring(0, lastSlash), { recursive: true });
  }
  await writeFile(full, content, 'utf8');
}

export async function cleanup(fixture: Fixture): Promise<void> {
  await rm(fixture.dir, { recursive: true, force: true });
}

export function scannerArgs(
  fixture: Fixture,
  extra: readonly string[] = [],
): string[] {
  return ['--registry', fixture.registryPath, '--root', fixture.scanRoot, ...extra];
}

export function runScanner(
  args: readonly string[],
  entry = SCANNER_ENTRY,
): Promise<ScannerRun> {
  return runScannerSubprocess(entry, args);
}

// ---------------------------------------------------------------------------
// Canned payloads
// ---------------------------------------------------------------------------

export const payloads = {
  EMPTY_REGISTRY_YAML: `adopter_manifests: []\n`,

  SINGLE_EDITOR_REGISTRY: `adopter_manifests:
  - id: slide-drawer-promotion
    introduced_in: deadbeef
    from: '@/components/SlideDrawer'
    expected_adopters_glob:
      - 'modules/roland-sxx0-editor/src/**/*Editor*.tsx'
    message: |
      Replace the inline drawer with @/components/SlideDrawer.
`,

  MULTI_EDITOR_REGISTRY: `adopter_manifests:
  - id: shared-list-bank
    introduced_in: cafef00d
    from: '@/components/ListBank'
    expected_adopters_glob:
      - 'modules/roland-sxx0-editor/src/**/*Page.tsx'
      - 'modules/akai-s3k-editor/src/**/*Page.tsx'
    message: |
      Use @/components/ListBank for consistent virtualization.
`,

  WITH_EXCEPTION_REGISTRY: `adopter_manifests:
  - id: slide-drawer-promotion
    introduced_in: deadbeef
    from: '@/components/SlideDrawer'
    expected_adopters_glob:
      - 'modules/roland-sxx0-editor/src/**/*Editor*.tsx'
    exceptions:
      - path: modules/roland-sxx0-editor/src/SpecialEditor.tsx
        reason: |
          Needs frame-rate scroll-lock that SlideDrawer does not expose.
    message: |
      Replace inline drawer with @/components/SlideDrawer.
`,

  IMPORTING_SOURCE:
    "import { SlideDrawer } from '@/components/SlideDrawer';\n" +
    'export function PatchEditor() { return <SlideDrawer />; }\n',

  HOLDOUT_SOURCE:
    "import { useState } from 'react';\n" +
    'export function PatchEditor() {\n' +
    '  const [open] = useState(false);\n' +
    '  return open ? <div className="inline-drawer" /> : null;\n' +
    '}\n',

  LIST_BANK_IMPORT_SOURCE:
    "import { ListBank } from '@/components/ListBank';\nexport const x = ListBank;\n",

  // AUDIT-06 — tracked_holdouts: payloads for the editor-symmetry suite.

  TRACKED_HOLDOUT_REGISTRY: `adopter_manifests:
  - id: slide-drawer-promotion
    introduced_in: deadbeef
    from: '@/components/SlideDrawer'
    expected_adopters_glob:
      - 'modules/akai-s3k-editor/src/**/*Editor*.tsx'
    tracked_holdouts:
      - path: modules/akai-s3k-editor/src/DeferredEditor.tsx
        issue: 'https://github.com/audiocontrol-org/audiocontrol/issues/450'
        reason: |
          pending follow-up — v3 SlideDrawer migration deferred.
    message: |
      Replace inline drawer with @/components/SlideDrawer.
`,

  TRACKED_HOLDOUT_MIXED_REGISTRY: `adopter_manifests:
  - id: slide-drawer-promotion
    introduced_in: deadbeef
    from: '@/components/SlideDrawer'
    expected_adopters_glob:
      - 'modules/akai-s3k-editor/src/**/*Editor*.tsx'
    tracked_holdouts:
      - path: modules/akai-s3k-editor/src/DeferredEditor.tsx
        issue: 'https://github.com/audiocontrol-org/audiocontrol/issues/450'
        reason: |
          pending follow-up — v3 SlideDrawer migration deferred.
    message: |
      Replace inline drawer with @/components/SlideDrawer.
`,
} as const;
