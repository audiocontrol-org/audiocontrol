/**
 * Capability specs — Connection (C-CONN-01..04 + D-CONN-03, 06).
 *
 * See ROLAND-S550-EDITOR-CAPABILITIES.md (parent) and
 * ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md (drill-down) for the
 * canonical statements. Tests are named with their capability/detail id
 * so a regression traces back to a specific row the inventory declares.
 *
 * Selectors prefer accessible queries (getByRole / getByText / getByLabel).
 * No layout-encoding data-testids in this file. The legacy specs at
 * test/ui/home.spec.ts continue to use the layout-encoding selectors and
 * are NOT replaced by this file — it's a parallel capability suite.
 *
 * Capabilities covered:
 *   - C-CONN-01: User can connect to a device
 *   - C-CONN-02: User can see connection status
 *   - C-CONN-03: User can disconnect from the device
 *   - C-CONN-04: User can navigate to each editor section
 *
 * Detail affordances covered (Wave 3, #414):
 *   - D-CONN-03: Device ID entry field renders
 *   - D-CONN-06: Device-setup help items render
 *
 * Detail affordances structurally untestable under the simulated harness
 * (the MidiConnectionPage hides them when transportMode !== 'web'):
 *   - D-CONN-01: MIDI input port selector
 *   - D-CONN-02: MIDI output port selector
 *   - D-CONN-05: Secure-context warning + help items
 * These require either a web-MIDI mock transport (not implemented in the
 * simulated harness) or hardware, so their test bindings belong to a
 * future infrastructure dispatch — tracked in the inventory's Test column
 * as "needs web-MIDI harness mode".
 */
import { test, expect } from '@playwright/test';

const HARNESS_URL =
  '/roland/s330/editor/?midi=simulated&scenario=load-everything';

test.describe('Capabilities — Connection (C-CONN)', () => {
  let pageErrors: string[];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') pageErrors.push(msg.text());
    });

    // The shared MidiStatusDisplay has an `ac-hide-narrow` class on its
    // text label; the design system collapses it below 1400px wide. The
    // default Playwright viewport (1280x720) sits in the collapsed band,
    // hiding the 'Connected' / 'Disconnected' text. The dot itself is
    // always visible via data-status, but the *text label* is the
    // accessible-query surface this capability test asserts. Widen the
    // viewport for this describe so the text label renders.
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.addInitScript(() => {
      window.localStorage.clear();
    });
    await page.goto(HARNESS_URL);
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(() => {
    expect(pageErrors, 'page should not log harness/adapter errors').toEqual([]);
  });

  test('C-CONN-01: connects to the simulated transport on mount', async ({ page }) => {
    // The simulated transport auto-connects (transport.kind !== 'web-midi'),
    // so the Disconnect affordance becomes visible without any user input —
    // that's the contract: arriving at the page gets you a working session.
    await expect(
      page.getByRole('button', { name: 'Disconnect' }),
    ).toBeVisible({ timeout: 5_000 });

    // The page-scoped status indicator surfaces the connected state. There
    // are TWO occurrences of "Connected" / "Disconnected" — one in the
    // header MidiStatusDisplay (visible) and one inside the narrow-screen
    // hide wrapper. Filter to the visible one.
    await expect(
      page.getByText('Connected', { exact: true }).first(),
    ).toBeVisible();
  });

  test('C-CONN-02: connection status is surfaced in an accessible region', async ({ page }) => {
    // MidiStatusDisplay renders a span with text 'Connected' / 'Disconnected'
    // (see modules/editor-core/src/components/layout/EditorLayout.tsx
    // MidiStatusDisplay). The visible state is what the user reads.
    await expect(
      page.getByText('Connected', { exact: true }).first(),
    ).toBeVisible({ timeout: 5_000 });

    // Transport label is also visible to the user — it tells them which
    // wire their actions are going down. Under simulated harness the label
    // falls through to the raw 'simulated' string.
    await expect(page.getByText(/Transport: simulated/)).toBeVisible();
  });

  test('C-CONN-03: disconnect affordance reachable + leaves status disconnected', async ({ page }) => {
    const disconnectButton = page.getByRole('button', { name: 'Disconnect' });
    await expect(disconnectButton).toBeVisible({ timeout: 5_000 });

    await disconnectButton.click();

    // After disconnect the store flips to 'disconnected' and the connection
    // page re-renders the Connect / Reconnect affordance instead. The
    // 'Disconnected' label appears in the MidiStatusDisplay too — assert
    // the post-disconnect state via the absence of the Disconnect button.
    await expect(disconnectButton).toHaveCount(0, { timeout: 5_000 });
  });

  test('C-CONN-04: navigation affordances reach each editor section', async ({ page }) => {
    // The Layout renders a top-level <nav> with five NavLink anchors.
    // Each renders as <a> — accessible via getByRole('link', { name: ... }).
    // 'Workflows' is intentionally absent — the capabilities doc marks it
    // n/a (not in scope), so the spec doesn't assert it.
    for (const label of ['Connect', 'Play', 'Patches', 'Tones', 'Library']) {
      await expect(
        page.getByRole('link', { name: label, exact: true }),
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test('D-CONN-03: device ID entry field is reachable on the connection page', async ({ page }) => {
    // The MidiConnectionPage renders the device-ID section unconditionally
    // (i.e., regardless of transport mode). The section's heading is the
    // configured deviceIdLabel ('Device ID' in HomePage.tsx) and the
    // input is a <number> bound to the store's deviceId. The S-330 editor
    // applies a display offset of 1 (devices show IDs 1-17 but protocol
    // values are 0-16), so the visible range label reads '(1-17)'.
    // beforeEach already navigated to the harness URL; no extra goto needed.

    await expect(
      page.getByRole('heading', { name: 'Device ID', level: 3 }),
    ).toBeVisible({ timeout: 5_000 });

    // The input has no accessible name beyond its <section> heading. We
    // locate it by its sibling range hint '(1-17)' anchored to the same
    // ac-row container. spinbutton role corresponds to <input type="number">.
    const deviceIdInput = page.getByRole('spinbutton');
    await expect(deviceIdInput).toBeVisible();

    // The HomePage configures deviceIdRange { min: 0, max: 16 } and
    // deviceIdDisplayOffset: 1 (HomePage.tsx:31, :44). The MidiConnectionPage
    // adds the offset for display, so min=1, max=17.
    await expect(deviceIdInput).toHaveAttribute('min', '1');
    await expect(deviceIdInput).toHaveAttribute('max', '17');
  });

  test('D-CONN-06: device-setup help items render under "Connection Help"', async ({ page }) => {
    // HomePage.tsx configures helpItems[] with four S-330-specific bullets.
    // The MidiConnectionPage renders each as a <li>. The capability spec
    // doesn't pin the exact copy (so a help-text edit doesn't break it);
    // instead it asserts the heading mounts AND >=4 bullets render (so a
    // regression that strips the list shows up).
    // beforeEach already navigated to the harness URL; no extra goto needed.

    const helpHeading = page.getByRole('heading', {
      name: 'Connection Help',
      level: 3,
    });
    await expect(helpHeading).toBeVisible({ timeout: 5_000 });

    // The help-items list lives inside the same <section> as the heading.
    // ac-help-list is the design-system class; we use getByRole('list')
    // scoped to that section + assert minimum bullet count.
    const helpSection = page
      .locator('section')
      .filter({ has: helpHeading });
    const bullets = helpSection.getByRole('listitem');
    await expect(bullets).toHaveCount(4);
  });
});
