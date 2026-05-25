/**
 * tools/scope-discovery/adopter-manifests.tracked-holdouts-scenarios.ts
 *
 * Adversarial-validator scenarios specifically targeting the AUDIT-
 * 20260522-06 failure mode: the T6.2 adopter-manifest schema's
 * `exceptions:` field collapsed two semantically distinct cases —
 * permanent opt-outs (the file legitimately shouldn't adopt) and
 * deferred-but-known holdouts (the file IS a holdout, with an open
 * follow-up to fix it). The only way to keep the gate green when a
 * known migration was pending was to list the file as a permanent
 * exception, which hid the work-to-do count AND made the editor-
 * symmetry matrix render `✓` for editors with unsilenced-but-
 * acknowledged holdouts.
 *
 * The fix:
 *   - `AdopterManifestEntry` gains optional `trackedHoldouts:
 *     TrackedHoldout[]` (each with `path` + `issue` URL + `reason`).
 *   - Scanner partitions expected files into three buckets:
 *     exceptions, tracked-holdouts, regular candidates. Only
 *     `holdouts` (the third bucket's failures-to-import) are findings.
 *   - Report emits tracked-holdouts in a separate section; gate exits
 *     0 when only tracked-holdouts remain.
 *   - Schema enforces: non-empty issue URL/ref, path matches at least
 *     one glob, path cannot appear in BOTH exceptions and
 *     tracked_holdouts.
 *
 * Lives in a sibling module to keep `adopter-manifests.scenarios.ts`
 * under the 300-500 line cap mandated by ~/work/CLAUDE.md. Reuses the
 * shared fixture helpers from `adopter-manifests.fixtures.ts` (DRY:
 * no duplicate mkdtemp / writeFile boilerplate).
 */

import {
  SOURCE_PAYLOADS,
  args,
  cleanup,
  fail,
  makeFixture,
  pass,
  runScanner,
  writeRegistry,
  writeSource,
  type ScenarioResult,
} from './adopter-manifests.fixtures.js';

// ---------------------------------------------------------------------------
// Fixture payloads
// ---------------------------------------------------------------------------

const TRACKED_HOLDOUT_MIXED_REGISTRY = `adopter_manifests:
  - id: slide-drawer-promotion
    introduced_in: deadbeef
    from: '@/components/SlideDrawer'
    expected_adopters_glob:
      - 'modules/roland-sxx0-editor/src/**/*Editor*.tsx'
    tracked_holdouts:
      - path: modules/roland-sxx0-editor/src/DeferredEditor.tsx
        issue: 'https://github.com/audiocontrol-org/audiocontrol/issues/450'
        reason: |
          pending ROLAND-BUGFIX-V3-IMPORT — v3 SlideDrawer migration deferred.
    message: |
      Replace the per-editor inline drawer with @/components/SlideDrawer.
`;

const TRACKED_HOLDOUT_ONLY_REGISTRY = `adopter_manifests:
  - id: slide-drawer-promotion
    introduced_in: deadbeef
    from: '@/components/SlideDrawer'
    expected_adopters_glob:
      - 'modules/akai-s3k-editor/src/**/*Dialog*.tsx'
    tracked_holdouts:
      - path: modules/akai-s3k-editor/src/LibraryDialogA.tsx
        issue: 'https://github.com/audiocontrol-org/audiocontrol/issues/451'
        reason: pending follow-up A.
      - path: modules/akai-s3k-editor/src/LibraryDialogB.tsx
        issue: 'https://github.com/audiocontrol-org/audiocontrol/issues/451'
        reason: pending follow-up B.
    message: |
      Migrate library dialogs to @/components/SlideDrawer chrome.
`;

