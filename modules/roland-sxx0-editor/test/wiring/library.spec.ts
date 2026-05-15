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
