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

    await expect(
      page.getByRole('heading', { name: 'Export Tone to Library' }),
    ).toBeVisible({ timeout: 5_000 });
    // Dialog's content-defining affordances: confirm + cancel buttons
    // (`ExportToneDialog.tsx:165-175`).
    await expect(page.getByTestId('export-confirm')).toBeVisible();
    await expect(page.getByTestId('export-cancel')).toBeVisible();
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

    await expect(
      page.getByRole('heading', { name: 'Export Patch to Library' }),
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
});
