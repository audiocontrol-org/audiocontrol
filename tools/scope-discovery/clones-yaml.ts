/**
 * tools/scope-discovery/clones-yaml.ts
 *
 * Shape, ser/deser, and comparison helpers for
 * docs/scope-discovery/clones.yaml. Used by clone-detector.ts; kept
 * separate so the CLI entry stays under the 300-line cap and so the
 * adversarial validator harness (T2.5) can reuse the same primitives.
 *
 * The yaml shape (common to every entry):
 *
 *   generated_at: 2026-05-21T22:00:00Z
 *   clones:
 *     - id: <12-char hex from sha1(sorted bare paths + jscpd fragment-fingerprint)>
 *       lines: <int>
 *       members:
 *         - <path>:<startLine>:<endLine>          # sorted ascending
 *         - <path>:<startLine>:<endLine>
 *       disposition: pending | keep-with-reason | ignore-with-justification | refactor
 *       reason: <string|null>
 *
 * ID derivation (T7.1) lives in clones-yaml.id.ts; see deriveContentHashedId.
 * The previous scheme hashed the full member strings including the
 * `:start:end` ranges, so any unrelated line-shift adjacent to a known
 * clone group rewrote that group's id and orphaned its disposition. The
 * T7.1 scheme follows the *content* across line shifts: id is derived
 * from sorted bare file-paths plus a sha1 of jscpd's `fragment` text.
 *
 * For `disposition: refactor` entries, five additional fields are
 * required (T5.1, scope-discovery-protocol Phase 5). Schema + rationale
 * + validator live in clones-yaml.refactor.ts; this file consumes them
 * via the discriminated-union variant `RefactorCloneGroup`. The other
 * three dispositions (`pending`, `keep-with-reason`,
 * `ignore-with-justification`) do NOT carry these fields — the schema
 * extension is additive and gated on the `refactor` discriminator.
 *
 * Sort key for the top-level `clones[]` list: `members[0]` ascending
 * lexicographic, then `id` ascending. This produces the most stable
 * diffs across runs because the first member is always the
 * lexicographically smallest path-line tuple in the group.
 *
 * Enforcement layer: this file + clones-yaml.refactor.ts + clones-yaml.id.ts
 * together are the SSOT. clones.yaml has no JSON Schema (the
 * scope-manifest schema covers a different file). The TS discriminated
 * union + runtime guards here are the only enforcement, paired with
 * T5.3's pre-commit gate.
 */

import { stringify as stringifyYaml } from 'yaml';
import {
  RefactorPreconditionError,
  type RefactorPreconditions,
  TESTS_PROOF_SHA_REGEX,
  validateRefactorPreconditions,
} from './clones-yaml.refactor.js';
import {
  deriveContentHashedId,
  extractBarePath,
  sha1HexOfText,
  sortedBarePathsFromMembers,
} from './clones-yaml.id.js';

// Re-export the ID surface so consumers can import everything from
// clones-yaml.js without learning the id-file split. The actual
// definitions live in clones-yaml.id.ts (file-cap split, T7.1).
export { deriveContentHashedId, extractBarePath, sha1HexOfText, sortedBarePathsFromMembers };

// Re-export refactor-precondition surface so consumers can import
// everything from clones-yaml.js without learning the refactor split.
// The actual definitions live in clones-yaml.refactor.ts (file-cap split).
export {
  RefactorPreconditionError,
  TESTS_PROOF_SHA_REGEX,
  validateRefactorPreconditions,
};
export type { RefactorPreconditions };

export type Disposition =
  | 'pending'
  | 'keep-with-reason'
  | 'ignore-with-justification'
  | 'refactor';

/** Common fields on every clone-group entry, regardless of disposition. */
interface CloneGroupBase {
  readonly id: string;
  readonly lines: number;
  readonly members: string[]; // "<path>:<startLine>:<endLine>", sorted
  readonly reason: string | null;
}

interface NonRefactorCloneGroup extends CloneGroupBase {
  readonly disposition: Exclude<Disposition, 'refactor'>;
}

export interface RefactorCloneGroup extends CloneGroupBase, RefactorPreconditions {
  readonly disposition: 'refactor';
}

/**
 * Discriminated union on `disposition`. Consumers MUST narrow before
 * accessing refactor-only fields — that narrowing is what enforces the
 * five required preconditions at compile time across every callsite.
 */
export type CloneGroup = NonRefactorCloneGroup | RefactorCloneGroup;

export interface ClonesYaml {
  readonly generated_at: string;
  readonly clones: CloneGroup[];
}

/**
 * Sort comparator for the top-level clones[] list: by members[0]
 * ascending, then by id ascending. Both inputs are assumed to have
 * pre-sorted `members` arrays (the constructor enforces this).
 */
