/**
 * tools/scope-discovery/editor-symmetry.tracked-holdouts-scenarios.ts
 *
 * Adversarial-validator scenarios for the AUDIT-20260522-06 fix in the
 * editor-symmetry matrix layer. The T6.3 matrix used to mask known
 * deferred holdouts — they were either silently subtracted (when
 * listed as `exceptions:`) or surfaced as `⚠`/`✗` blocking cells.
 *
 * The fix introduces a third cell state, `tracked`, rendered with the
 * `⏳ A/E (T tracked)` glyph. Cells with only tracked-holdouts pass
 * the gate; cells with real holdouts (plus or minus tracked) still
 * render as `⚠`/`✗`.
 *
 * Lives in a sibling module to keep `editor-symmetry.scenarios.ts`
 * under the 300-500 line cap. Reuses the shared fixture helpers from
 * `editor-symmetry.fixtures.ts`.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  cleanup,
  makeFixture,
  payloads,
  runScanner,
  scannerArgs as args,
  writeRegistry,
  writeSource,
} from './editor-symmetry.fixtures.js';

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

const EDITORS_AKAI_ONLY = ['akai-s3k-editor'];

/**
 * Manifest entry with one tracked-holdout in `akai-s3k-editor`; no
 * regular holdouts. Matrix MUST render `⏳ 0/1 (1 tracked)` for the
 * akai cell — NOT `✓` (would mask the deferral) and NOT `⚠`/`✗`
 * (those reserve for real holdouts).
 */
async function scenarioTrackedHoldoutsRenderAsHourglass(): Promise<ScenarioResult> {
  const name = 'tracked-holdouts-render-as-hourglass';
  const fixture = await makeFixture('tracked-hourglass', EDITORS_AKAI_ONLY);
  try {
    await writeRegistry(fixture, payloads.TRACKED_HOLDOUT_REGISTRY);
    // DeferredEditor.tsx matches the glob and is the manifest's tracked-holdout.
    await writeSource(
      fixture,
      'modules/akai-s3k-editor/src/DeferredEditor.tsx',
      payloads.HOLDOUT_SOURCE,
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 0) {
      return fail(
        name,
        `expected exit 0 (tracked-holdouts are gate-passing); got ${run.code}; stdout=${run.stdout}`,
      );
    }
    if (!run.stdout.includes('⏳ 0/1 (1 tracked)')) {
      return fail(
        name,
        `expected '⏳ 0/1 (1 tracked)' cell; got: ${run.stdout}`,
      );
    }
    if (run.stdout.includes('✓ 1/1')) {
      return fail(
        name,
        `tracked-holdout cell must NOT render as ✓ (would mask the deferral); got: ${run.stdout}`,
      );
    }
    return pass(
      name,
      'tracked-holdout-only cell renders as ⏳ 0/1 (1 tracked); gate exits 0',
    );
  } finally {
    await cleanup(fixture);
  }
}

/**
 * Tracked-holdouts + real holdouts in the same cell. Real holdouts
 * dominate: the cell MUST render as `⚠`, not `⏳`. The gate MUST exit 1.
 */
