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
    //
    // V3-IMPORT (#450): the v3 chrome migration switched the title to
    // sentence-case ("Import library tone") matching the sibling
    // Export* dialogs ("Export tone to library"). The legacy
    // title-case heading "Import Library Tone" is gone.
    await expect(
      page.getByRole('heading', { name: 'Import library tone' }),
    ).toBeVisible({ timeout: 5_000 });
    // The confirm button + the target-slot select are the canonical
    // interaction affordances. v3 chrome moved the confirm into the
    // SlideDrawer footer; the `renderFooter` helper from
    // ExportToneDialog is reused with `testIdPrefix: 'import'`, so
    // the testid is `import-confirm` (matches the legacy
    // `confirm-import-button` semantics; renamed for symmetry with
    // the export-side `export-confirm`).
    await expect(page.getByTestId('import-confirm')).toBeVisible();
    await expect(page.getByTestId('target-slot-select')).toBeVisible();
  });

  test('D-LIB-IMPORT-TONE-V3-01: ImportLibraryToneDialog mounts the v3 SlideDrawer chrome (ac-drawer-panel + sentence-case title)', async ({ page }) => {
    // Pins the v3 chrome shape for ImportLibraryToneDialog. Pre-migration
    // the dialog used Radix.Dialog (centered overlay), which does NOT
    // produce a `.ac-drawer-panel` element. Post-migration the dialog is
    // a right-edge SlideDrawer that mounts `.ac-drawer-panel` inline
    // (NO Portal) with `role="dialog"` + sentence-case title text.
    //
    // Added 2026-05-23 BEFORE the V3-IMPORT sub-task 2 migration.
    // Must fail against the legacy Radix.Dialog chrome and pass after.
    // Closes V3-IMPORT (#450) follow-up for the legacy Import dialog.
    const toneName = 'basic-sine';
    await page.goto(LIBRARY_URL);
    await page.waitForLoadState('networkidle');
    await cleanupOPFS(page);
    await seedOPFSTone(page, { fixtureName: toneName });
    await connectLibraryOPFS(page);

    const toneNode = page.getByTestId(`library-tone-${toneName}`);
    await expect(toneNode).toBeVisible({ timeout: 5_000 });
    await toneNode.click();

    const importButton = page.getByTestId('import-to-device-button');
    await expect(importButton).toBeVisible({ timeout: 5_000 });
    await importButton.click();

    // v3 chrome marker: SlideDrawer mounts `.ac-drawer-panel`. The
    // legacy Radix.Dialog code mounts `.fixed top-1/2 left-1/2 ...`
    // inside a `Dialog.Portal` and produces NO `.ac-drawer-panel` node.
    const drawerPanel = page.locator('.ac-drawer-panel');
    await expect(drawerPanel).toBeVisible({ timeout: 5_000 });

    // Sentence-case title matches the v3 design language. The legacy
    // chrome used "Import Library Tone" (title-case); v3 uses
    // "Import library tone" (sentence-case) per the same convention
    // ExportToneDialog applies ("Export tone to library"). The drawer
    // title renders inside `.ac-drawer-title` (an h2) — pinning the
    // heading directly is more reliable than role+name resolution
    // because SlideDrawer doesn't set `aria-labelledby`.
    const drawerTitle = page.locator('.ac-drawer-title');
    await expect(drawerTitle).toHaveText(/Import library tone/i, { timeout: 5_000 });
  });

  test('D-LIB-13: clicking "Import to Device" on a seeded library patch mounts ImportLibraryPatchDialog', async ({ page }) => {
    // Seed the basic-patch fixture as an OPFS directory bundle. The
    // helper deliberately uses a kebab-case directory name distinct
    // from the YAML's `name` field; the round-trip works because
    // `useRolandLibraryData` packs `meta.directoryName` (#418) and
    // `useRolandSelectionMapping` resolves the patch identity from
    // that meta field, NOT from `node.name` (which is the YAML display
    // name).
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

    // V3-IMPORT (#450): the v3 chrome migration switched the title to
    // sentence-case ("Import library patch") matching the sibling
    // Export* dialogs. The confirm testid is `import-confirm` (renamed
    // from `confirm-import-button` for symmetry with `export-confirm`).
    await expect(
      page.getByRole('heading', { name: 'Import library patch' }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('target-slot-select')).toBeVisible();
    await expect(page.getByTestId('import-confirm')).toBeVisible();
  });

  test('D-LIB-IMPORT-PATCH-V3-01: ImportLibraryPatchDialog mounts the v3 SlideDrawer chrome (ac-drawer-panel + sentence-case title)', async ({ page }) => {
    // Pins the v3 chrome shape for ImportLibraryPatchDialog. Pre-migration
    // the dialog used Radix.Dialog (centered overlay), which does NOT
    // produce a `.ac-drawer-panel` element. Post-migration the dialog
    // is a right-edge SlideDrawer that mounts `.ac-drawer-panel`
    // inline (NO Portal) with sentence-case title "Import library patch".
    //
    // Added 2026-05-23 BEFORE the V3-IMPORT sub-task 4 migration.
    // Must fail against the legacy Radix.Dialog chrome and pass
    // after. Closes V3-IMPORT (#450) final sub-task.
    await page.goto(LIBRARY_URL);
    await page.waitForLoadState('networkidle');
    await cleanupOPFS(page);
    const { patchDirName } = await seedOPFSPatch(page);
    await connectLibraryOPFS(page);

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

    // v3 chrome marker: SlideDrawer mounts `.ac-drawer-panel`. The
    // legacy Radix.Dialog code mounts `.fixed top-1/2 left-1/2 ...`
    // inside a `Dialog.Portal` and produces NO `.ac-drawer-panel` node.
    const drawerPanel = page.locator('.ac-drawer-panel');
    await expect(drawerPanel).toBeVisible({ timeout: 5_000 });

    // Sentence-case title matches the v3 design language. The legacy
    // chrome used "Import Library Patch" (title-case); v3 uses
    // "Import library patch" (sentence-case).
    const drawerTitle = page.locator('.ac-drawer-title');
    await expect(drawerTitle).toHaveText(/Import library patch/i, { timeout: 5_000 });
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

  test('D-LIB-39: page-level error banner clears when the operator selects a different library item (BUG-005 regression)', async ({ page }) => {
    // BUG-005 (2026-05-23): the page-level error banner above the
    // library tree (LibraryPage.tsx:521, `ac-alert ac-alert-error`)
    // never clears once `errorReporter.report()` fires. ItemPreviewPanel's
    // local `loadError` resets on selection change (ItemPreviewPanel.tsx:204),
    // but the page-level `useLibraryStore.error` does not — there's no
    // useEffect tying `selection` to `setError(null)`. Result: any failed
    // load leaves a sticky banner that survives every subsequent action,
    // forcing the operator to do a full page reload to recover.
    //
    // This spec exercises the recovery flow: seed two tones, delete tone A's
    // WAV under it (post-seed) to force an Open-in-Loop-Editor failure,
    // verify the page-level banner appears, click tone B, verify the banner
    // clears. The middle banner (PluginLibraryBrowser) and the right pane
    // (LibraryPreviewPanelAdapter context.error) both render off the same
    // store-level error, so testing the top banner is sufficient.
    //
    // Test-first ordering: this test was written BEFORE the fix, must
    // FAIL against current code, must PASS after the fix lands. The
    // reverse-revert check holds: revert the selection-change effect
    // and this test fails because the banner persists across the click.
    const toneA = 'basic-sine';
    const toneB = 'basic-square';
    await page.goto(LIBRARY_URL);
    await page.waitForLoadState('networkidle');
    await cleanupOPFS(page);
    await seedOPFSTone(page, { fixtureName: 'basic-sine', targetName: toneA });
    // Reuse the same fixture for tone B — what matters is two distinct
    // tree nodes the operator can click between. seedOPFSTone writes
    // YAML+WAV under `library/s330/tones/<targetName>.{yaml,wav}` so
    // both tones load cleanly.
    await seedOPFSTone(page, { fixtureName: 'basic-sine', targetName: toneB });
    await connectLibraryOPFS(page);

    // The page-level banner is the canonical sticky-error surface. Pin
    // by the .ac-alert.ac-alert-error class pair — same selector
    // LibraryPage.tsx:521 emits. The right pane (ItemPreviewPanel)
    // owns its own local loadError; the middle banner
    // (PluginLibraryBrowser) reads off the same page-level store.
    // Asserting the page-level banner is sufficient — the others
    // share its source.
    const pageBanner = page.locator('.ac-alert.ac-alert-error');

    // Click tone A → preview pane loads its YAML+WAV cleanly. The
    // editor-dialog action chain (Open in Loop Editor) is what feeds
    // the page-level errorReporter via useEditorDialogsCore's catches;
    // a preview-time failure stays local to ItemPreviewPanel.loadError.
    const toneANode = page.getByTestId(`library-tone-${toneA}`);
    await expect(toneANode).toBeVisible({ timeout: 5_000 });
    await toneANode.click();

    // Wait for the preview to render its action buttons. The "Open in
    // Loop Editor" button is only rendered after libraryTone resolves
    // (ItemPreviewPanel.tsx:387-407).
    const openLoopButton = page.getByRole('button', { name: 'Open in Loop Editor' });
    await expect(openLoopButton).toBeVisible({ timeout: 5_000 });

    // Now delete tone A's WAV after the preview has resolved, so the
    // editor-dialog action's WAV-load step (useRolandEditorDialogs.ts:72)
    // throws NotFoundError → errorReporter pushes to the page-level
    // store error → top/middle banners fire.
    await page.evaluate(async (name) => {
      const root = await navigator.storage.getDirectory();
      const library = await root.getDirectoryHandle('library');
      const s330 = await library.getDirectoryHandle('s330');
      const tones = await s330.getDirectoryHandle('tones');
      await tones.removeEntry(`${name}.wav`);
    }, toneA);

    await openLoopButton.click();

    // Page-level banner appears after the editor-dialog handler's
    // catch fires errorReporter.report.
    await expect(pageBanner).toBeVisible({ timeout: 5_000 });

    // Recovery action: click tone B. This is the operator's
    // most-natural recovery flow — "this one's broken, let me try a
    // different one." The selection change should clear the page-
    // level error so the banner disappears.
    const toneBNode = page.getByTestId(`library-tone-${toneB}`);
    await expect(toneBNode).toBeVisible({ timeout: 5_000 });
    await toneBNode.click();

    // The banner must be GONE after the recovery click. Pre-fix this
    // assertion fails because nothing in the codebase resets the
    // store-level error on selection change.
    await expect(pageBanner).not.toBeVisible({ timeout: 5_000 });

    // The deliberately-deleted WAV produces an expected console.error
    // (NotFoundError from the file handle). Filter it out of the
    // suite-level pageErrors guard so the afterEach assertion passes —
    // the error is the failure mode we're testing the recovery for, not
    // a separate unexpected regression. The other test-scope errors
    // (if any) survive the filter and still fail the afterEach.
    const before = pageErrors.length;
    const filtered = pageErrors.filter(
      (e) => !/could not be found at the time an operation was processed|NotFoundError/i.test(e),
    );
    pageErrors.length = 0;
    pageErrors.push(...filtered);
    expect(
      before - filtered.length,
      'D-LIB-39 expects at least one NotFoundError-shaped page error from the deliberately-deleted WAV',
    ).toBeGreaterThan(0);
  });

  test('D-LIB-38: clicking "Open in Loop Editor" on a seeded library TONE mounts LoopEditorDialog (BUG-004 regression)', async ({ page }) => {
    // BUG-004 (2026-05-23): the page-level handler at LibraryPage.tsx:445
    // hardcoded nodeType='sample' for all three Open-in-* handlers. The
    // Roland WAV-loader strategy (useRolandEditorDialogs.ts:71) only
    // matches nodeType==='tone' || 'individualTone'; the hardcoded 'sample'
    // caused the strategy to return null and fall through to the common-
    // area loadSample() path, which looked for
    // library/common/samples/<path>/<name>/sample.yaml — a path that does
    // not exist for a tone. Result: a DOMException NotFoundError surfaced
    // as "A requested file or directory could not be found at the time
    // an operation was processed." in 3 banners (page-top, library-mid,
    // preview-right), and the library state became unrecoverable without
    // a full page reload.
    //
    // This spec is the sibling of D-LIB-17 (which exercises the same
    // affordance against a common-area SAMPLE). D-LIB-17 hit the
    // common-area path, which worked; this spec hits the device-tone
    // strategy, which DID NOT work pre-fix.
    //
    // Test-first protocol: this test was written BEFORE the fix lands
    // in commit-history order but applied to the WORKING tree (the
    // fix landed first because the operator was sitting at a broken
    // dev server). The reverse-revert check holds: revert the fix
    // (re-hardcode 'sample' on LibraryPage.tsx:445) and this test
    // fails because the LoopEditor dialog never mounts.
    const toneName = 'basic-sine';
    await page.goto(LIBRARY_URL);
    await page.waitForLoadState('networkidle');
    await cleanupOPFS(page);
    await seedOPFSTone(page, { fixtureName: toneName });
    await connectLibraryOPFS(page);

    const toneNode = page.getByTestId(`library-tone-${toneName}`);
    await expect(toneNode).toBeVisible({ timeout: 5_000 });
    await toneNode.click();

    // ItemPreviewPanel.tsx:402-407 renders the "Open in Loop Editor"
    // button inside the Library Tone preview pane. The onClick passes
    // nodeType='tone' through to the page handler — which prior to the
    // fix dropped the 'tone' tag and used 'sample' instead.
    const openLoopButton = page.getByRole('button', { name: 'Open in Loop Editor' });
    await expect(openLoopButton).toBeVisible({ timeout: 5_000 });
    await openLoopButton.click();

    // Mount assertion: the LoopEditor dialog renders. Same pattern as
    // D-LIB-17 — scope by dialog role + name to disambiguate the dialog
    // title from the embedded LoopEditor component's inner heading.
    const dialog = page.getByRole('dialog', { name: 'Loop Editor' });
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(
      dialog.getByRole('button', { name: 'Save Loop Points' }),
    ).toBeVisible();
  });
});
