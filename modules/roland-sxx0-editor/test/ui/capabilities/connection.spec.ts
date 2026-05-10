/**
 * Capability specs — Connection (C-CONN-01..04).
 *
 * See ROLAND-S550-EDITOR-CAPABILITIES.md for the canonical capability
 * statements. Each test is named with its capability ID so a regression
 * traces back to a specific capability the doc declares.
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
});
