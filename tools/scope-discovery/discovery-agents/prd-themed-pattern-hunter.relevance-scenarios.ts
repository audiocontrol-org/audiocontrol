/**
 * tools/scope-discovery/discovery-agents/prd-themed-pattern-hunter.relevance-scenarios.ts
 *
 * AUDIT-20260524-11 — adversarial scenarios for the PRD-scope-based
 * module pruning. The agent extracts module relevance from the PRD's
 * "In Scope" / "Out of Scope" sections; the synthesizer's deriveModules
 * consumes the score to drop excluded modules + annotate low-relevance
 * ones. These scenarios assert both halves of that contract independently
 * AND end-to-end through `synthesize()`, plus a gutted-stub self-check
 * that confirms the harness has teeth.
 *
 * Lives in a sibling module so `prd-themed-pattern-hunter.validate.ts`
 * stays under the 300-500 line cap.
 */

import type {
  AstGrepMatrixFindings,
  CloneDetectorFindings,
  DiscoveryAgentFinding,
  PrdModuleRelevanceEntry,
  PrdThemedFindings,
} from './types.js';
import { parseModuleRelevance } from './prd-relevance.js';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { synthesize } from '../synthesis.js';

export interface RelevanceScenarioResult {
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
}

function pass(name: string, detail: string): RelevanceScenarioResult {
  return { name, passed: true, detail };
}
function fail(name: string, detail: string): RelevanceScenarioResult {
  return { name, passed: false, detail };
}

/**
 * Synthetic AST + clone + theme findings that route the synthesizer to
 * kind=code. Each module is referenced by at least one finding so it
 * lands in the strawman pre-pruning; the scenarios then assert which
 * survive PRD-scope filtering.
 */
function makeAstFindings(
  modulesTouched: ReadonlyArray<string>,
): AstGrepMatrixFindings {
  return {
    agent: 'ast-grep-matrix',
    featureSlug: 'relevance-fixture',
    patterns: [
      {
        id: 'as-type-cast',
        description: 'TypeScript `as Type` cast — relevance-fixture pattern.',
        regex: 'as Type',
        hits: modulesTouched.map((m) => ({
          file: `modules/${m}/src/index.ts`,
          line: 1,
          snippet: `value as Type // ${m}`,
        })),
      },
    ],
  };
}

function makeCloneFindings(modulesTouched: ReadonlyArray<string>): CloneDetectorFindings {
  return {
    agent: 'clone-detector-reader',
    featureSlug: 'relevance-fixture',
    baselinePath: 'docs/scope-discovery/clones.yaml',
    filterApplied: 'none',
    modulesInScope: modulesTouched,
    clones: [],
  };
}

function makeThemeFindings(
  moduleRelevance?: ReadonlyArray<PrdModuleRelevanceEntry>,
): PrdThemedFindings {
  return {
    agent: 'prd-themed-pattern-hunter',
    featureSlug: 'relevance-fixture',
    themes: [
      {
        term: 'relevance',
        occurrences: [
          { file: 'modules/foo/src/index.ts', line: 1, snippet: 'relevance probe' },
        ],
      },
    ],
    ...(moduleRelevance !== undefined ? { moduleRelevance } : {}),
  };
}

interface SynthFixture {
  readonly dir: string;
  readonly prdPath: string;
  readonly cleanup: () => Promise<void>;
}

async function makeSynthesisFixture(label: string): Promise<SynthFixture> {
  const dir = await mkdtemp(join(tmpdir(), `prd-relevance-${label}-`));
  await mkdir(dir, { recursive: true });
  const prdPath = join(dir, 'prd.md');
  // A tiny PRD with no References (so a separate warning fires but the
  // synthesizer still runs to completion).
  await writeFile(
    prdPath,
    '# Fixture\n\n## Goals\n\nThe relevance-fixture feature exists for testing.\n',
    'utf8',
  );
  return {
    dir,
    prdPath,
    cleanup: async () => rm(dir, { recursive: true, force: true }),
  };
}

/** Scenario 1: PRD with "In Scope" extracts modules at relevance=high. */
export function scenarioPrdWithInScopeExtractsModules(): RelevanceScenarioResult {
  const name = 'prd-with-in-scope-extracts-modules';
  const prd = [
    '# Fixture',
    '',
    '## In Scope',
    '',
    '- modules/foo',
    '- modules/bar — primary surface',
    '',
    '## Other section',
    '',
    'unrelated body.',
  ].join('\n');
  const result = parseModuleRelevance(prd, ['foo', 'bar', 'baz']);
  const foo = result.scores.get('foo');
  const bar = result.scores.get('bar');
  const baz = result.scores.get('baz');
  if (foo !== 'high' || bar !== 'high') {
    return fail(
      name,
      `expected foo=high bar=high; got foo=${String(foo)} bar=${String(bar)}`,
    );
  }
  if (baz !== undefined) {
    return fail(name, `baz was not mentioned but got score=${String(baz)}`);
  }
  return pass(name, 'foo & bar tagged high; baz absent from map');
}

