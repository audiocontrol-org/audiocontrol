/**
 * tools/scope-discovery/refactor-preconditions.smoke-test.ts
 *
 * Smoke-test for the T5.2 acceptance gate:
 *
 *   "A smoke-test dispatch of code-reviewer against a synthetic refactor
 *    commit missing the canonical declaration returns a rejection naming
 *    the missing fields."
 *
 * The smoke-test simulates a code-reviewer dispatch by feeding the
 * `validateRefactorPreconditions` validator (from T5.1) the same kind of
 * raw clone-group entry a reviewer would encounter on a refactor PR. The
 * validator is the mechanical layer the agent prompt at
 * `.claude/agents/code-reviewer.md` §"Refactor preconditions (Phase 5)"
 * is wired to invoke; running it directly proves the protocol's
 * machine-readable enforcement path is intact and that the rejection
 * messages name the missing fields by YAML key.
 *
 * Fixtures cover the operator's MUST HAVE cases:
 *   - Synthetic refactor entry with NO canonical_side / canonical_reason
 *     (the entry that should never pass review).
 *   - Synthetic refactor entry with canonical_side: "new" but no
 *     new_shape_summary (the "design-in-flight" failure mode).
 *   - Synthetic refactor entry with no tests / tests_proof (the
 *     coverage-gap failure mode).
 *   - Happy-path entry with all fields present (must accept).
 *
 * Each fixture asserts the exact rejection text contains the YAML field
 * names — the agent prompts cite the same field names, so a mismatch
 * between the prompt's wording and the validator's rejection would be a
 * silent drift the smoke-test catches.
 *
 * Run via `make check-refactor-preconditions-smoke` or directly via
 * `tsx tools/scope-discovery/refactor-preconditions.smoke-test.ts`.
 */

import { fileURLToPath } from 'node:url';
import {
  validateRefactorPreconditions,
  type RefactorPreconditionsCheck,
} from './clones-yaml.refactor.js';
import { errorMessage } from './util/typeguards.js';

// ---------------------------------------------------------------------------
// Fixture shape
// ---------------------------------------------------------------------------

interface SmokeTestFixture {
  readonly name: string;
  readonly entryId: string;
  readonly rawEntry: Record<string, unknown>;
  readonly expect: 'pass' | 'reject';
  readonly /** Substrings the rejection must contain — one per missing/malformed field. */
    expectErrorSubstrings?: ReadonlyArray<string>;
}

/**
 * The fixtures below are intentionally hand-built (not loaded from
 * clones.yaml) so the smoke-test exercises the same path a reviewer
 * agent would: receive a raw object from a clone-group entry, hand it
 * to the validator, surface the named-field rejection.
 */
