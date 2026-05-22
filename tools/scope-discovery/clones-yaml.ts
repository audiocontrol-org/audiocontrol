/**
 * tools/scope-discovery/clones-yaml.ts
 *
 * Shape, ser/deser, and comparison helpers for
 * docs/scope-discovery/clones.yaml. Used by clone-detector.ts; kept
 * separate so the CLI entry stays under the 300-line cap and so the
 * adversarial validator harness (T2.5) can reuse the same primitives.
 *
 * The yaml shape:
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
 * Sort key for the top-level `clones[]` list: `members[0]` ascending
 * lexicographic, then `id` ascending. This produces the most stable
 * diffs across runs because the first member is always the
 * lexicographically smallest path-line tuple in the group.
 */

import { createHash } from 'node:crypto';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { isPlainObject } from './util/typeguards.js';

export type Disposition =
  | 'pending'
  | 'keep-with-reason'
  | 'ignore-with-justification'
  | 'refactor';

export interface CloneGroup {
  readonly id: string;
  readonly lines: number;
  readonly members: string[]; // "<path>:<startLine>:<endLine>", sorted
  readonly disposition: Disposition;
  readonly reason: string | null;
}

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
 * Construct a CloneGroup from raw inputs. The members array is sorted
 * here so callers don't have to remember; the id is derived from the
 * sorted form so equivalent groups always hash the same.
 *
 * All callers must supply both disposition and reason explicitly.
 * Avoids exactOptionalPropertyTypes pitfalls and forces deliberate
 * defaults at each callsite.
 */
export function makeCloneGroup(args: {
  members: readonly string[];
  lines: number;
  disposition: Disposition;
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
 * Parse a previously-written clones.yaml. Returns null when the file
 * shape is wrong (we treat malformed yaml as "no baseline" so the next
 * run can rewrite it cleanly via --refresh-baseline; but we never
 * throw the operator into a confusing state — caller logs a warning).
 */
export function parseClonesYaml(yamlText: string): ClonesYaml | null {
  const parsed: unknown = parseYaml(yamlText);
  if (!isPlainObject(parsed)) return null;
  const generatedAt = parsed['generated_at'];
  const clones = parsed['clones'];
  if (typeof generatedAt !== 'string') return null;
  if (!Array.isArray(clones)) return null;
  const out: CloneGroup[] = [];
  for (const entry of clones) {
    const group = entryToGroup(entry);
    if (group === null) return null;
    out.push(group);
  }
  return { generated_at: generatedAt, clones: out };
}

function entryToGroup(entry: unknown): CloneGroup | null {
  if (!isPlainObject(entry)) return null;
  const id = entry['id'];
  const lines = entry['lines'];
  const members = entry['members'];
  const disposition = entry['disposition'];
  const reason = entry['reason'];
  // Legacy `tokens` field (pre-fix) is silently ignored if present.
  // jscpd's per-pair JSON did not surface token counts, so historical
  // entries had `tokens: 0` — a fabricated default. The field was
  // removed; we tolerate it on read for back-compat with old baselines.
  if (typeof id !== 'string') return null;
  if (typeof lines !== 'number') return null;
  if (!Array.isArray(members)) return null;
  const memberStrs: string[] = [];
  for (const m of members) {
    if (typeof m !== 'string') return null;
    memberStrs.push(m);
  }
  if (!isDisposition(disposition)) return null;
  const reasonValue: string | null =
    reason === null || reason === undefined
      ? null
      : typeof reason === 'string'
        ? reason
        : null;
  // We intentionally do NOT re-derive the id from members here — we
  // trust the on-disk value so operators can hand-edit groups without
  // the tool clobbering their work on the next refresh.
  return {
    id,
    lines,
    members: memberStrs,
    disposition,
    reason: reasonValue,
  };
}

/** Serialize a ClonesYaml to deterministic YAML text. */
export function serializeClonesYaml(doc: ClonesYaml): string {
  // yaml library will quote/escape as needed; we pass plain objects so
  // the output is canonical. Clones are sorted before serialization to
  // guarantee diff-stability across runs.
  const sorted = [...doc.clones].sort(compareCloneGroups);
  return stringifyYaml(
    {
      generated_at: doc.generated_at,
      clones: sorted.map((g) => ({
        id: g.id,
        lines: g.lines,
        members: g.members,
        disposition: g.disposition,
        reason: g.reason,
      })),
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
    return {
      ...g,
      disposition: existing.disposition,
      reason: existing.reason,
    };
  });
}
