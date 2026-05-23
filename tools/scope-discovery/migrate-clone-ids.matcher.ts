/**
 * tools/scope-discovery/migrate-clone-ids.matcher.ts
 *
 * Pure two-pass matching kernel for the T7.1 clone-ID migration.
 * Extracted from migrate-clone-ids.ts so the host file stays under the
 * 300-500 line cap after AUDIT-20260522-02's collision-resolution
 * expansion.
 *
 * SSOT for "how an old disposition gets carried onto a new content-hashed
 * ID":
 *
 *   Pass 1 — exact match by full `<path>:<start>:<end>` per member.
 *            Captures every clone group whose line ranges did not shift.
 *
 *   Pass 2 — shift-tolerant match by sorted bare paths + `lines` count.
 *            When multiple new candidates share a key, candidates are
 *            sorted by smallest member's startLine (then by the full
 *            sorted-members tuple) and old entries pick them in that
 *            order, consuming the chosen candidate so subsequent
 *            colliding olds pick the next candidate. If two candidates
 *            have IDENTICAL members (same paths AND same start/end
 *            lines), the matcher throws MigrationError instead of
 *            silently guessing — there is no deterministic signal to
 *            discriminate them.
 *
 * This file owns the pure logic only. The CLI wrapper, jscpd invocation,
 * and YAML writing live in migrate-clone-ids.ts.
 */

import { type CloneGroup, extractBarePath, hasRefactorDisposition } from './clones-yaml.js';

/**
 * Thrown when the pass-2 shift-tolerant matcher encounters two candidate
 * new entries with IDENTICAL members (same bare paths AND same start/end
 * lines), which means no deterministic tiebreaker can distinguish them.
 * Caller surfaces the message; the migration must not silently pick.
 */
export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationError';
  }
}

export interface MigrationResult {
  readonly migratedGroups: CloneGroup[];
  readonly idMap: ReadonlyMap<string, string>;
  readonly unmapped: readonly CloneGroup[];
  readonly newOnly: readonly CloneGroup[];
}

/** Full `<path>:<start>:<end>` sorted tuple joined — pass-1 key. */
function exactMembersKey(group: CloneGroup): string {
  return [...group.members].sort().join('|');
}

/** Sorted bare paths + `#L<lines>` — pass-2 key (shift-tolerant). */
function shiftTolerantKey(group: CloneGroup): string {
  const bare = [...group.members].map(extractBarePath).sort().join('|');
  return `${bare}#L${group.lines}`;
}

/**
 * Parse the `<start>` segment from a `<path>:<start>:<end>` member string.
 * Mirrors extractBarePath's strict shape: throws rather than returning a
 * sentinel value if the suffix doesn't match. Local to the matcher
 * because no other consumer needs raw start lines.
 */
function parseStartLine(member: string): number {
  const lastColon = member.lastIndexOf(':');
  if (lastColon <= 0) {
    throw new Error(`parseStartLine: member "${member}" missing :endLine suffix`);
  }
  const head = member.slice(0, lastColon);
  const secondLastColon = head.lastIndexOf(':');
  if (secondLastColon <= 0) {
    throw new Error(`parseStartLine: member "${member}" missing :startLine:endLine suffix`);
  }
  const raw = head.slice(secondLastColon + 1);
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || raw !== String(n)) {
    throw new Error(`parseStartLine: member "${member}" has non-integer startLine "${raw}"`);
  }
  return n;
}

/** Smallest start-line across a group's members. Pass-2 primary tiebreaker. */
function smallestStartLine(group: CloneGroup): number {
  let smallest = Number.POSITIVE_INFINITY;
  for (const m of group.members) {
    const startLine = parseStartLine(m);
    if (startLine < smallest) smallest = startLine;
  }
  return smallest;
}

/**
 * Compare two candidate groups for deterministic pass-2 ordering:
 * primary key is smallestStartLine ascending (the documented tiebreaker);
 * secondary key is the full sorted-members tuple (so candidates with the
 * same smallest start-line but different end-lines or other members are
 * still ordered deterministically). Two candidates compare equal iff
 * their members tuples are identical — that case is the
 * IDENTICAL-discriminator failure mode the migrator refuses to guess at.
 */
function compareShiftCandidates(a: CloneGroup, b: CloneGroup): number {
  const sa = smallestStartLine(a);
  const sb = smallestStartLine(b);
  if (sa !== sb) return sa < sb ? -1 : 1;
  const ka = exactMembersKey(a);
  const kb = exactMembersKey(b);
  if (ka !== kb) return ka < kb ? -1 : 1;
  return 0;
}

/**
 * Carry an old entry's disposition forward onto a new entry. New entry
 * keeps its (freshly-derived) id; everything else (`disposition`,
 * `reason`, and refactor-only fields when present) comes from old.
 */
function carryForward(newGroup: CloneGroup, oldGroup: CloneGroup): CloneGroup {
  if (hasRefactorDisposition(oldGroup)) {
    return {
      id: newGroup.id,
      lines: newGroup.lines,
      members: newGroup.members,
      disposition: 'refactor',
      reason: oldGroup.reason,
      canonical_side: oldGroup.canonical_side,
      canonical_reason: oldGroup.canonical_reason,
      tests: oldGroup.tests,
      tests_proof: oldGroup.tests_proof,
      ...(oldGroup.new_shape_summary !== undefined
        ? { new_shape_summary: oldGroup.new_shape_summary }
        : {}),
    };
  }
  return {
    id: newGroup.id,
    lines: newGroup.lines,
    members: newGroup.members,
    disposition: oldGroup.disposition,
    reason: oldGroup.reason,
  };
}

