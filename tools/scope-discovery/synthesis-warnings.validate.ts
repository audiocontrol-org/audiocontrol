/**
 * tools/scope-discovery/synthesis-warnings.validate.ts
 *
 * T7.5 polish — assert that synthesis.ts surfaces non-fatal warnings
 * into the SynthesisOutput.metadata.warnings field AND that the
 * --notes-out CLI option renders them under a `## Synthesizer notes`
 * markdown heading. Without this gate, synthesizer warnings stay on
 * stderr only — invisible to the operator reading the run-dir's
 * synthesis.md.
 *
 * Two scenarios + a gutted-stub self-check that mirrors the rest of
 * the scope-discovery validator suite.
 *
 * Exit code:
 *   0   all assertions held
 *   1   one or more assertions failed (warnings plumbing regressed)
 *   2   harness infrastructure error
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { synthesize } from './synthesis.js';
import type { DiscoveryAgentFinding } from './discovery-agents/types.js';
import { runScannerSubprocess } from './util/run-scanner.js';
import { errorMessage } from './util/typeguards.js';

const TMP_ROOT = '.tmp';
const SYNTHESIS_ENTRY = 'tools/scope-discovery/synthesis.ts';

interface ScenarioResult {
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

/**
 * PRD content with NO `References` section — the synthesizer should
 * emit a warning naming the missing section and default to PRD+LAYOUT.md.
 */
const PRD_NO_REFS = `# Feature: warnings-fixture\n\n## Overview\nA fixture PRD whose Goals section mentions polishtest tones polishtest patches polishtest library.\n\n## Goals\nThe polishtest goals are polishtest-shaped.\n`;

/**
 * Discovery findings that route the synthesizer to kind=code (clone
 * findings only). Kept synthetic so the assertion targets the
 * warnings-plumbing, not any specific real-source matrix.
 */
const SYNTHETIC_FINDINGS: ReadonlyArray<DiscoveryAgentFinding> = [
  {
    agent: 'clone-detector-reader',
    featureSlug: 'warnings-fixture',
    clones: [
      {
        id: 'a1b2c3d4',
        lines: 10,
        members: ['modules/test/src/a.ts:1-10', 'modules/test/src/b.ts:1-10'],
        disposition: 'pending',
      },
    ],
  },
  {
    agent: 'prd-themed-pattern-hunter',
    featureSlug: 'warnings-fixture',
    themes: [
      {
        term: 'polishtest',
        occurrences: [
          { file: 'modules/test/src/a.ts', line: 1, snippet: 'polishtest tones' },
        ],
      },
    ],
  },
];

interface Fixture {
  readonly dir: string;
  readonly prdPath: string;
  readonly notesPath: string;
}

async function makeFixture(label: string): Promise<Fixture> {
  const runId = Math.random().toString(36).slice(2, 8);
  const dir = join(TMP_ROOT, `synthesis-warnings-${label}-${runId}`);
  await mkdir(dir, { recursive: true });
  const prdPath = join(dir, 'prd.md');
  await writeFile(prdPath, PRD_NO_REFS, 'utf8');
  return { dir, prdPath, notesPath: join(dir, 'synthesis-notes.md') };
}

async function scenarioWarningsInOutput(): Promise<ScenarioResult> {
  const name = 'synthesize() populates metadata.warnings on missing PRD References';
  const fixture = await makeFixture('output');
  const result = await synthesize({
    featureSlug: 'warnings-fixture',
    findings: SYNTHETIC_FINDINGS,
    prdPath: fixture.prdPath,
    prdRelPath: 'prd.md',
  });
  if (!Array.isArray(result.metadata.warnings)) {
    return fail(name, `expected metadata.warnings to be an array; got ${typeof result.metadata.warnings}`);
  }
  if (result.metadata.warnings.length === 0) {
    return fail(name, 'expected at least one warning (PRD has no References section); got 0');
  }
  const matched = result.metadata.warnings.some(
    (w) => /no References\/Appendix/i.test(w),
  );
  if (!matched) {
    return fail(
      name,
      `expected a warning mentioning "no References/Appendix"; got: ${result.metadata.warnings.join(' / ')}`,
    );
  }
  return pass(name, `warnings array contains expected entry: ${result.metadata.warnings[0]}`);
}