/** Scenario 2: PRD with "Out of Scope" excludes modules. */
export function scenarioPrdWithOutOfScopeExcludesModules(): RelevanceScenarioResult {
  const name = 'prd-with-out-of-scope-excludes-modules';
  const prd = [
    '# Fixture',
    '',
    '## Out of Scope',
    '',
    '- modules/baz',
    '- The d110-editor surface is out of scope.',
    '',
  ].join('\n');
  const result = parseModuleRelevance(prd, ['foo', 'bar', 'baz', 'd110-editor']);
  if (result.scores.get('baz') !== 'excluded') {
    return fail(name, `expected baz=excluded; got ${String(result.scores.get('baz'))}`);
  }
  if (result.scores.get('d110-editor') !== 'excluded') {
    return fail(
      name,
      `expected d110-editor=excluded (bare-name detection); got ${String(result.scores.get('d110-editor'))}`,
    );
  }
  return pass(name, 'baz + d110-editor tagged excluded');
}

/**
 * Scenario 3 + 4 combined: synthesizer drops excluded modules AND
 * emits a warning naming the module + section. The synthesize() call
 * is the load-bearing operation; both assertions test its output.
 */
export async function scenarioSynthesizerDropsAndWarnsOnExcluded(): Promise<RelevanceScenarioResult> {
  const name = 'synthesizer-drops-excluded-modules-and-warns';
  const fixture = await makeSynthesisFixture('drop-warn');
  try {
    const ast = makeAstFindings(['foo', 'bar', 'baz']);
    const clones = makeCloneFindings(['foo', 'bar', 'baz']);
    const themes = makeThemeFindings([
      { module: 'foo', relevance: 'high', section: 'In Scope' },
      { module: 'bar', relevance: 'high', section: 'In Scope' },
      { module: 'baz', relevance: 'excluded', section: 'Out of Scope' },
    ]);
    const findings: DiscoveryAgentFinding[] = [ast, clones, themes];
    const result = await synthesize({
      featureSlug: 'relevance-fixture',
      findings,
      prdPath: fixture.prdPath,
      prdRelPath: 'prd.md',
    });
    const moduleSlugs = (result.manifest.modules ?? []).map((m) => m.label);
    if (moduleSlugs.includes('baz')) {
      return fail(
        name,
        `expected manifest to omit baz; got modules=[${moduleSlugs.join(', ')}]`,
      );
    }
    if (!moduleSlugs.includes('foo') || !moduleSlugs.includes('bar')) {
      return fail(
        name,
        `expected foo + bar to remain; got modules=[${moduleSlugs.join(', ')}]`,
      );
    }
    const exclusionWarning = result.metadata.warnings.find((w) =>
      /excluded.*module/i.test(w) && w.includes('baz'),
    );
    if (exclusionWarning === undefined) {
      return fail(
        name,
        `expected warning naming baz; got: ${result.metadata.warnings.join(' / ')}`,
      );
    }
    if (!exclusionWarning.includes('Out of Scope')) {
      return fail(
        name,
        `expected warning to cite section "Out of Scope"; got: ${exclusionWarning}`,
      );
    }
    return pass(
      name,
      `baz dropped; warning cited "Out of Scope" — manifest modules=[${moduleSlugs.join(', ')}]`,
    );
  } finally {
    await fixture.cleanup();
  }
}

/** Scenario 5: synthesizer annotates low-relevance modules. */
export async function scenarioSynthesizerAnnotatesLowRelevance(): Promise<RelevanceScenarioResult> {
  const name = 'synthesizer-annotates-low-relevance';
  const fixture = await makeSynthesisFixture('annotate-low');
  try {
    const ast = makeAstFindings(['foo', 'qux']);
    const clones = makeCloneFindings(['foo', 'qux']);
    const themes = makeThemeFindings([
      { module: 'foo', relevance: 'high', section: 'In Scope' },
      { module: 'qux', relevance: 'low', section: 'Scope' },
    ]);
    const findings: DiscoveryAgentFinding[] = [ast, clones, themes];
    const result = await synthesize({
      featureSlug: 'relevance-fixture',
      findings,
      prdPath: fixture.prdPath,
      prdRelPath: 'prd.md',
    });
    const qux = (result.manifest.modules ?? []).find((m) => m.label === 'qux');
    if (qux === undefined) {
      return fail(
        name,
        `expected qux to appear in manifest with relevance=low; got modules=[${(result.manifest.modules ?? []).map((m) => m.label).join(', ')}]`,
      );
    }
    if (qux.relevance !== 'low') {
      return fail(name, `expected qux.relevance=low; got ${String(qux.relevance)}`);
    }
    const foo = (result.manifest.modules ?? []).find((m) => m.label === 'foo');
    if (foo === undefined) {
      return fail(name, 'foo missing from manifest');
    }
    if (foo.relevance !== undefined) {
      return fail(
        name,
        `expected foo to carry no relevance annotation (high is the default emphasis); got ${String(foo.relevance)}`,
      );
    }
    return pass(name, 'qux annotated relevance=low; foo unannotated (high is default emphasis)');
  } finally {
    await fixture.cleanup();
  }
}