const TRACKED_HOLDOUT_MISSING_ISSUE_REGISTRY = `adopter_manifests:
  - id: slide-drawer-promotion
    introduced_in: deadbeef
    from: '@/components/SlideDrawer'
    expected_adopters_glob:
      - 'modules/roland-sxx0-editor/src/**/*Editor*.tsx'
    tracked_holdouts:
      - path: modules/roland-sxx0-editor/src/DeferredEditor.tsx
        reason: |
          oops, no issue field at all.
    message: |
      Replace inline drawer with @/components/SlideDrawer.
`;

const TRACKED_HOLDOUT_OUT_OF_GLOB_REGISTRY = `adopter_manifests:
  - id: slide-drawer-promotion
    introduced_in: deadbeef
    from: '@/components/SlideDrawer'
    expected_adopters_glob:
      - 'modules/roland-sxx0-editor/src/**/*Editor*.tsx'
    tracked_holdouts:
      - path: somewhere/else/Unrelated.tsx
        issue: 'https://github.com/audiocontrol-org/audiocontrol/issues/450'
        reason: |
          path is outside any glob; entry is inert.
    message: |
      Replace inline drawer with @/components/SlideDrawer.
`;

const TRACKED_HOLDOUT_DUAL_DISPOSITION_REGISTRY = `adopter_manifests:
  - id: slide-drawer-promotion
    introduced_in: deadbeef
    from: '@/components/SlideDrawer'
    expected_adopters_glob:
      - 'modules/roland-sxx0-editor/src/**/*Editor*.tsx'
    exceptions:
      - path: modules/roland-sxx0-editor/src/ConflictedEditor.tsx
        reason: |
          listed as permanent opt-out here, but also tracked-holdout below.
    tracked_holdouts:
      - path: modules/roland-sxx0-editor/src/ConflictedEditor.tsx
        issue: 'https://github.com/audiocontrol-org/audiocontrol/issues/450'
        reason: |
          listed as tracked-holdout AND as exception — contradiction.
    message: |
      Replace inline drawer with @/components/SlideDrawer.
`;

// ---------------------------------------------------------------------------
// AUDIT-20260525-20 fixture payloads — `issue:` made optional when
// `reason:` is substantive. Six scenarios prove the parser:
//   (a) accepts the existing URL/#-prefix shape (happy path A);
//   (b) accepts an issue-less entry with a >= 80-char substantive reason
//       (happy path B — the new degree of freedom);
//   (c) rejects an issue-less entry with an empty / too-short reason;
//   (d) rejects an issue-less entry with a placeholder/gaming reason
//       ("deferred", "TODO", "see issue");
//   (e) preserves backward compatibility for #-prefixed shape;
//   (f) gutted-stub self-check proves the substantive-reason rejection
//       has teeth (the rejection scenarios fail under a no-op stub).
// ---------------------------------------------------------------------------

// Happy path B: issue-less entry; reason >= 80 chars + carries the
// (what / why / unlock) trio. Should PASS as a tracked-holdout (gate
// exits 0, deferred entry surfaces in the dedicated report section).
const TRACKED_HOLDOUT_NO_ISSUE_SUBSTANTIVE_REGISTRY = `adopter_manifests:
  - id: slide-drawer-promotion
    introduced_in: deadbeef
    from: '@/components/SlideDrawer'
    expected_adopters_glob:
      - 'modules/akai-s3k-editor/src/**/*Dialog*.tsx'
    tracked_holdouts:
      - path: modules/akai-s3k-editor/src/LibraryDialogA.tsx
        reason: |
          akai LibraryDialogA still uses inline lifecycle state instead of
          the canonical useExportDialogLifecycle hook. Migration deferred
          pending state-contract harmonization between roland's lifecycle
          shape and akai's SteppedProgressDrawer call-site state. Unlocks
          when the shared state interface lands in editor-core (Phase 3+).
    message: |
      Migrate library dialogs to @/components/SlideDrawer chrome.
`;

