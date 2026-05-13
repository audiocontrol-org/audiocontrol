/**
 * Capability specs — Video Capture Drawer (D-XX-09, D-XX-10).
 *
 * See ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md for the canonical
 * statements. The video drawer is mounted on every editor page via
 * Layout.tsx; it surfaces a USB / webcam capture stream alongside the
 * S-330's display + a copy of the front-panel controls (MODE / MENU /
 * SUB / COM / EXEC, navigation D-pad, Inc/Dec) inside the drawer.
 *
 * The DEFAULT_DRAWER_OPEN constant (modules/roland-sxx0-editor/src/
 * stores/uiStore.ts) is true, so the drawer renders open by default
 * under the test harness — the spec doesn't need to click the toggle.
 *
 * Wave 3 scope: display affordances only — actual stream + DT1 emit
 * flows live in Wave 6 (#417) cross-cutting territory.
 *
 * Affordances covered:
 *   - D-XX-09: Video capture drawer mounts and exposes a toggle that
 *     can close + reopen it.
 *   - D-XX-10: Front-panel controls (MODE / MENU / SUB / COM / EXEC,
 *     navigation pad, value buttons) render inside the drawer.
 *
 * Fixture: `tones-bank-0` — the drawer is mount-on-every-page, so any
 * editor URL works; we pick the tones page to match the rest of this
 * suite's scenario URLs.
 */
import { test, expect } from '@playwright/test';

const HARNESS_URL =
  '/roland/s330/editor/tones?midi=simulated&scenario=tones-bank-0';

test.describe('Capabilities — Video Capture Drawer (D-XX)', () => {
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

  test('D-XX-09: video capture drawer mounts with a toggle affordance', async ({ page }) => {
    // Layout.tsx renders the DrawerToggle as a fixed-positioned button
    // with title 'Open S-330 display' (closed) or 'Close S-330 display'
    // (open). DEFAULT_DRAWER_OPEN=true means the harness mounts with
    // the drawer open, so the visible title is 'Close S-330 display'.
    const drawerToggle = page.getByRole('button', {
      name: /Close S-330 display|Open S-330 display/,
    });
    await expect(drawerToggle).toBeVisible({ timeout: 5_000 });

    // The drawer's contents are inside an <aside> rendered by the
    // Drawer component (Layout.tsx:139-165). The 'Enable Camera Access'
    // CTA renders inside it when no camera permission has been
    // granted — that's the deterministic state under the harness
    // (no permission prompt was answered). Asserting it is visible
    // pins the drawer's open state.
    await expect(
      page.getByRole('button', { name: 'Enable Camera Access' }),
    ).toBeVisible({ timeout: 5_000 });

    // Close → reopen flow. After clicking the toggle the 'Open S-330
    // display' title flips into view; clicking again restores 'Close'.
    await drawerToggle.click();
    await expect(
      page.getByRole('button', { name: 'Open S-330 display' }),
    ).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: 'Open S-330 display' }).click();
    await expect(
      page.getByRole('button', { name: 'Close S-330 display' }),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('D-XX-10: front-panel controls render inside the drawer', async ({ page }) => {
    // VideoCapture.tsx mounts the canonical VirtualFrontPanel inside the
    // drawer (replaces the three ad-hoc clusters as of Phase 7 Task 2,
    // commit 81ea648b). With the drawer open at mount, every button is
    // visible. MODE / MENU / SUB / COM / EXEC are the function-button
    // labels surfaced by VirtualFrontPanel.tsx.
    for (const label of ['MODE', 'MENU', 'SUB', 'COM', 'EXEC']) {
      await expect(
        page.getByRole('button', { name: label, exact: true }),
      ).toBeVisible({ timeout: 5_000 });
    }

    // The 'Arrow category' affordance (the 01/09 navigation mode
    // toggle inside the drawer, VideoCapture.tsx:381-397) is also
    // part of this drawer-only contract. The button text is '01' or
    // '09'; we assert the label 'Arrow category:' is visible to pin
    // the affordance.
    await expect(
      page.getByText('Arrow category:', { exact: true }),
    ).toBeVisible({ timeout: 5_000 });

    // The keyboard shortcuts hint is shown at the bottom of the drawer.
    await expect(
      page.getByText('Keys: Arrows, +/-, Enter, F1-F5'),
    ).toBeVisible({ timeout: 5_000 });
  });
});