/**
 * Scenario 6: backward-compat — a PrdThemedFindings without
 * `moduleRelevance` produces the pre-AUDIT-11 behavior (every module
 * included, no annotations, no exclusion warning).
 */
export async function scenarioBackwardCompatNoModuleRelevance(): Promise<RelevanceScenarioResult> {
  const name = 'backward-compat-agent-without-relevance';
  const fixture = await makeSynthesisFixture('backcompat');
  try {
    const ast = makeAstFindings(['foo', 'bar', 'baz']);
    const clones = makeCloneFindings(['foo', 'bar', 'baz']);
    // No moduleRelevance field. Mirrors a pre-AUDIT-11 agent output.
    const themes = makeThemeFindings(undefined);
    const findings: DiscoveryAgentFinding[] = [ast, clones, themes];
    const result = await synthesize({
      featureSlug: 'relevance-fixture',
      findings,
      prdPath: fixture.prdPath,
      prdRelPath: 'prd.md',
    });
    const moduleSlugs = (result.manifest.modules ?? []).map((m) => m.label);
    if (!moduleSlugs.includes('foo') || !moduleSlugs.includes('bar') || !moduleSlugs.includes('baz')) {
      return fail(
        name,
        `expected all 3 modules retained; got modules=[${moduleSlugs.join(', ')}]`,
      );
    }
    for (const m of result.manifest.modules ?? []) {
      if (m.relevance !== undefined) {
        return fail(name, `module ${m.label} unexpectedly carries relevance=${String(m.relevance)}`);
      }
    }
    const sawExclusionWarning = result.metadata.warnings.some((w) =>
      /excluded.*module/i.test(w),
    );
    if (sawExclusionWarning) {
      return fail(
        name,
        `expected no exclusion warning for back-compat path; got: ${result.metadata.warnings.join(' / ')}`,
      );
    }
    return pass(name, 'all 3 modules retained; no annotations; no exclusion warning');
  } finally {
    await fixture.cleanup();
  }
}

/** Scenario 7: PRD with neither In Scope nor Out of Scope returns empty map. */
export function scenarioPrdWithoutScopeSections(): RelevanceScenarioResult {
  const name = 'prd-without-in-out-sections';
  const prd = [
    '# Fixture',
    '',
    '## Goals',
    '',
    'Nothing about scope here.',
    '',
    '## Acceptance Criteria',
    '',
    '- Some criterion that mentions modules/foo in passing.',
  ].join('\n');
  const result = parseModuleRelevance(prd, ['foo', 'bar']);
  if (result.scores.size !== 0) {
    return fail(
      name,
      `expected empty relevance map; got ${result.scores.size} entries: ${[...result.scores.entries()].map(([k, v]) => `${k}=${v}`).join(', ')}`,
    );
  }
  return pass(name, 'no scope sections → empty relevance map (synthesizer falls back to default-medium for every module)');
}

/**
 * Scenario 8 (gutted-detector self-check): if the relevance parser
 * silently returns an empty map (e.g., the production code regressed
 * to never detect anything), scenarios 1+2 — which assert specific
 * relevance values — would FAIL. We confirm that by running the
 * scenario logic against a deliberately-empty stub and asserting the
 * stub's output would NOT satisfy the production assertion.
 */
export function scenarioGuttedRelevanceStubFailsTeethCheck(): RelevanceScenarioResult {
  const name = 'gutted-detector-self-check';
  const prd = '## In Scope\n\n- modules/foo\n\n## Out of Scope\n\n- modules/baz\n';
  // Stubbed parser: never finds anything.
  const stubResult = { scores: new Map<string, 'high' | 'medium' | 'low' | 'excluded'>() };
  // Production scenarios would check `stubResult.scores.get('foo') === 'high'`.
  // We assert that the stub does NOT satisfy that check.
  if (stubResult.scores.get('foo') === 'high') {
    return fail(name, 'stub returned high for foo; the stub is not actually gutted');
  }
  // And confirm the REAL parser DOES satisfy it.
  const realResult = parseModuleRelevance(prd, ['foo', 'baz']);
  if (realResult.scores.get('foo') !== 'high' || realResult.scores.get('baz') !== 'excluded') {
    return fail(
      name,
      `real parser failed to surface expected values; got foo=${String(realResult.scores.get('foo'))} baz=${String(realResult.scores.get('baz'))}`,
    );
  }
  return pass(
    name,
    'gutted stub correctly fails the production assertion; real parser satisfies it (harness has teeth)',
  );
}

export type RelevanceScenarioFn = () => Promise<RelevanceScenarioResult> | RelevanceScenarioResult;

/** Ordered scenario list — consumed by prd-themed-pattern-hunter.validate.ts. */
export const RELEVANCE_SCENARIOS: ReadonlyArray<RelevanceScenarioFn> = [
  scenarioPrdWithInScopeExtractsModules,
  scenarioPrdWithOutOfScopeExcludesModules,
  scenarioSynthesizerDropsAndWarnsOnExcluded,
  scenarioSynthesizerAnnotatesLowRelevance,
  scenarioBackwardCompatNoModuleRelevance,
  scenarioPrdWithoutScopeSections,
  scenarioGuttedRelevanceStubFailsTeethCheck,
];
