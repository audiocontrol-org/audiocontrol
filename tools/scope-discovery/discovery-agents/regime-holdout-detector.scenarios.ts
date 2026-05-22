/**
 * tools/scope-discovery/discovery-agents/regime-holdout-detector.scenarios.ts
 *
 * Adversarial validator scenarios for the T6.5 regime-holdout-detector
 * discovery agent. Fixture builders + canned payloads live in
 * `regime-holdout-detector.fixtures.ts` (so this file stays under the
 * 300-500 line cap).
 *
 * Each scenario:
 *   - builds a per-scenario temp-dir fixture via `makeFixture`,
 *   - plants synthetic registries + source files,
 *   - invokes the agent via `invokeAgent`,
 *   - narrows the parsed payload via the type-predicate
 *     `isRegimeHoldoutFindings` (no `as` casts),
 *   - asserts on exit code, meta counts, and finding fields,
 *   - cleans up in a `finally`.
 *
 * Scenarios cover:
 *   1. empty registries + clean source tree → findings: [], total: 0.
 *   2. anti-pattern catch — registry has one entry; source matches.
 *   3. adopter-manifest holdout catch.
 *   4. editor-symmetry partial/missing cell.
 *   5. deprecation importer-line catch.
 *   6. mixed sources — all four contribute; meta counts reconcile.
 *   7. evidence back-pointers valid — non-empty + match registry id.
 *   8. JSON output passes the type-predicate (`isRegimeHoldoutFindings`).
 *   9. gutted-stub self-check — stub returns 0 findings; the anti-
 *      pattern assertion REJECTS it, proving the harness has signal.
 *
 * The validator entry-point (`regime-holdout-detector.validate.ts`)
 * imports SCENARIOS and runs each in sequence; this module is
 * side-effect-free.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  cleanup,
  invokeAgent,
  makeFixture,
  payloads,
  plantEmptyRegistries,
  writeAdopterManifests,
  writeAntiPatterns,
  writeSource,
} from './regime-holdout-detector.fixtures.js';
import { isRegimeHoldoutFindings } from './types.js';

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

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

async function scenarioEmptyEverything(): Promise<ScenarioResult> {
  const name = 'empty-registries-clean-tree';
  const fixture = await makeFixture('empty');
  try {
    await plantEmptyRegistries(fixture);
    const { run, payload } = await invokeAgent(fixture);
    if (run.code !== 0) {
      return fail(name, `expected exit 0; got ${run.code}; stderr=${run.stderr}`);
    }
    if (!isRegimeHoldoutFindings(payload)) {
      return fail(
        name,
        `payload missing regime-holdout shape; stdout=${run.stdout.slice(0, 200)}`,
      );
    }
    if (payload.findings.length !== 0) {
      return fail(name, `expected 0 findings; got ${payload.findings.length}`);
    }
    if (payload.meta.total !== 0) {
      return fail(name, `expected meta.total=0; got ${payload.meta.total}`);
    }
    return pass(name, 'empty registries + clean tree → findings: [], meta.total: 0');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioAntiPatternCatch(): Promise<ScenarioResult> {
  const name = 'anti-pattern-catch';
  const fixture = await makeFixture('anti-pat');
  try {
    await writeAntiPatterns(fixture, payloads.ANTI_PATTERN_REGISTRY_ONE);
    await writeAdopterManifests(fixture, 'adopter_manifests: []\n');
    await writeSource(
      fixture,
      'modules/foo-editor/src/Drawer.tsx',
      payloads.ANTI_PATTERN_SOURCE_MATCH,
    );
    const { run, payload } = await invokeAgent(fixture);
    if (run.code !== 0) {
      return fail(name, `expected exit 0; got ${run.code}; stderr=${run.stderr}`);
    }
    if (!isRegimeHoldoutFindings(payload)) {
      return fail(name, 'payload not a regime-holdout shape');
    }
    if (payload.meta.anti_pattern_count !== 1) {
      return fail(
        name,
        `expected anti_pattern_count=1; got ${payload.meta.anti_pattern_count}`,
      );
    }
    const f = payload.findings.find((x) => x.source === 'anti-pattern');
    if (f === undefined) return fail(name, 'expected one anti-pattern finding');
    if (f.id !== 'legacy-slide-drawer') {
      return fail(name, `expected id legacy-slide-drawer; got ${f.id}`);
    }
    if (!f.file.endsWith('modules/foo-editor/src/Drawer.tsx')) {
      return fail(name, `expected match file path; got ${f.file}`);
    }
    return pass(name, 'anti-pattern match surfaces with correct source, id, file');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioAdopterHoldoutCatch(): Promise<ScenarioResult> {
  const name = 'adopter-manifest-holdout-catch';
  const fixture = await makeFixture('adopter');
  try {
    await writeAntiPatterns(fixture, 'anti_patterns: []\n');
    await writeAdopterManifests(fixture, payloads.ADOPTER_MANIFEST_REGISTRY_ONE);
    // Two editor files matching the glob — one adopts, one holds out.
    await writeSource(
      fixture,
      'modules/foo-editor/src/PatchEditor.tsx',
      payloads.ADOPTER_HOLDOUT_SOURCE,
    );
    await writeSource(
      fixture,
      'modules/foo-editor/src/ToneEditor.tsx',
      payloads.ADOPTER_ADOPTING_SOURCE,
    );
    const { run, payload } = await invokeAgent(fixture);
    if (run.code !== 0) {
      return fail(name, `expected exit 0; got ${run.code}; stderr=${run.stderr}`);
    }
    if (!isRegimeHoldoutFindings(payload)) return fail(name, 'payload not shaped right');
    if (payload.meta.adopter_manifest_count !== 1) {
      return fail(
        name,
        `expected adopter_manifest_count=1; got ${payload.meta.adopter_manifest_count}`,
      );
    }
    const f = payload.findings.find((x) => x.source === 'adopter-manifest');
    if (f === undefined) return fail(name, 'expected an adopter-manifest finding');
    if (f.id !== 'slide-drawer-adoption') {
      return fail(name, `expected id slide-drawer-adoption; got ${f.id}`);
    }
    if (!f.file.endsWith('PatchEditor.tsx')) {
      return fail(name, `expected holdout file PatchEditor.tsx; got ${f.file}`);
    }
    return pass(name, 'adopter-manifest holdout surfaces with correct file');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioEditorSymmetryCatch(): Promise<ScenarioResult> {
  const name = 'editor-symmetry-partial-cell';
  const fixture = await makeFixture('symmetry');
  try {
    await writeAntiPatterns(fixture, 'anti_patterns: []\n');
    await writeAdopterManifests(fixture, payloads.SYMMETRY_REGISTRY_TWO_EDITORS);
    // foo-editor adopts; bar-editor has a Page that doesn't import.
    await writeSource(
      fixture,
      'modules/foo-editor/src/HomePage.tsx',
      payloads.LIST_BANK_IMPORT,
    );
    await writeSource(
      fixture,
      'modules/bar-editor/src/HomePage.tsx',
      payloads.LIST_BANK_HOLDOUT,
    );
    const { run, payload } = await invokeAgent(fixture);
    if (run.code !== 0) {
      return fail(name, `expected exit 0; got ${run.code}; stderr=${run.stderr}`);
    }
    if (!isRegimeHoldoutFindings(payload)) return fail(name, 'payload not shaped right');
    if (payload.meta.editor_symmetry_holdout_count < 1) {
      return fail(
        name,
        `expected at least 1 editor-symmetry finding; got ${payload.meta.editor_symmetry_holdout_count}`,
      );
    }
    const f = payload.findings.find(
      (x) => x.source === 'editor-symmetry' && x.id.includes('bar-editor'),
    );
    if (f === undefined) {
      return fail(name, 'expected an editor-symmetry finding naming bar-editor');
    }
    return pass(name, 'editor-symmetry partial/missing cell surfaces with composite id');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioDeprecationCatch(): Promise<ScenarioResult> {
  const name = 'deprecation-importer-catch';
  const fixture = await makeFixture('deprecation');
  try {
    await plantEmptyRegistries(fixture);
    await writeSource(
      fixture,
      'modules/foo-editor/src/components/OldEnvelope.ts',
      payloads.DEPRECATED_FILE_CONTENT,
    );
    await writeSource(
      fixture,
      'modules/foo-editor/src/Page.tsx',
      payloads.DEPRECATED_IMPORTER_CONTENT,
    );
    const { run, payload } = await invokeAgent(fixture);
    if (run.code !== 0) {
      return fail(name, `expected exit 0; got ${run.code}; stderr=${run.stderr}`);
    }
    if (!isRegimeHoldoutFindings(payload)) return fail(name, 'payload not shaped right');
    if (payload.meta.deprecation_count !== 1) {
      return fail(name, `expected deprecation_count=1; got ${payload.meta.deprecation_count}`);
    }
    const f = payload.findings.find((x) => x.source === 'deprecation');
    if (f === undefined) return fail(name, 'expected a deprecation finding');
    if (!f.id.includes('OldEnvelope')) {
      return fail(name, `expected id to name deprecated file; got ${f.id}`);
    }
    if (f.line !== 1) {
      return fail(name, `expected importer line 1; got ${String(f.line)}`);
    }
    return pass(name, 'deprecation importer surfaces with file + 1-based line');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioMixedSources(): Promise<ScenarioResult> {
  const name = 'mixed-sources-meta-counts';
  const fixture = await makeFixture('mixed');
  try {
    await writeAntiPatterns(fixture, payloads.ANTI_PATTERN_REGISTRY_ONE);
    await writeAdopterManifests(fixture, payloads.ADOPTER_MANIFEST_REGISTRY_ONE);
    // anti-pattern: drawer source matches the regex.
    await writeSource(
      fixture,
      'modules/foo-editor/src/Drawer.tsx',
      payloads.ANTI_PATTERN_SOURCE_MATCH,
    );
    // adopter-manifest: editor file fails the import expectation.
    await writeSource(
      fixture,
      'modules/foo-editor/src/PatchEditor.tsx',
      payloads.ADOPTER_HOLDOUT_SOURCE,
    );
    // deprecation: importer of a `@deprecated` file.
    await writeSource(
      fixture,
      'modules/foo-editor/src/components/OldEnvelope.ts',
      payloads.DEPRECATED_FILE_CONTENT,
    );
    await writeSource(
      fixture,
      'modules/foo-editor/src/Page.tsx',
      payloads.DEPRECATED_IMPORTER_CONTENT,
    );
    const { run, payload } = await invokeAgent(fixture);
    if (run.code !== 0) {
      return fail(name, `expected exit 0; got ${run.code}; stderr=${run.stderr}`);
    }
    if (!isRegimeHoldoutFindings(payload)) return fail(name, 'payload not shaped right');
    if (payload.meta.anti_pattern_count !== 1) {
      return fail(name, `anti_pattern_count expected 1; got ${payload.meta.anti_pattern_count}`);
    }
    if (payload.meta.adopter_manifest_count !== 1) {
      return fail(
        name,
        `adopter_manifest_count expected 1; got ${payload.meta.adopter_manifest_count}`,
      );
    }
    if (payload.meta.deprecation_count !== 1) {
      return fail(name, `deprecation_count expected 1; got ${payload.meta.deprecation_count}`);
    }
    const expectedTotal =
      payload.meta.anti_pattern_count +
      payload.meta.adopter_manifest_count +
      payload.meta.editor_symmetry_holdout_count +
      payload.meta.deprecation_count;
    if (payload.meta.total !== expectedTotal) {
      return fail(
        name,
        `meta.total ${payload.meta.total} != sum of per-source counts ${expectedTotal}`,
      );
    }
    if (payload.findings.length !== expectedTotal) {
      return fail(
        name,
        `findings.length ${payload.findings.length} != meta.total ${expectedTotal}`,
      );
    }
    return pass(name, 'mixed sources contribute; meta totals reconcile against findings array');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioEvidenceBackPointers(): Promise<ScenarioResult> {
  const name = 'evidence-backpointers-valid';
  const fixture = await makeFixture('evidence');
  try {
    await writeAntiPatterns(fixture, payloads.ANTI_PATTERN_REGISTRY_ONE);
    await writeAdopterManifests(fixture, 'adopter_manifests: []\n');
    await writeSource(
      fixture,
      'modules/foo-editor/src/Drawer.tsx',
      payloads.ANTI_PATTERN_SOURCE_MATCH,
    );
    const { run, payload } = await invokeAgent(fixture);
    if (run.code !== 0) {
      return fail(name, `expected exit 0; got ${run.code}; stderr=${run.stderr}`);
    }
    if (!isRegimeHoldoutFindings(payload)) return fail(name, 'payload not shaped right');
    for (const f of payload.findings) {
      if (typeof f.evidence.registryPath !== 'string' || f.evidence.registryPath.length === 0) {
        return fail(name, `finding ${f.id} missing evidence.registryPath`);
      }
      if (typeof f.evidence.registryId !== 'string' || f.evidence.registryId.length === 0) {
        return fail(name, `finding ${f.id} missing evidence.registryId`);
      }
    }
    const antiPatternFinding = payload.findings.find((x) => x.source === 'anti-pattern');
    if (antiPatternFinding === undefined) return fail(name, 'no anti-pattern finding to verify');
    if (
      antiPatternFinding.evidence.registryPath !== 'docs/scope-discovery/anti-patterns.yaml'
    ) {
      return fail(
        name,
        `evidence path mismatch; got ${antiPatternFinding.evidence.registryPath}`,
      );
    }
    if (antiPatternFinding.evidence.registryId !== 'legacy-slide-drawer') {
      return fail(
        name,
        `evidence id mismatch; got ${antiPatternFinding.evidence.registryId}`,
      );
    }
    return pass(name, 'every finding carries non-empty evidence back-pointer to its registry');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioJsonStructure(): Promise<ScenarioResult> {
  const name = 'json-output-shape-valid';
  const fixture = await makeFixture('json-shape');
  try {
    await plantEmptyRegistries(fixture);
    const { run, payload } = await invokeAgent(fixture);
    if (run.code !== 0) {
      return fail(name, `expected exit 0; got ${run.code}; stderr=${run.stderr}`);
    }
    if (!isRegimeHoldoutFindings(payload)) {
      return fail(name, 'isRegimeHoldoutFindings rejected payload — agent emitted wrong shape');
    }
    if (payload.agent !== 'regime-holdout-detector') {
      return fail(name, `agent name wrong; got ${payload.agent}`);
    }
    if (payload.featureSlug !== 'test-feature') {
      return fail(name, `featureSlug not propagated; got ${payload.featureSlug}`);
    }
    return pass(name, 'JSON output passes the type predicate; agent name + featureSlug propagate');
  } finally {
    await cleanup(fixture);
  }
}

/**
 * Gutted-stub self-check. Plants a stub that always emits a 0-findings
 * payload. Re-runs the anti-pattern-catch source layout against the
 * stub; the anti-pattern assertion (anti_pattern_count === 1) MUST
 * reject the stub's empty response — that's the signal the assertion
 * carries.
 */