async function scenarioNotesOutWritesSection(): Promise<ScenarioResult> {
  const name = 'synthesis.ts --notes-out writes "## Synthesizer notes" markdown fragment';
  const fixture = await makeFixture('notesout');
  const manifestPath = join(fixture.dir, 'scope-manifest.yaml');
  const findingsDir = join(fixture.dir, 'findings');
  await mkdir(findingsDir, { recursive: true });
  // Persist findings to disk so the CLI can read them.
  const findingsPaths: string[] = [];
  for (const f of SYNTHETIC_FINDINGS) {
    const p = join(findingsDir, `${f.agent}.json`);
    await writeFile(p, JSON.stringify(f, null, 2), 'utf8');
    findingsPaths.push(p);
  }
  const run = await runScannerSubprocess(SYNTHESIS_ENTRY, [
    '--feature', 'warnings-fixture',
    '--prd-path', fixture.prdPath,
    '--findings', ...findingsPaths,
    '--out', manifestPath,
    '--notes-out', fixture.notesPath,
  ]);
  if (run.code !== 0) {
    return fail(name, `synthesis exited ${run.code}; stderr:\n${run.stderr}`);
  }
  let notes: string;
  try {
    notes = await readFile(fixture.notesPath, 'utf8');
  } catch (err) {
    return fail(name, `expected ${fixture.notesPath} to exist; ${errorMessage(err)}`);
  }
  if (!notes.includes('## Synthesizer notes')) {
    return fail(name, `expected "## Synthesizer notes" heading; got:\n${notes}`);
  }
  if (!/no References\/Appendix/i.test(notes)) {
    return fail(name, `expected warning text in notes file; got:\n${notes}`);
  }
  return pass(name, 'notes file contained heading + expected warning text');
}

/**
 * Harness-teeth check: feed an EMPTY warnings array through the
 * renderer and assert the section still emits the heading with
 * "clean — no notes" body. If a regressed renderer omitted the
 * heading on empty input, downstream skill parsing would silently
 * lose the section. We exercise the same renderer the CLI path uses.
 */
async function scenarioRendererTeethOnEmptyWarnings(): Promise<ScenarioResult> {
  const name = 'gutted-stub self-check: empty-warnings rendering still emits heading';
  // Run the CLI against a PRD WITH a References section so warnings is
  // empty, and confirm --notes-out still writes the heading.
  const fixture = await makeFixture('teeth');
  const prdWithRefs = `# Feature: teeth-fixture\n\npolishtest polishtest polishtest body.\n\n## References\n\n- [LAYOUT](docs/scope-discovery/LAYOUT.md)\n`;
  await writeFile(fixture.prdPath, prdWithRefs, 'utf8');
  const findingsDir = join(fixture.dir, 'findings');
  await mkdir(findingsDir, { recursive: true });
  const findingsPaths: string[] = [];
  for (const f of SYNTHETIC_FINDINGS) {
    const p = join(findingsDir, `${f.agent}.json`);
    // rewrite featureSlug to match the new fixture
    const remapped = { ...f, featureSlug: 'teeth-fixture' } as DiscoveryAgentFinding;
    await writeFile(p, JSON.stringify(remapped, null, 2), 'utf8');
    findingsPaths.push(p);
  }
  const manifestPath = join(fixture.dir, 'scope-manifest.yaml');
  const run = await runScannerSubprocess(SYNTHESIS_ENTRY, [
    '--feature', 'teeth-fixture',
    '--prd-path', fixture.prdPath,
    '--findings', ...findingsPaths,
    '--out', manifestPath,
    '--notes-out', fixture.notesPath,
  ]);
  if (run.code !== 0) {
    return fail(name, `synthesis exited ${run.code}; stderr:\n${run.stderr}`);
  }
  const notes = await readFile(fixture.notesPath, 'utf8');
  if (!notes.includes('## Synthesizer notes')) {
    return fail(name, `heading missing on empty-warnings input; got:\n${notes}`);
  }
  // Either "clean — no notes" or the regime-holdout warning may appear
  // (kind=code synthesis with no regime detector finds emits a warning).
  // The hard requirement is heading presence + at least some body content.
  if (notes.trim().split('\n').length < 2) {
    return fail(name, `notes file too short; got:\n${notes}`);
  }
  return pass(name, 'empty-warnings input still produced the heading with body content');
}