export function compareCloneGroups(a: CloneGroup, b: CloneGroup): number {
  const a0 = a.members[0] ?? '';
  const b0 = b.members[0] ?? '';
  if (a0 !== b0) return a0 < b0 ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Construct a non-refactor CloneGroup from raw inputs. The members array
 * is sorted here so callers don't have to remember; the id is derived
 * from the sorted bare paths + tokenFingerprint so equivalent groups
 * always hash the same regardless of line shifts (T7.1).
 *
 * All callers must supply both disposition and reason explicitly.
 * Avoids exactOptionalPropertyTypes pitfalls and forces deliberate
 * defaults at each callsite. For `disposition: refactor`, use
 * `makeRefactorCloneGroup` — the five precondition fields are required
 * and this constructor's type excludes that variant.
 */
export function makeCloneGroup(args: {
  members: readonly string[];
  lines: number;
  disposition: Exclude<Disposition, 'refactor'>;
  reason: string | null;
  tokenFingerprint: string;
}): CloneGroup {
  if (args.members.length < 2) {
    throw new Error(
      `makeCloneGroup: a clone group must have at least 2 members (got ${args.members.length}). ` +
        `jscpd's duplicates[] entries are always pairs; if you see this, the input parser is broken.`,
    );
  }
  const sorted = [...args.members].sort();
  const id = deriveContentHashedId({
    sortedBarePaths: sortedBarePathsFromMembers(sorted),
    tokenFingerprint: args.tokenFingerprint,
  });
  return {
    id,
    lines: args.lines,
    members: sorted,
    disposition: args.disposition,
    reason: args.reason,
  };
}

/**
 * Construct a refactor-dispositioned CloneGroup carrying the five
 * required precondition fields. Separate from `makeCloneGroup` so the
 * type system forces callers to supply the preconditions; you cannot
 * accidentally construct a refactor entry without them.
 */
export function makeRefactorCloneGroup(args: {
  members: readonly string[];
  lines: number;
  reason: string | null;
  canonical_side: string;
  canonical_reason: string;
  new_shape_summary?: string;
  tests: readonly string[];
  tests_proof: { readonly sha: string; readonly demonstration: string };
  tokenFingerprint: string;
}): RefactorCloneGroup {
  if (args.members.length < 2) {
    throw new Error(
      `makeRefactorCloneGroup: a clone group must have at least 2 members (got ${args.members.length}).`,
    );
  }
  const sorted = [...args.members].sort();
  const id = deriveContentHashedId({
    sortedBarePaths: sortedBarePathsFromMembers(sorted),
    tokenFingerprint: args.tokenFingerprint,
  });
  const base: RefactorCloneGroup = {
    id,
    lines: args.lines,
    members: sorted,
    disposition: 'refactor',
    reason: args.reason,
    canonical_side: args.canonical_side,
    canonical_reason: args.canonical_reason,
    tests: [...args.tests],
    tests_proof: { ...args.tests_proof },
  };
  // exactOptionalPropertyTypes: only add new_shape_summary key when supplied.
  return args.new_shape_summary !== undefined
    ? { ...base, new_shape_summary: args.new_shape_summary }
    : base;
}

/**
 * Discriminator-only check: returns true iff `g.disposition === 'refactor'`.
 *
 * Full structural validation of the refactor-only fields (canonical_side,
 * canonical_reason, new_shape_summary?, tests, tests_proof) lives in
 * `validateRefactorPreconditions` (clones-yaml.refactor.ts), which is the
 * single source of truth for "what counts as a complete refactor
 * declaration." Use THIS predicate only for type narrowing in code paths
 * where the discriminated union has already been validated at construction
 * — e.g., inside `serializeClonesYaml` (operates on CloneGroup values
 * built via `makeRefactorCloneGroup` or `parseClonesYaml`, both of which
 * call `validateRefactorPreconditions` upstream).
 *
 * Renamed from the old "is-refactor-clone-group" name in T5.1's
 * code-review follow-ups (Fix 3): the old name was misleading because it
 * suggested a structural check that the implementation never performed.
 */
export function hasRefactorDisposition(g: CloneGroup): g is RefactorCloneGroup {
  return g.disposition === 'refactor';
}

// Parse surface re-exports (AUDIT-20260524-14). The actual parse layer
// lives in clones-yaml.parse.ts so this host file stays under the
// 300-500 line cap. Consumers continue to import from clones-yaml.js
// — the split is transparent at every callsite.
export {
  ClonesYamlParseError,
  parseClonesYaml,
  parseClonesYamlDetailed,
  parseClonesYamlStrict,
} from './clones-yaml.parse.js';
export type { ParseClonesYamlResult } from './clones-yaml.parse.js';

/** Serialize a ClonesYaml to deterministic YAML text. */
export function serializeClonesYaml(doc: ClonesYaml): string {
  // yaml library will quote/escape as needed; we pass plain objects so
  // the output is canonical. Clones are sorted before serialization to
  // guarantee diff-stability across runs. Refactor entries carry their
  // five precondition fields after the common fields, in fixed order,
  // so YAML diffs stay readable.
  const sorted = [...doc.clones].sort(compareCloneGroups);
  return stringifyYaml(
    {
      generated_at: doc.generated_at,
      clones: sorted.map((g) => {
        const base = {
          id: g.id,
          lines: g.lines,
          members: g.members,
          disposition: g.disposition,
          reason: g.reason,
        };
        if (!hasRefactorDisposition(g)) return base;
        return {
          ...base,
          canonical_side: g.canonical_side,
          canonical_reason: g.canonical_reason,
          ...(g.new_shape_summary !== undefined
            ? { new_shape_summary: g.new_shape_summary }
            : {}),
          tests: g.tests,
          tests_proof: g.tests_proof,
        };
      }),
    },
    { lineWidth: 0 },
  );
}

/**
 * Comparison between a freshly-detected set of clone groups and a
 * baseline ClonesYaml. Used by the pre-commit gate to decide whether
 * to fail the commit.
 *
 * NEW:     in newClones but not in baseline (by id)
 * DROPPED: in baseline but not in newClones (refactor success)
 *
 * Note: id derives from sorted bare member-paths + jscpd token fingerprint
 * (T7.1). Adding or removing a file from a clone group yields a fresh id
 * (NEW + DROPPED); modifying the duplicated content yields a fresh id
 * (NEW + DROPPED). Adjacent line shifts that leave both the membership
 * and the content unchanged preserve the id — that's the whole point of
 * T7.1. A stable-id growth ("GROWN") is impossible by construction.
 */
export interface CloneDiff {
  readonly newGroups: CloneGroup[];
  readonly droppedGroups: CloneGroup[];
}

export function diffClones(
  newClones: readonly CloneGroup[],
  baseline: ClonesYaml | null,
): CloneDiff {
  const baselineById = new Map<string, CloneGroup>();
  if (baseline !== null) {
    for (const g of baseline.clones) baselineById.set(g.id, g);
  }
  const newById = new Map<string, CloneGroup>();
  for (const g of newClones) newById.set(g.id, g);

  const newGroups: CloneGroup[] = [];
  const droppedGroups: CloneGroup[] = [];

  for (const g of newClones) {
    if (!baselineById.has(g.id)) newGroups.push(g);
  }
  if (baseline !== null) {
    for (const g of baseline.clones) {
      if (!newById.has(g.id)) droppedGroups.push(g);
    }
  }
  return { newGroups, droppedGroups };
}

/**
 * For baseline refresh: carry forward non-pending dispositions from
 * the existing baseline onto matching ids in the new clone list. New
 * groups (id not in baseline) keep their default disposition; baseline
 * groups not in the new list are silently dropped (refactored away).
 *
 * For `disposition: refactor` entries, the five precondition fields
 * (canonical_side, canonical_reason, new_shape_summary?, tests,
 * tests_proof) are carried forward in lockstep with the disposition
 * itself. Refresh never mints new refactor preconditions — operator
 * authored them; tooling preserves them as-is.
 */
export function mergeDispositions(
  newClones: readonly CloneGroup[],
  baseline: ClonesYaml | null,
): CloneGroup[] {
  if (baseline === null) return [...newClones];
  const baselineById = new Map<string, CloneGroup>();
  for (const g of baseline.clones) baselineById.set(g.id, g);
  return newClones.map((g) => {
    const existing = baselineById.get(g.id);
    if (existing === undefined) return g;
    if (existing.disposition === 'pending') return g;
    if (hasRefactorDisposition(existing)) {
      const refreshed: RefactorCloneGroup = {
        id: g.id,
        lines: g.lines,
        members: g.members,
        disposition: 'refactor',
        reason: existing.reason,
        canonical_side: existing.canonical_side,
        canonical_reason: existing.canonical_reason,
        tests: existing.tests,
        tests_proof: existing.tests_proof,
        ...(existing.new_shape_summary !== undefined
          ? { new_shape_summary: existing.new_shape_summary }
          : {}),
      };
      return refreshed;
    }
    return {
      id: g.id,
      lines: g.lines,
      members: g.members,
      disposition: existing.disposition,
      reason: existing.reason,
    };
  });
}
