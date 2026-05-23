/**
 * tools/scope-discovery/clone-detector.refactor-scenarios.ts
 *
 * Adversarial-validator scenarios covering the refactor-precondition
 * schema extension (T5.1, scope-discovery-protocol Phase 5). Extracted
 * from clone-detector.validate.ts so that file stays under the 300-500
 * line cap.
 *
 * Each scenario tests `parseClonesYaml` directly against a hand-crafted
 * YAML payload. We bypass the jscpd subprocess here on purpose:
 *
 *   - The schema extension is a parser-level invariant. Driving jscpd
 *     just to produce a baseline with one refactor entry would add 90+s
 *     of subprocess time per scenario without exercising anything the
 *     parser tests don't already cover.
 *   - Hand-crafted YAML lets each scenario target exactly one missing
 *     field, which is the failure mode the gate is built to catch. A
 *     real-jscpd run gives no control over which fields appear.
 *   - Per the CLAUDE.md DRY rule: tests run at the layer they catch the
 *     bug. Refactor-precondition bugs surface at parse time; the test
 *     belongs at the parse-time layer.
 *
 * The seven scenarios:
 *
 *   1. canonical_side: <file-path>      happy path  — parser accepts
 *   2. canonical_side: "all"            happy path  — parser accepts
 *   3. canonical_side: "new"            happy path + missing-new_shape_summary rejection
 *   4. missing 'tests' field            rejection   — parser throws RefactorPreconditionError
 *   5. malformed tests[] element        rejection   — non-string in tests[] is rejected by index
 *   6. malformed tests_proof.sha        rejection   — non-hex sha is rejected
 *   7. missing canonical_reason field   rejection   — required field absent
 *
 * Each scenario returns the same ScenarioResult shape the host
 * harness emits to stdout.
 */

import {
  parseClonesYaml,
  RefactorPreconditionError,
  hasRefactorDisposition,
} from './clones-yaml.js';

export interface RefactorScenarioResult {
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
}

function pass(name: string, detail: string): RefactorScenarioResult {
  return { name, passed: true, detail };
}

function fail(name: string, detail: string): RefactorScenarioResult {
  return { name, passed: false, detail };
}

/**
 * Build a baseline-shaped YAML payload with ONE refactor entry whose
 * precondition fields are spelled out by the caller. The fields_yaml
 * fragment is interpolated AFTER `disposition: refactor` so the caller
 * controls exactly which precondition fields appear (or are omitted).
 *
 * Indentation matches what `parseYaml` from the `yaml` library produces
 * for nested members; the fields_yaml argument supplies its own
 * 4-space leading indent per line.
 */
function buildRefactorBaselineYaml(fields_yaml: string): string {
  return [
    'generated_at: 2026-05-22T00:00:00.000Z',
    'clones:',
    '  - id: abc123def456',
    '    lines: 12',
    '    members:',
    '      - modules/x/file-a.ts:1:12',
    '      - modules/x/file-b.ts:1:12',
    '    disposition: refactor',
    '    reason: T5.1 fixture — operator-authored refactor disposition',
    fields_yaml,
    '',
  ].join('\n');
}

/**
 * Scenario 1: canonical_side as a concrete <file-path>. Represents the
 * "one side has a documented regime; others are holdouts" case from
 * the PRD. Parser must accept and produce a RefactorCloneGroup with all
 * five precondition fields populated.
 */
