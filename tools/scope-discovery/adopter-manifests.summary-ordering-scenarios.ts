/**
 * tools/scope-discovery/adopter-manifests.summary-ordering-scenarios.ts
 *
 * Adversarial-validator scenarios specifically targeting the AUDIT-
 * 20260524-13 failure mode: `make check-adopters` previously printed
 * its summary line in the MIDDLE of its output (between the per-
 * manifest counts and the tracked-holdouts detail block). Operators
 * who relied on `make check-adopters | tail -1` to get a clean
 * finding count had to scroll past unrelated noise.
 *
 * The fix:
 *   - The summary line is ALWAYS the LAST non-empty line of stdout.
 *   - The summary line ALWAYS matches the regex
 *       /^adopter-manifests: \d+ holdouts? across \d+ manifest/
 *     so `tail -1` consumers can parse the count without special-
 *     casing the zero-holdouts / tracked-holdouts-present branches.
 *   - `--quiet` suppresses per-manifest details ONLY when there are
 *     ZERO real holdouts; if any real holdouts exist, the full report
 *     prints so the operator sees what to act on.
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

/**
 * Registry with one real-holdout and tracked-holdouts in the same
 * manifest. The shape that originally exposed the audit finding:
 * the per-manifest tracked-holdouts listing visually buried the
 * summary line when it landed mid-output.
 */
const MIXED_REAL_AND_TRACKED_REGISTRY = `adopter_manifests:
  - id: slide-drawer-promotion
    introduced_in: deadbeef
    from: '@/components/SlideDrawer'
    expected_adopters_glob:
      - 'modules/akai-s3k-editor/src/**/*Editor*.tsx'
    tracked_holdouts:
      - path: modules/akai-s3k-editor/src/DeferredEditorA.tsx
        issue: 'https://github.com/audiocontrol-org/audiocontrol/issues/450'
        reason: pending follow-up A.
      - path: modules/akai-s3k-editor/src/DeferredEditorB.tsx
        issue: 'https://github.com/audiocontrol-org/audiocontrol/issues/450'
        reason: pending follow-up B.
    message: |
      Replace the per-editor inline drawer with @/components/SlideDrawer.
`;

/**
 * Registry with only tracked-holdouts (zero real holdouts). The
 * "operator deferred everything; gate passes" shape — the case where
 * `--quiet` should produce a single summary line.
 */
const TRACKED_ONLY_REGISTRY = `adopter_manifests:
  - id: slide-drawer-promotion
    introduced_in: deadbeef
    from: '@/components/SlideDrawer'
    expected_adopters_glob:
      - 'modules/akai-s3k-editor/src/**/*Editor*.tsx'
    tracked_holdouts:
      - path: modules/akai-s3k-editor/src/DeferredEditor.tsx
        issue: 'https://github.com/audiocontrol-org/audiocontrol/issues/450'
        reason: pending follow-up.
    message: |
      Replace the per-editor inline drawer with @/components/SlideDrawer.
`;

/**
 * Registry with one manifest, no exceptions / tracked-holdouts. Used
 * by the default-mode summary-at-end regression guard.
 */
const SIMPLE_REGISTRY = `adopter_manifests:
  - id: slide-drawer-promotion
    introduced_in: deadbeef
    from: '@/components/SlideDrawer'
    expected_adopters_glob:
      - 'modules/akai-s3k-editor/src/**/*Editor*.tsx'
    message: |
      Replace the per-editor inline drawer with @/components/SlideDrawer.
`;

// Regex matching the summary line shape (AUDIT-13 contract).
const SUMMARY_REGEX = /^adopter-manifests: \d+ holdouts? across \d+ manifest/;

/**
 * Return the last non-empty line of `stdout`, or '' if `stdout` is
 * empty / whitespace-only. This is the line `tail -1` would print if
 * stdout ends with a single trailing newline.
 */
