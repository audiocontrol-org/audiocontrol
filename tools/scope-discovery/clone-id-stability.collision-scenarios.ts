/**
 * tools/scope-discovery/clone-id-stability.collision-scenarios.ts
 *
 * Adversarial-validator scenarios specifically targeting the AUDIT-
 * 20260522-02 failure mode: the T7.1 migrator's pass-2 shift-tolerant
 * index originally used Map<string, CloneGroup>, so two new candidate
 * groups sharing the same bare-file-pair + lines key silently
 * overwrote each other; subsequent colliding old entries were marked
 * `unmapped` and an operator-authored disposition could be silently
 * dropped.
 *
 * The fix:
 *   - newByShift is Map<string, CloneGroup[]> (accumulates candidates).
 *   - Candidates are sorted by smallest member's startLine, then by the
 *     full sorted-members tuple.
 *   - Old entries pick candidates in that order, consuming the chosen
 *     one so subsequent colliding olds pick the next.
 *   - When two candidates share IDENTICAL members (same paths AND same
 *     start/end lines), the migrator throws MigrationError instead of
 *     silently guessing.
 *
 * Each scenario exercises one of these guarantees; they share the
 * `ScenarioResult` shape and are wired into clone-id-stability.validate.ts
 * alongside the migration-scenarios from the sibling file.
 */

import { type CloneGroup, makeCloneGroup } from './clones-yaml.js';
import { MigrationError, migrateGroups } from './migrate-clone-ids.js';
import type { ScenarioResult } from './clone-id-stability.migration-scenarios.js';

function pass(name: string, detail: string): ScenarioResult {
  return { name, passed: true, detail };
}

function fail(name: string, detail: string): ScenarioResult {
  return { name, passed: false, detail };
}

/**
 * Build a non-refactor old CloneGroup. Helper for collision-scenario
 * setup; the production constructor enforces "min 2 members" so the
 * fixture always provides two paths.
 */
function makeOldGroup(args: {
  id: string;
  members: readonly string[];
  reason: string;
}): CloneGroup {
  return {
    id: args.id,
    lines: 10,
    members: [...args.members].sort(),
    disposition: 'keep-with-reason',
    reason: args.reason,
  };
}

/**
 * Scenario: two new candidates share the same bare-file-pair + lines
 * key but have different startLines. Two old entries map to the same
 * key. The fixed matcher must:
 *   - sort candidates by smallest startLine (the documented tiebreaker)
 *   - match the smaller-startLine old to the smaller-startLine new
 *   - match the larger-startLine old to the larger-startLine new
 *   - emit zero unmapped and zero newOnly
 *
 * The buggy pre-fix behavior would have overwritten one new entry in
 * the index, matched only one old, and reported the other as unmapped
 * with the displaced new entry appearing as newOnly — silently
 * dropping a disposition. This scenario asserts that did not happen.
 */
