/**
 * tools/scope-discovery/adopter-manifests.from-list-scenarios.ts
 *
 * Adversarial-validator scenarios specifically targeting the AUDIT-
 * 20260524-08 failure mode (Part A): the T6.2 adopter-manifest `from:`
 * field was a literal string. When a primitive was promoted across
 * modules (e.g., `@/components/common/PageTitleRow` →
 * `@audiocontrol/editor-core`), consumers' new import paths stopped
 * matching the registry's `from:` and the gate produced false
 * holdouts.
 *
 * The fix:
 *   - `from:` may be a single string (back-compat) OR a non-empty
 *     list of non-empty strings.
 *   - `buildImportRegex` OR-combines every listed path; a consumer
 *     importing the primitive via ANY listed path counts as an
 *     adopter.
 *   - Parser rejects: empty array, non-string elements, empty string
 *     elements.
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

const FROM_LIST_REGISTRY = `adopter_manifests:
  - id: page-title-row
    introduced_in: deadbeef
    from:
      - '@audiocontrol/editor-core'
      - '@/components/common/PageTitleRow'
    expected_adopters_glob:
      - 'modules/{roland-sxx0,akai-s3k}-editor/src/**/*Page.tsx'
    message: |
      Replace inline page-title row with PageTitleRow from @audiocontrol/editor-core.
`;

const FROM_STRING_BACKCOMPAT_REGISTRY = `adopter_manifests:
  - id: legacy-from-string
    introduced_in: deadbeef
    from: '@/components/SlideDrawer'
    expected_adopters_glob:
      - 'modules/roland-sxx0-editor/src/**/*Editor*.tsx'
    message: |
      Replace inline drawer with @/components/SlideDrawer.
`;

const FROM_EMPTY_ARRAY_REGISTRY = `adopter_manifests:
  - id: empty-from-array
    introduced_in: deadbeef
    from: []
    expected_adopters_glob:
      - 'modules/roland-sxx0-editor/src/**/*Editor*.tsx'
    message: |
      Replace inline drawer with the canonical primitive.
`;

const FROM_LIST_WITH_EMPTY_STRING_REGISTRY = `adopter_manifests:
  - id: from-with-empty-string
    introduced_in: deadbeef
    from:
      - '@audiocontrol/editor-core'
      - ''
    expected_adopters_glob:
      - 'modules/roland-sxx0-editor/src/**/*Editor*.tsx'
    message: |
      Replace inline drawer with the canonical primitive.
`;

const FROM_LIST_WITH_NON_STRING_REGISTRY = `adopter_manifests:
  - id: from-with-non-string
    introduced_in: deadbeef
    from:
      - '@audiocontrol/editor-core'
      - 42
    expected_adopters_glob:
      - 'modules/roland-sxx0-editor/src/**/*Editor*.tsx'
    message: |
      Replace inline drawer with the canonical primitive.