function lastNonEmptyLine(stdout: string): string {
  const trimmed = stdout.endsWith('\n') ? stdout.slice(0, -1) : stdout;
  const lines = trimmed.split('\n');
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (line !== undefined && line.length > 0) return line;
  }
  return '';
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

async function scenarioSummaryLineIsLastLine(): Promise<ScenarioResult> {
  const name = 'summary-line-is-last-line';
  const fixture = await makeFixture('summary-last');
  try {
    await writeRegistry(fixture, MIXED_REAL_AND_TRACKED_REGISTRY);
    // Real holdout — keeps the gate at exit 1 and the full report
    // shape (per-manifest details + tracked-holdouts block).
    await writeSource(
      fixture,
      'modules/akai-s3k-editor/src/RealHoldoutEditor.tsx',
      SOURCE_PAYLOADS.HOLDOUT,
    );
    await writeSource(
      fixture,
      'modules/akai-s3k-editor/src/DeferredEditorA.tsx',
      SOURCE_PAYLOADS.HOLDOUT,
    );
    await writeSource(
      fixture,
      'modules/akai-s3k-editor/src/DeferredEditorB.tsx',
      SOURCE_PAYLOADS.HOLDOUT,
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 1) {
      return fail(
        name,
        `expected exit 1 (one real holdout); got ${run.code}; stdout=${run.stdout}`,
      );
    }
    const last = lastNonEmptyLine(run.stdout);
    if (!SUMMARY_REGEX.test(last)) {
      return fail(
        name,
        `last non-empty line should match ${SUMMARY_REGEX}; got: ${JSON.stringify(last)}; full stdout=${run.stdout}`,
      );
    }
    // Sanity: the per-manifest tracked-holdouts listing MUST still appear
    // somewhere in the output (we didn't accidentally drop it).
    if (!run.stdout.includes('DeferredEditorA.tsx')) {
      return fail(name, `tracked-holdouts listing missing; got: ${run.stdout}`);
    }
    return pass(
      name,
      'summary line is the last non-empty stdout line under mixed real+tracked holdouts',
    );
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioQuietModeNoRealHoldouts(): Promise<ScenarioResult> {
  const name = 'quiet-mode-no-real-holdouts';
  const fixture = await makeFixture('quiet-no-real');
  try {
    await writeRegistry(fixture, TRACKED_ONLY_REGISTRY);
    await writeSource(
      fixture,
      'modules/akai-s3k-editor/src/DeferredEditor.tsx',
      SOURCE_PAYLOADS.HOLDOUT,
    );
    const run = await runScanner(args(fixture, ['--quiet']));
    if (run.code !== 0) {
      return fail(
        name,
        `expected exit 0 (only tracked-holdouts present); got ${run.code}; stdout=${run.stdout}`,
      );
    }
    const last = lastNonEmptyLine(run.stdout);
    if (!SUMMARY_REGEX.test(last)) {
      return fail(
        name,
        `quiet-mode summary should match ${SUMMARY_REGEX}; got: ${JSON.stringify(last)}; stdout=${run.stdout}`,
      );
    }
    // Quiet mode in the no-real-holdouts case MUST NOT print the
    // per-manifest detail block. The 'expected adopters:' / 'actual
    // adopters:' / 'tracked holdouts (gate-passing' lines are the
    // detail signatures the operator wants suppressed.
    const detailSignatures = [
      'expected adopters:',
      'actual adopters:',
      'tracked holdouts (gate-passing',
      'manifest=slide-drawer-promotion',
    ];
    for (const sig of detailSignatures) {
      if (run.stdout.includes(sig)) {
        return fail(
          name,
          `--quiet should suppress detail '${sig}' when no real holdouts; got: ${run.stdout}`,
        );
      }
    }
    // Summary tail must surface the tracked-holdout count so the
    // operator still sees there's work pending.
    if (!run.stdout.includes('tracked holdout')) {
      return fail(
        name,
        `quiet summary should still mention tracked holdouts; got: ${run.stdout}`,
      );
    }
    return pass(
      name,
      '--quiet prints summary only (no per-manifest details) when zero real holdouts',
    );
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioQuietModeWithRealHoldouts(): Promise<ScenarioResult> {
  const name = 'quiet-mode-with-real-holdouts';
  const fixture = await makeFixture('quiet-with-real');
  try {
    await writeRegistry(fixture, MIXED_REAL_AND_TRACKED_REGISTRY);
    await writeSource(
      fixture,
      'modules/akai-s3k-editor/src/RealHoldoutEditor.tsx',
      SOURCE_PAYLOADS.HOLDOUT,
    );
    await writeSource(
      fixture,
      'modules/akai-s3k-editor/src/DeferredEditorA.tsx',
      SOURCE_PAYLOADS.HOLDOUT,
    );
    await writeSource(
      fixture,
      'modules/akai-s3k-editor/src/DeferredEditorB.tsx',
      SOURCE_PAYLOADS.HOLDOUT,
    );
    const run = await runScanner(args(fixture, ['--quiet']));
    if (run.code !== 1) {
      return fail(
        name,
        `expected exit 1 (real holdouts present); got ${run.code}; stdout=${run.stdout}`,
      );
    }
    // `--quiet` is overridden when real holdouts exist: the full
    // report MUST print so the operator can act. Detail signatures
    // that quiet mode suppresses in the no-real-holdouts case MUST be
    // present here.
    const requiredDetails = [
      'manifest=slide-drawer-promotion',
      'expected adopters:',
      'actual adopters:',
      'RealHoldoutEditor.tsx',
    ];
    for (const sig of requiredDetails) {
      if (!run.stdout.includes(sig)) {
        return fail(
          name,
          `--quiet should still print '${sig}' when real holdouts exist; stdout=${run.stdout}`,
        );
      }
    }
    const last = lastNonEmptyLine(run.stdout);
    if (!SUMMARY_REGEX.test(last)) {
      return fail(
        name,
        `summary should still be last line even in --quiet override mode; got: ${JSON.stringify(last)}; stdout=${run.stdout}`,
      );
    }
    return pass(
      name,
      '--quiet overridden by real holdouts: full report prints; summary remains last line',
    );
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioDefaultModeSummaryAtEnd(): Promise<ScenarioResult> {
  const name = 'default-mode-summary-still-at-end';
  const fixture = await makeFixture('default-summary');
  try {
    await writeRegistry(fixture, SIMPLE_REGISTRY);
    await writeSource(
      fixture,
      'modules/akai-s3k-editor/src/PatchEditor.tsx',
      SOURCE_PAYLOADS.HOLDOUT,
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 1) {
      return fail(
        name,
        `expected exit 1 (one real holdout); got ${run.code}; stdout=${run.stdout}`,
      );
    }
    const last = lastNonEmptyLine(run.stdout);
    if (!SUMMARY_REGEX.test(last)) {
      return fail(
        name,
        `default-mode last non-empty line should match ${SUMMARY_REGEX}; got: ${JSON.stringify(last)}; stdout=${run.stdout}`,
      );
    }
    // The summary must NOT also appear in the middle of stdout — the
    // operator should see exactly ONE summary line, at the end.
    const matches = run.stdout.split('\n').filter((l) => SUMMARY_REGEX.test(l));
    if (matches.length !== 1) {
      return fail(
        name,
        `expected exactly one summary line; got ${matches.length}: ${JSON.stringify(matches)}; stdout=${run.stdout}`,
      );
    }
    return pass(
      name,
      'default mode emits exactly one summary line, at the end of stdout',
    );
  } finally {
    await cleanup(fixture);
  }
}

/** All AUDIT-13 summary-ordering scenarios in execution order. */
export const SUMMARY_ORDERING_SCENARIOS: ReadonlyArray<() => Promise<ScenarioResult>> = [
  scenarioSummaryLineIsLastLine,
  scenarioQuietModeNoRealHoldouts,
  scenarioQuietModeWithRealHoldouts,
  scenarioDefaultModeSummaryAtEnd,
];
