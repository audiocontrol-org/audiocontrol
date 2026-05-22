/**
 * tools/scope-discovery/clone-id-stability.migration-scenarios.ts
 *
 * Adversarial-validator scenarios for the T7.1 migration step:
 *
 *   - migration disposition-preservation (pure-function)
 *   - migration orphan detection (pure-function)
 *   - migration orphan detection via the migrate-clone-ids.ts CLI
 *
 * Extracted from clone-id-stability.validate.ts so the host harness
 * stays under the 300-500 line cap. The migration scenarios share the
 * `ScenarioResult` shape with the host harness; each function returns
 * a result the host appends to its top-level results array.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  type CloneGroup,
  type ClonesYaml,
  extractBarePath,
  makeCloneGroup,
  serializeClonesYaml,
} from './clones-yaml.js';
import { migrateGroups } from './migrate-clone-ids.js';
import { runScannerSubprocess } from './util/run-scanner.js';

const MIGRATOR_ENTRY = 'tools/scope-discovery/migrate-clone-ids.ts';
const TMP_ROOT = '.tmp';

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

function makeFixturePath(label: string): string {
  const runId = Math.random().toString(36).slice(2, 8);
  return join(TMP_ROOT, `clone-id-stability-${label}-${runId}`);
}

/**
 * Shift the line-range suffix of a member string. Preserves the bare
 * path so migrateGroups can match the old entry to the new one — that's
 * the whole point of the line-shift scenario.
 */
function shiftMemberRange(member: string, newStart: number, newEnd: number): string {
  const bare = extractBarePath(member);
  return `${bare}:${newStart}:${newEnd}`;
}

/**
 * Build a tuple of (oldGroups, newGroups) where every old entry has a
 * matching new entry under the new line ranges. Each old entry has a
 * distinct disposition so the harness can assert each one carries
 * forward independently.
 */
function buildShiftedFixture(): { old: readonly CloneGroup[]; nu: readonly CloneGroup[] } {
  const oldGroups: CloneGroup[] = [
    {
      id: 'old-id-1',
      lines: 10,
      members: ['modules/x/a.ts:1:10', 'modules/x/b.ts:1:10'],
      disposition: 'pending',
      reason: null,
    },
    {
      id: 'old-id-2',
      lines: 10,
      members: ['modules/x/c.ts:1:10', 'modules/x/d.ts:1:10'],
      disposition: 'keep-with-reason',
      reason: 'fixture: intentional duplication',
    },
    {
      id: 'old-id-3',
      lines: 10,
      members: ['modules/x/e.ts:1:10', 'modules/x/f.ts:1:10'],
      disposition: 'ignore-with-justification',
      reason: 'fixture: near-clone, not refactor candidate',
    },
    {
      id: 'old-id-4',
      lines: 10,
      members: ['modules/x/g.ts:1:10', 'modules/x/h.ts:1:10'],
      disposition: 'refactor',
      reason: 'fixture: refactor case',
      canonical_side: 'all',
      canonical_reason: 'fixture canonical reason',
      tests: ['modules/x/test.spec.ts'],
      tests_proof: { sha: 'abc1234', demonstration: 'fixture proof' },
    },
    {
      id: 'old-id-5',
      lines: 10,
      members: ['modules/x/i.ts:1:10', 'modules/x/j.ts:1:10'],
      disposition: 'pending',
      reason: 'fixture: explicit pending reason',
    },
  ];

  const newGroups: CloneGroup[] = oldGroups.map((g, i) =>
    makeCloneGroup({
      members: g.members.map((m) => shiftMemberRange(m, 100 + i, 110 + i)),
      lines: g.lines,
      disposition: 'pending',
      reason: null,
      tokenFingerprint: `fragment-for-${g.id}`,
    }),
  );
  return { old: oldGroups, nu: newGroups };
}

/**
 * Build the bare-path-set key used to match old and new entries
 * across the line-shift boundary. Sorting + joining with `|` gives a
 * deterministic, comparable string.
 */
function barePathsKey(group: CloneGroup): string {
  return [...group.members].map(extractBarePath).sort().join('|');
}

/**
 * Scenario: 5 dispositioned entries survive a line-shift migration with
 * disposition, reason, and refactor-only fields intact under fresh IDs.
 */
export function scenarioMigrationPreservesDispositions(): ScenarioResult {
  const { old: oldGroups, nu: newGroups } = buildShiftedFixture();
  const result = migrateGroups(newGroups, oldGroups);

  if (result.migratedGroups.length !== 5) {
    return fail(
      'migration disposition-preservation',
      `expected 5 migrated groups; got ${result.migratedGroups.length}`,
    );
  }
  if (result.unmapped.length !== 0) {
    return fail(
      'migration disposition-preservation',
      `expected 0 unmapped; got ${result.unmapped.length}`,
    );
  }
  if (result.newOnly.length !== 0) {
    return fail(
      'migration disposition-preservation',
      `expected 0 new-only; got ${result.newOnly.length}`,
    );
  }
  // Verify each old disposition landed on the matching new entry.
  for (const oldG of oldGroups) {
    const oldKey = barePathsKey(oldG);
    const newMatch = result.migratedGroups.find((g) => barePathsKey(g) === oldKey);
    if (newMatch === undefined) {
      return fail(
        'migration disposition-preservation',
        `no new entry matched old.members bare-key for ${oldG.id}: ${oldKey}`,
      );
    }
    if (newMatch.disposition !== oldG.disposition) {
      return fail(
        'migration disposition-preservation',
        `disposition mismatch for ${oldG.id}: old=${oldG.disposition} new=${newMatch.disposition}`,
      );
    }
    if (newMatch.reason !== oldG.reason) {
      return fail(
        'migration disposition-preservation',
        `reason mismatch for ${oldG.id}: old="${oldG.reason}" new="${newMatch.reason}"`,
      );
    }
    if (newMatch.id === oldG.id) {
      return fail(
        'migration disposition-preservation',
        `id did NOT change for ${oldG.id}; migration should produce a fresh id`,
      );
    }
  }
  return pass(
    'migration disposition-preservation',
    `5/5 dispositions carried forward across line-shift migration; all ids changed`,
  );
}

