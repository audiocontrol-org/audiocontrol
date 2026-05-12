/**
 * Library import + sample-editing dialog capability specs (Wave 4
 * close-out, #415).
 *
 * Sibling of `library-flows.spec.ts`. Split for the 300-500 line cap;
 * the helper module `library-flows-helpers.ts` is shared.
 *
 * Affordances bound (5):
 *   - D-LIB-12: clicking "Import to Device" on a seeded library-tone
 *     preview mounts `ImportLibraryToneDialog` with the tone metadata
 *     surface visible.
 *   - D-LIB-13: clicking "Import to Device" on a seeded library-patch
 *     preview mounts `ImportLibraryPatchDialog`.
 *   - D-LIB-17: clicking "Open in Loop Editor" on a seeded common-area
 *     sample preview mounts `LoopEditorDialog` with the loop-points
 *     save affordance.
 *   - D-LIB-18: clicking "Open in Editor" on the same sample preview
 *     mounts `SampleEditorDialog` with its editing toolbar.
 *   - D-LIB-19: clicking "Open in Chopper" on the same sample preview
 *     mounts `SampleChopperDialog` with its waveform region.
 *
 * Library-state seeding approach is documented in
 * `library-flows-helpers.ts`. The Decision 3 unblock event (commit
 * 28992738) confirmed the approach: REUSE validated fixtures from
 * `test/e2e/fixtures/` rather than construct YAML in code. Every YAML
 * the helpers write into OPFS is parsed through its matching Zod
 * schema (`ToneYamlSchema`, `PatchYamlSchema`, `SampleYamlSchema`)
 * BEFORE writing, so fixture/schema drift fails the test at seed time
 * with a clear pointer rather than at dialog-mount time as a
 * downstream parse error.
 *
 * Common preconditions across every test:
 *   - Navigate to the library page on the s330 simulated route.
 *   - Cleanup OPFS so the library tree starts empty.
 *   - Seed the fixture(s) the test needs into OPFS.
 *   - Connect the OPFS backend via the LibraryConnectionUI button —
 *     this fires the categoryData load + populates the tree.
 *   - Wait for the tree node corresponding to the seeded fixture to
 *     appear (this is the test's barrier; it proves seed + connect +
 *     refresh round-tripped through real production code paths).
 *   - Click the tree node to set the page-level selection, then click
 *     the preview pane's action button (Import / Open in *) and assert
 *     the target dialog mounted.
 */
import { test, expect } from '@playwright/test';
import {
  LIBRARY_URL,
  cleanupOPFS,
  connectLibraryOPFS,
  seedOPFSTone,
  seedOPFSPatch,
  seedOPFSSample,
} from './library-flows-helpers';