async function scenarioTrackedVsRealHoldoutsDistinction(): Promise<ScenarioResult> {
  const name = 'tracked-vs-real-holdouts-distinction';
  const fixture = await makeFixture('tracked-vs-real', EDITORS_AKAI_ONLY);
  try {
    await writeRegistry(fixture, payloads.TRACKED_HOLDOUT_MIXED_REGISTRY);
    // Tracked-holdout file (registered in the manifest).
    await writeSource(
      fixture,
      'modules/akai-s3k-editor/src/DeferredEditor.tsx',
      payloads.HOLDOUT_SOURCE,
    );
    // Real holdout: matches glob, no canonical import, not tracked.
    await writeSource(
      fixture,
      'modules/akai-s3k-editor/src/RealHoldoutEditor.tsx',
      payloads.HOLDOUT_SOURCE,
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 1) {
      return fail(
        name,
        `expected exit 1 (real holdout dominates); got ${run.code}; stdout=${run.stdout}`,
      );
    }
    if (!run.stdout.includes('⚠ 0/2 (1 holdout)')) {
      return fail(
        name,
        `expected '⚠ 0/2 (1 holdout)' cell when real holdouts dominate; got: ${run.stdout}`,
      );
    }
    // The legend always documents the ⏳ glyph, so we can't grep stdout
    // wholesale. Instead inspect the matrix's data row only.
    const dataRow = run.stdout
      .split('\n')
      .find((l) => l.includes('slide-drawer-promotion') && l.startsWith('|'));
    if (dataRow === undefined) {
      return fail(name, `data row not found; stdout=${run.stdout}`);
    }
    if (dataRow.includes('⏳')) {
      return fail(
        name,
        `cell must NOT render as ⏳ when a real holdout is present; got data row: ${dataRow}`,
      );
    }
    return pass(
      name,
      'real holdouts dominate tracked-holdouts: cell renders ⚠, not ⏳; exit 1',
    );
  } finally {
    await cleanup(fixture);
  }
}

/**
 * Gutted-stub self-check. Plants a scanner stub that emits an all-✓
 * matrix even though tracked-holdouts should produce a ⏳ cell. The
 * hourglass-assertion MUST reject the stub.
 */
async function scenarioGuttedStubTrackedHoldouts(): Promise<ScenarioResult> {
  const name = 'gutted-stub-tracked-holdouts';
  const fixture = await makeFixture('gutted-tracked', EDITORS_AKAI_ONLY);
  const stubDir = await mkdtemp(join(tmpdir(), 'editor-symmetry-tracked-stub-'));
  const stubPath = join(stubDir, 'stub.ts');
  try {
    await writeFile(
      stubPath,
      "process.stdout.write('| Convention | akai-s3k-editor |\\n');\n" +
        "process.stdout.write('| --- | --- |\\n');\n" +
        "process.stdout.write('| slide-drawer-promotion | ✓ 1/1 |\\n');\n" +
        'process.exit(0);\n',
      'utf8',
    );
    await writeRegistry(fixture, payloads.TRACKED_HOLDOUT_REGISTRY);
    await writeSource(
      fixture,
      'modules/akai-s3k-editor/src/DeferredEditor.tsx',
      payloads.HOLDOUT_SOURCE,
    );
    const run = await runScanner(args(fixture), stubPath);
    // The hourglass-assertion in scenarioTrackedHoldoutsRenderAsHourglass
    // expects exit 0 AND '⏳ 0/1 (1 tracked)' AND absence of '✓ 1/1'.
    // The stub returns exit 0 with '✓ 1/1' — so the assertion's
    // tracked-glyph check fails, AND the no-false-✓ check fails.
    if (run.stdout.includes('⏳ 0/1 (1 tracked)')) {
      return fail(
        name,
        'stub somehow produced the hourglass cell; gutted self-check has no signal',
      );
    }
    if (run.code === 0 && run.stdout.includes('✓ 1/1')) {
      return pass(
        name,
        'gutted stub returns all-✓ matrix; the real assertion (expects ⏳, rejects ✓) would reject it',
      );
    }
    return fail(name, `unexpected stub exit code ${run.code}; stdout=${run.stdout}`);
  } finally {
    await cleanup(fixture);
    await rm(stubDir, { recursive: true, force: true });
  }
}

/** Tracked-holdouts scenarios in execution order. */
export const TRACKED_HOLDOUTS_SCENARIOS: ReadonlyArray<() => Promise<ScenarioResult>> = [
  scenarioTrackedHoldoutsRenderAsHourglass,
  scenarioTrackedVsRealHoldoutsDistinction,
  scenarioGuttedStubTrackedHoldouts,
];
