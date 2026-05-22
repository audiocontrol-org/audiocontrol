/**
 * tools/scope-discovery/clone-id-stability.validate.ts
 *
 * Adversarial validator harness for T7.1 content-hashed clone-group IDs.
 * Proves that:
 *
 *   1. IDs are stable across unrelated line shifts.
 *   2. IDs change when the duplicated content changes.
 *   3. IDs change when member-paths change (renames / membership shifts).
 *   4. IDs are deterministic across runs against the same source.
 *   5. 50 distinct synthetic clone groups produce 50 distinct IDs (no
 *      collisions at the 12-char truncation in a realistic batch).
 *   6. Migration preserves dispositions: an old baseline with 5 entries,
 *      each at a distinct non-default disposition, lands in the new
 *      baseline with every disposition intact at the new ID.
 *   7. Migration detects orphans (pure-function): an old entry whose
 *      members don't match anything yields `unmapped` from migrateGroups.
 *   8. Gutted-stub self-check: a stubbed deriveContentHashedId that
 *      returns a constant string causes scenario 5's assertion to FAIL,
 *      proving the harness has teeth.
 *   9. Migration orphan detection (subprocess): the migrate-clone-ids.ts
 *      CLI rejects an orphan without --allow-unmapped and accepts it
 *      with the flag.
 *
 * Migration-related scenarios (6-7-9) live in the sibling file
 * clone-id-stability.migration-scenarios.ts to keep both files under
 * the 300-500 line cap. Pure-function scenarios (1-5, 8) live here.
 *
 * Each scenario uses its own short-lived fixture directory under
 * `.tmp/clone-id-stability-<runid>/`, torn down on success or failure
 * via a single top-level finally.
 *
 * Run via:
 *   tsx tools/scope-discovery/clone-id-stability.validate.ts
 *   make check-clone-id-stability-validate
 *
 * Exit code:
 *   0   every scenario asserts as expected
 *   1   one or more assertions failed
 *   2   harness infrastructure error
 */

import { mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { deriveContentHashedId, makeCloneGroup } from './clones-yaml.js';
import {
  scenarioMigrationDetectsOrphans,
  scenarioMigrationOrphanSubprocess,
  scenarioMigrationPreservesDispositions,
  type ScenarioResult,
} from './clone-id-stability.migration-scenarios.js';
import { errorMessage } from './util/typeguards.js';

const TMP_ROOT = '.tmp';

function pass(name: string, detail: string): ScenarioResult {
  return { name, passed: true, detail };
}

function fail(name: string, detail: string): ScenarioResult {
  return { name, passed: false, detail };
}

/**
 * Scenario 1: line-shift stability. Two groups differ only in their
 * `:startLine:endLine` ranges; same bare paths + same tokenFingerprint
 * must yield the same id.
 */
function scenarioLineShiftStable(): ScenarioResult {
  const g1 = makeCloneGroup({
    members: ['modules/x/a.ts:10:20', 'modules/x/b.ts:30:40'],
    lines: 11,
    disposition: 'pending',
    reason: null,
    tokenFingerprint: 'fragment-sha-1',
  });
  const g2 = makeCloneGroup({
    members: ['modules/x/a.ts:100:110', 'modules/x/b.ts:200:210'],
    lines: 11,
    disposition: 'pending',
    reason: null,
    tokenFingerprint: 'fragment-sha-1',
  });
  if (g1.id !== g2.id) {
    return fail(
      'line-shift stability',
      `expected stable id across line shifts; g1.id=${g1.id} g2.id=${g2.id}`,
    );
  }
  return pass('line-shift stability', `id ${g1.id} stable across :10:20 vs :100:110 shifts`);
}

/** Scenario 2: content-change sensitivity. Different fingerprint -> different id. */
function scenarioContentChangeSensitive(): ScenarioResult {
  const g1 = makeCloneGroup({
    members: ['modules/x/a.ts:10:20', 'modules/x/b.ts:30:40'],
    lines: 11,
    disposition: 'pending',
    reason: null,
    tokenFingerprint: 'fragment-sha-1',
  });
  const g2 = makeCloneGroup({
    members: ['modules/x/a.ts:10:20', 'modules/x/b.ts:30:40'],
    lines: 11,
    disposition: 'pending',
    reason: null,
    tokenFingerprint: 'fragment-sha-2',
  });
  if (g1.id === g2.id) {
    return fail(
      'content-change sensitivity',
      `expected distinct ids when fragment fingerprint changes; both = ${g1.id}`,
    );
  }
  return pass(
    'content-change sensitivity',
    `id changed (${g1.id} -> ${g2.id}) with new fingerprint`,
  );
}

/** Scenario 3: member-path-change sensitivity. Rename -> different id. */
function scenarioMemberPathChangeSensitive(): ScenarioResult {
  const g1 = makeCloneGroup({
    members: ['modules/x/a.ts:10:20', 'modules/x/b.ts:30:40'],
    lines: 11,
    disposition: 'pending',
    reason: null,
    tokenFingerprint: 'fragment-sha-1',
  });
  const g2 = makeCloneGroup({
    members: ['modules/x/a.ts:10:20', 'modules/x/c.ts:30:40'],
    lines: 11,
    disposition: 'pending',
    reason: null,
    tokenFingerprint: 'fragment-sha-1',
  });
  if (g1.id === g2.id) {
    return fail(
      'member-path-change sensitivity',
      `expected distinct ids when a member's bare path changes; both = ${g1.id}`,
    );
  }
  return pass('member-path-change sensitivity', `id changed (${g1.id} -> ${g2.id}) on rename`);
}

/** Scenario 4: deterministic across repeated derivations. */
function scenarioDeterministic(): ScenarioResult {
  const paths = ['modules/x/a.ts', 'modules/x/b.ts'];
  const id1 = deriveContentHashedId({ sortedBarePaths: paths, tokenFingerprint: 'fp' });
  const id2 = deriveContentHashedId({ sortedBarePaths: paths, tokenFingerprint: 'fp' });
  if (id1 !== id2) {
    return fail('determinism', `same inputs produced different ids: ${id1} vs ${id2}`);
  }
  return pass('determinism', `same inputs produce id ${id1} on every derivation`);
}

interface DeriveForCollisionTest {
  readonly derive: (members: readonly string[], fingerprint: string) => string;
  readonly label: string;
}

/** Build 50 synthetic groups + assert their ids are distinct. */
function assertNoCollisionsOver50(opts: DeriveForCollisionTest): ScenarioResult {
  const ids = new Set<string>();
  const collisions: { i: number; id: string }[] = [];
  for (let i = 0; i < 50; i += 1) {
    const members = [`modules/fx/file-${i}-a.ts:1:10`, `modules/fx/file-${i}-b.ts:1:10`];
    const fingerprint = `synth-fingerprint-${i}-${Math.floor(i / 5)}-${(i * 31) % 7}`;
    const id = opts.derive(members, fingerprint);
    if (ids.has(id)) collisions.push({ i, id });
    ids.add(id);
  }
  if (ids.size !== 50) {
    return fail(
      opts.label,
      `expected 50 distinct ids; got ${ids.size} (collisions: ${JSON.stringify(collisions)})`,
    );
  }
  return pass(opts.label, `50 synthetic groups produced 50 distinct ids`);
}

/** Scenario 5: 50 distinct groups -> 50 distinct IDs. */
function scenarioNoCollisions(): ScenarioResult {
  return assertNoCollisionsOver50({
    derive: (members, fingerprint) =>
      makeCloneGroup({
        members,
        lines: 10,
        disposition: 'pending',
        reason: null,
        tokenFingerprint: fingerprint,
      }).id,
    label: 'no-collisions',
  });
}

/**
 * Scenario 8: gutted-stub self-check. A stub returning a constant
 * collides under the 50-group assertion; the assertion MUST fail.
 */
function scenarioGuttedStubSelfCheck(): ScenarioResult {
  const stubResult = assertNoCollisionsOver50({
    derive: () => 'aaaaaaaaaaaa',
    label: 'gutted-stub no-collisions',
  });
  if (stubResult.passed) {
    return fail(
      'gutted-stub self-check',
      'scenario-5 (no-collisions) passed against a stubbed derivation returning a constant - ' +
        'harness has no teeth',
    );
  }
  return pass('gutted-stub self-check', 'no-collisions assertion rejected a constant-return stub');
}

async function cleanupTmp(): Promise<void> {
  try {
    const entries = await readdir(TMP_ROOT, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory() && e.name.startsWith('clone-id-stability-')) {
        await rm(join(TMP_ROOT, e.name), { recursive: true, force: true });
      }
    }
  } catch (err) {
    void err;
  }
}

type Scenario = () => Promise<ScenarioResult> | ScenarioResult;

const SCENARIOS: readonly Scenario[] = [
  scenarioLineShiftStable,
  scenarioContentChangeSensitive,
  scenarioMemberPathChangeSensitive,
  scenarioDeterministic,
  scenarioNoCollisions,
  scenarioMigrationPreservesDispositions,
  scenarioMigrationDetectsOrphans,
  scenarioGuttedStubSelfCheck,
  scenarioMigrationOrphanSubprocess,
];

async function main(): Promise<number> {
  await mkdir(TMP_ROOT, { recursive: true });
  const results: ScenarioResult[] = [];
  try {
    for (const scenario of SCENARIOS) {
      const result = await scenario();
      results.push(result);
      const marker = result.passed ? 'PASS' : 'FAIL';
      process.stdout.write(`  ${marker}  ${result.name} — ${result.detail}\n`);
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
  (err) => {
    console.error(`harness infrastructure error: ${errorMessage(err)}`);
    process.exit(2);
  },
);
