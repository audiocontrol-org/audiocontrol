/**
 * tools/scope-discovery/adopter-manifests.fixtures.ts
 *
 * Shared fixture builders + subprocess runner for the T6.2
 * adopter-manifests adversarial validator. Extracted from
 * `adopter-manifests.scenarios.ts` so both the original-scenarios
 * module and the AUDIT-20260522-06 tracked-holdouts scenarios sibling
 * can DRY-share the helpers without duplicating mkdtemp/writeFile
 * boilerplate.
 *
 * Pattern mirrors `editor-symmetry.fixtures.ts`:
 *   - `makeFixture(slug)` — per-scenario temp dir
 *   - `writeRegistry` / `writeSource` — plant files
 *   - `cleanup` — remove temp dir in finally
 *   - `runScanner` — subprocess invocation (defaults to
 *     `check-adopters.ts`; the gutted-stub scenarios override)
 *   - `args` — registry/root flag pair
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runScannerSubprocess, type ScannerRun } from './util/run-scanner.js';

const SCANNER_ENTRY = 'tools/scope-discovery/check-adopters.ts';

export type { ScannerRun };

export interface ScenarioResult {
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
}

export function pass(name: string, detail: string): ScenarioResult {
  return { name, passed: true, detail };
}

export function fail(name: string, detail: string): ScenarioResult {
  return { name, passed: false, detail };
}

export interface Fixture {
  readonly registryPath: string;
  readonly scanRoot: string;
  readonly dir: string;
}

export async function makeFixture(slug: string): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), `adopter-manifests-validator-${slug}-`));
  const scanRoot = join(root, 'src');
  await mkdir(scanRoot, { recursive: true });
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

export function args(fixture: Fixture, extra: readonly string[] = []): string[] {
  return ['--registry', fixture.registryPath, '--root', fixture.scanRoot, ...extra];
}

export function runScanner(
  argv: readonly string[],
  entry = SCANNER_ENTRY,
): Promise<ScannerRun> {
  return runScannerSubprocess(entry, argv);
}

/** Common source payloads reused across multiple scenario modules. */
export const SOURCE_PAYLOADS = {
  IMPORTING:
    "import { SlideDrawer } from '@/components/SlideDrawer';\n" +
    'export function PatchEditor() { return <SlideDrawer />; }\n',
  HOLDOUT:
    "import { useState } from 'react';\n" +
    'export function PatchEditor() {\n' +
    '  const [open, setOpen] = useState(false);\n' +
    '  return open ? <div className="inline-drawer" /> : null;\n' +
    '}\n',
} as const;
