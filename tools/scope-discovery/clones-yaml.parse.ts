/**
 * tools/scope-discovery/clones-yaml.parse.ts
 *
 * Parse layer for `docs/scope-discovery/clones.yaml`. Extracted from
 * `clones-yaml.ts` so the host file stays under the 300-500 line cap
 * after AUDIT-20260524-14's strict-parse helpers + structured
 * shape-error reasons + `ClonesYamlParseError` class were added.
 *
 * SSOT for "what counts as a well-formed entry":
 *
 *   - top-level: mapping with `generated_at: string` + `clones: sequence`
 *   - per-entry:
 *       - `id: string`
 *       - `lines: number`
 *       - `members: string[]`
 *       - `disposition` ∈ {pending, keep-with-reason, ignore-with-justification, refactor}
 *       - `reason: string | null` (absent / null tolerated, non-string coerced to null)
 *       - for `disposition: refactor`: the five refactor preconditions
 *         (canonical_side, canonical_reason, new_shape_summary?, tests,
 *         tests_proof) per clones-yaml.refactor.ts
 *
 * Three public entry points serve different callsite needs (AUDIT-14):
 *
 *   parseClonesYaml(text)         → ClonesYaml | null
 *     Lenient — returns null on any shape error. Use ONLY at callsites
 *     that legitimately treat malformed YAML as "no baseline" (the
 *     T7.1 migration script's pre-migration read; the operator has
 *     explicitly opted into a rewrite there).
 *
 *   parseClonesYamlStrict(text)   → ClonesYaml         (throws on shape error)
 *     Strict — throws `ClonesYamlParseError` with a per-entry / per-field
 *     reason. Use at every callsite that reads the production baseline
 *     for COMPARE purposes (clone-detector's `readBaseline`,
 *     check-disposition-survivor's git-show reads). A silent null →
 *     empty-baseline → refresh-write wiped operator dispositions in
 *     AUDIT-14's repro.
 *
 *   parseClonesYamlDetailed(text) → ParseClonesYamlResult
 *     Structured — returns `{ ok: true, doc }` or `{ ok: false, reason }`.
 *     The other two helpers are thin adapters on top of this one. Direct
 *     consumers: callers that need the reason without a throw (none
 *     currently — exposed for symmetry + future use).
 *
 * RefactorPreconditionError propagation is independent of the shape-error
 * path: a refactor entry missing one of the five preconditions throws
 * RefactorPreconditionError from all three entry points (preserves the
 * pre-AUDIT-14 loud-throw contract for that class).
 */

import { parse as parseYaml } from 'yaml';
import {
  RefactorPreconditionError,
  validateRefactorPreconditions,
} from './clones-yaml.refactor.js';
import type { CloneGroup, ClonesYaml, Disposition, RefactorCloneGroup } from './clones-yaml.js';
import { isPlainObject } from './util/typeguards.js';

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
 * Thrown by `parseClonesYamlStrict` when the YAML's shape is wrong
 * (AUDIT-20260524-14). Carries the structured reason from
 * `parseClonesYamlDetailed` so callers can render it without losing
 * the per-entry / per-field detail.
 */
export class ClonesYamlParseError extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(`clones.yaml shape error: ${reason}`);
    this.name = 'ClonesYamlParseError';
    this.reason = reason;
  }
}

/** Discriminated result for the detailed parse path. */
export type ParseClonesYamlResult =
  | { readonly ok: true; readonly doc: ClonesYaml }
  | { readonly ok: false; readonly reason: string };

/**
 * Lenient parse. Returns `null` on shape error (every public callsite
 * that doesn't have a stronger guarantee about the file's provenance
 * still uses this for backward compat). Throws `RefactorPreconditionError`
 * when a refactor entry is malformed.
 */
export function parseClonesYaml(yamlText: string): ClonesYaml | null {
  const result = parseClonesYamlDetailed(yamlText);
  return result.ok ? result.doc : null;
}

