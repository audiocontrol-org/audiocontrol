/**
 * Capability specs — Library (C-LIB-01).
 *
 * See ROLAND-S550-EDITOR-CAPABILITIES.md for the canonical capability
 * statement. C-LIB-01 is currently `partial` — the doc declares the
 * tree affordance is present, with node enumeration deferred.
 *
 * The harness mounts the page WITHOUT a connected library backend, so
 * the PluginLibraryBrowser shows its empty-state pane instead of the
 * tree. The capability assertion at this maturity is therefore:
 *
 *   "the library page mounts a region where the project library tree
 *    will live, and the on-ramp affordance to connect a backend is
 *    reachable."
 *
 * That's the partial coverage. Wave 2 (or a follow-up) will populate
 * the OPFS or local backend in the harness, then assert
 * `getByRole('tree')` directly.
 *
 * Selectors are accessible-first; the only data-capability fallback is
 * the LIB-01 region wrapper, used because the library content swaps
 * between an empty-state and a tree depending on backend connection
 * and neither has a single role that survives the swap.
 */
import { test, expect } from '@playwright/test';

const HARNESS_URL =
  '/roland/s330/editor/library?midi=simulated&scenario=load-everything';

test.describe('Capabilities — Library (C-LIB)', () => {
  let pageErrors: string[];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') pageErrors.push(msg.text());
    });

    await page.addInitScript(() => {
      window.localStorage.clear();
    });
    await page.goto(HARNESS_URL);
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(() => {
    expect(pageErrors, 'page should not log harness/adapter errors').toEqual([]);
  });

  test('C-LIB-01: library tree affordance is present', async ({ page }) => {
    // The page heading establishes the surface — accessible by role.
    await expect(
      page.getByRole('heading', { name: 'Library', level: 2 }),
    ).toBeVisible({ timeout: 5_000 });

    // The library content region carries data-capability="C-LIB-01" so
    // the spec doesn't need to know whether the empty-state or the tree
    // is mounted at the moment. Either way, the affordance pane is
    // present; that's the partial coverage the doc declares.
    const libRegion = page.locator('[data-capability="C-LIB-01"]');
    await expect(libRegion).toBeVisible({ timeout: 5_000 });

    // The on-ramp to the tree — at minimum the "Connect to a library
    // folder" empty-state copy or the tree itself must be visible
    // inside the region. We assert the empty-state copy because that's
    // what the harness currently renders. If the harness ever
    // pre-populates a backend, this test will need to flex (or split
    // into two tests scoped by backend state).
    await expect(
      libRegion.getByText(/Connect to a library folder/),
    ).toBeVisible();
  });

  test('D-LIB-04: Sets affordance gate — section is hidden without a library', async ({ page }) => {
    // The PluginLibraryBrowser only mounts its `headerSections` slot
    // (where LibraryPage feeds the SetsSection) when `libraryHandle`
    // is truthy — see modules/editor-core/src/components/library/
    // PluginLibraryBrowser.tsx:818-820. With no library connected,
    // the empty-state pane replaces the sections. The test pins the
    // GATE: in the disconnected-library harness, the SetsSection (and
    // therefore the text 'Sets') MUST NOT appear inside the library
    // region. The connected-library half of the contract (the
    // SetsSection actually mounts when a handle is available) lives
    // in the Wave 4 library-dialog suite (#415), which connects an
    // OPFS backend in the harness.
    const libRegion = page.locator('[data-capability="C-LIB-01"]');
    await expect(libRegion).toBeVisible({ timeout: 5_000 });

    // Disconnected state — the empty-state copy is what the user sees.
    await expect(
      libRegion.getByText(/Connect to a library folder/),
    ).toBeVisible({ timeout: 5_000 });

    // And the Sets section header is absent in this state.
    await expect(libRegion.getByText(/^Sets$/)).toHaveCount(0);
  });

  test('D-LIB-23: DeviceMemoryPanel mounts on both s330 and s550 library pages (clones.yaml 47120235fd38 + 290604cd13fe MemoryPanelAdapter refactor contract)', async ({ page }) => {
    // Test-before-extract contract for the MemoryPanelAdapter half of
    // the s330/s550 library-plugin pair (clone groups 47120235fd38 +
    // 290604cd13fe). Both adapters bridge plugin -> DeviceMemoryPanel
    // identically (props pass-through) but live in two separate files.
    // The refactor promotes the bridging to a shared adapter component
    // that both plugins consume. Without this assertion the refactor
    // could silently mount the panel only for one device.
    //
    // Asserts: the LibraryPage's device-memory column mounts a
    // DeviceMemoryPanel (which carries data-capability="C-LIB-02") on
    // BOTH device URLs. Added 2026-05-22 BEFORE the adapter extraction
    // lands. Must pass against pre-refactor code AND stay green after.
    const s330Panel = page.locator('[data-capability="C-LIB-02"]');
    await expect(s330Panel).toBeVisible({ timeout: 5_000 });

    await page.goto('/roland/s550/editor/library?midi=simulated&scenario=load-everything');
    await page.waitForLoadState('networkidle');
    const s550Panel = page.locator('[data-capability="C-LIB-02"]');
    await expect(s550Panel).toBeVisible({ timeout: 5_000 });
  });

  test('D-LIB-37: empty-state preview panel renders canonical "Preview" header on both s330 and s550 (clones.yaml 47120235fd38 PreviewPanelAdapter refactor contract)', async ({ page }) => {
    // Test-before-extract contract for the PreviewPanelAdapter half of
    // clone group 47120235fd38 (92-line shared body between
    // S330PreviewPanelAdapter and S550PreviewPanelAdapter). Both
    // adapters route to ItemPreviewPanel / CommonSamplePreviewPanel /
    // the empty-state header based on customState.pageSelection
    // identically. The refactor extracts that body to a single shared
    // adapter consumed by both plugins.
    //
    // Asserts: with no pageSelection, BOTH devices render the canonical
    // .ac-panel-header chrome with the "Preview" title. Added 2026-05-22
    // BEFORE the adapter extraction. Must pass pre-refactor + stay
    // green post-refactor.
    const s330PreviewTitle = page
      .locator('.ac-panel-header-title', { hasText: 'Preview' });
    await expect(s330PreviewTitle).toBeVisible({ timeout: 5_000 });

    await page.goto('/roland/s550/editor/library?midi=simulated&scenario=load-everything');
    await page.waitForLoadState('networkidle');
    const s550PreviewTitle = page
      .locator('.ac-panel-header-title', { hasText: 'Preview' });
    await expect(s550PreviewTitle).toBeVisible({ timeout: 5_000 });
  });

  test('D-LIB-38: DeviceMemoryPanel bank headers expose device-{tone,patch}-bank-{toggle,reload}-N testids (clones.yaml 03544a6f535a + b9f7e847ff94 BankHeader-reuse refactor contract)', async ({ page }) => {
    // Test-before-extract contract for replacing DeviceMemoryPanel's
    // local renderBankHeader helper with the shared BankHeader
    // component. The contract: every tone bank in the panel still
    // exposes `device-tone-bank-toggle-${N}` + `device-tone-bank-
    // reload-${N}` testids; every patch bank exposes the analogous
    // `device-patch-bank-*-${N}` pair. The render also still produces
    // the slot-range readout text inside .ac-list-bank-meta.
    //
    // No prior test pinned these testids — they exist only as code
    // identifiers, so a refactor that drops them would silently break
    // any future bank-targeting tests. This assertion adds the
    // protection BEFORE the BankHeader-reuse refactor lands. Must pass
    // pre-refactor + stay green post-refactor.
    const panel = page.locator('[data-capability="C-LIB-02"]');
    await expect(panel).toBeVisible({ timeout: 5_000 });

    await expect(page.getByTestId('device-tone-bank-toggle-0')).toBeVisible();
    await expect(page.getByTestId('device-tone-bank-reload-0')).toBeVisible();
    await expect(page.getByTestId('device-patch-bank-toggle-0')).toBeVisible();
    await expect(page.getByTestId('device-patch-bank-reload-0')).toBeVisible();

    await expect(page.getByTestId('device-tone-bank-toggle-0')).toContainText('Bank 1');
    await expect(page.getByTestId('device-patch-bank-toggle-0')).toContainText('Bank 1');
  });

  test('D-LIB-PAGE-TITLE-01: LibraryPage renders the .ac-page-title-row chrome with heading "Library" + Experimental tag inline + actions slot — RGM-001 PageTitleRow-migration contract', async ({ page }) => {
    // Test-before-migration contract for ROLAND-BUGFIX-RGM-001 sub-task 2
    // (migrate LibraryPage to PageTitleRow's new headingNode + actions
    // variant). The contract LibraryPage preserves through the migration:
    //   - <header class="ac-page-title-row"> wraps the whole row
    //   - .ac-page-title-block > h2#library-heading.ac-page-title-heading
    //     contains "Library" + a child .ac-page-title-tag.ac-page-title-tag--warn
    //     reading "Experimental"
    //   - .ac-page-title-rule renders under the heading
    //   - .ac-page-title-actions (NOT .ac-page-title-metric) contains the
    //     refresh button with aria-label "Refresh device data"
    //
    // Pre-existing tests (D-LIB-22) pin the button's aria-label but not
    // the chrome around it. Must pass against pre-migration code AND
    // post-migration code (after LibraryPage adopts <PageTitleRow
    // headingNode={...} actions={...} />).
    const titleRow = page.locator('header.ac-page-title-row');
    await expect(titleRow).toBeVisible({ timeout: 5_000 });

    const heading = titleRow.locator('h2.ac-page-title-heading');
    await expect(heading).toHaveAttribute('id', 'library-heading');
    await expect(heading).toContainText('Library');

    const experimentalTag = heading.locator('.ac-page-title-tag.ac-page-title-tag--warn');
    await expect(experimentalTag).toHaveText('Experimental');

    await expect(titleRow.locator('.ac-page-title-rule')).toBeVisible();

    // Refresh button lives in .ac-page-title-actions, NOT in .ac-page-title-metric.
    await expect(titleRow.locator('.ac-page-title-actions')).toBeVisible();
    await expect(titleRow.locator('.ac-page-title-metric')).toHaveCount(0);

    const refresh = titleRow.getByRole('button', { name: 'Refresh device data' });
    await expect(refresh).toBeVisible();
  });

  test('D-LIB-DEVICE-MEMORY-SLOTINFO-01: DeviceMemoryPanel slot rows render .ac-list-info wrapper around the slot-name span — RGM-001 SlotInfo-migration contract', async ({ page }) => {
    // Test-before-migration contract for ROLAND-BUGFIX-RGM-001 sub-task 3
    // (extend SlotInfo with dragOverText?: string + isDragOver?: boolean +
    // optional testId, then migrate DeviceMemoryPanel's inline span).
    //
    // DeviceMemoryPanel's slot rows currently render:
    //   <span class="ac-list-info">
    //     <span class="ac-list-name [--placeholder|--empty]">{displayName | "Drop to import"}</span>
    //     {!tone && !isLoaded && !isBankLoading && !isDragOver && (
    //       <span class="ac-list-eyebrow">click to load</span>
    //     )}
    //   </span>
    //
    // This test pins the structural shape (.ac-list-info wrapper +
    // .ac-list-name inner span) so the upcoming migration to
    // <SlotInfo .../> doesn't drop the wrapper class. The drag-over
    // branch (Drop to import) requires simulating a drag event and is
    // out of scope for this wiring test; the structural shape is what
    // catches a botched migration.
    const panel = page.locator('[data-capability="C-LIB-02"]');
    await expect(panel).toBeVisible({ timeout: 5_000 });

    // First tone slot — under load-everything scenario it's loaded.
    // The slot may render inside a collapsed bank section depending on
    // the panel's default expand state; assert structural attachment
    // (wrapper + name span are in the DOM) rather than visibility.
    const slot0 = page.getByTestId('device-tone-slot-0');
    await expect(slot0).toBeAttached({ timeout: 5_000 });

    const wrapper = slot0.locator('.ac-list-info');
    await expect(wrapper).toBeAttached();
    await expect(wrapper.locator('.ac-list-name')).toBeAttached();
  });

  test('D-LIB-22: Refresh Device button is reachable in the page header', async ({ page }) => {
    // LibraryPage.tsx:249 renders a "Refresh Device" button in the
    // sticky page header. It triggers handleLoadDeviceData, which
    // re-reads every tone bank + every patch bank into the store. The
    // affordance is independent of the library backend connection
    // (it talks to the device, not the library), so the harness
    // renders it whether or not the library is connected.
    const refreshButton = page.getByRole('button', { name: 'Refresh Device' });
    await expect(refreshButton).toBeVisible({ timeout: 5_000 });
    // No assertion on enabled — the button's disabled state tracks
    // isLoading, which oscillates as the harness's initial bank loads
    // settle. Visibility is the affordance under test.
  });
});
