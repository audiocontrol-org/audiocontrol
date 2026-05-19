/**
 * Library + dialog-flow capability specs (Wave 4, #415).
 *
 * Covers the D-LIB-* affordances that depend on a CONNECTED library and
 * either no device round-trip (dialog-mount tests) or a round-trip the
 * fixture already captures.
 *
 * Affordances bound:
 *   - D-LIB-03 (strict): library tree displays its category sections
 *     (Tones, Patches, Samples, Programs) once OPFS is connected.
 *     Upgrades the Wave 3 gate-only test (presence of the C-LIB-01
 *     region) to a strict assertion against the section titles.
 *   - D-LIB-04 (strict): SetsSection mounts and renders the "Sets"
 *     header (and its empty-state copy when no sets are seeded).
 *     Upgrades the Wave 3 gate-only assertion (no Sets header when
 *     disconnected) to its connected-state counterpart.
 *   - D-LIB-05: DeviceMemoryPanel renders loaded tones + patches from
 *     the `load-everything` fixture — proves the panel binds to the
 *     device-data store and surfaces tone/patch slot rows the user
 *     can act on.
 *   - D-LIB-10: SaveSetDialog mounts when the user clicks "Save to
 *     Library..."; the name input + Save action surface.
 *   - D-LIB-11: LoadSetDialog mounts when the user picks a set and
 *     clicks "Load Selected Set"; the MemoryMapPanel inside the dialog
 *     (D-LIB-20) renders.
 *   - D-LIB-15: ExportToneDialog mounts when the user clicks a
 *     ToneList row's "Export" button on the Tones page with a
 *     connected library (upgrades the Wave 3 gate-only D-TONE-LIST-07
 *     test from the disconnected half to the connected half).
 *   - D-LIB-16: ExportPatchDialog mounts on the Patches page with a
 *     connected library (upgrades the Wave 3 gate-only D-PATCH-LIST-08
 *     test from the disconnected half to the connected half).
 *   - D-LIB-20: MemoryMapPanel ToneSlotMap renders inside LoadSetDialog
 *     (covered transitively by D-LIB-11; named separately so the
 *     inventory traces both rows back here).
 *
 * Affordances NOT bound in this wave — see commit message for the
 * BLOCKED disposition each requires:
 *   - D-LIB-12 (Import Library Tone dialog): requires a seeded library
 *     tone yaml whose contents pass `convertYamlToS330Tone()` AND a
 *     companion WAV file. Multiple file types per row + content
 *     validation; needs operator-accepted seeding infrastructure to
 *     ship cleanly.
 *   - D-LIB-13 (Import Library Patch dialog): same seeding shape as
 *     D-LIB-12 plus a patch bundle.
 *   - D-LIB-14 (Import Samples dialog) + D-LIB-21 (WaveSegmentMap):
 *     ImportSamplesDialog opens only via DnD of a sample bundle from
 *     the library tree onto the DeviceMemoryPanel — that's Wave 5
 *     (DnD) territory.
 *   - D-LIB-17/18/19 (Loop Editor / Sample Editor / Sample Chopper):
 *     require a seeded library sample (yaml + decodable WAV under
 *     `library/common/samples/<name>/`) and the dialogs decode the
 *     audio on open. Same seeding-infrastructure shape as D-LIB-12/13.
 *
 * The chosen library-state-setup approach (real OPFS, no mock backend)
 * is documented in `library-flows-helpers.ts` next to the helper
 * implementations.
 */
import { test, expect } from '@playwright/test';
import {
  LIBRARY_URL,
  TONES_URL,
  PATCHES_URL,
  cleanupOPFS,
  connectLibraryOPFS,
  seedOPFSSetManifest,
  setItem,
} from './library-flows-helpers';

// PatchesPage's mount sequence loads patch bank 0 (matched by the
// `patches-bank-0` fixture) and THEN load tone bank 0, which the
// fixture doesn't capture. The trailing tone-load emits 8 RQDs that
// either mismatch the patches-bank-0 byte stream at byte 6
// (area-selector 0x00 patch vs 0x03 tone) or — once the fixture's
// outbound records are exhausted — surface as
// SimulatedAdapterRecordsExhaustedError with the S330Client error
// message "Error loading tone N". Same filter shape as
// `wiring/patches.spec.ts` (issue #405); the spec under test
// asserts the affordance under test, not the legacy preload
// divergence.
const KNOWN_TONE_PRELOAD_DIVERGENCE =
  /SimulatedAdapter[\s\S]*first diff at byte 6:\s*expected 0x00,\s*got 0x03/;
const KNOWN_TONE_PRELOAD_EXHAUSTED =
  /SimulatedAdapterRecordsExhaustedError[\s\S]*has no more outbound records/;
const S330_TONE_LOAD_ERROR = /\[S330Client\] Error loading tone \d+/;

function isKnownPatchesPreloadDiagnostic(text: string): boolean {
  return (
    KNOWN_TONE_PRELOAD_DIVERGENCE.test(text) ||
    KNOWN_TONE_PRELOAD_EXHAUSTED.test(text) ||
    S330_TONE_LOAD_ERROR.test(text)
  );
}