`;

// Two import-payload variants — one importing via the new canonical
// path, one via the legacy alias. Both should count as adopters when
// the registry's `from:` lists both paths (the relocation case).
const IMPORT_VIA_NEW_PATH =
  "import { PageTitleRow } from '@audiocontrol/editor-core';\n" +
  'export function PatchesPage() { return <PageTitleRow />; }\n';
const IMPORT_VIA_LEGACY_PATH =
  "import { PageTitleRow } from '@/components/common/PageTitleRow';\n" +
  'export function ProgramsPage() { return <PageTitleRow />; }\n';

// ---------------------------------------------------------------------------
// Scenarios — Part A (from-as-list)
// ---------------------------------------------------------------------------

async function scenarioFromAsListDetectsEitherPath(): Promise<ScenarioResult> {
  const name = 'from-as-list-detects-either-path';
  const fixture = await makeFixture('from-list-either');
  try {
    await writeRegistry(fixture, FROM_LIST_REGISTRY);
    // Consumer A imports via the new path — should count as adopter.
    await writeSource(
      fixture,
      'modules/roland-sxx0-editor/src/PatchesPage.tsx',
      IMPORT_VIA_NEW_PATH,
    );
    // Consumer B imports via the legacy path — should also count as adopter.
    await writeSource(
      fixture,
      'modules/akai-s3k-editor/src/ProgramsPage.tsx',
      IMPORT_VIA_LEGACY_PATH,
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 0) {
      return fail(
        name,
        `expected exit 0 (both consumers adopt); got ${run.code}; stdout=${run.stdout}; stderr=${run.stderr}`,
      );
    }
    if (!run.stdout.includes('0 holdouts')) {
      return fail(
        name,
        `expected '0 holdouts' line confirming both consumers adopt; stdout=${run.stdout}`,
      );
    }
    return pass(
      name,
      'multi-path `from:` recognizes adoption via EITHER listed import path → 0 holdouts',
    );
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioFromAsStringBackwardCompat(): Promise<ScenarioResult> {
  const name = 'from-as-string-backward-compat';
  const fixture = await makeFixture('from-string-compat');
  try {
    await writeRegistry(fixture, FROM_STRING_BACKCOMPAT_REGISTRY);
    // Pre-AUDIT-08 shape: `from:` is a single string. Adopter
    // detection MUST still work — the registry parser normalizes
    // string → single-element array internally, but the YAML on disk
    // is unchanged from how operators authored it before AUDIT-08.
    await writeSource(
      fixture,
      'modules/roland-sxx0-editor/src/PatchEditor.tsx',
      SOURCE_PAYLOADS.IMPORTING,
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 0) {
      return fail(
        name,
        `expected exit 0 (string-form back-compat); got ${run.code}; stdout=${run.stdout}; stderr=${run.stderr}`,
      );
    }
    if (!run.stdout.includes('0 holdouts')) {
      return fail(
        name,
        `expected '0 holdouts' for back-compat string-form from:; stdout=${run.stdout}`,
      );
    }
    return pass(
      name,
      'single-string `from:` preserved end-to-end; consumer importing the path counts as adopter',
    );
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioFromEmptyArrayRejected(): Promise<ScenarioResult> {
  const name = 'from-empty-array-rejected';
  const fixture = await makeFixture('from-empty');
  try {
    await writeRegistry(fixture, FROM_EMPTY_ARRAY_REGISTRY);
    await writeSource(
      fixture,
      'modules/roland-sxx0-editor/src/PatchEditor.tsx',
      SOURCE_PAYLOADS.IMPORTING,
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 2) {
      return fail(
        name,
        `expected exit 2 (parse error: empty from list); got ${run.code}; stderr=${run.stderr}`,
      );
    }
    if (!run.stderr.includes('from')) {
      return fail(
        name,
        `stderr should mention 'from' field; got: ${run.stderr}`,
      );
    }
    return pass(
      name,
      'empty `from:` array rejected with descriptive parse error',
    );
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioFromListWithEmptyStringRejected(): Promise<ScenarioResult> {
  const name = 'from-list-with-empty-string-rejected';
  const fixture = await makeFixture('from-empty-element');
  try {
    await writeRegistry(fixture, FROM_LIST_WITH_EMPTY_STRING_REGISTRY);
    await writeSource(
      fixture,
      'modules/roland-sxx0-editor/src/PatchEditor.tsx',
      SOURCE_PAYLOADS.IMPORTING,
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 2) {
      return fail(
        name,
        `expected exit 2 (parse error: empty string element); got ${run.code}; stderr=${run.stderr}`,
      );
    }
    if (!run.stderr.includes('from')) {
      return fail(
        name,
        `stderr should mention 'from' field; got: ${run.stderr}`,
      );
    }
    return pass(
      name,
      'empty string inside `from:` list rejected with descriptive parse error',
    );
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioFromListWithNonStringRejected(): Promise<ScenarioResult> {
  const name = 'from-list-with-non-string-rejected';
  const fixture = await makeFixture('from-non-string');
  try {
    await writeRegistry(fixture, FROM_LIST_WITH_NON_STRING_REGISTRY);
    await writeSource(
      fixture,
      'modules/roland-sxx0-editor/src/PatchEditor.tsx',
      SOURCE_PAYLOADS.IMPORTING,
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 2) {
      return fail(
        name,
        `expected exit 2 (parse error: non-string element); got ${run.code}; stderr=${run.stderr}`,
      );
    }
    if (!run.stderr.includes('from')) {
      return fail(
        name,
        `stderr should mention 'from' field; got: ${run.stderr}`,
      );
    }
    return pass(
      name,
      'non-string element inside `from:` list rejected with descriptive parse error',
    );
  } finally {
    await cleanup(fixture);
  }
}

async function scenarioFromListRelocation(): Promise<ScenarioResult> {
  const name = 'from-relocation-scenario';
  const fixture = await makeFixture('from-relocation');
  try {
    // Synthetic relocation: the primitive's package path changes from
    // an old module-local alias to a new shared-package canonical.
    // Manifest lists BOTH paths so the gate stays green during the
    // transition window — three editors land in different states:
    //  - editor A: already migrated to new path → adopter.
    //  - editor B: still on legacy alias → adopter (during transition).
    //  - editor C: doesn't import either → holdout.
    const RELOCATION_REGISTRY = `adopter_manifests:
  - id: relocated-primitive
    introduced_in: feedface
    from:
      - '@new-package/RelocatedPrimitive'
      - '@/local/RelocatedPrimitive'
    expected_adopters_glob:
      - 'modules/editor-*/src/**/*Page.tsx'
    message: |
      Migrate to '@new-package/RelocatedPrimitive' once your editor lands its scheduled bump.