// Reject C: issue-less entry; reason empty. Should REJECT at parse time
// with the substantive-reason error naming the offending entry context.
// Note: `requireString` rejects empty `reason:` at the top of the
// parser, so the failure surfaces as a missing-non-empty-string error
// rather than the substantive-reason error specifically. Either rejects
// the entry — the scenario asserts that the parser does NOT accept the
// shape, which is the load-bearing semantic for AUDIT-20260525-20.
const TRACKED_HOLDOUT_NO_ISSUE_EMPTY_REASON_REGISTRY = `adopter_manifests:
  - id: slide-drawer-promotion
    introduced_in: deadbeef
    from: '@/components/SlideDrawer'
    expected_adopters_glob:
      - 'modules/akai-s3k-editor/src/**/*Dialog*.tsx'
    tracked_holdouts:
      - path: modules/akai-s3k-editor/src/LibraryDialogA.tsx
        reason: ''
    message: |
      Migrate library dialogs.
`;

// Reject D-1: issue-less entry; reason is the gaming phrase "deferred".
// Should REJECT with the substantive-reason error naming the gaming
// phrase + the (what / why / unlock) expansion guidance.
const TRACKED_HOLDOUT_NO_ISSUE_GAMED_REASON_REGISTRY = `adopter_manifests:
  - id: slide-drawer-promotion
    introduced_in: deadbeef
    from: '@/components/SlideDrawer'
    expected_adopters_glob:
      - 'modules/akai-s3k-editor/src/**/*Dialog*.tsx'
    tracked_holdouts:
      - path: modules/akai-s3k-editor/src/LibraryDialogA.tsx
        reason: 'deferred'
    message: |
      Migrate library dialogs.
`;

// Reject D-2: issue-less entry; reason is short (< 80 chars) but not on
// the gaming-phrase list. Should REJECT with the length-based
// substantive-reason error so the operator knows to expand it.
const TRACKED_HOLDOUT_NO_ISSUE_SHORT_REASON_REGISTRY = `adopter_manifests:
  - id: slide-drawer-promotion
    introduced_in: deadbeef
    from: '@/components/SlideDrawer'
    expected_adopters_glob:
      - 'modules/akai-s3k-editor/src/**/*Dialog*.tsx'
    tracked_holdouts:
      - path: modules/akai-s3k-editor/src/LibraryDialogA.tsx
        reason: 'A short reason under eighty chars — not substantive.'
    message: |
      Migrate library dialogs.
`;

// Backward-compat: hash-prefix shape (the pre-AUDIT-20 form). Must
// continue to PASS even after the schema amendment so the v3-import
// closure entries + other existing hash-ref shapes keep working.
const TRACKED_HOLDOUT_HASH_ISSUE_REGISTRY = `adopter_manifests:
  - id: slide-drawer-promotion
    introduced_in: deadbeef
    from: '@/components/SlideDrawer'
    expected_adopters_glob:
      - 'modules/akai-s3k-editor/src/**/*Dialog*.tsx'
    tracked_holdouts:
      - path: modules/akai-s3k-editor/src/LibraryDialogA.tsx
        issue: '#audit-20260522-06-followup'
        reason: short reason allowed because issue carries the tracker ref.
    message: |
      Migrate library dialogs.
`;

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