test.describe('Capabilities — Library import + sample-editing dialogs (Wave 4)', () => {
  let pageErrors: string[];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      pageErrors.push(msg.text());
    });

    await page.addInitScript(() => {
      window.localStorage.clear();
    });
  });

  test.afterEach(() => {
    expect(
      pageErrors,
      'no page errors during library dialog interactions',
    ).toEqual([]);
  });

  test('D-LIB-12: clicking "Import to Device" on a seeded library tone mounts ImportLibraryToneDialog', async ({ page }) => {
    // Seed the basic-sine tone fixture (`tones/basic-sine.yaml` +
    // `tones/basic-sine.wav`). The Roland s330 plugin scans
    // `library/s330/tones/` and surfaces each `<name>.yaml` as a tree
    // node with testid `library-tone-<name>`; clicking it maps to a
    // `selection.type === 'individualTone'` state which the preview
    // panel arms with `onImport === onImportIndividualTone`.
    const toneName = 'basic-sine';
    await page.goto(LIBRARY_URL);
    await page.waitForLoadState('networkidle');
    await cleanupOPFS(page);
    await seedOPFSTone(page, { fixtureName: toneName });
    await connectLibraryOPFS(page);

    const toneNode = page.getByTestId(`library-tone-${toneName}`);
    await expect(toneNode).toBeVisible({ timeout: 5_000 });
    await toneNode.click();

    // The library-tone preview renders the "Import to Device" button
    // (`ItemPreviewPanel.tsx:127`, data-testid `import-to-device-button`).
    // Multiple preview rows can carry that testid in this run because
    // we only seed one tone; scope by waiting for the visible button.
    const importButton = page.getByTestId('import-to-device-button');
    await expect(importButton).toBeVisible({ timeout: 5_000 });
    await importButton.click();

    // Mount assertion: dialog title is present AND one of its content-
    // defining affordances renders. We pin the heading + the confirm
    // button rather than just the title, so an empty-but-mounted state
    // (e.g., dialog opened against a missing fixture) wouldn't pass.
    await expect(
      page.getByRole('heading', { name: 'Import Library Tone' }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('confirm-import-button')).toBeVisible();
    // The target-slot select is the canonical interaction affordance —
    // without it the dialog mounted but cannot be used.
    await expect(page.getByTestId('target-slot-select')).toBeVisible();
  });

  test('D-LIB-13: clicking "Import to Device" on a seeded library patch mounts ImportLibraryPatchDialog', async ({ page }) => {
    // Seed the basic-patch fixture as an OPFS directory bundle. The
    // helper aligns the OPFS directory name with the YAML's `name`
    // field (see `seedOPFSPatch` JSDoc for why); the patch-tree
    // detector reads the directory name as `node.id` and the YAML
    // name field as `node.name`, and the selection-mapping fallback
    // walks `node.name` straight back to `loadIndividualPatch`'s
    // directory lookup.
    //
    // The fixture uses `keyGroups` only (no `s330.toneLayer1`), so
    // `getPatchToneDependencies` returns an empty list and the dialog
    // mounts without needing any tones-under-this-patch seeding. That
    // keeps D-LIB-13 a pure mount-only assertion, which is what the
    // inventory entry calls for.
    await page.goto(LIBRARY_URL);
    await page.waitForLoadState('networkidle');
    await cleanupOPFS(page);
    const { patchDirName } = await seedOPFSPatch(page);
    await connectLibraryOPFS(page);

    // TreeView.tsx:258 generates the testid as
    // `library-${type}-${id-slugified}` where `id` is the LibraryTreeNode
    // `id` (path-joined directory name). For our root-level seed,
    // `id === patchDirName`. Slugify by lowercasing + non-alphanumeric
    // collapse so an "id" of "Basic Patch" turns into the testid
    // `library-patch-basic-patch`.
    const testIdSuffix = patchDirName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const patchNode = page.getByTestId(`library-patch-${testIdSuffix}`);
    await expect(patchNode).toBeVisible({ timeout: 5_000 });
    await patchNode.click();

    const importButton = page.getByTestId('import-to-device-button');
    await expect(importButton).toBeVisible({ timeout: 5_000 });
    await importButton.click();

    await expect(
      page.getByRole('heading', { name: 'Import Library Patch' }),
    ).toBeVisible({ timeout: 5_000 });
    // The target-slot select + confirm button are the canonical
    // interaction affordances for the patch import dialog — same
    // shape as the tone dialog (`ImportLibraryPatchDialog.tsx:480` +
    // `:691`).
    await expect(page.getByTestId('target-slot-select')).toBeVisible();
    await expect(page.getByTestId('confirm-import-button')).toBeVisible();
  });

  test('D-LIB-17: clicking "Open in Loop Editor" on a seeded library sample mounts LoopEditorDialog', async ({ page }) => {
    // Seed a common-area sample bundle under
    // `library/common/samples/basic-sine/{sample.yaml, sample.wav}`.
    // The CommonSamplePreviewPanel's "Open in Loop Editor" button
    // (CommonSamplePreviewPanel.tsx:410) triggers
    // `editorDialogs.handleOpenInLoopEditor` with `nodeType='sample'`,
    // which goes through `useEditorDialogsCore.loadWavData` → `loadSample`
    // → decode WAV → set the loop-editor dialog state.
    const sampleName = 'basic-sine';
    await page.goto(LIBRARY_URL);
    await page.waitForLoadState('networkidle');
    await cleanupOPFS(page);
    await seedOPFSSample(page, { fixtureName: sampleName });
    await connectLibraryOPFS(page);

    const sampleNode = page.getByTestId(`library-sample-${sampleName}`);
    await expect(sampleNode).toBeVisible({ timeout: 5_000 });
    await sampleNode.click();

    // The button label comes from CommonSamplePreviewPanel.tsx:413.
    const openLoopButton = page.getByRole('button', { name: 'Open in Loop Editor' });
    await expect(openLoopButton).toBeVisible({ timeout: 5_000 });
    await openLoopButton.click();

    // Mount assertion: the LoopEditor dialog renders its title +
    // its content-defining affordance (the "Save Loop Points" button
    // surfaced only when `onSave` is wired). LoopEditorDialog.tsx:81-95.
    //
    // Scope to the dialog role to disambiguate the dialog's <h2>
    // "Loop Editor" from the embedded LoopEditor component's <h4>
    // "Loop Editor" heading rendered inside the same dialog tree
    // (LoopEditor.tsx:471 + :509).
    const dialog = page.getByRole('dialog', { name: 'Loop Editor' });
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(
      dialog.getByRole('button', { name: 'Save Loop Points' }),
    ).toBeVisible();
  });

  test('D-LIB-18: clicking "Open in Editor" on a seeded library sample mounts SampleEditorDialog', async ({ page }) => {
    // Same seeding as D-LIB-17. The "Open in Editor" button is bound
    // to `editorDialogs.handleOpenInSampleEditor` via the preview
    // panel (CommonSamplePreviewPanel.tsx:425-432).
    const sampleName = 'basic-sine';
    await page.goto(LIBRARY_URL);
    await page.waitForLoadState('networkidle');
    await cleanupOPFS(page);
    await seedOPFSSample(page, { fixtureName: sampleName });
    await connectLibraryOPFS(page);

    const sampleNode = page.getByTestId(`library-sample-${sampleName}`);
    await expect(sampleNode).toBeVisible({ timeout: 5_000 });
    await sampleNode.click();

    const openEditorButton = page.getByRole('button', { name: 'Open in Editor' });
    await expect(openEditorButton).toBeVisible({ timeout: 5_000 });
    await openEditorButton.click();

    // Mount assertion: the SampleEditor dialog renders its title +
    // its editing toolbar (Undo / Redo buttons surfaced unconditionally;
    // SampleEditorDialog.tsx:113-130).
    await expect(
      page.getByRole('heading', { name: 'Sample Editor' }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Redo' })).toBeVisible();
  });

  test('D-LIB-19: clicking "Open in Chopper" on a seeded library sample mounts SampleChopperDialog', async ({ page }) => {
    // Same seeding as D-LIB-17/18. The "Open in Chopper" button is
    // bound to `editorDialogs.handleOpenInChopper` via the preview
    // panel (CommonSamplePreviewPanel.tsx:417-424). The chopper has
    // edit-mode and create-mode; for a fresh sample with no slices in
    // its YAML metadata, the title resolves to "Chop Sample"
    // (SampleChopperDialog.tsx:440).
    const sampleName = 'basic-sine';
    await page.goto(LIBRARY_URL);
    await page.waitForLoadState('networkidle');
    await cleanupOPFS(page);
    await seedOPFSSample(page, { fixtureName: sampleName });
    await connectLibraryOPFS(page);

    const sampleNode = page.getByTestId(`library-sample-${sampleName}`);
    await expect(sampleNode).toBeVisible({ timeout: 5_000 });
    await sampleNode.click();

    const openChopperButton = page.getByRole('button', { name: 'Open in Chopper' });
    await expect(openChopperButton).toBeVisible({ timeout: 5_000 });
    await openChopperButton.click();

    // Mount assertion: the Chopper dialog renders its title + its
    // content-defining affordances.
    //
    // - "Waveform & Slice Preview" label
    //   (SampleChopperDialog.tsx:484-486) is the canonical proof that
    //   the dialog rendered with audio data — without samples, the
    //   inner waveform region would not mount at all.
    // - "Save" button (SampleChopperDialog.tsx:776-787), which the
    //   Roland LibraryPage wires via `onSave={libraryHandle ? ... :
    //   undefined}` whenever OPFS is connected. We don't assert on
    //   the chopper-edit-sample-button — the Roland editor wires the
    //   chopper without an `onOpenSampleEditor` callback, so that
    //   button is intentionally absent here (LibraryPage.tsx:368-381).
    const dialog = page.getByRole('dialog', { name: 'Chop Sample' });
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByText('Waveform & Slice Preview')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Save' })).toBeVisible();
  });
});