`;
    await writeRegistry(fixture, RELOCATION_REGISTRY);
    await writeSource(
      fixture,
      'modules/editor-a/src/Page.tsx',
      "import { X } from '@new-package/RelocatedPrimitive';\nexport const A = X;\n",
    );
    await writeSource(
      fixture,
      'modules/editor-b/src/Page.tsx',
      "import { X } from '@/local/RelocatedPrimitive';\nexport const B = X;\n",
    );
    await writeSource(
      fixture,
      'modules/editor-c/src/Page.tsx',
      'export const C = "not adopted";\n',
    );
    const run = await runScanner(args(fixture));
    if (run.code !== 1) {
      return fail(
        name,
        `expected exit 1 (one true holdout); got ${run.code}; stdout=${run.stdout}; stderr=${run.stderr}`,
      );
    }
    // Editor C must surface as the only holdout. Editors A + B must NOT.
    if (!run.stdout.includes('editor-c/src/Page.tsx')) {
      return fail(
        name,
        `editor-c should surface as a holdout; stdout=${run.stdout}`,
      );
    }
    if (run.stdout.includes('editor-a/src/Page.tsx')) {
      return fail(
        name,
        `editor-a imports the NEW canonical and should NOT be a holdout; stdout=${run.stdout}`,
      );
    }
    if (run.stdout.includes('editor-b/src/Page.tsx')) {
      return fail(
        name,
        `editor-b imports the LEGACY alias and should NOT be a holdout during the transition; stdout=${run.stdout}`,
      );
    }
    return pass(
      name,
      'multi-path `from:` recognizes mixed-state transition (new + legacy adopters); only true holdout surfaces',
    );
  } finally {
    await cleanup(fixture);
  }
}

/** All AUDIT-08 from-as-list scenarios in execution order. */
export const FROM_LIST_SCENARIOS: ReadonlyArray<() => Promise<ScenarioResult>> = [
  scenarioFromAsListDetectsEitherPath,
  scenarioFromAsStringBackwardCompat,
  scenarioFromEmptyArrayRejected,
  scenarioFromListWithEmptyStringRejected,
  scenarioFromListWithNonStringRejected,
  scenarioFromListRelocation,
];