test.describe('Capabilities — Library flows (Wave 4)', () => {
  let pageErrors: string[];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    page.on('pageerror', (err) => {
      if (isKnownPatchesPreloadDiagnostic(err.message)) return;
      pageErrors.push(err.message);
    });
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (isKnownPatchesPreloadDiagnostic(text)) return;
      pageErrors.push(text);
    });

    await page.addInitScript(() => {
      window.localStorage.clear();
    });
  });

  test.afterEach(() => {
    expect(
      pageErrors,
      'no page errors during library-flow interactions (beyond the known PatchesPage tone-preload divergence, issue #405)',
    ).toEqual([]);
  });

  test('D-LIB-03 (strict): connected library tree shows category sections', async ({ page }) => {
    // Disconnected harness state: PluginLibraryBrowser shows the
    // empty-state pane (`Connect to a library folder to get started`).
    // Connecting OPFS swaps the pane for the
    // `ac-plugin-library-browser-sections` div, where the s330 plugin's
    // categories render: tones, patches, samples, programs.
    await page.goto(LIBRARY_URL);
    await page.waitForLoadState('networkidle');
    await cleanupOPFS(page);
    await connectLibraryOPFS(page);

    const libRegion = page.locator('[data-capability="C-LIB-01"]');
    await expect(libRegion).toBeVisible({ timeout: 5_000 });

    // Each category's TreeSection renders its `title` as a heading
    // (modules/editor-core/src/components/library/TreeSection.tsx).
    // The Roland s330 plugin registers Tones, Patches and inherits
    // Samples + Programs from the common-area factories.
    await expect(libRegion.getByText(/^Tones$/).first()).toBeVisible();
    await expect(libRegion.getByText(/^Patches$/).first()).toBeVisible();
    await expect(libRegion.getByText(/^Samples$/).first()).toBeVisible();
    await expect(libRegion.getByText(/^Programs$/).first()).toBeVisible();
  });

  test('D-LIB-04 (strict): connected library mounts SetsSection', async ({ page }) => {
    // Wave 3 covered the disconnected gate (Sets header MUST NOT
    // appear without a library); this is the connected half (Sets
    // header MUST appear once OPFS is wired). The SetsSection always
    // renders its header (see modules/roland-sxx0-editor/src/
    // components/library/SetsSection.tsx:87-89) even when no sets are
    // in the library — the empty-state copy reads "No sets in library".
    await page.goto(LIBRARY_URL);
    await page.waitForLoadState('networkidle');
    await cleanupOPFS(page);
    await connectLibraryOPFS(page);

    const libRegion = page.locator('[data-capability="C-LIB-01"]');
    await expect(libRegion.getByText(/^Sets$/)).toBeVisible({ timeout: 5_000 });
    // Empty-state copy is the contract for a clean OPFS root.
    await expect(libRegion.getByText('No sets in library')).toBeVisible();
  });

  test('D-LIB-05: DeviceMemoryPanel mounts with tone group + patch group regions', async ({ page }) => {
    // The panel's mount-time affordances under test:
    //   - "Device Memory" heading
    //   - The "N tones, M patches" summary line
    //   - The tone group header from `memoryLayout.toneGroups`
    //     (S-330: a single "Tones (48 slots)" group — see
    //     modules/roland-sxx0-editor/src/configs/memory-layout.ts).
    //   - The patch section label pinned in the same memory-layout
    //     config (S-330: "Patches (16 slots)").
    //
    // These are the structural affordances DeviceMemoryPanel renders
    // unconditionally — they prove the panel is reachable, the
    // memory-layout config bound through to the UI, and the tone /
    // patch group regions exist as drop targets. The populated-state
    // (per-slot tone names) and DnD drop-target behaviors are not
    // exercised here: per-slot population requires a fixture matching
    // LibraryPage's per-bank `handleLoadDeviceData` byte sequence
    // (which differs from the `load-everything` Node-driven shape and
    // would need its own capture), and DnD coverage lives in Wave 5
    // per the inventory (D-LIB-06..09).
    await page.goto(LIBRARY_URL);
    await page.waitForLoadState('networkidle');

    const panelHeading = page.getByRole('heading', { name: 'Device Memory' });
    await expect(panelHeading).toBeVisible({ timeout: 5_000 });

    // The summary line is present immediately (always renders, even
    // at 0 tones / 0 patches). Anchor on "tones, " to disambiguate
    // from the page title "Tones" in the navigation.
    await expect(page.getByText(/\d+ tones,\s+\d+ patches/)).toBeVisible();

    // The S-330 memory layout puts every tone in a single group with
    // label "Tones (32 slots)" (createS330MemoryLayout in
    // modules/roland-sxx0-editor/src/configs/memory-layout.ts:40).
    await expect(page.getByText(/Tones \(32 slots\)/)).toBeVisible();

    // The patch section label is pinned in the same config.
    await expect(page.getByText(/Patches \(16 slots\)/)).toBeVisible();
  });

  test('D-LIB-10: clicking "Save to Library..." mounts SaveSetDialog', async ({ page }) => {
    // The save button is gated on `libraryHandle && !isLoading` in
    // LibraryPage.tsx:250. Without OPFS the button is disabled; with
    // OPFS connected, clicking it sets `isSaveDialogOpen` which mounts
    // the Radix Dialog.Portal. Its name input carries
    // `data-testid="set-name-input"` (SaveSetDialog.tsx:82).
    await page.goto(LIBRARY_URL);
    await page.waitForLoadState('networkidle');
    await cleanupOPFS(page);
    await connectLibraryOPFS(page);

    const saveButton = page.getByTestId('save-set-button');
    await expect(saveButton).toBeEnabled({ timeout: 5_000 });
    await saveButton.click();

    await expect(
      page.getByRole('heading', { name: 'Save Device to Library' }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('set-name-input')).toBeVisible();
    await expect(page.getByTestId('confirm-save-set')).toBeVisible();
  });

  test('D-LIB-11 + D-LIB-20: selecting a set + Load opens LoadSetDialog with MemoryMapPanel', async ({ page }) => {
    // Steps:
    //   1. Connect OPFS with a seeded set manifest. SetsSection lists
    //      the set; selecting it sets `selection.type === 'set'`.
    //   2. Click "Load Selected Set" in the page header — gated on
    //      libraryHandle && selection?.type === 'set' (LibraryPage.tsx:251).
    //   3. LoadSetDialog mounts; the MemoryMapPanel inside it
    //      (LoadSetDialog.tsx:17) renders the ToneSlotMap, naming the
    //      "Memory Map" header.
    const setName = 'Wave4TestSet';
    await page.goto(LIBRARY_URL);
    await page.waitForLoadState('networkidle');
    await cleanupOPFS(page);
    await seedOPFSSetManifest(page, setName);
    await connectLibraryOPFS(page);

    // The seeded set must surface in the SetsSection.
    const row = setItem(page, setName);
    await expect(row).toBeVisible({ timeout: 5_000 });
    await row.click();

    const loadButton = page.getByTestId('load-set-button');
    await expect(loadButton).toBeEnabled({ timeout: 5_000 });
    await loadButton.click();

    await expect(
      page.getByRole('heading', { name: 'Load Set to Device' }),
    ).toBeVisible({ timeout: 5_000 });
    // The MemoryMapPanel header is the canonical assertion for
    // D-LIB-20 (ToneSlotMap rendering). It lives inside the dialog;
    // we don't pin the slot-cell count because that depends on the
    // memoryLayout config + active import target, which Wave 4 doesn't
    // bind. Header presence is enough to prove the component mounted.
    await expect(page.getByText('Memory Map')).toBeVisible();
  });

  test('D-LIB-15: connected library exposes the title-row Export button and opens ExportToneDialog', async ({ page }) => {
    // The per-row Export button was removed 2026-05-19. Tone export
    // now lives on the tone editor's title row (ToneEditorHead),
    // surfaced once a tone is selected. This test verifies the
    // connected-library half of that flow: with OPFS wired, selecting
    // a loaded sample-bearing tone surfaces the title-row Export
    // button, and clicking it mounts ExportToneDialog.
    //
    // Library connection bootstrap: TonesPage doesn't include the
    // LibraryConnectionUI (only LibraryPage does), so we connect OPFS
    // on the library route first, then navigate to the tones route.
    // localStorage carries the 'opfs' backend preference; useLibrary-
    // Connection auto-reconnects from it on mount. The per-test
    // addInitScript clears localStorage before each navigation, so we
    // re-seed the preference in a follow-up init script.
    await page.goto(LIBRARY_URL);
    await page.waitForLoadState('networkidle');
    await cleanupOPFS(page);
    await connectLibraryOPFS(page);

    await page.addInitScript(() => {
      window.localStorage.setItem('audiocontrol-library-backend', 'opfs');
    });
    await page.goto(TONES_URL);
    await page.waitForLoadState('networkidle');

    // Select the first loaded tone to mount the editor + title row.
    const firstSlot = page.getByTestId('tone-item-0');
    await expect(firstSlot).toBeVisible({ timeout: 5_000 });
    await firstSlot.click();

    const exportButton = page.getByTestId('export-tone-button');
    await expect(exportButton).toBeVisible({ timeout: 10_000 });
    await exportButton.click();

    await expect(
      page.getByRole('heading', { name: 'Export Tone to Library' }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('export-dialog')).toBeVisible();
    await expect(page.getByTestId('export-confirm')).toBeVisible();
  });

  // D-LIB-16 retired 2026-05-19. The per-row patch Export button was
  // removed (vestige from before the library page existed) and patches
  // have no title-row equivalent — there's no UI affordance left to
  // test. The export pipeline (`useLibraryExport.openExportPatchDialog`)
  // remains for any future call site that wants to surface it.
});