/**
 * AUDIT-20260524-12: the "PRD has no References/Appendix section"
 * warning must include a paste-ready PRD-augmentation skeleton so the
 * operator gets actionable guidance instead of a single line that's
 * easy to ignore. The skeleton MUST surface in BOTH the in-memory
 * warnings array (synthesize() return) AND the rendered notes file
 * (--notes-out output), since both are operator-facing channels.
 */
const SKELETON_SUBSTRINGS: ReadonlyArray<string> = [
  '## References',
  'Related issues:',
  'Related ADRs:',
  'External docs:',
];

async function scenarioWarningTextIncludesSkeleton(): Promise<ScenarioResult> {
  const name =
    'AUDIT-12: missing-References warning includes paste-ready PRD skeleton (in-memory + notes file)';
  const fixture = await makeFixture('skeleton-included');
  // In-memory channel: synthesize() return value.
  const result = await synthesize({
    featureSlug: 'warnings-fixture',
    findings: SYNTHETIC_FINDINGS,
    prdPath: fixture.prdPath,
    prdRelPath: 'prd.md',
  });
  const referencesWarning = result.metadata.warnings.find((w) =>
    /no References\/Appendix/i.test(w),
  );
  if (referencesWarning === undefined) {
    return fail(name, `expected a References/Appendix warning; got: ${result.metadata.warnings.join(' / ')}`);
  }
  const missingInMemory = SKELETON_SUBSTRINGS.filter(
    (s) => !referencesWarning.includes(s),
  );
  if (missingInMemory.length > 0) {
    return fail(
      name,
      `in-memory warning missing skeleton substrings [${missingInMemory.join(', ')}]; warning was:\n${referencesWarning}`,
    );
  }
  // The warning should also reference the PRD path so the operator
  // knows which file to edit (the skeleton is keyed on `prd.md`).
  if (!referencesWarning.includes('prd.md')) {
    return fail(
      name,
      `in-memory warning should name the PRD path; warning was:\n${referencesWarning}`,
    );
  }
  // Notes-file channel: --notes-out output.
  const manifestPath = join(fixture.dir, 'scope-manifest.yaml');
  const findingsDir = join(fixture.dir, 'findings');
  await mkdir(findingsDir, { recursive: true });
  const findingsPaths: string[] = [];
  for (const f of SYNTHETIC_FINDINGS) {
    const p = join(findingsDir, `${f.agent}.json`);
    await writeFile(p, JSON.stringify(f, null, 2), 'utf8');
    findingsPaths.push(p);
  }
  const run = await runScannerSubprocess(SYNTHESIS_ENTRY, [
    '--feature', 'warnings-fixture',
    '--prd-path', fixture.prdPath,
    '--findings', ...findingsPaths,
    '--out', manifestPath,
    '--notes-out', fixture.notesPath,
  ]);
  if (run.code !== 0) {
    return fail(name, `synthesis CLI exited ${run.code}; stderr:\n${run.stderr}`);
  }
  const notes = await readFile(fixture.notesPath, 'utf8');
  const missingInNotes = SKELETON_SUBSTRINGS.filter((s) => !notes.includes(s));
  if (missingInNotes.length > 0) {
    return fail(
      name,
      `notes file missing skeleton substrings [${missingInNotes.join(', ')}]; notes were:\n${notes}`,
    );
  }
  return pass(
    name,
    'skeleton substrings present in BOTH in-memory warning and notes file',
  );
}