export function scenarioCanonicalSideFilePath(): RefactorScenarioResult {
  const yaml = buildRefactorBaselineYaml(
    [
      '    canonical_side: modules/x/file-a.ts',
      '    canonical_reason: file-a.ts already uses the documented regime; file-b.ts is the holdout',
      '    tests:',
      '      - modules/x/test/file-a.regime.test.ts',
      '    tests_proof:',
      '      sha: a1b2c3d',
      '      demonstration: file-b.ts call site returned legacy shape before extracting; test pinned it',
    ].join('\n'),
  );
  let parsed;
  try {
    parsed = parseClonesYaml(yaml);
  } catch (err) {
    return fail(
      'canonical_side: <file-path> happy path',
      `parseClonesYaml threw unexpectedly: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (parsed === null) {
    return fail('canonical_side: <file-path> happy path', 'parseClonesYaml returned null');
  }
  if (parsed.clones.length !== 1) {
    return fail(
      'canonical_side: <file-path> happy path',
      `expected exactly 1 clone group; got ${parsed.clones.length}`,
    );
  }
  const group = parsed.clones[0];
  if (group === undefined || !hasRefactorDisposition(group)) {
    return fail(
      'canonical_side: <file-path> happy path',
      `expected refactor variant; got disposition=${group?.disposition ?? 'undefined'}`,
    );
  }
  if (group.canonical_side !== 'modules/x/file-a.ts') {
    return fail(
      'canonical_side: <file-path> happy path',
      `canonical_side mismatch: ${group.canonical_side}`,
    );
  }
  return pass(
    'canonical_side: <file-path> happy path',
    'parser accepted refactor entry with file-path canonical_side; all 5 fields present',
  );
}

/**
 * Scenario 2: canonical_side: "all". Represents the "missing-primitive
 * gap" case (e.g. the PageTitleRow extraction). new_shape_summary is
 * NOT required when canonical_side is "all" — parser must accept
 * without it.
 */
export function scenarioCanonicalSideAll(): RefactorScenarioResult {
  const yaml = buildRefactorBaselineYaml(
    [
      '    canonical_side: all',
      '    canonical_reason: both files are correctly migrated; duplication is a missing-primitive gap',
      '    tests:',
      '      - pnpm --filter @audiocontrol/roland-sxx0-editor test:ui',
      '    tests_proof:',
      '      sha: 1234567890abcdef',
      '      demonstration: both sides currently render correctly; extraction must preserve identical output',
    ].join('\n'),
  );
  let parsed;
  try {
    parsed = parseClonesYaml(yaml);
  } catch (err) {
    return fail(
      'canonical_side: "all" happy path',
      `parseClonesYaml threw unexpectedly: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (parsed === null || parsed.clones.length !== 1) {
    return fail(
      'canonical_side: "all" happy path',
      `expected 1 clone group; got ${parsed === null ? 'null' : parsed.clones.length}`,
    );
  }
  const group = parsed.clones[0];
  if (group === undefined || !hasRefactorDisposition(group)) {
    return fail(
      'canonical_side: "all" happy path',
      `expected refactor variant; got ${group?.disposition ?? 'undefined'}`,
    );
  }
  if (group.canonical_side !== 'all') {
    return fail(
      'canonical_side: "all" happy path',
      `canonical_side mismatch: expected "all"; got ${group.canonical_side}`,
    );
  }
  if (group.new_shape_summary !== undefined) {
    return fail(
      'canonical_side: "all" happy path',
      `new_shape_summary must be absent when canonical_side: "all"; got ${group.new_shape_summary}`,
    );
  }
  return pass(
    'canonical_side: "all" happy path',
    'parser accepted "all" without new_shape_summary; refactor variant emitted',
  );
}

/**
 * Scenario 3a: canonical_side: "new" with `new_shape_summary` populated.
 * Parser must accept.
 *
 * Scenario 3b: canonical_side: "new" with `new_shape_summary` MISSING.
 * Parser must throw RefactorPreconditionError naming the missing field.
 *
 * Both halves run inside this one scenario so a regression on either
 * arm fails the gate.
 */
export function scenarioCanonicalSideNew(): RefactorScenarioResult {
  // 3a: happy path
  const happyYaml = buildRefactorBaselineYaml(
    [
      '    canonical_side: new',
      '    canonical_reason: no side is canonical; both call sites diverge from the documented design',
      '    new_shape_summary: extract a CommonRow primitive accepting label + value + trailing-action slots',
      '    tests:',
      '      - modules/x/test/common-row.test.ts',
      '    tests_proof:',
      '      sha: 0123abc4567',
      '      demonstration: neither side currently renders the trailing-action slot; new primitive adds it',
    ].join('\n'),
  );
  let parsed;
  try {
    parsed = parseClonesYaml(happyYaml);
  } catch (err) {
    return fail(
      'canonical_side: "new" happy path + missing-new_shape_summary rejection',
      `happy-path parseClonesYaml threw unexpectedly: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (parsed === null || parsed.clones.length !== 1) {
    return fail(
      'canonical_side: "new" happy path + missing-new_shape_summary rejection',
      `happy-path expected 1 clone group; got ${parsed === null ? 'null' : parsed.clones.length}`,
    );
  }
  const group = parsed.clones[0];
  if (group === undefined || !hasRefactorDisposition(group)) {
    return fail(
      'canonical_side: "new" happy path + missing-new_shape_summary rejection',
      `happy-path expected refactor variant; got ${group?.disposition ?? 'undefined'}`,
    );
  }
  if (group.new_shape_summary === undefined || group.new_shape_summary.length === 0) {
    return fail(
      'canonical_side: "new" happy path + missing-new_shape_summary rejection',
      'happy-path new_shape_summary should be populated when canonical_side: "new"',
    );
  }
  // 3b: missing new_shape_summary — must reject
  const rejectYaml = buildRefactorBaselineYaml(
    [
      '    canonical_side: new',
      '    canonical_reason: no side is canonical — both diverge from the design',
      '    tests:',
      '      - modules/x/test/common-row.test.ts',
      '    tests_proof:',
      '      sha: 0123abc4567',
      '      demonstration: neither side currently renders the trailing-action slot',
    ].join('\n'),
  );
  let threw = false;
  let errMsg = '';
  try {
    parseClonesYaml(rejectYaml);
  } catch (err) {
    threw = true;
    if (err instanceof RefactorPreconditionError) {
      errMsg = err.message;
    } else {
      errMsg = err instanceof Error ? err.message : String(err);
    }
  }
  if (!threw) {
    return fail(
      'canonical_side: "new" happy path + missing-new_shape_summary rejection',
      'rejection-arm: parseClonesYaml accepted canonical_side: "new" WITHOUT new_shape_summary',
    );
  }
  if (!errMsg.includes('new_shape_summary')) {
    return fail(
      'canonical_side: "new" happy path + missing-new_shape_summary rejection',
      `rejection-arm: error did not name 'new_shape_summary': ${errMsg}`,
    );
  }
  return pass(
    'canonical_side: "new" happy path + missing-new_shape_summary rejection',
    'happy path accepted with summary; missing-summary rejected by name',
  );
}

/**
 * Scenario 4: missing `tests` field on a refactor entry. Parser must
 * throw RefactorPreconditionError naming the missing field. This is
 * the test-precondition arm from feature/roland-bugfix tooling-feedback:
 * a refactor disposition without proven regression-detection coverage
 * is the failure mode this rule names.
 */
export function scenarioMissingTestsField(): RefactorScenarioResult {
  // canonical_side + canonical_reason + tests_proof present; tests omitted
  const yaml = buildRefactorBaselineYaml(
    [
      '    canonical_side: modules/x/file-a.ts',
      '    canonical_reason: file-a.ts is canonical; file-b.ts is the holdout',
      '    tests_proof:',
      '      sha: deadbeef',
      '      demonstration: holdout call sites return legacy shape; test must pin the regression',
    ].join('\n'),
  );
  let threw = false;
  let errMsg = '';
  let isExpectedClass = false;
  try {
    parseClonesYaml(yaml);
  } catch (err) {
    threw = true;
    if (err instanceof RefactorPreconditionError) {
      isExpectedClass = true;
      errMsg = err.message;
    } else {
      errMsg = err instanceof Error ? err.message : String(err);
    }
  }
  if (!threw) {
    return fail(
      'missing-tests rejection',
      'parseClonesYaml accepted refactor entry without tests field',
    );
  }
  if (!isExpectedClass) {
    return fail(
      'missing-tests rejection',
      `parser threw but not RefactorPreconditionError: ${errMsg}`,
    );
  }
  if (!errMsg.includes("'tests'") && !errMsg.includes(' tests ')) {
    return fail('missing-tests rejection', `error did not name 'tests' field: ${errMsg}`);
  }
  return pass(
    'missing-tests rejection',
    "parser threw RefactorPreconditionError naming 'tests' field",
  );
}

/**
 * Common adversarial-rejection helper. Each of the post-scenario-4 cases
 * follows the same shape: hand a malformed YAML to parseClonesYaml and
 * assert that (a) it throws, (b) the throw is RefactorPreconditionError,
 * and (c) the error message names the expected field. Centralising the
 * scaffolding keeps the per-scenario bodies focused on the YAML payload
 * + the specific field-name needle.
 */
function assertRefactorRejection(
  name: string,
  yaml: string,
  needle: string,
): RefactorScenarioResult {
  let threw = false;
  let isExpectedClass = false;
  let errMsg = '';
  try {
    parseClonesYaml(yaml);
  } catch (err) {
    threw = true;
    if (err instanceof RefactorPreconditionError) {
      isExpectedClass = true;
      errMsg = err.message;
    } else {
      errMsg = err instanceof Error ? err.message : String(err);
    }
  }
  if (!threw) {
    return fail(name, `parseClonesYaml accepted malformed entry; expected rejection naming ${needle}`);
  }
  if (!isExpectedClass) {
    return fail(name, `parser threw but not RefactorPreconditionError: ${errMsg}`);
  }
  if (!errMsg.includes(needle)) {
    return fail(name, `error did not name ${needle}: ${errMsg}`);
  }
  return pass(name, `parser threw RefactorPreconditionError naming ${needle}`);
}

/**
 * Scenario 5: malformed tests[] element. Refactor entry has tests as a
 * list with one valid string + one non-string (number) element. Parser
 * must reject and name the offending index. Catches the failure mode
 * where an operator hand-edits a tests entry and accidentally drops the
 * quotes around a numeric-looking test id ("42" → 42).
 */
export function scenarioMalformedTestsElement(): RefactorScenarioResult {
  const yaml = buildRefactorBaselineYaml(
    [
      '    canonical_side: modules/x/file-a.ts',
      '    canonical_reason: file-a.ts is canonical; file-b.ts is the holdout',
      '    tests:',
      '      - 42',
      '      - modules/x/test/valid-test.ts',
      '    tests_proof:',
      '      sha: a1b2c3d',
      '      demonstration: holdout call sites return legacy shape; test pins the regression',
    ].join('\n'),
  );
  return assertRefactorRejection(
    'malformed tests[] element rejection',
    yaml,
    'tests[0]',
  );
}

/**
 * Scenario 6: malformed tests_proof.sha. Refactor entry has every field
 * populated correctly EXCEPT tests_proof.sha contains non-hex characters
 * ("ZZZZZZZ"). Parser must reject and reference the SHA regex. Catches
 * the failure mode where an operator pastes a placeholder or accidentally
 * types a non-hex string into the sha field.
 */
export function scenarioBadTestsProofSha(): RefactorScenarioResult {
  const yaml = buildRefactorBaselineYaml(
    [
      '    canonical_side: modules/x/file-a.ts',
      '    canonical_reason: file-a.ts is canonical; file-b.ts is the holdout',
      '    tests:',
      '      - modules/x/test/valid-test.ts',
      '    tests_proof:',
      '      sha: ZZZZZZZ',
      '      demonstration: holdout call sites return legacy shape; test pins the regression',
    ].join('\n'),
  );
  return assertRefactorRejection(
    'bad tests_proof.sha rejection',
    yaml,
    'tests_proof.sha',
  );
}

/**
 * Scenario 7: missing canonical_reason. Refactor entry has canonical_side
 * populated but canonical_reason omitted entirely. Parser must reject and
 * name the missing field. Catches the failure mode where an operator
 * declares "which side wins" but forgets to record "why" — exactly the
 * deferral pattern the precondition schema is built to prevent.
 */
export function scenarioMissingCanonicalReason(): RefactorScenarioResult {
  const yaml = buildRefactorBaselineYaml(
    [
      '    canonical_side: all',
      '    tests:',
      '      - modules/x/test/valid-test.ts',
      '    tests_proof:',
      '      sha: a1b2c3d',
      '      demonstration: both sides currently render correctly; extraction must preserve identical output',
    ].join('\n'),
  );
  return assertRefactorRejection(
    'missing canonical_reason rejection',
    yaml,
    'canonical_reason',
  );
}