/**
 * Strict parse — throws `ClonesYamlParseError` on any shape error
 * (AUDIT-20260524-14). Used by `clone-detector.ts:readBaseline` so a
 * malformed-but-present baseline can no longer collapse to `null` +
 * silently destroy operator dispositions on the next refresh write.
 */
export function parseClonesYamlStrict(yamlText: string): ClonesYaml {
  const result = parseClonesYamlDetailed(yamlText);
  if (!result.ok) {
    throw new ClonesYamlParseError(result.reason);
  }
  return result.doc;
}

/**
 * Detailed parse with structured failure reasons (AUDIT-20260524-14).
 * Surfaces the specific shape-violation cause — top-level key missing,
 * `clones[]` not an array, a per-entry field missing or of wrong type —
 * so callers can render an actionable error instead of the legacy
 * "did not parse as a clones.yaml document" one-liner.
 */
export function parseClonesYamlDetailed(yamlText: string): ParseClonesYamlResult {
  const parsed: unknown = parseYaml(yamlText);
  if (!isPlainObject(parsed)) {
    return { ok: false, reason: 'root is not a mapping' };
  }
  const generatedAt = parsed['generated_at'];
  const clones = parsed['clones'];
  if (typeof generatedAt !== 'string') {
    return { ok: false, reason: '`generated_at` missing or not a string' };
  }
  if (!Array.isArray(clones)) {
    return { ok: false, reason: '`clones` missing or not a sequence' };
  }
  const out: CloneGroup[] = [];
  const refactorErrors: string[] = [];
  for (let i = 0; i < clones.length; i += 1) {
    const entry = clones[i];
    const result = entryToGroup(entry);
    if (result.kind === 'shape-error') {
      return { ok: false, reason: `clones[${i}]: ${result.reason}` };
    }
    if (result.kind === 'refactor-error') {
      refactorErrors.push(...result.errors);
      continue;
    }
    out.push(result.group);
  }
  if (refactorErrors.length > 0) {
    throw new RefactorPreconditionError(refactorErrors);
  }
  return { ok: true, doc: { generated_at: generatedAt, clones: out } };
}

type EntryResult =
  | { kind: 'ok'; group: CloneGroup }
  | { kind: 'shape-error'; reason: string }
  | { kind: 'refactor-error'; errors: readonly string[] };

function entryToGroup(entry: unknown): EntryResult {
  if (!isPlainObject(entry)) {
    return { kind: 'shape-error', reason: 'entry is not a mapping' };
  }
  const id = entry['id'];
  const lines = entry['lines'];
  const members = entry['members'];
  const disposition = entry['disposition'];
  const reason = entry['reason'];
  // Legacy `tokens` field (pre-fix) is silently ignored if present.
  // jscpd's per-pair JSON did not surface token counts, so historical
  // entries had `tokens: 0` — a fabricated default. The field was
  // removed; we tolerate it on read for back-compat with old baselines.
  if (typeof id !== 'string') {
    return { kind: 'shape-error', reason: '`id` missing or not a string' };
  }
  if (typeof lines !== 'number') {
    return { kind: 'shape-error', reason: `id=${id}: \`lines\` missing or not a number` };
  }
  if (!Array.isArray(members)) {
    return { kind: 'shape-error', reason: `id=${id}: \`members\` missing or not a sequence` };
  }
  const memberStrs: string[] = [];
  for (const m of members) {
    if (typeof m !== 'string') {
      return { kind: 'shape-error', reason: `id=${id}: \`members[]\` entry is not a string` };
    }
    memberStrs.push(m);
  }
  if (!isDisposition(disposition)) {
    return {
      kind: 'shape-error',
      reason:
        `id=${id}: \`disposition\` missing or not one of ` +
        `pending|keep-with-reason|ignore-with-justification|refactor ` +
        `(got ${typeof disposition === 'string' ? `"${disposition}"` : typeof disposition})`,
    };
  }
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