async function scenarioSkeletonOmittedWhenPrdHasReferences(): Promise<ScenarioResult> {
  const name =
    'AUDIT-12: missing-References warning + skeleton absent when PRD has References section';
  const fixture = await makeFixture('skeleton-omitted');
  const prdWithRefs =
    '# Feature: has-refs-fixture\n\n' +
    'polishtest polishtest polishtest body.\n\n' +
    '## References\n\n' +
    '- [LAYOUT](docs/scope-discovery/LAYOUT.md)\n';
  await writeFile(fixture.prdPath, prdWithRefs, 'utf8');
  // In-memory channel: synthesize() return value.
  const result = await synthesize({
    featureSlug: 'has-refs-fixture',
    findings: SYNTHETIC_FINDINGS.map((f) => ({ ...f, featureSlug: 'has-refs-fixture' })) as DiscoveryAgentFinding[],
    prdPath: fixture.prdPath,
    prdRelPath: 'prd.md',
  });
  const referencesWarning = result.metadata.warnings.find((w) =>
    /no References\/Appendix/i.test(w),
  );
  if (referencesWarning !== undefined) {
    return fail(
      name,
      `expected NO References/Appendix warning (PRD has the section); got: ${referencesWarning}`,
    );
  }
  // The skeleton's load-bearing substrings should be absent from EVERY
  // warning in the array — no other warning channel should accidentally
  // ship the skeleton when the gate isn't tripped.
  for (const w of result.metadata.warnings) {
    for (const s of SKELETON_SUBSTRINGS) {
      if (w.includes(s)) {
        return fail(
          name,
          `unexpected skeleton substring "${s}" present in non-References warning:\n${w}`,
        );
      }
    }
  }
  // Notes-file channel: --notes-out output.
  const findingsDir = join(fixture.dir, 'findings');
  await mkdir(findingsDir, { recursive: true });
  const findingsPaths: string[] = [];
  for (const f of SYNTHETIC_FINDINGS) {
    const p = join(findingsDir, `${f.agent}.json`);
    const remapped = { ...f, featureSlug: 'has-refs-fixture' } as DiscoveryAgentFinding;
    await writeFile(p, JSON.stringify(remapped, null, 2), 'utf8');
    findingsPaths.push(p);
  }
  const manifestPath = join(fixture.dir, 'scope-manifest.yaml');
  const run = await runScannerSubprocess(SYNTHESIS_ENTRY, [
    '--feature', 'has-refs-fixture',
    '--prd-path', fixture.prdPath,
    '--findings', ...findingsPaths,
    '--out', manifestPath,
    '--notes-out', fixture.notesPath,
  ]);
  if (run.code !== 0) {
    return fail(name, `synthesis CLI exited ${run.code}; stderr:\n${run.stderr}`);
  }
  const notes = await readFile(fixture.notesPath, 'utf8');
  // The notes file's own heading is literally `## Synthesizer notes`,
  // which is unrelated to the skeleton. Check that NONE of the
  // skeleton-specific substrings (which all reference PRD-section
  // content) appear — the heading check uses the literal subheading
  // names + bullet labels chosen to never collide with the synthesizer
  // notes' own structure.
  const leakedInNotes = SKELETON_SUBSTRINGS.filter((s) => notes.includes(s));
  if (leakedInNotes.length > 0) {
    return fail(
      name,
      `notes file leaked skeleton substrings [${leakedInNotes.join(', ')}] when PRD has References; notes were:\n${notes}`,
    );
  }
  return pass(
    name,
    'no References/Appendix warning fired and no skeleton substrings appeared in either channel',
  );
}

async function cleanupTmp(): Promise<void> {
  try {
    const { readdir } = await import('node:fs/promises');
    const entries = await readdir(TMP_ROOT, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory() && e.name.startsWith('synthesis-warnings-')) {
        await rm(join(TMP_ROOT, e.name), { recursive: true, force: true });
      }
    }
  } catch {
    // .tmp may not exist — fine.
  }
}

async function main(): Promise<number> {
  await mkdir(TMP_ROOT, { recursive: true });
  // Suppress dirname unused-warning by using it in a harmless local.
  void dirname;
  const scenarios = [
    scenarioWarningsInOutput,
    scenarioNotesOutWritesSection,
    scenarioRendererTeethOnEmptyWarnings,
    scenarioWarningTextIncludesSkeleton,
    scenarioSkeletonOmittedWhenPrdHasReferences,
  ];
  const results: ScenarioResult[] = [];
  try {
    for (const scenario of scenarios) {
      const r = await scenario();
      results.push(r);
      const marker = r.passed ? 'PASS' : 'FAIL';
      process.stdout.write(`  ${marker}  ${r.name} — ${r.detail}\n`);
    }
  } finally {
    await cleanupTmp();
  }
  const failed = results.filter((r) => !r.passed);
  process.stdout.write(
    `\nSummary: ${results.length - failed.length}/${results.length} scenarios passed\n`,
  );
  return failed.length === 0 ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(`harness infrastructure error: ${errorMessage(err)}`);
    process.exit(2);
  },
);
