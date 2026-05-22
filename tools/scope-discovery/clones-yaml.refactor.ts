/**
 * tools/scope-discovery/clones-yaml.refactor.ts
 *
 * Refactor-disposition precondition schema for clones.yaml entries
 * (T5.1, scope-discovery-protocol Phase 5). Extracted from
 * clones-yaml.ts so the host file stays under the 300-500 line cap and
 * so T5.3's pre-commit gate can import the validator without pulling
 * in the YAML ser/deser surface.
 *
 * Why these fields are required on `disposition: refactor`:
 *   - canonical_side / canonical_reason: refactor commits that don't
 *     declare which side carries the canonical regime risk silently
 *     downgrading new-regime call sites to legacy semantics ("regime
 *     erasure"). Naming the canonical side forces the deferral
 *     decision the operator would otherwise bury in a code comment.
 *   - new_shape_summary (only when canonical_side: "new"): when no
 *     side is canonical, the refactor designs a brand-new shape; the
 *     design must be named in the disposition record before extraction
 *     begins, otherwise the shape is invented in flight and inherits
 *     whichever side happened to be edited last.
 *   - tests / tests_proof: refactor commits without proven
 *     regression-detection coverage risk silent behavior regression
 *     while the clone count drops. The sha + demonstration pair
 *     anchors the test to a specific failing-then-passing commit pair,
 *     so the disposition record itself proves the safety net exists.
 *
 * Both failure modes were observed on feature/roland-bugfix and
 * surfaced in tooling-feedback.md as MUST-FIX before any refactor
 * disposition lands.
 */

import { isPlainObject } from './util/typeguards.js';

/** SHA regex for tests_proof.sha — partial (>= 7 hex) or full (40 hex). */
export const TESTS_PROOF_SHA_REGEX = /^[0-9a-f]{7,40}$/;

/**
 * canonical_side semantics:
 *   - "<file-path>": one side has a documented regime; that side is
 *     canonical; others are holdouts to migrate to it.
 *   - "all": every side is correctly migrated; the duplication is a
 *     missing-primitive gap (extract common shape, no behavior change
 *     at any consumer).
 *   - "new": no side is canonical; the refactor designs a NEW shape
 *     from scratch. `new_shape_summary` is required in this case so
 *     the design is named before extraction begins.
 *
 * File-existence of <file-path> is NOT checked here (parser stays
 * permissive at the string level); T5.3's pre-commit gate validates
 * the path resolves to a tracked file in the repo.
 */
export interface RefactorPreconditions {
  readonly canonical_side: string;
  readonly canonical_reason: string;
  readonly new_shape_summary?: string;
  readonly tests: readonly string[];
  readonly tests_proof: {
    readonly sha: string;
    readonly demonstration: string;
  };
}

/** Thrown when a parsed entry has `disposition: refactor` but is missing required fields. */
export class RefactorPreconditionError extends Error {
  readonly preconditionErrors: readonly string[];
  constructor(errors: readonly string[]) {
    super(
      `clones.yaml: ${errors.length} refactor precondition error(s):\n  - ` +
        errors.join('\n  - '),
    );
    this.name = 'RefactorPreconditionError';
    this.preconditionErrors = errors;
  }
}

export type RefactorPreconditionsCheck =
  | { readonly ok: true; readonly value: RefactorPreconditions }
  | { readonly ok: false; readonly errors: readonly string[] };

/**
 * Validate a raw entry's refactor preconditions and return either the
 * built RefactorPreconditions object or an array of human-readable error
 * messages naming the entry id + which field is missing/malformed.
 *
 * Exported so T5.3's pre-commit gate can validate manually-edited entries
 * with the same rules used at parse time. Single source of truth for
 * "what counts as a complete refactor declaration."
 */