const FIXTURES: ReadonlyArray<SmokeTestFixture> = [
  {
    name: 'reject: refactor commit missing canonical_side + canonical_reason + tests + tests_proof',
    entryId: 'abc123def456',
    rawEntry: {
      // disposition: 'refactor' implied — every refactor field is missing.
      // This is the cardinal failure mode: an agent paraphrases the
      // disposition without supplying the safety net.
    },
    expect: 'reject',
    expectErrorSubstrings: [
      "missing or empty 'canonical_side'",
      "missing or empty 'canonical_reason'",
      "'tests' is required",
      "'tests_proof' is required",
    ],
  },
  {
    name: 'reject: refactor with canonical_side: "new" but no new_shape_summary (design-in-flight failure)',
    entryId: 'def456abc789',
    rawEntry: {
      canonical_side: 'new',
      canonical_reason: 'all members predate the regime; new shape needed',
      // new_shape_summary intentionally absent — this is the
      // "shape invented in flight" failure mode the schema catches.
      tests: ['modules/foo/test/unit/bar.test.ts'],
      tests_proof: {
        sha: 'abcdef1',
        demonstration: 'deliberate break of canonical-side fn caused test failure; restored',
      },
    },
    expect: 'reject',
    expectErrorSubstrings: [
      "'new_shape_summary' is required when canonical_side: \"new\"",
    ],
  },
  {
    name: 'reject: refactor with canonical declaration but no tests / tests_proof (coverage-gap failure)',
    entryId: '123456789abc',
    rawEntry: {
      canonical_side: 'modules/foo/Canonical.tsx',
      canonical_reason: 'cited in modules/foo/README.md ADR-007 as the migration target',
      // tests + tests_proof intentionally absent — the operator's MUST
      // HAVE for the test-precondition side of Step 0b.
    },
    expect: 'reject',
    expectErrorSubstrings: [
      "'tests' is required",
      "'tests_proof' is required",
    ],
  },
  {
    name: 'reject: refactor with tests_proof.sha that is not 7-40 hex',
    entryId: 'fedcba987654',
    rawEntry: {
      canonical_side: 'modules/foo/Canonical.tsx',
      canonical_reason: 'cited as canonical in ADR-007',
      tests: ['modules/foo/test/unit/canonical.test.ts'],
      tests_proof: {
        sha: 'not-a-sha',
        demonstration: 'demonstration string is non-empty',
      },
    },
    expect: 'reject',
    expectErrorSubstrings: [
      "'tests_proof.sha' must match",
    ],
  },
  {
    name: 'pass: refactor with all four-branch fields present (canonical_side: <file-path>, tests + proof)',
    entryId: '111222333444',
    rawEntry: {
      canonical_side: 'modules/roland-sxx0-editor/src/components/PatchEditor.tsx',
      canonical_reason:
        'cited in docs/1.0/003-COMPLETE/roland-bugfix/README.md as the regime canonical surface',
      tests: [
        'modules/roland-sxx0-editor/test/ui/patch-editor.spec.ts',
        'make test-ui-roland',
      ],
      tests_proof: {
        sha: '752ba934',
        demonstration:
          'deliberate break of PatchEditor render produced 3 failing assertions; restored at next commit',
      },
    },
    expect: 'pass',
  },
  {
    name: 'pass: refactor with canonical_side: "all" + lifted-primitive plan',
    entryId: '222333444555',
    rawEntry: {
      canonical_side: 'all',
      canonical_reason:
        'all three sites use the post-S550-redesign regime correctly; missing-primitive gap; lift to ac-list-bank-chevron',
      tests: ['make test-ui-roland'],
      tests_proof: {
        sha: 'e510a715',
        demonstration: 'manual chevron-size break caused 7 visual-snapshot failures; restored',
      },
    },
    expect: 'pass',
  },
  {
    name: 'pass: refactor with canonical_side: "new" + new_shape_summary present',
    entryId: '333444555666',
    rawEntry: {
      canonical_side: 'new',
      canonical_reason: 'all four sites predate the .ac-* design system; legacy idioms',
      new_shape_summary:
        'new ac-detail-head primitive with eyebrow + title + hairline composition',
      tests: ['modules/akai-s3k-editor/test/ui/detail-head.spec.ts'],
      tests_proof: {
        sha: '8762ff12',
        demonstration:
          'break detail-head composition caused 4 visual-snapshot failures across editors; restored',
      },
    },
    expect: 'pass',
  },
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function checkRejection(
  fx: SmokeTestFixture,
  result: RefactorPreconditionsCheck,
): boolean {
  if (result.ok) {
    process.stdout.write(`FAIL  ${fx.name} — expected rejection, validator accepted\n`);
    return false;
  }
  const errors = result.errors;
  const expected = fx.expectErrorSubstrings ?? [];
  const missing: string[] = [];
  for (const sub of expected) {
    const found = errors.some((e) => e.includes(sub));
    if (!found) missing.push(sub);
  }
  if (missing.length > 0) {
    process.stdout.write(
      `FAIL  ${fx.name} — rejection text missing expected substring(s):\n` +
        missing.map((s) => `        - ${s}`).join('\n') +
        `\n      actual errors:\n` +
        errors.map((e) => `        - ${e}`).join('\n') +
        `\n`,
    );
    return false;
  }
  process.stdout.write(
    `PASS  ${fx.name} (rejection named ${expected.length} expected field(s))\n`,
  );
  return true;
}

function checkAcceptance(fx: SmokeTestFixture, result: RefactorPreconditionsCheck): boolean {
  if (!result.ok) {
    process.stdout.write(
      `FAIL  ${fx.name} — expected acceptance, validator rejected:\n` +
        result.errors.map((e) => `        - ${e}`).join('\n') +
        `\n`,
    );
    return false;
  }
  process.stdout.write(`PASS  ${fx.name} (accepted)\n`);
  return true;
}

function runOneFixture(fx: SmokeTestFixture): boolean {
  let result: RefactorPreconditionsCheck;
  try {
    result = validateRefactorPreconditions(fx.rawEntry, fx.entryId);
  } catch (err) {
    process.stdout.write(`FAIL  ${fx.name} — validator threw: ${errorMessage(err)}\n`);
    return false;
  }
  if (fx.expect === 'reject') return checkRejection(fx, result);
  return checkAcceptance(fx, result);
}

/**
 * Gutted-logic self-check: simulate a code-reviewer agent that paraphrases
 * the protocol but DOES NOT actually call the validator (the failure mode
 * the agent prompt is designed to prevent). We construct a stand-in
 * "agent" that always returns ACCEPT regardless of the entry's contents,
 * then assert that this stand-in disagrees with the validator on the
 * missing-canonical-declaration fixture. If the stand-in and the
 * validator AGREED, the validator would be gutted.
 *
 * This mirrors the gutted-logic self-checks in
 * dispatch-wrapper.validate.ts and clone-detector.validate.ts.
 */
function guttedReviewerSelfCheck(): boolean {
  const fx = FIXTURES[0]; // The cardinal-missing-fields fixture.
  if (fx === undefined) {
    process.stdout.write('FAIL  gutted-reviewer self-check — fixture array empty\n');
    return false;
  }
  // The "gutted reviewer" always accepts (rubber-stamp).
  const guttedDecision = 'accept' as const;
  const validatorResult = validateRefactorPreconditions(fx.rawEntry, fx.entryId);
  const validatorDecision = validatorResult.ok ? 'accept' : 'reject';
  if (guttedDecision === validatorDecision) {
    process.stdout.write(
      'FAIL  gutted-reviewer self-check — validator agreed with rubber-stamp reviewer (both accepted the missing-fields entry). ' +
        'This means the validator is gutted — the agent prompt cannot rely on it.\n',
    );
    return false;
  }
  process.stdout.write(
    `PASS  gutted-reviewer self-check — validator rejected (${validatorDecision}) where rubber-stamp reviewer accepted (${guttedDecision}); validator is load-bearing\n`,
  );
  return true;
}

function runSmokeTest(): number {
  let passes = 0;
  let total = 0;
  for (const fx of FIXTURES) {
    total += 1;
    if (runOneFixture(fx)) passes += 1;
  }
  total += 1;
  if (guttedReviewerSelfCheck()) passes += 1;
  process.stdout.write(
    `\nSummary: ${passes}/${total} fixtures behaved as expected.\n`,
  );
  return passes === total ? 0 : 1;
}

function isCliEntryPoint(): boolean {
  if (typeof process === 'undefined' || process.argv.length < 2) return false;
  const invoked = process.argv[1];
  if (invoked === undefined) return false;
  return invoked === fileURLToPath(import.meta.url);
}

if (isCliEntryPoint()) {
  try {
    process.exit(runSmokeTest());
  } catch (err) {
    process.stderr.write(`smoke-test crashed: ${errorMessage(err)}\n`);
    process.exit(2);
  }
}