export function scenarioCollisionDeterministicTiebreaker(): ScenarioResult {
  const oldGroups: readonly CloneGroup[] = [
    makeOldGroup({
      id: 'old-collide-low',
      members: ['modules/y/a.ts:1:10', 'modules/y/b.ts:1:10'],
      reason: 'collision fixture: low-start',
    }),
    makeOldGroup({
      id: 'old-collide-high',
      members: ['modules/y/a.ts:50:59', 'modules/y/b.ts:50:59'],
      reason: 'collision fixture: high-start',
    }),
  ];
  // Both new entries share bare-paths a.ts|b.ts and lines=10, so they
  // hash to the same shift-tolerant key. They differ only in start-line
  // ranges, which is the tiebreaker the fix relies on.
  const newGroups: readonly CloneGroup[] = [
    makeCloneGroup({
      members: ['modules/y/a.ts:5:14', 'modules/y/b.ts:5:14'],
      lines: 10,
      disposition: 'pending',
      reason: null,
      tokenFingerprint: 'collision-low-frag',
    }),
    makeCloneGroup({
      members: ['modules/y/a.ts:60:69', 'modules/y/b.ts:60:69'],
      lines: 10,
      disposition: 'pending',
      reason: null,
      tokenFingerprint: 'collision-high-frag',
    }),
  ];

  const result = migrateGroups(newGroups, oldGroups);
  if (result.unmapped.length !== 0) {
    return fail(
      'migration collision deterministic tiebreaker',
      `expected 0 unmapped; got ${result.unmapped.length} (${result.unmapped
        .map((g) => g.id)
        .join(', ')}) — collision silently dropped a disposition`,
    );
  }
  if (result.newOnly.length !== 0) {
    return fail(
      'migration collision deterministic tiebreaker',
      `expected 0 newOnly; got ${result.newOnly.length} — colliding new entry surfaced as orphan`,
    );
  }
  if (result.idMap.size !== 2) {
    return fail(
      'migration collision deterministic tiebreaker',
      `expected 2 idMap entries; got ${result.idMap.size}`,
    );
  }
  // The smallest-startLine old (members starting at 1) must map to the
  // smallest-startLine new (members starting at 5). Lookup by sorted
  // members[0] startLine ordering, not by id (the ids are content-
  // derived and unstable across fixture edits).
  const lowNew = newGroups.find((g) => g.members[0]?.endsWith(':5:14'));
  const highNew = newGroups.find((g) => g.members[0]?.endsWith(':60:69'));
  if (lowNew === undefined || highNew === undefined) {
    return fail('migration collision deterministic tiebreaker', 'fixture builder returned wrong members');
  }
  const mappedLow = result.idMap.get('old-collide-low');
  const mappedHigh = result.idMap.get('old-collide-high');
  if (mappedLow !== lowNew.id) {
    return fail(
      'migration collision deterministic tiebreaker',
      `old-collide-low should map to low-start new (${lowNew.id}); got ${String(mappedLow)}`,
    );
  }
  if (mappedHigh !== highNew.id) {
    return fail(
      'migration collision deterministic tiebreaker',
      `old-collide-high should map to high-start new (${highNew.id}); got ${String(mappedHigh)}`,
    );
  }
  return pass(
    'migration collision deterministic tiebreaker',
    '2 colliding old entries matched 2 colliding new entries by smallest-startLine; 0 unmapped, 0 newOnly',
  );
}

/**
 * Scenario: two new candidates with IDENTICAL members (same paths AND
 * same start/end lines). compareShiftCandidates returns 0 for them, so
 * there is no deterministic signal to pick one over the other. The
 * matcher must throw MigrationError at index-build time rather than
 * silently picking.
 *
 * We synthesize this by making two new groups with the same members[]
 * but different tokenFingerprints (so their content-hashed ids differ
 * and they are otherwise distinct CloneGroup values). In practice this
 * shape can only arise if jscpd somehow emits two duplicates pointing
 * at the same line range with different normalised content — extremely
 * rare, but the migrator must fail loudly when it does happen rather
 * than picking randomly.
 */
