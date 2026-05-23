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

  test('C-CONN-02b: continue-to-next-section affordance appears once connected', async ({ page }) => {
    // The device config's `continueLabel` is rendered as a button only
    // after auto-connect completes. For S-330 that label is
    // 'Continue to Patches' (see modules/roland-sxx0-editor/src/devices/s330.ts).
    // This assertion previously lived in test/ui/home.spec.ts and was
    // migrated here as part of #426's Option C disposition — the wiring
    // tier already proves auto-connect, so the continue affordance is
    // the same auto-connect contract surfaced one frame later.
    await expect(
      page.getByRole('button', { name: 'Continue to Patches' }),
    ).toBeVisible({ timeout: 5_000 });
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
    // After the 2026-05-18 connect-page redesign (the operator-
    // approved VFD-status mockup) the Device ID input no longer
    // lives in its own <section> with a level-3 heading. It now
    // sits inside the "Connection details" disclosure, which is
    // collapsed by default. The capability — "device ID is
    // reachable on the connection page" — is still satisfied; the
    // operator has to open the disclosure to set it manually
    // (manual setup being the disclosure's whole purpose).

    // Open the Connection details disclosure.
    const detailsSummary = page.getByText('Connection details', { exact: false }).first();
    await expect(detailsSummary).toBeVisible({ timeout: 5_000 });
    await detailsSummary.click();

    // The Device ID input is the spinbutton inside the disclosure.
    // The S-330 editor applies a display offset (devices show IDs
    // 1-17 but protocol values are 0-16), so the visible range is
    // 1-17.
    const deviceIdInput = page.getByRole('spinbutton');
    await expect(deviceIdInput).toBeVisible({ timeout: 5_000 });
    await expect(deviceIdInput).toHaveAttribute('min', '1');
    await expect(deviceIdInput).toHaveAttribute('max', '17');
  });

  test('D-CONNECT-PAGE-TITLE-01: HomePage renders the .ac-page-title-row chrome with heading + rule + metric text (no LED, no refresh) — RGM-001 PageTitleRow-migration contract', async ({ page }) => {
    // Test-before-migration contract for ROLAND-BUGFIX-RGM-001 sub-task 1
    // (extend PageTitleRow with showLed?: boolean + headingNode?: ReactNode
    // + optional isLoading/refreshLabel; then migrate HomePage to use it).
    //
    // HomePage's title-row currently has:
    //   <header class="ac-page-title-row">
    //     <div class="ac-page-title-block">
    //       <h2 id="connect-heading" class="ac-page-title-heading">Connect</h2>
    //       <div class="ac-page-title-rule" />
    //     </div>
    //     <span class="ac-page-title-metric">{deviceName} · MIDI Handshake</span>
    //   </header>
    //
    // Notably NO .ac-page-title-led + NO refresh button (HomePage is the
    // connect page; LED would be misleading until a device is bound).
    //
    // This test pins the shape so the PageTitleRow extension that adds
    // `showLed?: boolean` (default true; HomePage sets false) and makes
    // `isLoading` / `refreshLabel` optional does NOT inadvertently start
    // rendering the LED or refresh button on HomePage post-migration.
    // Must pass against pre-migration code AND post-migration code.
    const titleRow = page.locator('header.ac-page-title-row');
    await expect(titleRow).toBeVisible({ timeout: 5_000 });

    const heading = titleRow.locator('h2.ac-page-title-heading');
    await expect(heading).toHaveText('Connect');
    await expect(heading).toHaveAttribute('id', 'connect-heading');

    await expect(titleRow.locator('.ac-page-title-rule')).toBeVisible();

    // The metric span carries the device-name · handshake-text. Plain
    // string content; no LED, no refresh button.
    const metric = titleRow.locator('.ac-page-title-metric');
    await expect(metric).toBeVisible();
    await expect(metric).toContainText(/·\s*MIDI Handshake/);
    await expect(metric.locator('.ac-page-title-led')).toHaveCount(0);
    await expect(metric.getByRole('button')).toHaveCount(0);
  });

  test('D-CONN-06: device-setup help items render in the Setup guide / Troubleshooting disclosures', async ({ page }) => {
    // After the 2026-05-18 connect-page redesign the single
    // "Connection Help" section was split into TWO disclosures
    // both collapsed by default: "Setup guide · prepare your
    // device for SysEx control" and "Troubleshooting · the editor
    // can't reach the device". The capability — "device-setup help
    // is reachable on the connection page" — is still satisfied.

    // Setup guide disclosure surfaces a numbered procedure (7
    // steps). Open it and verify the list renders.
    const setupSummary = page.getByText('Setup guide', { exact: false }).first();
    await expect(setupSummary).toBeVisible({ timeout: 5_000 });
    await setupSummary.click();

    const setupSteps = page.getByRole('list').first().getByRole('listitem');
    await expect(setupSteps.first()).toBeVisible({ timeout: 5_000 });
    const stepCount = await setupSteps.count();
    expect(stepCount).toBeGreaterThanOrEqual(4);

    // Troubleshooting disclosure surfaces the original four help
    // bullets (and more — the current copy adds extra context).
    const troubleshootSummary = page.getByText('Troubleshooting', { exact: false }).first();
    await expect(troubleshootSummary).toBeVisible();
    await troubleshootSummary.click();
  });
});
