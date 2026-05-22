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
 *     - id: <12-char hex from sha1(sorted-members joined with \n)>
 *       lines: <int>
 *       members:
 *         - <path>:<startLine>:<endLine>          # sorted ascending
 *         - <path>:<startLine>:<endLine>
 *       disposition: pending | keep-with-reason | ignore-with-justification | refactor
 *       reason: <string|null>
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
 * Enforcement layer: this file + clones-yaml.refactor.ts together are
 * the SSOT. clones.yaml has no JSON Schema (the scope-manifest schema
 * covers a different file). The TS discriminated union + runtime guards
 * here are the only enforcement, paired with T5.3's pre-commit gate.
 */

import { createHash } from 'node:crypto';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { isPlainObject } from './util/typeguards.js';
import {
  RefactorPreconditionError,
  type RefactorPreconditions,
  TESTS_PROOF_SHA_REGEX,
  validateRefactorPreconditions,
} from './clones-yaml.refactor.js';

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

const DISPOSITIONS: readonly Disposition[] = [
  'pending',
  'keep-with-reason',
  'ignore-with-justification',
  'refactor',
];

function isDisposition(v: unknown): v is Disposition {
  return typeof v === 'string' && (DISPOSITIONS as readonly string[]).includes(v);
}

/**
 * Stable id from the sorted member-strings. SHA-1 of the joined list,
 * truncated to 12 hex chars — long enough to make accidental collisions
 * across ~530 groups vanishingly unlikely, short enough to be a usable
 * label in the yaml.
 */
export function deriveCloneId(sortedMembers: readonly string[]): string {
  const hash = createHash('sha1');
  hash.update(sortedMembers.join('\n'));
  return hash.digest('hex').slice(0, 12);
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
 * from the sorted form so equivalent groups always hash the same.
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
}): CloneGroup {
  if (args.members.length < 2) {
    throw new Error(
      `makeCloneGroup: a clone group must have at least 2 members (got ${args.members.length}). ` +
        `jscpd's duplicates[] entries are always pairs; if you see this, the input parser is broken.`,
    );
  }
  const sorted = [...args.members].sort();
  return {
    id: deriveCloneId(sorted),
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
}): RefactorCloneGroup {
  if (args.members.length < 2) {
    throw new Error(
      `makeRefactorCloneGroup: a clone group must have at least 2 members (got ${args.members.length}).`,
    );
  }
  const sorted = [...args.members].sort();
  const base: RefactorCloneGroup = {
    id: deriveCloneId(sorted),
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

/**
 * Parse a previously-written clones.yaml. Returns null when the file
 * shape is fundamentally wrong (top-level keys missing, members not a
 * string array, etc.) — we treat malformed yaml as "no baseline" so the
 * next run can rewrite it cleanly via --refresh-baseline.
 *
 * EXCEPTION: when an entry has `disposition: refactor` but is missing
 * any of the five required precondition fields (canonical_side,
 * canonical_reason, tests, tests_proof, and new_shape_summary when
 * canonical_side: "new"), we THROW a `RefactorPreconditionError`. The
 * refactor disposition is operator-authored — silently dropping a
 * malformed refactor entry would let an incomplete declaration ship
 * past the gate. The throw surfaces the missing fields by entry id so
 * the operator can fix the declaration explicitly.
 */
export function parseClonesYaml(yamlText: string): ClonesYaml | null {
  const parsed: unknown = parseYaml(yamlText);
  if (!isPlainObject(parsed)) return null;
  const generatedAt = parsed['generated_at'];
  const clones = parsed['clones'];
  if (typeof generatedAt !== 'string') return null;
  if (!Array.isArray(clones)) return null;
  const out: CloneGroup[] = [];
  const refactorErrors: string[] = [];
  for (const entry of clones) {
    const result = entryToGroup(entry);
    if (result.kind === 'shape-error') return null;
    if (result.kind === 'refactor-error') {
      refactorErrors.push(...result.errors);
      continue;
    }
    out.push(result.group);
  }
  if (refactorErrors.length > 0) {
    throw new RefactorPreconditionError(refactorErrors);
  }
  return { generated_at: generatedAt, clones: out };
}

type EntryResult =
  | { kind: 'ok'; group: CloneGroup }
  | { kind: 'shape-error' }
  | { kind: 'refactor-error'; errors: readonly string[] };

function entryToGroup(entry: unknown): EntryResult {
  if (!isPlainObject(entry)) return { kind: 'shape-error' };
  const id = entry['id'];
  const lines = entry['lines'];
  const members = entry['members'];
  const disposition = entry['disposition'];
  const reason = entry['reason'];
  // Legacy `tokens` field (pre-fix) is silently ignored if present.
  // jscpd's per-pair JSON did not surface token counts, so historical
  // entries had `tokens: 0` — a fabricated default. The field was
  // removed; we tolerate it on read for back-compat with old baselines.
  if (typeof id !== 'string') return { kind: 'shape-error' };
  if (typeof lines !== 'number') return { kind: 'shape-error' };
  if (!Array.isArray(members)) return { kind: 'shape-error' };
  const memberStrs: string[] = [];
  for (const m of members) {
    if (typeof m !== 'string') return { kind: 'shape-error' };
    memberStrs.push(m);
  }
  if (!isDisposition(disposition)) return { kind: 'shape-error' };
  const reasonValue: string | null =
    reason === null || reason === undefined
      ? null
      : typeof reason === 'string'
        ? reason
        : null;
  // We intentionally do NOT re-derive the id from members here — we
  // trust the on-disk value so operators can hand-edit groups without
  // the tool clobbering their work on the next refresh.
  if (disposition === 'refactor') {
    const preconds = validateRefactorPreconditions(entry, id);
    if (!preconds.ok) {
      return { kind: 'refactor-error', errors: preconds.errors };
    }
    const group: RefactorCloneGroup = {
      id,
      lines,
      members: memberStrs,
      disposition: 'refactor',
      reason: reasonValue,
      canonical_side: preconds.value.canonical_side,
      canonical_reason: preconds.value.canonical_reason,
      tests: preconds.value.tests,
      tests_proof: preconds.value.tests_proof,
      ...(preconds.value.new_shape_summary !== undefined
        ? { new_shape_summary: preconds.value.new_shape_summary }
        : {}),
    };
    return { kind: 'ok', group };
  }
  return {
    kind: 'ok',
    group: {
      id,
      lines,
      members: memberStrs,
      disposition,
      reason: reasonValue,
    },
  };
}

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
 * Note: id derives from sorted-members + line-ranges; any membership or
 * boundary change yields a fresh id (NEW + DROPPED), so a stable-id
 * growth ("GROWN") is impossible by construction. No GROWN bucket.
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