async function scenarioTrackedHoldoutNotAFinding(): Promise<ScenarioResult> {
  const name = 'tracked-holdout-not-a-finding';
  const fixture = await makeFixture('tracked-mixed');
  try {
    await writeRegistry(fixture, TRACKED_HOLDOUT_MIXED_REGISTRY);
    // Deferred file: in tracked_holdouts; must NOT surface as a finding.
    await writeSource(
      fixture,
      'modules/roland-sxx0-editor/src/DeferredEditor.tsx',
      SOURCE_PAYLOADS.HOLDOUT,
    );
    // Real holdout: not deferred; must surface as a finding → exit 1.
    await writeSource(
      fixture,
      'modules/roland-sxx0-editor/src/RealHoldoutEditor.tsx',
      SOURCE_PAYLOADS.HOLDOUT,
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 1) {
      return fail(
        name,
        `expected exit 1 (one real holdout present); got ${run.code}; stdout=${run.stdout}`,
      );
    }
    // RealHoldoutEditor.tsx MUST appear under the holdouts: section.
    if (!run.stdout.includes('RealHoldoutEditor.tsx')) {
      return fail(
        name,
        `RealHoldoutEditor.tsx should still surface as a holdout finding; got: ${run.stdout}`,
      );
    }
    // DeferredEditor.tsx MUST NOT appear in the holdouts list (where each
    // line ends with "no import matches ..."). It MUST appear under the
    // tracked-holdouts section instead.
    const holdoutFindingLine =
      `DeferredEditor.tsx — no import matches @/components/SlideDrawer`;
    if (run.stdout.includes(holdoutFindingLine)) {
      return fail(
        name,
        `DeferredEditor.tsx surfaced as a holdout finding; should be tracked-only; got: ${run.stdout}`,
      );
    }
    if (!run.stdout.includes('tracked holdouts (gate-passing, pending follow-up)')) {
      return fail(name, `tracked-holdouts section missing; got: ${run.stdout}`);
    }
    if (!run.stdout.includes('DeferredEditor.tsx')) {
      return fail(
        name,
        `DeferredEditor.tsx should appear under tracked-holdouts section; got: ${run.stdout}`,
      );
    }
    if (!run.stdout.includes('issues/450')) {
      return fail(
        name,
        `tracked-holdout entry should render its issue URL; got: ${run.stdout}`,
      );
    }
    return pass(
      name,
      'tracked-holdout file routed to gate-passing section; real holdout still surfaces as finding',
    );
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioTrackedHoldoutOnlyGatePasses(): Promise<ScenarioResult> {
  const name = 'tracked-holdout-only-gate-passes';
  const fixture = await makeFixture('tracked-only');
  try {
    await writeRegistry(fixture, TRACKED_HOLDOUT_ONLY_REGISTRY);
    await writeSource(
      fixture,
      'modules/akai-s3k-editor/src/LibraryDialogA.tsx',
      SOURCE_PAYLOADS.HOLDOUT,
    );
    await writeSource(
      fixture,
      'modules/akai-s3k-editor/src/LibraryDialogB.tsx',
      SOURCE_PAYLOADS.HOLDOUT,
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 0) {
      return fail(
        name,
        `expected exit 0 (only tracked-holdouts present); got ${run.code}; stdout=${run.stdout}`,
      );
    }
    if (!run.stdout.includes('LibraryDialogA.tsx')) {
      return fail(name, `LibraryDialogA.tsx should appear in tracked section; got: ${run.stdout}`);
    }
    if (!run.stdout.includes('LibraryDialogB.tsx')) {
      return fail(name, `LibraryDialogB.tsx should appear in tracked section; got: ${run.stdout}`);
    }
    if (!run.stdout.includes('2 tracked holdout(s) reported separately')) {
      return fail(
        name,
        `summary line should name the tracked-holdout count; got: ${run.stdout}`,
      );
    }
    return pass(
      name,
      'tracked-holdouts only → gate passes (exit 0); files surfaced in dedicated section',
    );
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioTrackedHoldoutMissingIssue(): Promise<ScenarioResult> {
  const name = 'tracked-holdout-missing-issue-rejected';
  const fixture = await makeFixture('tracked-missing-issue');
  try {
    await writeRegistry(fixture, TRACKED_HOLDOUT_MISSING_ISSUE_REGISTRY);
    await writeSource(
      fixture,
      'modules/roland-sxx0-editor/src/DeferredEditor.tsx',
      SOURCE_PAYLOADS.HOLDOUT,
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 2) {
      return fail(
        name,
        `expected exit 2 (registry parse error); got ${run.code}; stderr=${run.stderr}`,
      );
    }
    if (!run.stderr.includes('issue')) {
      return fail(name, `stderr should name the missing 'issue' field; got: ${run.stderr}`);
    }
    return pass(name, 'tracked_holdouts entry without issue → exit 2 + descriptive error');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioTrackedHoldoutPathOutOfGlob(): Promise<ScenarioResult> {
  const name = 'tracked-holdout-path-not-in-glob-rejected';
  const fixture = await makeFixture('tracked-oog');
  try {
    await writeRegistry(fixture, TRACKED_HOLDOUT_OUT_OF_GLOB_REGISTRY);
    await writeSource(
      fixture,
      'modules/roland-sxx0-editor/src/AnyEditor.tsx',
      SOURCE_PAYLOADS.IMPORTING,
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 2) {
      return fail(
        name,
        `expected exit 2 (registry parse error); got ${run.code}; stderr=${run.stderr}`,
      );
    }
    if (!run.stderr.includes('somewhere/else/Unrelated.tsx')) {
      return fail(name, `stderr should name the out-of-glob path; got: ${run.stderr}`);
    }
    return pass(name, 'tracked_holdouts path outside any glob → exit 2 + descriptive error');
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioTrackedHoldoutDualDisposition(): Promise<ScenarioResult> {
  const name = 'tracked-holdout-and-exception-conflict-rejected';
  const fixture = await makeFixture('tracked-conflict');
  try {
    await writeRegistry(fixture, TRACKED_HOLDOUT_DUAL_DISPOSITION_REGISTRY);
    await writeSource(
      fixture,
      'modules/roland-sxx0-editor/src/ConflictedEditor.tsx',
      SOURCE_PAYLOADS.HOLDOUT,
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 2) {
      return fail(
        name,
        `expected exit 2 (registry parse error); got ${run.code}; stderr=${run.stderr}`,
      );
    }
    if (!run.stderr.includes('ConflictedEditor.tsx')) {
      return fail(name, `stderr should name the conflicting path; got: ${run.stderr}`);
    }
    if (!run.stderr.includes('mutually exclusive')) {
      return fail(name, `stderr should explain the mutual-exclusion rule; got: ${run.stderr}`);
    }
    return pass(
      name,
      'path listed in BOTH exceptions and tracked_holdouts → exit 2 + descriptive error',
    );
  } finally {
    await cleanup(fixture);
  }
}

// ---------------------------------------------------------------------------
// AUDIT-20260525-20 scenarios — issue:-optional + substantive-reason
// ---------------------------------------------------------------------------

/**
 * Happy path B (AUDIT-20260525-20): tracked-holdout WITHOUT `issue:` but
 * with a substantive `reason:` (>= 80 chars + carries the what/why/
 * unlock trio). The parser MUST accept this shape; the gate MUST exit
 * 0; the deferred file MUST appear in the tracked-holdouts report
 * section (and NOT under the holdouts: section).
 *
 * This is the new degree of freedom AUDIT-20 added — pre-amendment,
 * any `tracked_holdouts:` entry missing `issue:` was rejected at parse
 * time. The scenario is the load-bearing assertion that the new shape
 * is honored.
 */
async function scenarioTrackedHoldoutNoIssueSubstantiveReason(): Promise<ScenarioResult> {
  const name = 'tracked-holdout-no-issue-substantive-reason-accepted';
  const fixture = await makeFixture('tracked-no-issue-substantive');
  try {
    await writeRegistry(fixture, TRACKED_HOLDOUT_NO_ISSUE_SUBSTANTIVE_REGISTRY);
    await writeSource(
      fixture,
      'modules/akai-s3k-editor/src/LibraryDialogA.tsx',
      SOURCE_PAYLOADS.HOLDOUT,
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 0) {
      return fail(
        name,
        `expected exit 0 (issue-less + substantive-reason → gate passes); ` +
          `got ${run.code}; stderr=${run.stderr}; stdout=${run.stdout}`,
      );
    }
    if (!run.stdout.includes('tracked holdouts (gate-passing, pending follow-up)')) {
      return fail(
        name,
        `tracked-holdouts section missing from report; got: ${run.stdout}`,
      );
    }
    if (!run.stdout.includes('LibraryDialogA.tsx')) {
      return fail(
        name,
        `LibraryDialogA.tsx should appear under tracked-holdouts; got: ${run.stdout}`,
      );
    }
    // The report's per-line render for an issue-less entry MUST omit
    // the " — issue: ..." clause so the operator can tell at a glance
    // whether a navigable tracker artifact exists.
    if (run.stdout.includes('LibraryDialogA.tsx — issue:')) {
      return fail(
        name,
        `report rendered a misleading "issue:" clause for an issue-less entry; got: ${run.stdout}`,
      );
    }
    return pass(
      name,
      'issue-less tracked-holdout with substantive reason accepted; gate exit 0; report omits stale issue clause',
    );
  } finally {
    await cleanup(fixture);
  }
}

/**
 * Reject C (AUDIT-20260525-20): tracked-holdout WITHOUT `issue:` and
 * with an empty `reason:`. Must REJECT at parse time (exit 2) so the
 * operator cannot mask a holdout without any tracking context whatsoever.
 */
async function scenarioTrackedHoldoutNoIssueEmptyReason(): Promise<ScenarioResult> {
  const name = 'tracked-holdout-no-issue-empty-reason-rejected';
  const fixture = await makeFixture('tracked-no-issue-empty');
  try {
    await writeRegistry(fixture, TRACKED_HOLDOUT_NO_ISSUE_EMPTY_REASON_REGISTRY);
    await writeSource(
      fixture,
      'modules/akai-s3k-editor/src/LibraryDialogA.tsx',
      SOURCE_PAYLOADS.HOLDOUT,
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 2) {
      return fail(
        name,
        `expected exit 2 (registry parse error for empty reason); got ${run.code}; ` +
          `stderr=${run.stderr}; stdout=${run.stdout}`,
      );
    }
    if (!run.stderr.includes('reason')) {
      return fail(
        name,
        `stderr should name the offending 'reason' field; got: ${run.stderr}`,
      );
    }
    return pass(
      name,
      'tracked_holdouts entry without issue AND with empty reason → exit 2 + descriptive error',
    );
  } finally {
    await cleanup(fixture);
  }
}

/**
 * Reject D-1 (AUDIT-20260525-20): tracked-holdout WITHOUT `issue:` and
 * with a gaming-phrase `reason:` ("deferred"). Must REJECT at parse
 * time (exit 2) with the substantive-reason error pointing the operator
 * at the what/why/unlock expansion guidance.
 */
async function scenarioTrackedHoldoutNoIssueGamedReason(): Promise<ScenarioResult> {
  const name = 'tracked-holdout-no-issue-gamed-reason-rejected';
  const fixture = await makeFixture('tracked-no-issue-gamed');
  try {
    await writeRegistry(fixture, TRACKED_HOLDOUT_NO_ISSUE_GAMED_REASON_REGISTRY);
    await writeSource(
      fixture,
      'modules/akai-s3k-editor/src/LibraryDialogA.tsx',
      SOURCE_PAYLOADS.HOLDOUT,
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 2) {
      return fail(
        name,
        `expected exit 2 (registry parse error for gaming-phrase reason); ` +
          `got ${run.code}; stderr=${run.stderr}; stdout=${run.stdout}`,
      );
    }
    // Error must name the offending phrase + the substantive-reason rule.
    if (!run.stderr.includes('placeholder phrase')) {
      return fail(
        name,
        `stderr should name the 'placeholder phrase' rejection; got: ${run.stderr}`,
      );
    }
    if (!run.stderr.includes('deferred')) {
      return fail(
        name,
        `stderr should quote the offending phrase; got: ${run.stderr}`,
      );
    }
    return pass(
      name,
      'tracked_holdouts entry with gaming-phrase reason → exit 2 + descriptive error naming the phrase',
    );
  } finally {
    await cleanup(fixture);
  }
}

/**
 * Reject D-2 (AUDIT-20260525-20): tracked-holdout WITHOUT `issue:` and
 * with a short (< 80 chars) but non-placeholder `reason:`. Must REJECT
 * at parse time (exit 2) with the length-based substantive-reason error.
 */
async function scenarioTrackedHoldoutNoIssueShortReason(): Promise<ScenarioResult> {
  const name = 'tracked-holdout-no-issue-short-reason-rejected';
  const fixture = await makeFixture('tracked-no-issue-short');
  try {
    await writeRegistry(fixture, TRACKED_HOLDOUT_NO_ISSUE_SHORT_REASON_REGISTRY);
    await writeSource(
      fixture,
      'modules/akai-s3k-editor/src/LibraryDialogA.tsx',
      SOURCE_PAYLOADS.HOLDOUT,
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 2) {
      return fail(
        name,
        `expected exit 2 (registry parse error for short reason); ` +
          `got ${run.code}; stderr=${run.stderr}; stdout=${run.stdout}`,
      );
    }
    if (!run.stderr.includes('substantive')) {
      return fail(
        name,
        `stderr should name the 'substantive' rule; got: ${run.stderr}`,
      );
    }
    if (!run.stderr.includes('80 chars')) {
      return fail(
        name,
        `stderr should quote the minimum-length threshold; got: ${run.stderr}`,
      );
    }
    return pass(
      name,
      'tracked_holdouts entry with short reason → exit 2 + descriptive error naming the threshold',
    );
  } finally {
    await cleanup(fixture);
  }
}

/**
 * Backward-compat (AUDIT-20260525-20): tracked-holdout WITH `#`-prefix
 * issue and a short reason. Must continue to PASS as before. This
 * scenario protects the pre-amendment shape from accidental
 * over-rejection by the new substantive-reason check.
 */
async function scenarioTrackedHoldoutBackwardCompatHashIssue(): Promise<ScenarioResult> {
  const name = 'tracked-holdout-backward-compat-hash-issue-accepted';
  const fixture = await makeFixture('tracked-hash-issue');
  try {
    await writeRegistry(fixture, TRACKED_HOLDOUT_HASH_ISSUE_REGISTRY);
    await writeSource(
      fixture,
      'modules/akai-s3k-editor/src/LibraryDialogA.tsx',
      SOURCE_PAYLOADS.HOLDOUT,
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 0) {
      return fail(
        name,
        `expected exit 0 (issue-present + short-reason → gate passes); ` +
          `got ${run.code}; stderr=${run.stderr}; stdout=${run.stdout}`,
      );
    }
    if (!run.stdout.includes('#audit-20260522-06-followup')) {
      return fail(
        name,
        `report should render the issue ref when present; got: ${run.stdout}`,
      );
    }
    return pass(
      name,
      '#-prefix issue ref + short reason accepted (backward-compat preserved)',
    );
  } finally {
    await cleanup(fixture);
  }
}

/** All AUDIT-06 + AUDIT-20 tracked-holdouts scenarios in execution order. */
export const TRACKED_HOLDOUTS_SCENARIOS: ReadonlyArray<() => Promise<ScenarioResult>> = [
  scenarioTrackedHoldoutNotAFinding,
  scenarioTrackedHoldoutOnlyGatePasses,
  scenarioTrackedHoldoutMissingIssue,
  scenarioTrackedHoldoutPathOutOfGlob,
  scenarioTrackedHoldoutDualDisposition,
  // AUDIT-20260525-20: issue:-optional + substantive-reason scenarios.
  scenarioTrackedHoldoutNoIssueSubstantiveReason,
  scenarioTrackedHoldoutNoIssueEmptyReason,
  scenarioTrackedHoldoutNoIssueGamedReason,
  scenarioTrackedHoldoutNoIssueShortReason,
  scenarioTrackedHoldoutBackwardCompatHashIssue,
];