export function scenarioCollisionIdenticalDiscriminatorFails(): ScenarioResult {
  const oldGroup = makeOldGroup({
    id: 'old-identical',
    members: ['modules/z/a.ts:1:10', 'modules/z/b.ts:1:10'],
    reason: 'identical-discriminator fixture',
  });
  // Both new entries have IDENTICAL members[]. Only their fingerprints
  // (and therefore their derived ids) differ. The matcher has no
  // line-based signal to discriminate them.
  const sharedMembers = ['modules/z/a.ts:5:14', 'modules/z/b.ts:5:14'];
  const newA = makeCloneGroup({
    members: sharedMembers,
    lines: 10,
    disposition: 'pending',
    reason: null,
    tokenFingerprint: 'identical-frag-a',
  });
  const newB = makeCloneGroup({
    members: sharedMembers,
    lines: 10,
    disposition: 'pending',
    reason: null,
    tokenFingerprint: 'identical-frag-b',
  });
  if (newA.id === newB.id) {
    return fail(
      'migration collision identical-discriminator fails',
      'fixture builder produced colliding ids; tokenFingerprint should have prevented that',
    );
  }
  try {
    migrateGroups([newA, newB], [oldGroup]);
  } catch (err) {
    if (err instanceof MigrationError) {
      const msg = err.message;
      if (!msg.includes('IDENTICAL members') || !msg.includes(newA.id) || !msg.includes(newB.id)) {
        return fail(
          'migration collision identical-discriminator fails',
          `MigrationError thrown but message is missing expected content: ${msg}`,
        );
      }
      return pass(
        'migration collision identical-discriminator fails',
        'MigrationError thrown with both candidate ids when discriminators are identical',
      );
    }
    return fail(
      'migration collision identical-discriminator fails',
      `expected MigrationError; got ${err instanceof Error ? err.constructor.name : typeof err}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
  return fail(
    'migration collision identical-discriminator fails',
    'expected MigrationError; migrateGroups returned without throwing — silent pick is the failure mode',
  );
}

/**
 * Scenario: generalised collision. 5 old entries + 5 new candidates all
 * sharing the same bare-file-pair + lines key, with distinct startLines.
 * The fixed matcher must match all 5 deterministically by startLine
 * order: zero unmapped, zero newOnly, 5 idMap entries.
 */
export function scenarioCollisionNCandidates(): ScenarioResult {
  const oldGroups: CloneGroup[] = [];
  const newGroups: CloneGroup[] = [];
  // Five distinct start-line ranges, well-separated so no overlap.
  const starts = [1, 100, 200, 300, 400];
  for (let i = 0; i < 5; i += 1) {
    const oldStart = starts[i];
    if (oldStart === undefined) continue;
    const oldEnd = oldStart + 9;
    oldGroups.push(
      makeOldGroup({
        id: `old-N-${i}`,
        members: [`modules/w/a.ts:${oldStart}:${oldEnd}`, `modules/w/b.ts:${oldStart}:${oldEnd}`],
        reason: `N-candidate fixture index ${i}`,
      }),
    );
    // New entries shift relative to old (e.g. old [1..10] -> new [11..20]),
    // simulating a tree-wide line shift that preserves the duplication
    // signature but rewrites every line range.
    const newStart = oldStart + 10;
    const newEnd = newStart + 9;
    newGroups.push(
      makeCloneGroup({
        members: [`modules/w/a.ts:${newStart}:${newEnd}`, `modules/w/b.ts:${newStart}:${newEnd}`],
        lines: 10,
        disposition: 'pending',
        reason: null,
        tokenFingerprint: `N-frag-${i}`,
      }),
    );
  }
  const result = migrateGroups(newGroups, oldGroups);
  if (result.unmapped.length !== 0) {
    return fail(
      'migration collision N-candidate',
      `expected 0 unmapped; got ${result.unmapped.length} (${result.unmapped
        .map((g) => g.id)
        .join(', ')})`,
    );
  }
  if (result.newOnly.length !== 0) {
    return fail(
      'migration collision N-candidate',
      `expected 0 newOnly; got ${result.newOnly.length}`,
    );
  }
  if (result.idMap.size !== 5) {
    return fail(
      'migration collision N-candidate',
      `expected 5 idMap entries; got ${result.idMap.size}`,
    );
  }
  // Verify the order is monotonic: old-N-0 -> smallest-start new,
  // old-N-4 -> largest-start new. The tiebreaker is startLine ascending
  // (smaller-start wins), and old entries are consumed in iteration
  // order — but since old startLines are also monotonically ascending,
  // the resulting mapping must follow the same monotonic order.
  for (let i = 0; i < 5; i += 1) {
    const expectedNew = newGroups[i];
    const mapped = result.idMap.get(`old-N-${i}`);
    if (expectedNew === undefined || mapped !== expectedNew.id) {
      return fail(
        'migration collision N-candidate',
        `old-N-${i} should map to new[${i}] (${expectedNew?.id ?? '<none>'}); got ${String(mapped)}`,
      );
    }
  }
  return pass(
    'migration collision N-candidate',
    '5 colliding old entries matched 5 colliding new entries deterministically by ascending startLine',
  );
}