/**
 * Match old entries to new entries in two passes (see file header for
 * the full algorithm). Pure function: no I/O, no jscpd, no side effects.
 *
 * Throws MigrationError when pass-2 candidates are not deterministically
 * distinguishable; callers must let the error propagate so the operator
 * decides how to disambiguate rather than the migration silently
 * dropping a disposition.
 */
export function migrateGroups(
  newGroups: readonly CloneGroup[],
  oldGroups: readonly CloneGroup[],
): MigrationResult {
  // Pass-1 index: by exact full-member-string key. Exact keys are
  // guaranteed unique per new group (jscpd never emits duplicate full
  // <path>:<start>:<end> tuples), so a flat Map is correct.
  const newByExact = new Map<string, CloneGroup>();
  for (const g of newGroups) newByExact.set(exactMembersKey(g), g);

  // Pass-2 index: by shift-tolerant key. Multiple new entries can share
  // the same key when one file pair contains several distinct duplicated
  // fragments of identical length — the index ACCUMULATES candidates
  // rather than overwriting so the pass-2 matcher can resolve the
  // collision deterministically.
  const newByShift = new Map<string, CloneGroup[]>();
  for (const g of newGroups) {
    const key = shiftTolerantKey(g);
    const bucket = newByShift.get(key);
    if (bucket === undefined) newByShift.set(key, [g]);
    else bucket.push(g);
  }
  // Sort each bucket by the deterministic tiebreaker (smallest startLine,
  // then full sorted-members tuple) and validate that no two candidates
  // share IDENTICAL members. An identical-members pair is unrecoverable:
  // the pass-2 matcher would have no signal to discriminate, so we fail
  // here at index-build time with an actionable error rather than during
  // the per-old-entry loop.
  for (const [key, bucket] of newByShift) {
    bucket.sort(compareShiftCandidates);
    for (let i = 1; i < bucket.length; i += 1) {
      const prev = bucket[i - 1];
      const curr = bucket[i];
      if (prev === undefined || curr === undefined) continue;
      if (compareShiftCandidates(prev, curr) === 0) {
        throw new MigrationError(
          `migrateGroups: shift-tolerant key "${key}" has ${bucket.length} candidates ` +
            `with IDENTICAL members; no deterministic tiebreaker can discriminate. ` +
            `Candidate ids: ${bucket.map((g) => g.id).join(', ')}. ` +
            `Resolve by either (a) changing the source so the candidates' line ranges ` +
            `differ, or (b) deleting one of the new entries before re-running.`,
        );
      }
    }
  }

  // Track which new entries have been claimed and which old entries
  // have been paired. Two passes so exact wins over shift-tolerant.
  const newClaimed = new Set<string>(); // new entry ids
  const idMap = new Map<string, string>();
  const oldByOldId = new Map<string, CloneGroup>();
  for (const g of oldGroups) oldByOldId.set(g.id, g);
  const oldMatched = new Set<string>();

  // Pass 1: exact match.
  for (const oldG of oldGroups) {
    const newMatch = newByExact.get(exactMembersKey(oldG));
    if (newMatch !== undefined && !newClaimed.has(newMatch.id)) {
      newClaimed.add(newMatch.id);
      oldMatched.add(oldG.id);
      idMap.set(oldG.id, newMatch.id);
    }
  }

  // Pass 2: shift-tolerant match (only for un-matched olds). For each
  // colliding key, candidates are consumed in the deterministic order
  // established at index-build time. The first unclaimed candidate in
  // the bucket wins; the next colliding old gets the next candidate.
  for (const oldG of oldGroups) {
    if (oldMatched.has(oldG.id)) continue;
    const bucket = newByShift.get(shiftTolerantKey(oldG));
    if (bucket === undefined) continue;
    const chosen = bucket.find((c) => !newClaimed.has(c.id));
    if (chosen === undefined) continue;
    newClaimed.add(chosen.id);
    oldMatched.add(oldG.id);
    idMap.set(oldG.id, chosen.id);
  }

  // Build the migrated list: for each new entry, either carry forward
  // the matching old disposition or keep it as-is (default pending).
  const migrated: CloneGroup[] = [];
  const newOnly: CloneGroup[] = [];
  // Invert idMap to find old by new.
  const oldByNewId = new Map<string, string>();
  for (const [oldId, newId] of idMap) oldByNewId.set(newId, oldId);

  for (const g of newGroups) {
    const oldId = oldByNewId.get(g.id);
    if (oldId === undefined) {
      newOnly.push(g);
      migrated.push(g);
      continue;
    }
    const oldG = oldByOldId.get(oldId);
    if (oldG === undefined) {
      // Defensive: shouldn't happen because idMap was populated from oldGroups.
      newOnly.push(g);
      migrated.push(g);
      continue;
    }
    migrated.push(carryForward(g, oldG));
  }

  const unmapped: CloneGroup[] = [];
  for (const g of oldGroups) {
    if (!oldMatched.has(g.id)) unmapped.push(g);
  }

  return { migratedGroups: migrated, idMap, unmapped, newOnly };
}
