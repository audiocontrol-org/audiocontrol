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
});