async function scenarioGuttedStub(): Promise<ScenarioResult> {
  const name = 'gutted-stub-self-check';
  const fixture = await makeFixture('gutted');
  const stubDir = await mkdtemp(join(tmpdir(), 'regime-stub-'));
  const stubPath = join(stubDir, 'stub.ts');
  try {
    const stubPayload = {
      agent: 'regime-holdout-detector',
      featureSlug: 'test-feature',
      findings: [],
      meta: {
        anti_pattern_count: 0,
        adopter_manifest_count: 0,
        editor_symmetry_holdout_count: 0,
        deprecation_count: 0,
        total: 0,
      },
    };
    await writeFile(
      stubPath,
      `process.stdout.write(${JSON.stringify(JSON.stringify(stubPayload))} + '\\n');\nprocess.exit(0);\n`,
      'utf8',
    );
    await writeAntiPatterns(fixture, payloads.ANTI_PATTERN_REGISTRY_ONE);
    await writeAdopterManifests(fixture, 'adopter_manifests: []\n');
    await writeSource(
      fixture,
      'modules/foo-editor/src/Drawer.tsx',
      payloads.ANTI_PATTERN_SOURCE_MATCH,
    );
    const { run, payload } = await invokeAgent(fixture, stubPath);
    if (!isRegimeHoldoutFindings(payload)) {
      return fail(
        name,
        'stub payload should still pass the type-predicate; harness contract broken',
      );
    }
    // The stub emits 0 anti-pattern findings; the real-agent assertion
    // (scenarioAntiPatternCatch) requires 1. We assert here that the
    // stub fails that real-agent expectation, confirming the assertion
    // carries signal.
    if (run.code === 0 && payload.meta.anti_pattern_count === 0) {
      return pass(
        name,
        'gutted stub returns 0 anti-pattern findings; the real assertion would reject it',
      );
    }
    return fail(
      name,
      `stub diverged unexpectedly; code=${run.code}; payload=${run.stdout.slice(0, 200)}`,
    );
  } finally {
    await cleanup(fixture);
    await rm(stubDir, { recursive: true, force: true });
  }
}

/** All scenarios in execution order. */
export const SCENARIOS: ReadonlyArray<() => Promise<ScenarioResult>> = [
  scenarioEmptyEverything,
  scenarioAntiPatternCatch,
  scenarioAdopterHoldoutCatch,
  scenarioEditorSymmetryCatch,
  scenarioDeprecationCatch,
  scenarioMixedSources,
  scenarioEvidenceBackPointers,
  scenarioJsonStructure,
  scenarioGuttedStub,
];