export function validateRefactorPreconditions(
  entry: Record<string, unknown>,
  id: string,
): RefactorPreconditionsCheck {
  const errors: string[] = [];
  const canonical_side_raw = entry['canonical_side'];
  const canonical_reason_raw = entry['canonical_reason'];
  const new_shape_summary_raw = entry['new_shape_summary'];
  const tests_raw = entry['tests'];
  const tests_proof_raw = entry['tests_proof'];

  // Per-field locals are typed as the validated type OR null. After all
  // checks, if errors.length === 0 every local is guaranteed non-null and
  // we construct the result object from them. This avoids fallback
  // empty-string literals (which CLAUDE.md forbids outside test code)
  // while keeping the parser permissive (collect every error in one pass
  // rather than fail-fast on the first one).
  const canonical_side: string | null =
    typeof canonical_side_raw === 'string' && canonical_side_raw.length > 0
      ? canonical_side_raw
      : null;
  if (canonical_side === null) {
    errors.push(
      `refactor entry ${id}: missing or empty 'canonical_side' ` +
        `(expected <file-path> | "all" | "new")`,
    );
  }
  const canonical_reason: string | null =
    typeof canonical_reason_raw === 'string' && canonical_reason_raw.length > 0
      ? canonical_reason_raw
      : null;
  if (canonical_reason === null) {
    errors.push(`refactor entry ${id}: missing or empty 'canonical_reason'`);
  }
  // new_shape_summary semantics:
  //   - canonical_side === 'new': required, must be non-empty string
  //   - canonical_side !== 'new': optional; if present, must be a
  //     non-empty string. An empty string is rejected in BOTH arms for
  //     consistency (an explicit empty value is a malformed declaration,
  //     not a "no value" signal — omit the field instead).
  let new_shape_summary: string | undefined = undefined;
  if (canonical_side_raw === 'new') {
    if (typeof new_shape_summary_raw !== 'string' || new_shape_summary_raw.length === 0) {
      errors.push(
        `refactor entry ${id}: 'new_shape_summary' is required when canonical_side: "new"`,
      );
    } else {
      new_shape_summary = new_shape_summary_raw;
    }
  } else if (new_shape_summary_raw !== undefined) {
    if (typeof new_shape_summary_raw !== 'string' || new_shape_summary_raw.length === 0) {
      errors.push(
        `refactor entry ${id}: 'new_shape_summary' must be omitted or a non-empty string ` +
          `when canonical_side !== "new"`,
      );
    } else {
      new_shape_summary = new_shape_summary_raw;
    }
  }
  const tests = collectTestStrings(tests_raw, id, errors);
  const tests_proof = collectTestsProof(tests_proof_raw, id, errors);

  if (errors.length > 0) return { ok: false, errors };
  // All non-null guards are guaranteed by the errors.length === 0 gate
  // above. The `!` assertions are load-bearing only as TS-narrowing
  // sugar; if any local is still null here, the error-collection logic
  // above is broken.
  if (canonical_side === null || canonical_reason === null || tests === null || tests_proof === null) {
    throw new Error(
      `validateRefactorPreconditions: internal invariant violated for entry ${id} ` +
        `(errors empty but a per-field local is null)`,
    );
  }
  const result: RefactorPreconditions = {
    canonical_side,
    canonical_reason,
    tests,
    tests_proof,
    ...(new_shape_summary !== undefined ? { new_shape_summary } : {}),
  };
  return { ok: true, value: result };
}

function collectTestStrings(
  tests: unknown,
  id: string,
  errors: string[],
): readonly string[] | null {
  if (!Array.isArray(tests) || tests.length === 0) {
    errors.push(
      `refactor entry ${id}: 'tests' is required and must be a non-empty array ` +
        `of test ids / commands`,
    );
    return null;
  }
  const out: string[] = [];
  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];
    if (typeof t !== 'string' || t.length === 0) {
      errors.push(
        `refactor entry ${id}: tests[${i}] must be a non-empty string (got ${typeof t})`,
      );
      return null;
    }
    out.push(t);
  }
  return out;
}

function collectTestsProof(
  tests_proof: unknown,
  id: string,
  errors: string[],
): { readonly sha: string; readonly demonstration: string } | null {
  if (!isPlainObject(tests_proof)) {
    errors.push(
      `refactor entry ${id}: 'tests_proof' is required and must be an object ` +
        `with 'sha' + 'demonstration'`,
    );
    return null;
  }
  const shaRaw = tests_proof['sha'];
  const demoRaw = tests_proof['demonstration'];
  const sha: string | null =
    typeof shaRaw === 'string' && TESTS_PROOF_SHA_REGEX.test(shaRaw) ? shaRaw : null;
  if (sha === null) {
    errors.push(
      `refactor entry ${id}: 'tests_proof.sha' must match ${TESTS_PROOF_SHA_REGEX.source} ` +
        `(7-40 lowercase hex)`,
    );
  }
  const demonstration: string | null =
    typeof demoRaw === 'string' && demoRaw.length > 0 ? demoRaw : null;
  if (demonstration === null) {
    errors.push(`refactor entry ${id}: 'tests_proof.demonstration' is required and non-empty`);
  }
  if (sha === null || demonstration === null) return null;
  return { sha, demonstration };
}
