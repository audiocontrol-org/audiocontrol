/**
 * Library DnD capability specs (Wave 5, #416 + Wave 4 close-out #415).
 *
 * Affordances bound (6):
 *   - D-LIB-06: dragging a loaded device tone slot onto the library tree's
 *     Tones section mounts `ExportToneDialog` (route through
 *     `useLibraryExport.handleDropDeviceTone`).
 *   - D-LIB-07: dragging a loaded device patch slot onto the library
 *     tree's Patches section mounts `ExportPatchDialog`.
 *   - D-LIB-08: dropping a seeded library tone onto a device tone slot
 *     mounts `ImportLibraryToneDialog`.
 *   - D-LIB-09: dropping a seeded library patch onto a device patch slot
 *     mounts `ImportLibraryPatchDialog`.
 *   - D-LIB-14: dropping a seeded library sample bundle onto the device
 *     memory panel (panel-level — see design note below) mounts
 *     `ImportSamplesDialog`.
 *   - D-LIB-21: composed-mount — `WaveSegmentMap` (and its containing
 *     `MemoryMapPanel`'s "Wave Memory" label) renders inside the
 *     `ImportSamplesDialog` that D-LIB-14 mounts.
 *
 * --- Production wiring landed in the same commit as these specs ---
 *
 * Wave 5's original brief assumed every drop target was already wired;
 * the Wave 5 BLOCKED return revealed that D-LIB-06/07/14/21's drop
 * sides were unwired. The operator's decision (2026-05-12): "Expand
 * scope: wire prod + test." Production changes shipped alongside this
 * spec file:
 *
 *   - LibraryPage now passes `onExternalDrop` to `PluginLibraryBrowser`;
 *     the callback parses `DEVICE_DRAG_MIME` and routes to
 *     `useLibraryExport.handleDropDeviceTone` / `handleDropDevicePatch`
 *     (mirrors `akai-s3k-editor/src/pages/LibraryPage.tsx:151-167`).
 *   - DeviceMemoryPanel grew a panel-level drop target for library
 *     samples (`onDropLibrarySample`). Design call (option b in the
 *     dispatch brief): panel-level rather than slot-level — sample
 *     bundles span multiple tone slots + a wave-bank segment range, so
 *     a single-slot drop target is semantically misleading. The
 *     `ImportSamplesDialog` that opens is where the user picks slot /
 *     bank / segment.
 *
 * --- DnD harness pattern ---
 *
 * The editor uses HTML5 DnD (no `react-dnd` in the dependency graph).
 * Playwright's `page.dragAndDrop` is known to flake on HTML5 DnD because
 * the synthetic events don't always carry a `DataTransfer` with the
 * expected MIME types. We use the documented Playwright pattern
 * (https://playwright.dev/docs/input#drag-and-drop), extracted as
 * `simulateDragAndDrop` in `library-flows-dnd-helpers.ts`.
 *
 * --- Device-side state ---
 *
 * LibraryPage's `handleLoadDeviceData` byte stream diverges from the
 * `load-everything` simulated-MIDI fixture (see `library-flows.spec.ts`
 * D-LIB-05 commentary). Rather than capture a new fixture for the
 * per-bank load pattern, the Wave 5 specs inject minimal tone / patch
 * objects directly via `window.__deviceDataStore` — that surface was
 * exposed by production for E2E testing
 * (`deviceDataStore.ts:174-176`). See
 * `library-flows-dnd-helpers.ts :: seedDeviceTone` / `seedDevicePatch`.
 *
 * --- Selector strategy ---
 *
 * - Device-side slots have no `data-testid`. We select by the slot label
 *   text rendered by `MemoryLayout.formatToneSlot` /
 *   `formatPatchSlot` (e.g. "T11", "P11"), scoped to the
 *   `data-capability="C-LIB-02"` device-memory region so the same
 *   labels in other regions (PreviewPanel, ToneSlotMap) don't collide.
 * - Library tree nodes carry `data-testid` of shape
 *   `library-<type>-<id-slug>` (set by TreeView).
 * - Section drop targets use `data-testid="library-<categoryId>-section"`
 *   (set by PluginLibraryBrowser via TreeSection's `data-testid` prop).
 * - Panel-level sample-drop target carries `role="region"` +
 *   `aria-label` so the test can target it via `getByRole`.
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
import {
  simulateDragAndDrop,
  seedDeviceTone,
  seedDevicePatch,
  deviceToneSlot,
  devicePatchSlot,
  devicePanelDropTarget,
} from './library-flows-dnd-helpers';

test.describe('Capabilities — Library DnD (Wave 5)', () => {
  let pageErrors: string[];
  /** Tests that INTENTIONALLY trigger console.error (e.g. D-LIB-31's
   *  continue-on-error verification) can push regexes here. afterEach
   *  drops matching entries before asserting. Cleared each test. */
  let expectedErrorPatterns: RegExp[];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    expectedErrorPatterns = [];
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
    const unexpected = pageErrors.filter(
      (msg) => !expectedErrorPatterns.some((pat) => pat.test(msg)),
    );
    expect(
      unexpected,
      'no page errors during library DnD interactions',
    ).toEqual([]);
  });

  test('D-LIB-08: dropping a seeded library tone on a device tone slot mounts ImportLibraryToneDialog', async ({ page }) => {
    // Production wiring (pre-existing): `DeviceMemoryPanel`'s tone-slot
    // `onDrop` accepts `nodeType === 'tone'` and calls
    // `onDropLibraryTone`, which routes to
    // `useLibraryImportDialogs.handleDropLibraryTone` → sets
    // `importToneDialog` → mounts the dialog.
    //
    // -----------------------------------------------------------------
    // Wave 5 close-out (#421) — fixture-backed load path
    // -----------------------------------------------------------------
    // This spec is the canonical example that consumes the
    // `library-page-load` fixture (captured against real S-550 hardware,
    // stored under `s330/library-page-load.ndjson` per the directory
    // convention `tones.spec.ts:11-15` documents). The other five Wave-5
    // specs continue to use the `window.__deviceDataStore` injection
    // because their affordances only need a single loaded slot, not the
    // full per-bank load sequence — see `library-flows-dnd-helpers.ts`
    // file header for the injection rationale.
    //
    // Mount URL differs from the rest of the suite:
    //   - URL uses `/roland/s550/editor/library` (NOT `/roland/s330/...`)
    //     because the fixture was captured by an S-550 client and so the
    //     RQD byte patterns are S-550-specific (config drives both
    //     `totalTones=64` for the per-bank loop and the S-550 client
    //     factory).
    //   - `useMidiStore` is still hardcoded to `getMidiStore('s330')` in
    //     `midiStore.ts:137`, so the simulated transport STILL fetches
    //     from `/test-fixtures/s330/`. The fixture file lives there
    //     intentionally — see scenario header `"device":"s550"`.
    // The rewrite proves the production load path (page → client →
    // simulated adapter → fixture replay → state store → `DeviceMemoryPanel`
    // surfaces loaded slots) works end-to-end; the Wave-5 D-LIB-08
    // affordance assertion (drop mounts dialog) is preserved verbatim
    // after the loaded slot becomes visible.
    const toneName = 'basic-sine';
    const url = '/roland/s550/editor/library?midi=simulated&scenario=library-page-load';
    await page.goto(url);
    await cleanupOPFS(page);
    await seedOPFSTone(page, { fixtureName: toneName });
    await connectLibraryOPFS(page);

    // Trigger the production load sequence — the same callback the user
    // hits when clicking the header button at `LibraryPage.tsx:333`.
    // The fixture (1310 records: 96 outbound RQDs + 96 inbound DT1s
    // for tones, plus the patch sweep) replays through the simulated
    // adapter as the per-bank loop runs.
    await page.getByRole('button', { name: 'Refresh Device' }).click();

    // Wait for at least one slot to render its tone name — proves the
    // load reached `setTone(0, ...)` and the panel re-rendered. T11's
    // accessible name is composed of slot label + tone name (see
    // `DeviceMemoryPanel.tsx`); we anchor on the slot row's name
    // attribute via the existing `deviceToneSlot` locator (which only
    // requires the slot label to be present) and then assert the row
    // surfaces as draggable, which only happens once `tone` is non-null
    // (`DeviceMemoryPanel.tsx` `draggable={!!tone}` predicate).
    const target = deviceToneSlot(page, 'T11');
    await expect(target).toBeVisible({ timeout: 30_000 });
    await expect(target).toHaveAttribute('draggable', 'true', { timeout: 30_000 });

    const sourceNode = page.getByTestId(`library-tone-${toneName}`);
    await expect(sourceNode).toBeVisible({ timeout: 5_000 });

    await simulateDragAndDrop(page, sourceNode, target);

    await expect(
      page.getByRole('heading', { name: 'Import Library Tone' }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('target-slot-select')).toBeVisible();
    await expect(page.getByTestId('confirm-import-button')).toBeVisible();
  });

  test('D-LIB-09: dropping a seeded library patch on a device patch slot mounts ImportLibraryPatchDialog', async ({ page }) => {
    // Symmetric to D-LIB-08 but through `onDropLibraryPatch` →
    // `handleDropLibraryPatch` → `ImportLibraryPatchDialog`.
    await page.goto(LIBRARY_URL);
    await cleanupOPFS(page);
    const { patchDirName } = await seedOPFSPatch(page);
    await connectLibraryOPFS(page);

    const testIdSuffix = patchDirName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const sourceNode = page.getByTestId(`library-patch-${testIdSuffix}`);
    await expect(sourceNode).toBeVisible({ timeout: 5_000 });

    const target = devicePatchSlot(page, 'P11');
    await expect(target).toBeVisible({ timeout: 5_000 });

    await simulateDragAndDrop(page, sourceNode, target);

    await expect(
      page.getByRole('heading', { name: 'Import Library Patch' }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('target-slot-select')).toBeVisible();
    await expect(page.getByTestId('confirm-import-button')).toBeVisible();
  });

  test('D-LIB-06: dragging a loaded device tone onto the library Tones section mounts ExportToneDialog', async ({ page }) => {
    // Precondition: a tone must be loaded for the drag source's
    // `draggable={!!tone}` predicate to be true. Wave 5 uses direct
    // store-injection (see file-header note) — much smaller surface
    // than capturing a new per-bank fixture, and no behavioural drift
    // because the drag source only reads `tone.name`.
    //
    // Drop target: `PluginLibraryBrowser`'s `TreeSection` for the
    // 'tones' category, surfaced via
    // `data-testid="library-tones-section"`. The `onExternalDrop`
    // wiring is what makes this drop reach
    // `useLibraryExport.handleDropDeviceTone` (production wiring
    // landed in the same commit — see file header).
    await page.goto(LIBRARY_URL);
    await cleanupOPFS(page);
    await connectLibraryOPFS(page);
    await seedDeviceTone(page, { slot: 0, name: 'TestTone1' });

    const source = deviceToneSlot(page, 'T11');
    await expect(source).toHaveAttribute('draggable', 'true', { timeout: 5_000 });

    // Target the outer `TreeSection` explicitly via `[data-category]` so the
    // drop bubbles to the section's `onDrop` handler that
    // `PluginLibraryBrowser` wired up. The inner content `<div>` carries a
    // distinct `library-tones-section-content` testid (per #419 fix in
    // editor-core TreeSection.tsx:133) but the section-level handler is what
    // we exercise here.
    const target = page.locator('[data-category="tones"][data-testid="library-tones-section"]');
    await expect(target).toBeVisible({ timeout: 5_000 });

    await simulateDragAndDrop(page, source, target);

    // v3 SlideDrawer title is sentence-case per the design language
    // (matches sibling drawers like MoveDialog "Move \"<name>\"").
    await expect(
      page.getByRole('heading', { name: /Export tone to library/i }),
    ).toBeVisible({ timeout: 5_000 });
    // Dialog's content-defining affordances: Export (confirm) + Cancel
    // buttons in the SlideDrawer footer (same data-testids preserved
    // across the v3 chrome migration).
    await expect(page.getByTestId('export-confirm')).toBeVisible();
    await expect(page.getByTestId('export-cancel')).toBeVisible();
  });

  test('D-LIB-EXPORT-LIFECYCLE-01: ExportToneDialog open-reset effect pre-fills name input + Cancel closes the dialog (clones.yaml e83df277765c + 82e7ef31c329 useExportDialogLifecycle refactor contract)', async ({ page }) => {
    // Test-before-extract contract for promoting the cross-dialog
    // useState / useEffect / useCallback lifecycle pattern in
    // ExportToneDialog, ExportPatchDialog, and BatchExportDrawer
    // (e83df277765c 12L + 82e7ef31c329 16L) to a shared
    // useExportDialogLifecycle hook. Existing tests (D-LIB-06/07,
    // D-LIB-34/35/36) pin mount + eyebrow text but do NOT exercise:
    //   - The useEffect open-reset (proves name state is initialized
    //     from per-dialog source — `tone?.name || 'Tone_${slot}'` here)
    //   - handleClose (proves Cancel onClick wires to onOpenChange(false))
    //
    // Added 2026-05-22 BEFORE the useExportDialogLifecycle extraction.
    // Must pass against pre-refactor code AND stay green after.
    await page.goto(LIBRARY_URL);
    await cleanupOPFS(page);
    await connectLibraryOPFS(page);
    await seedDeviceTone(page, { slot: 0, name: 'TestTone1' });

    const source = deviceToneSlot(page, 'T11');
    await expect(source).toHaveAttribute('draggable', 'true', { timeout: 5_000 });
    const target = page.locator('[data-category="tones"][data-testid="library-tones-section"]');
    await simulateDragAndDrop(page, source, target);

    // Mount: drawer's name input renders + open-reset populates it
    // from tone?.name (the seeded name 'TestTone1').
    const nameInput = page.getByTestId('export-tone-name-input');
    await expect(nameInput).toBeVisible({ timeout: 5_000 });
    await expect(nameInput).toHaveValue('TestTone1');

    // handleClose: Cancel button click → onOpenChange(false) → drawer
    // unmounts. The drawer title disappearing is the visible side-effect.
    await page.getByTestId('export-cancel').click();
    await expect(
      page.getByRole('heading', { name: /Export tone to library/i }),
    ).toHaveCount(0, { timeout: 5_000 });
  });

  test('D-LIB-07: dragging a loaded device patch onto the library Patches section mounts ExportPatchDialog', async ({ page }) => {
    // Symmetric to D-LIB-06; patch side. Patch-export needs no
    // referenced tones for mount-only assertion — the dialog's
    // dependent-tone count is computed at render time and renders 0
    // when `toneLayer1 / toneLayer2` are empty.
    await page.goto(LIBRARY_URL);
    await cleanupOPFS(page);
    await connectLibraryOPFS(page);
    await seedDevicePatch(page, { slot: 0, name: 'TestPatch1' });

    const source = devicePatchSlot(page, 'P11');
    await expect(source).toHaveAttribute('draggable', 'true', { timeout: 5_000 });

    // See D-LIB-06 above for why we scope on `data-category`.
    const target = page.locator('[data-category="patches"][data-testid="library-patches-section"]');
    await expect(target).toBeVisible({ timeout: 5_000 });

    await simulateDragAndDrop(page, source, target);

    // v3 SlideDrawer title — see D-LIB-06 above for the casing note.
    await expect(
      page.getByRole('heading', { name: /Export patch to library/i }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('export-confirm')).toBeVisible();
    await expect(page.getByTestId('export-cancel')).toBeVisible();
  });

  test('D-LIB-14: dropping a seeded library sample bundle on the device memory panel mounts ImportSamplesDialog', async ({ page }) => {
    // We seed `chopped-sine` (a sliced sample fixture) rather than the
    // `basic-sine` (non-sliced) fixture used by D-LIB-17/18/19, because
    // `sampleManifestToImportBundle` requires `manifest.slices` to be
    // non-empty — the bundle would otherwise have zero slices and the
    // dialog couldn't proceed.
    const sampleName = 'chopped-sine';
    await page.goto(LIBRARY_URL);
    await cleanupOPFS(page);
    await seedOPFSSample(page, { fixtureName: sampleName });
    await connectLibraryOPFS(page);

    const sourceNode = page.getByTestId(`library-sample-${sampleName}`);
    await expect(sourceNode).toBeVisible({ timeout: 5_000 });

    // Panel-level drop target — see file-header production-wiring note
    // for the design rationale.
    const target = devicePanelDropTarget(page);
    await expect(target).toBeVisible({ timeout: 5_000 });

    await simulateDragAndDrop(page, sourceNode, target);

    // `ImportSamplesDialog.tsx:194` renders the title.
    await expect(
      page.getByRole('heading', { name: 'Import Samples' }),
    ).toBeVisible({ timeout: 10_000 });
    // Content-defining affordance: the Memory Map panel (containing
    // both ToneSlotMap and WaveSegmentMap) renders only when the
    // dialog has a valid bundle.
    await expect(page.getByText('Memory Map')).toBeVisible();
    // The starting-tone-slot select is the canonical interaction
    // affordance (`ImportSamplesDialog.tsx:298`).
    await expect(page.locator('#startingToneSlot')).toBeVisible();
  });

  test('D-LIB-21: WaveSegmentMap renders inside the ImportSamplesDialog mounted via DnD', async ({ page }) => {
    // Composed-mount spec — gated on D-LIB-14's path. Same seeding +
    // drag-drop sequence; the assertion is on the `WaveSegmentMap`
    // region inside the dialog. `MemoryMapPanel` labels the
    // wave-segment region with the "Wave Memory" heading
    // (`MemoryMapPanel.tsx:89`), which renders only when at least one
    // wave bank is iterated — positive content assertion.
    const sampleName = 'chopped-sine';
    await page.goto(LIBRARY_URL);
    await cleanupOPFS(page);
    await seedOPFSSample(page, { fixtureName: sampleName });
    await connectLibraryOPFS(page);

    const sourceNode = page.getByTestId(`library-sample-${sampleName}`);
    const target = devicePanelDropTarget(page);
    await expect(sourceNode).toBeVisible({ timeout: 5_000 });
    await expect(target).toBeVisible({ timeout: 5_000 });

    await simulateDragAndDrop(page, sourceNode, target);

    await expect(
      page.getByRole('heading', { name: 'Import Samples' }),
    ).toBeVisible({ timeout: 10_000 });

    // The "Wave Memory" label is the `WaveSegmentMap`-region heading
    // (MemoryMapPanel.tsx:89). The S-330 layout has 2 wave banks
    // (A + B), so two WaveSegmentMap rows render under that heading.
    // We anchor on the heading (exact match) to disambiguate from
    // "Wave Memory:" used as the allocation-preview label
    // (`ImportSamplesDialog.tsx:484`).
    await expect(page.getByText('Wave Memory', { exact: true })).toBeVisible();
  });

  // -----------------------------------------------------------------
  // D-LIB-24 / D-LIB-25: In-library moves (single + batch)
  // -----------------------------------------------------------------
  //
  // Coverage gap discovered 2026-05-21: drag-to-folder, the most basic
  // library operation, had NO test before. The bug it would have caught:
  // `useLibraryOperations.onMove` skipped the strategy hook entirely,
  // routing every move through the common-area `moveItem` (which only
  // resolves under `library/common/samples/`). Roland's tones/patches
  // live under `library/s330/…`, so every in-library drag failed with
  // "file or directory could not be found." Fixed by adding
  // `LibraryOperationsStrategy.moveItem` + routing onMove/onBatchMove
  // through it; these specs are the regression gate.
  //
  // Both specs assert directly on OPFS state after the drag so a future
  // adapter-typing or path-prefix regression fails loudly here instead
  // of in the operator's browser.

  /**
   * Resolve a tree-row DOM node by its data-testid, then return the
   * outer `[role="treeitem"]` ancestor — the actual DnD-bearing element
   * the production `onDrop` handler is wired to.
   */
  async function treeRowFor(page: Page, testId: string) {
    return page.evaluateHandle((id) => {
      const inner = document.querySelector(`[data-testid="${id}"]`);
      return inner?.closest('[role="treeitem"]') ?? null;
    }, testId);
  }

  /**
   * Resolve a folder tree row by its visible text. Folders don't carry
   * a stable per-folder data-testid — operator-typed folder names route
   * to the same `library-folder-<id>` shape that the editor doesn't
   * promise to keep stable across schema rounds. The text lookup is the
   * cheap, robust path for the regression spec.
   */
  async function folderRowByText(page: Page, name: string) {
    return page.evaluateHandle((n) => {
      const span = Array.from(document.querySelectorAll('span.ac-tree-node-name'))
        .find((e) => e.textContent === n);
      return span?.closest('[role="treeitem"]') ?? null;
    }, name);
  }

  /**
   * Seed an empty subfolder under `library/s330/<category>/`. The
   * patches/tones helpers don't have a "create folder" companion, and
   * driving the production createFolder dialog from a test would be
   * a second test in disguise; writing directly to OPFS keeps this
   * spec focused on the move chain.
   */
  async function seedSubfolder(
    page: Page,
    category: 'patches' | 'tones',
    folderName: string,
  ): Promise<void> {
    await page.evaluate(
      async ({ category, folderName }) => {
        const root = await navigator.storage.getDirectory();
        const lib = await root.getDirectoryHandle('library', { create: true });
        const s330 = await lib.getDirectoryHandle('s330', { create: true });
        const cat = await s330.getDirectoryHandle(category, { create: true });
        await cat.getDirectoryHandle(folderName, { create: true });
      },
      { category, folderName },
    );
  }

  /** Assert an item directory exists at the given OPFS path. */
  async function assertOpfsHasPatch(
    page: Page,
    parentPath: string[],
    name: string,
  ): Promise<boolean> {
    return page.evaluate(
      async ({ parentPath, name }) => {
        const root = await navigator.storage.getDirectory();
        let cur: FileSystemDirectoryHandle = root;
        for (const seg of parentPath) {
          cur = await cur.getDirectoryHandle(seg);
        }
        try {
          await cur.getDirectoryHandle(name);
          return true;
        } catch {
          return false;
        }
      },
      { parentPath, name },
    );
  }

  test('D-LIB-24: dragging a single library patch onto a folder row moves it under that folder', async ({ page }) => {
    await page.goto(LIBRARY_URL);
    await cleanupOPFS(page);
    const { patchDirName } = await seedOPFSPatch(page, { targetName: 'hhc-test' });
    await seedSubfolder(page, 'patches', 'DRUMS');
    await connectLibraryOPFS(page);

    const source = page.getByTestId(`library-patch-${patchDirName}`);
    await expect(source).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('span.ac-tree-node-name', { hasText: 'DRUMS' })).toBeVisible({ timeout: 5_000 });

    const sourceRow = await treeRowFor(page, `library-patch-${patchDirName}`);
    const drumsRow = await folderRowByText(page, 'DRUMS');
    await simulateDragAndDrop(page, sourceRow as never, drumsRow as never);

    // Wait for the post-move refresh to land + assert OPFS state.
    await expect
      .poll(
        () => assertOpfsHasPatch(page, ['library', 's330', 'patches', 'DRUMS'], patchDirName),
        { timeout: 5_000 },
      )
      .toBe(true);
    expect(await assertOpfsHasPatch(page, ['library', 's330', 'patches'], patchDirName)).toBe(false);
  });

  test('D-LIB-27: Ctrl-click multi-select keeps the original anchor row highlighted alongside the new toggles', async ({ page }) => {
    // Before the seed fix, `handleMultiSelect`'s toggle branch
    // initialised `next = new Set(multiSelectedIds)` (size 0 after a
    // plain click) and added ONLY the Ctrl-clicked id. The page-level
    // anchor stayed in `selection.node.id`, but TreeView's
    // `isSelected` check (`selectedIds ? selectedIds.has(id) : selectedId === id`)
    // ignores `selectedId` the moment `selectedIds` is non-undefined,
    // so the anchor row visually dropped its highlight — operator
    // saw their initial click disappear the second they Ctrl-clicked
    // a sibling. Fix: seed `lastSelectedIdRef.current` into the
    // toggle set when starting from empty.
    await page.goto(LIBRARY_URL);
    await cleanupOPFS(page);
    const hhc = await seedOPFSPatch(page, { targetName: 'hhc-test' });
    const hho = await seedOPFSPatch(page, { targetName: 'hho-test' });
    const snare = await seedOPFSPatch(page, { targetName: 'snare-test' });
    await connectLibraryOPFS(page);

    for (const dir of [hhc.patchDirName, hho.patchDirName, snare.patchDirName]) {
      await expect(page.getByTestId(`library-patch-${dir}`)).toBeVisible({ timeout: 5_000 });
    }

    // Plain click on HHC (page-level anchor).
    await page.getByTestId(`library-patch-${hhc.patchDirName}`).click();
    await expect(page.getByTestId(`library-patch-${hhc.patchDirName}`))
      .toHaveClass(/ac-tree-node--selected/);

    // Ctrl-click on HHO and SNARE.
    await page.getByTestId(`library-patch-${hho.patchDirName}`).click({ modifiers: ['ControlOrMeta'] });
    await page.getByTestId(`library-patch-${snare.patchDirName}`).click({ modifiers: ['ControlOrMeta'] });

    // All three rows must carry the selected class — the anchor row
    // is the regression gate. If the anchor seed regresses, HHC drops
    // .ac-tree-node--selected and this assertion fails first.
    await expect(page.getByTestId(`library-patch-${hhc.patchDirName}`))
      .toHaveClass(/ac-tree-node--selected/);
    await expect(page.getByTestId(`library-patch-${hho.patchDirName}`))
      .toHaveClass(/ac-tree-node--selected/);
    await expect(page.getByTestId(`library-patch-${snare.patchDirName}`))
      .toHaveClass(/ac-tree-node--selected/);
  });

  test('D-LIB-26: moving the currently-selected patch out of a folder clears the stale selection (no FAILED TO LOAD preview)', async ({ page }) => {
    // Reverse-direction move regression. The operator selects HHC
    // inside DRUMS, then drags it back to the patches root. The move
    // succeeds OPFS-wise (D-LIB-24's path covers that), but the
    // page-level selection still holds `path: ['DRUMS']`. The preview
    // pane's `useEffect([selection, libraryHandle])` then tries to
    // load `library/s330/patches/DRUMS/HHC/patch.yaml`, which no
    // longer exists, and renders "FAILED TO LOAD" — making it look
    // like the move destroyed data even though the patch landed at
    // `library/s330/patches/HHC/` correctly. The Roland strategy's
    // `moveItem` clears the selection on a path-matching move so the
    // preview drops back to the empty state instead of a stale error.
    await page.goto(LIBRARY_URL);
    await cleanupOPFS(page);
    // Seed the patch INSIDE a DRUMS subfolder so the source path is
    // `['DRUMS']` rather than the empty root.
    await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      const lib = await root.getDirectoryHandle('library', { create: true });
      const s330 = await lib.getDirectoryHandle('s330', { create: true });
      const patches = await s330.getDirectoryHandle('patches', { create: true });
      const drums = await patches.getDirectoryHandle('DRUMS', { create: true });
      const d = await drums.getDirectoryHandle('hhc-test', { create: true });
      const y = await d.getFileHandle('patch.yaml', { create: true });
      const w = await y.createWritable();
      await w.write(
        'format: sampler-patch\ndevice: s330\nversion: 1\nname: "Basic Patch"\nlevel: 100\ns330:\n  keyMode: normal\n  benderRange: 2\n',
      );
      await w.close();
    });
    await connectLibraryOPFS(page);

    // Expand DRUMS so the patch row is in the DOM.
    const drumsRow = page.locator('span.ac-tree-node-name', { hasText: 'DRUMS' }).locator('xpath=ancestor::*[@role="treeitem"][1]');
    await expect(drumsRow).toBeVisible({ timeout: 5_000 });
    await drumsRow.click();
    await expect(page.getByTestId('library-patch-drums-hhc-test')).toBeVisible({ timeout: 5_000 });

    // Select the patch (single-click without modifier — populates page
    // selection so the preview pane mounts the patch body).
    await page.getByTestId('library-patch-drums-hhc-test').click();
    await expect(page.locator('[data-testid="library-preview-panel"]'))
      .toContainText('Basic Patch', { timeout: 5_000 });

    // Drag the selected patch to the patches root.
    const sourceRow = await treeRowFor(page, 'library-patch-drums-hhc-test');
    const target = page.locator('[data-category="patches"][data-testid="library-patches-section"]');
    await expect(target).toBeVisible({ timeout: 5_000 });
    await simulateDragAndDrop(page, sourceRow as never, target);

    // Post-move assertions:
    // 1) OPFS state moved correctly.
    await expect
      .poll(
        () => assertOpfsHasPatch(page, ['library', 's330', 'patches'], 'hhc-test'),
        { timeout: 5_000 },
      )
      .toBe(true);
    expect(await assertOpfsHasPatch(page, ['library', 's330', 'patches', 'DRUMS'], 'hhc-test')).toBe(false);

    // 2) Preview pane does NOT show the stale error. The empty state
    //    "Select an item to view details" is the post-clear render.
    await expect(page.locator('[data-testid="library-preview-panel"]'))
      .not.toContainText('FAILED TO LOAD', { ignoreCase: true });
  });

  test('D-LIB-28: device-memory multi-select + drag of any member opens the BatchExportDrawer with every selected slot', async ({ page }) => {
    // The device-memory multi-select dispatcher lives in
    // DeviceMemoryPanel.handleToneClick: plain click sets the anchor,
    // ctrl/meta-click toggles membership (seeding the prior anchor on
    // the first toggle). When a member is dragged with size > 1, the
    // dragstart payload includes `indices` — and
    // useLibraryExport.handleDropDeviceTone opens BatchExportDrawer
    // instead of the single-item dialog.
    //
    // The single-item D-LIB-06 already covers the size=1 path. This
    // spec specifically asserts the size>1 path: three slots ctrl-
    // selected, drag any one, drawer mounts with all three.
    await page.goto(LIBRARY_URL);
    await cleanupOPFS(page);
    await connectLibraryOPFS(page);
    await seedDeviceTone(page, { slot: 0, name: 'TestToneA' });
    await seedDeviceTone(page, { slot: 1, name: 'TestToneB' });
    await seedDeviceTone(page, { slot: 2, name: 'TestToneC' });

    const slotA = deviceToneSlot(page, 'T11');
    const slotB = deviceToneSlot(page, 'T12');
    const slotC = deviceToneSlot(page, 'T13');
    await expect(slotA).toHaveAttribute('draggable', 'true', { timeout: 5_000 });
    await expect(slotB).toHaveAttribute('draggable', 'true', { timeout: 5_000 });
    await expect(slotC).toHaveAttribute('draggable', 'true', { timeout: 5_000 });

    // Plain click on T11 sets the anchor (selected, single-select); the
    // multi-set is cleared. Ctrl-clicks on T12 then T13 add to the set,
    // and on the first ctrl-click the prior anchor (T11) is seeded into
    // the set so it stays highlighted alongside the new toggles.
    await slotA.click();
    await slotB.click({ modifiers: ['ControlOrMeta'] });
    await slotC.click({ modifiers: ['ControlOrMeta'] });

    await expect(slotA).toHaveAttribute('data-multi-selected', 'true', { timeout: 2_000 });
    await expect(slotB).toHaveAttribute('data-multi-selected', 'true', { timeout: 2_000 });
    await expect(slotC).toHaveAttribute('data-multi-selected', 'true', { timeout: 2_000 });

    const target = page.locator('[data-category="tones"][data-testid="library-tones-section"]');
    await expect(target).toBeVisible({ timeout: 5_000 });

    await simulateDragAndDrop(page, slotA, target);

    // Drawer title carries the item count; per-item rows surface in
    // the eyebrow + the item list. The drawer reuses the same
    // SlideDrawer chrome as the single-item flows so the heading-by-
    // name lookup is consistent with D-LIB-06.
    await expect(
      page.getByRole('heading', { name: /Export 3 tones to library/i }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('batch-export-item-0')).toBeVisible();
    await expect(page.getByTestId('batch-export-item-1')).toBeVisible();
    await expect(page.getByTestId('batch-export-item-2')).toBeVisible();
    await expect(page.getByTestId('export-confirm')).toBeVisible();
  });

  test('D-LIB-30: device-memory multi-select with Cmd-click skips intermediate slots (non-contiguous selection)', async ({ page }) => {
    // The dispatcher branches on `e.ctrlKey || e.metaKey` and seeds the
    // prior anchor on the first modifier-click; the cascading prior-
    // session "only shift works" observation came from operators who
    // assumed ctrl/cmd would extend contiguously like shift. This spec
    // exercises the genuinely non-contiguous case: anchor on slot 0
    // then meta-click slot 2 and slot 4 — intermediate slots 1 and 3
    // are seeded with tones but MUST NOT enter the multi-set. The drag
    // payload's `indices` array therefore carries exactly 3 entries
    // and the drawer mounts with 3 items.
    await page.goto(LIBRARY_URL);
    await cleanupOPFS(page);
    await connectLibraryOPFS(page);
    await seedDeviceTone(page, { slot: 0, name: 'TestToneA' });
    await seedDeviceTone(page, { slot: 1, name: 'TestToneB' });
    await seedDeviceTone(page, { slot: 2, name: 'TestToneC' });
    await seedDeviceTone(page, { slot: 3, name: 'TestToneD' });
    await seedDeviceTone(page, { slot: 4, name: 'TestToneE' });

    const slot0 = deviceToneSlot(page, 'T11');
    const slot1 = deviceToneSlot(page, 'T12');
    const slot2 = deviceToneSlot(page, 'T13');
    const slot3 = deviceToneSlot(page, 'T14');
    const slot4 = deviceToneSlot(page, 'T15');
    for (const s of [slot0, slot1, slot2, slot3, slot4]) {
      await expect(s).toHaveAttribute('draggable', 'true', { timeout: 5_000 });
    }

    await slot0.click();
    await slot2.click({ modifiers: ['ControlOrMeta'] });
    await slot4.click({ modifiers: ['ControlOrMeta'] });

    // Selected: 0, 2, 4. Unselected: 1, 3.
    await expect(slot0).toHaveAttribute('data-multi-selected', 'true', { timeout: 2_000 });
    await expect(slot2).toHaveAttribute('data-multi-selected', 'true', { timeout: 2_000 });
    await expect(slot4).toHaveAttribute('data-multi-selected', 'true', { timeout: 2_000 });
    // Intermediate slots remain unselected — the attribute should not
    // be present (Playwright treats missing attributes as null).
    await expect(slot1).not.toHaveAttribute('data-multi-selected', 'true');
    await expect(slot3).not.toHaveAttribute('data-multi-selected', 'true');

    const target = page.locator('[data-category="tones"][data-testid="library-tones-section"]');
    await expect(target).toBeVisible({ timeout: 5_000 });
    await simulateDragAndDrop(page, slot0, target);

    // Drawer mounts with exactly 3 items — the indices array carried
    // [0, 2, 4], so item-0/2/4 testids appear and item-1/3 do not.
    await expect(
      page.getByRole('heading', { name: /Export 3 tones to library/i }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('batch-export-item-0')).toBeVisible();
    await expect(page.getByTestId('batch-export-item-2')).toBeVisible();
    await expect(page.getByTestId('batch-export-item-4')).toBeVisible();
    await expect(page.getByTestId('batch-export-item-1')).toHaveCount(0);
    await expect(page.getByTestId('batch-export-item-3')).toHaveCount(0);
  });

  test('D-LIB-31: batch export continues past per-item failure — every item gets its own failed row instead of aborting at the first error', async ({ page }) => {
    // The continue-on-error contract: a per-item failure inside the
    // batch loop (e.g. `client.requestWaveData` throws for one slot)
    // records the error in `batchExportFailures` and the loop moves
    // on to the next item. The drawer's step log surfaces ✗ on each
    // failed row instead of aborting at the first error — that abort
    // was the original bug (user screenshot: T15 succeeded, T16 failed
    // with "Wave data request rejected", T17 never started).
    //
    // The cleanest reproduction in the test environment is to fail
    // EVERY item with a distinct error message and assert all three
    // failure rows render. Pre-fix this would have aborted at item 1
    // and step rows 2 + 3 would never have surfaced; post-fix all
    // three appear with their respective messages. The partial-
    // success summary message ("X of N exported · Y failed") is
    // covered separately by the dispatcher unit logic, not asserted
    // here — faking exportToneToDirectory's success path requires
    // valid 12-bit packed wave data + tone-converter-compatible YAML
    // structure that the wiring harness deliberately doesn't ship.
    //
    // Reproducing the per-slot failure requires forcing
    // `requestWaveData` to throw with a known message. The dev-mode
    // test seam `window.__samplerClient` (LibraryPage.tsx) exposes
    // the in-use client so the test can monkeypatch its method.
    // Mirrors the existing `__deviceDataStore` seam used by
    // `seedDeviceTone`.
    await page.goto(LIBRARY_URL);
    await cleanupOPFS(page);
    await connectLibraryOPFS(page);
    await seedDeviceTone(page, { slot: 0, name: 'TestKick1' });
    await seedDeviceTone(page, { slot: 1, name: 'TestKick2' });
    await seedDeviceTone(page, { slot: 2, name: 'TestKick3' });

    // The per-item failures we're about to trigger are console.errored
    // by handleBatchExport (intentionally — operators want the cause
    // logged beyond the in-drawer step log). Whitelist that pattern so
    // the suite-wide "no console errors" assertion doesn't fire on the
    // contract under test.
    expectedErrorPatterns.push(/\[useLibraryExport\] Batch item T1\d \(tone\) failed/);

    // Pre-fix behavior: loop throws at slot 0 and slots 1 + 2 never
    // run. Post-fix: each per-slot throw is caught + recorded; the
    // distinct error messages prove the loop reached each item.
    await page.evaluate(() => {
      const w = window as unknown as { __samplerClient?: { requestWaveData: (i: number, cb?: (r: number, t: number) => void) => Promise<unknown> } };
      const client = w.__samplerClient;
      if (!client) throw new Error('__samplerClient seam not present — LibraryPage.tsx dev-mode export missing');
      client.requestWaveData = async (toneIndex: number) => {
        throw new Error(`SimulatedRejection_slot_${toneIndex}`);
      };
    });

    const slot0 = deviceToneSlot(page, 'T11');
    const slot1 = deviceToneSlot(page, 'T12');
    const slot2 = deviceToneSlot(page, 'T13');
    for (const s of [slot0, slot1, slot2]) {
      await expect(s).toHaveAttribute('draggable', 'true', { timeout: 5_000 });
    }

    await slot0.click();
    await slot1.click({ modifiers: ['ControlOrMeta'] });
    await slot2.click({ modifiers: ['ControlOrMeta'] });

    const target = page.locator('[data-category="tones"][data-testid="library-tones-section"]');
    await expect(target).toBeVisible({ timeout: 5_000 });
    await simulateDragAndDrop(page, slot0, target);

    await expect(
      page.getByRole('heading', { name: /Export 3 tones to library/i }),
    ).toBeVisible({ timeout: 5_000 });

    // Kick off the batch.
    await page.getByTestId('export-confirm').click();

    // Wait for the all-failed terminal state. The step-log final row
    // emits this label only when every per-item try/catch fired.
    await expect(
      page.getByText(/Batch failed — all 3 items errored/i),
    ).toBeVisible({ timeout: 15_000 });

    // Three per-item failure rows plus a final summary row (also
    // styled failed because the all-failed terminal state sets
    // batchExportError, which useStepHistory marks the final summary
    // row as failed too). Pre-fix the loop would have aborted at slot
    // 0 — only ONE failed row would exist. The load-bearing assertion
    // is the >=3 per-item rows; counting summary + per-item gives 4.
    const failedStepRows = page.locator('.ac-step-row--failed');
    await expect(failedStepRows).toHaveCount(4);

    // Each row carries its own distinct error message — proves each
    // item ran. If the loop had aborted at slot 0, rows 2 + 3 would
    // never have been populated.
    await expect(page.getByText('SimulatedRejection_slot_0')).toBeVisible();
    await expect(page.getByText('SimulatedRejection_slot_1')).toBeVisible();
    await expect(page.getByText('SimulatedRejection_slot_2')).toBeVisible();

  });

  test('D-LIB-32: ctrl-click does not move the anchor, so a subsequent shift-click ranges from the original plain-click anchor', async ({ page }) => {
    // Regression coverage for AUDIT-20260521-01. The dispatcher used
    // to overwrite `lastToneAnchorRef.current` inside the ctrl/meta
    // branch, so a subsequent shift-click would range from the most-
    // recently ctrl-clicked slot instead of the original plain-click
    // anchor. Matches the OS-standard file-manager idiom (the anchor
    // moves on plain click or shift click; ctrl/meta toggles
    // membership without moving the anchor).
    //
    // Sequence:
    //   1. Plain-click T11 — anchor = T11.
    //   2. Cmd/Ctrl-click T13 — multi-set = {T11, T13}; anchor STAYS T11.
    //   3. Shift-click T15 — range from T11 → {T11, T12, T13, T14, T15}.
    await page.goto(LIBRARY_URL);
    await cleanupOPFS(page);
    await connectLibraryOPFS(page);
    await seedDeviceTone(page, { slot: 0, name: 'TestToneA' });
    await seedDeviceTone(page, { slot: 1, name: 'TestToneB' });
    await seedDeviceTone(page, { slot: 2, name: 'TestToneC' });
    await seedDeviceTone(page, { slot: 3, name: 'TestToneD' });
    await seedDeviceTone(page, { slot: 4, name: 'TestToneE' });

    const slot0 = deviceToneSlot(page, 'T11');
    const slot1 = deviceToneSlot(page, 'T12');
    const slot2 = deviceToneSlot(page, 'T13');
    const slot3 = deviceToneSlot(page, 'T14');
    const slot4 = deviceToneSlot(page, 'T15');
    for (const s of [slot0, slot1, slot2, slot3, slot4]) {
      await expect(s).toHaveAttribute('draggable', 'true', { timeout: 5_000 });
    }

    // Step 1: plain click sets anchor + clears multi-set.
    await slot0.click();
    // Step 2: ctrl-click adds T13 — anchor stays at T11.
    await slot2.click({ modifiers: ['ControlOrMeta'] });
    // Step 3: shift-click T15 — range from anchor T11 (NOT T13).
    await slot4.click({ modifiers: ['Shift'] });

    // Post-condition: T11-T15 all selected (range from anchor).
    for (const s of [slot0, slot1, slot2, slot3, slot4]) {
      await expect(s).toHaveAttribute('data-multi-selected', 'true', { timeout: 2_000 });
    }

    // The drag payload should carry all 5 indices.
    const target = page.locator('[data-category="tones"][data-testid="library-tones-section"]');
    await expect(target).toBeVisible({ timeout: 5_000 });
    await simulateDragAndDrop(page, slot0, target);

    await expect(
      page.getByRole('heading', { name: /Export 5 tones to library/i }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('batch-export-item-0')).toBeVisible();
    await expect(page.getByTestId('batch-export-item-1')).toBeVisible();
    await expect(page.getByTestId('batch-export-item-2')).toBeVisible();
    await expect(page.getByTestId('batch-export-item-3')).toBeVisible();
    await expect(page.getByTestId('batch-export-item-4')).toBeVisible();
  });

  test('D-LIB-33: export drawer eyebrow reflects the active device name (S-550), not a hardcoded S-330 label', async ({ page }) => {
    // Regression coverage for AUDIT-20260521-02. All three export
    // drawers used to hardcode "S330" in the eyebrow row instead of
    // deriving from useDeviceConfig(). The bug only surfaced on the
    // s550 surface because every prior wiring test ran via LIBRARY_URL
    // (the s330 URL). This spec exercises the s550 mount + asserts
    // the eyebrow reads "S-550".
    //
    // Single-item ExportToneDialog is the canonical surface; the
    // patch + batch drawers share the same shape (verified by
    // tone/patch/batch all using deviceName from useDeviceConfig).
    const S550_LIBRARY_URL =
      '/roland/s550/editor/library?midi=simulated&scenario=load-everything';
    await page.goto(S550_LIBRARY_URL);
    await cleanupOPFS(page);
    await connectLibraryOPFS(page);
    await seedDeviceTone(page, { slot: 0, name: 'TestTone1' });

    const source = deviceToneSlot(page, 'T11');
    await expect(source).toHaveAttribute('draggable', 'true', { timeout: 5_000 });

    const target = page.locator('[data-category="tones"][data-testid="library-tones-section"]');
    await expect(target).toBeVisible({ timeout: 5_000 });
    await simulateDragAndDrop(page, source, target);

    await expect(
      page.getByRole('heading', { name: /Export tone to library/i }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('export-tone-device-name')).toHaveText('S-550');
  });

  test('D-LIB-34: ExportToneDialog destination eyebrow renders kindLabel + LIBRARY + device-name in the right testid-suffixed spans (clones.yaml 38c8236d8a7b refactor contract)', async ({ page }) => {
    // Test-before-extract contract for clones.yaml group 38c8236d8a7b
    // (ExportPatchDialog.tsx:195-201 ↔ ExportToneDialog.tsx:183-189
    // shared eyebrow row). The clone-disposition refactor extracts the
    // shared eyebrow shape (accent kindLabel + LIBRARY literal + device-
    // name testid span + optional target-path tail) into a new
    // DestinationEyebrow component; all three export surfaces
    // (ExportToneDialog, ExportPatchDialog, BatchExportDrawer) render
    // <DestinationEyebrow ... /> in place of the inline JSX block.
    //
    // The contract this assertion protects: the eyebrow's full token
    // sequence (testid wrapper, kindLabel accent text, LIBRARY literal,
    // device-name testid suffix) on the tone surface. D-LIB-35 covers
    // the patch surface; D-LIB-36 covers the batch surface. Without
    // these three the refactor could silently drop the LIBRARY literal
    // or scramble the testid suffixing.
    //
    // Added 2026-05-22 BEFORE the DestinationEyebrow extraction lands,
    // per workplan 'Refactoring protocol: test before extract'. Must
    // pass against pre-refactor code AND stay green after the refactor.
    await page.goto(LIBRARY_URL);
    await cleanupOPFS(page);
    await connectLibraryOPFS(page);
    await seedDeviceTone(page, { slot: 0, name: 'TestTone1' });

    const source = deviceToneSlot(page, 'T11');
    await expect(source).toHaveAttribute('draggable', 'true', { timeout: 5_000 });
    const target = page.locator('[data-category="tones"][data-testid="library-tones-section"]');
    await simulateDragAndDrop(page, source, target);

    await expect(
      page.getByRole('heading', { name: /Export tone to library/i }),
    ).toBeVisible({ timeout: 5_000 });

    const eyebrow = page.getByTestId('export-tone-destination');
    await expect(eyebrow).toBeVisible();
    // Accent label is the kind in caps ("TONE")
    await expect(eyebrow.locator('.ac-detail-eyebrow-accent')).toHaveText('TONE');
    // The LIBRARY literal is the third labeled segment
    await expect(eyebrow).toContainText('LIBRARY');
    // Device-name span carries the prefixed testid + capitalized name
    await expect(eyebrow.getByTestId('export-tone-device-name')).toHaveText('S-330');
  });

  test('D-LIB-35: ExportPatchDialog destination eyebrow renders kindLabel + LIBRARY + device-name in the right testid-suffixed spans (clones.yaml 38c8236d8a7b refactor contract)', async ({ page }) => {
    // Sibling to D-LIB-34; covers the patch surface. See D-LIB-34 for
    // full rationale.
    await page.goto(LIBRARY_URL);
    await cleanupOPFS(page);
    await connectLibraryOPFS(page);
    await seedDevicePatch(page, { slot: 0, name: 'TestPatch1' });

    const source = devicePatchSlot(page, 'P11');
    await expect(source).toHaveAttribute('draggable', 'true', { timeout: 5_000 });
    const target = page.locator('[data-category="patches"][data-testid="library-patches-section"]');
    await simulateDragAndDrop(page, source, target);

    await expect(
      page.getByRole('heading', { name: /Export patch to library/i }),
    ).toBeVisible({ timeout: 5_000 });

    const eyebrow = page.getByTestId('export-patch-destination');
    await expect(eyebrow).toBeVisible();
    await expect(eyebrow.locator('.ac-detail-eyebrow-accent')).toHaveText('PATCH');
    await expect(eyebrow).toContainText('LIBRARY');
    await expect(eyebrow.getByTestId('export-patch-device-name')).toHaveText('S-330');
  });

  test('D-LIB-36: BatchExportDrawer destination eyebrow renders kindLabel + N ITEMS + LIBRARY + device-name (clones.yaml 38c8236d8a7b refactor contract — batch surface)', async ({ page }) => {
    // Sibling to D-LIB-34/35; covers the batch surface. The batch
    // eyebrow's leftField differs from the single-item dialogs (it
    // shows "N ITEMS" instead of a slot label), so the assertion
    // exercises the alternate shape. See D-LIB-34 for full rationale.
    await page.goto(LIBRARY_URL);
    await cleanupOPFS(page);
    await connectLibraryOPFS(page);
    await seedDeviceTone(page, { slot: 0, name: 'TestToneA' });
    await seedDeviceTone(page, { slot: 1, name: 'TestToneB' });
    await seedDeviceTone(page, { slot: 2, name: 'TestToneC' });

    const slot0 = deviceToneSlot(page, 'T11');
    const slot1 = deviceToneSlot(page, 'T12');
    const slot2 = deviceToneSlot(page, 'T13');
    for (const s of [slot0, slot1, slot2]) {
      await expect(s).toHaveAttribute('draggable', 'true', { timeout: 5_000 });
    }
    await slot0.click();
    await slot1.click({ modifiers: ['ControlOrMeta'] });
    await slot2.click({ modifiers: ['ControlOrMeta'] });

    const target = page.locator('[data-category="tones"][data-testid="library-tones-section"]');
    await simulateDragAndDrop(page, slot0, target);

    await expect(
      page.getByRole('heading', { name: /Export 3 tones to library/i }),
    ).toBeVisible({ timeout: 5_000 });

    const eyebrow = page.getByTestId('batch-export-destination');
    await expect(eyebrow).toBeVisible();
    await expect(eyebrow.locator('.ac-detail-eyebrow-accent')).toHaveText('TONES');
    await expect(eyebrow).toContainText('3 ITEMS');
    await expect(eyebrow).toContainText('LIBRARY');
    await expect(eyebrow.getByTestId('batch-export-device-name')).toHaveText('S-330');
  });

  test('D-LIB-29: device-memory multi-select on patches + drag of any member opens the BatchExportDrawer with kind="patch"', async ({ page }) => {
    // Symmetric to D-LIB-28 but exercises the patch side of the
    // dispatcher (handlePatchClick) and the patch branch of
    // useLibraryExport.handleDropDevicePatch. The code shape mirrors
    // tone batch one-to-one; this spec just keeps the patch path from
    // silently regressing when someone touches one and forgets the
    // sibling.
    await page.goto(LIBRARY_URL);
    await cleanupOPFS(page);
    await connectLibraryOPFS(page);
    await seedDevicePatch(page, { slot: 0, name: 'TestPatchA' });
    await seedDevicePatch(page, { slot: 1, name: 'TestPatchB' });
    await seedDevicePatch(page, { slot: 2, name: 'TestPatchC' });

    const slotA = devicePatchSlot(page, 'P11');
    const slotB = devicePatchSlot(page, 'P12');
    const slotC = devicePatchSlot(page, 'P13');
    await expect(slotA).toHaveAttribute('draggable', 'true', { timeout: 5_000 });
    await expect(slotB).toHaveAttribute('draggable', 'true', { timeout: 5_000 });
    await expect(slotC).toHaveAttribute('draggable', 'true', { timeout: 5_000 });

    await slotA.click();
    await slotB.click({ modifiers: ['ControlOrMeta'] });
    await slotC.click({ modifiers: ['ControlOrMeta'] });

    await expect(slotA).toHaveAttribute('data-multi-selected', 'true', { timeout: 2_000 });
    await expect(slotB).toHaveAttribute('data-multi-selected', 'true', { timeout: 2_000 });
    await expect(slotC).toHaveAttribute('data-multi-selected', 'true', { timeout: 2_000 });

    const target = page.locator('[data-category="patches"][data-testid="library-patches-section"]');
    await expect(target).toBeVisible({ timeout: 5_000 });

    await simulateDragAndDrop(page, slotA, target);

    await expect(
      page.getByRole('heading', { name: /Export 3 patches to library/i }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('batch-export-item-0')).toBeVisible();
    await expect(page.getByTestId('batch-export-item-1')).toBeVisible();
    await expect(page.getByTestId('batch-export-item-2')).toBeVisible();
    await expect(page.getByTestId('export-confirm')).toBeVisible();
  });

  test('D-LIB-25: batch drag of 3 multi-selected patches to a folder moves every selected item', async ({ page }) => {
    // Multi-select gesture in PluginLibraryBrowser: ctrlKey/metaKey click
    // on each row adds it to `multiSelectedIds`. When the drag fires
    // with size > 1 and the dragged node is in the set, the production
    // path calls `onBatchMove` rather than `onMove` — the bug fixed
    // alongside D-LIB-24 also missed this branch, so the batch path
    // gets its own regression assertion.
    await page.goto(LIBRARY_URL);
    await cleanupOPFS(page);
    const hhc = await seedOPFSPatch(page, { targetName: 'hhc-test' });
    const hho = await seedOPFSPatch(page, { targetName: 'hho-test' });
    const snare = await seedOPFSPatch(page, { targetName: 'snare-test' });
    await seedSubfolder(page, 'patches', 'DRUMS');
    await connectLibraryOPFS(page);

    for (const dir of [hhc.patchDirName, hho.patchDirName, snare.patchDirName]) {
      await expect(page.getByTestId(`library-patch-${dir}`)).toBeVisible({ timeout: 5_000 });
    }

    // Ctrl-click each row to build the multi-selection.
    for (const dir of [hhc.patchDirName, hho.patchDirName, snare.patchDirName]) {
      await page.getByTestId(`library-patch-${dir}`).click({ modifiers: ['ControlOrMeta'] });
    }

    const sourceRow = await treeRowFor(page, `library-patch-${hhc.patchDirName}`);
    const drumsRow = await folderRowByText(page, 'DRUMS');
    await simulateDragAndDrop(page, sourceRow as never, drumsRow as never);

    for (const dir of [hhc.patchDirName, hho.patchDirName, snare.patchDirName]) {
      await expect
        .poll(
          () => assertOpfsHasPatch(page, ['library', 's330', 'patches', 'DRUMS'], dir),
          { timeout: 5_000 },
        )
        .toBe(true);
      expect(await assertOpfsHasPatch(page, ['library', 's330', 'patches'], dir)).toBe(false);
    }
  });
});