/** Scenario: old entry with no matching new entry surfaces as unmapped. */
export function scenarioMigrationDetectsOrphans(): ScenarioResult {
  const oldGroups: CloneGroup[] = [
    {
      id: 'matched-old',
      lines: 10,
      members: ['modules/x/a.ts:1:10', 'modules/x/b.ts:1:10'],
      disposition: 'keep-with-reason',
      reason: 'will match',
    },
    {
      id: 'orphan-old',
      lines: 10,
      members: ['modules/gone/orphan-a.ts:1:10', 'modules/gone/orphan-b.ts:1:10'],
      disposition: 'refactor',
      reason: 'will orphan',
      canonical_side: 'all',
      canonical_reason: 'fixture',
      tests: ['modules/gone/test.spec.ts'],
      tests_proof: { sha: 'def5678', demonstration: 'fixture' },
    },
  ];
  const newGroups: CloneGroup[] = [
    makeCloneGroup({
      members: ['modules/x/a.ts:1:10', 'modules/x/b.ts:1:10'],
      lines: 10,
      disposition: 'pending',
      reason: null,
      tokenFingerprint: 'matches-old-first-entry',
    }),
  ];

  const result = migrateGroups(newGroups, oldGroups);
  if (result.unmapped.length !== 1) {
    return fail(
      'orphan detection',
      `expected 1 unmapped (the orphan-old entry); got ${result.unmapped.length}`,
    );
  }
  if (result.unmapped[0]?.id !== 'orphan-old') {
    return fail(
      'orphan detection',
      `expected unmapped id 'orphan-old'; got ${result.unmapped[0]?.id ?? '<none>'}`,
    );
  }
  if (result.migratedGroups.length !== 1) {
    return fail(
      'orphan detection',
      `expected 1 migrated group; got ${result.migratedGroups.length}`,
    );
  }
  return pass('orphan detection', `orphan 'orphan-old' surfaced; 1 entry migrated cleanly`);
}

/**
 * Scenario: end-to-end exercise of the migrate-clone-ids.ts CLI gate
 * for orphans. Plants a synthetic baseline with one orphan entry, runs
 * the migrator (which kicks off a real jscpd run against the live tree)
 * with and without --allow-unmapped, asserts on the exit code + the
 * orphan id appearing in the output.
 *
 * Wall-clock cost: dominated by jscpd. Two subprocess runs at ~60-90s
 * each; total scenario time roughly 2-3 minutes. The pure-function
 * scenario above covers the same logic at zero jscpd cost; this
 * subprocess version validates the CLI wrapper specifically.
 */
export async function scenarioMigrationOrphanSubprocess(): Promise<ScenarioResult> {
  const fixtureDir = makeFixturePath('orphan-subproc');
  await mkdir(fixtureDir, { recursive: true });
  const fakeBaselinePath = join(fixtureDir, 'baseline.yaml');
  const fakeMapPath = join(fixtureDir, 'migration-map.yaml');

  // Paths under .tmp/ are excluded by .jscpd.json's ignore list, so this
  // synthetic entry is guaranteed to have no match in jscpd's output.
  const orphanGroup: CloneGroup = {
    id: 'orphan12byte',
    lines: 10,
    members: [
      '.tmp/clone-id-stability-orphan/never-clone-a.ts:1:10',
      '.tmp/clone-id-stability-orphan/never-clone-b.ts:1:10',
    ],
    disposition: 'keep-with-reason',
    reason: 'fixture: this entry will orphan',
  };
  const fixtureBaseline: ClonesYaml = {
    generated_at: '2026-05-22T00:00:00.000Z',
    clones: [orphanGroup],
  };
  await writeFile(fakeBaselinePath, serializeClonesYaml(fixtureBaseline), 'utf8');

  // Run the migrator without --allow-unmapped; expect non-zero exit.
  const denied = await runScannerSubprocess(MIGRATOR_ENTRY, [
    '--dry-run',
    '--baseline',
    fakeBaselinePath,
    '--map',
    fakeMapPath,
  ]);
  if (denied.code === 0) {
    return fail(
      'orphan-detection subprocess',
      `expected non-zero exit when orphan present without --allow-unmapped; got 0\n` +
        `stdout:\n${denied.stdout}\nstderr:\n${denied.stderr}`,
    );
  }
  if (!denied.stderr.includes('orphan12byte') && !denied.stdout.includes('orphan12byte')) {
    return fail(
      'orphan-detection subprocess',
      `orphan id should appear in output; stdout:\n${denied.stdout}\nstderr:\n${denied.stderr}`,
    );
  }

  // Re-run with --allow-unmapped + --dry-run; expect exit 0.
  const allowed = await runScannerSubprocess(MIGRATOR_ENTRY, [
    '--dry-run',
    '--allow-unmapped',
    '--baseline',
    fakeBaselinePath,
    '--map',
    fakeMapPath,
  ]);
  if (allowed.code !== 0) {
    return fail(
      'orphan-detection subprocess',
      `expected exit 0 with --allow-unmapped; got ${allowed.code}\n` +
        `stdout:\n${allowed.stdout}\nstderr:\n${allowed.stderr}`,
    );
  }
  return pass(
    'orphan-detection subprocess',
    'orphan without --allow-unmapped: non-zero exit + orphan id surfaced; with --allow-unmapped: exit 0',
  );
}
