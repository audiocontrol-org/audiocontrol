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

/** All AUDIT-06 tracked-holdouts scenarios in execution order. */
export const TRACKED_HOLDOUTS_SCENARIOS: ReadonlyArray<() => Promise<ScenarioResult>> = [
  scenarioTrackedHoldoutNotAFinding,
  scenarioTrackedHoldoutOnlyGatePasses,
  scenarioTrackedHoldoutMissingIssue,
  scenarioTrackedHoldoutPathOutOfGlob,
  scenarioTrackedHoldoutDualDisposition,
];
