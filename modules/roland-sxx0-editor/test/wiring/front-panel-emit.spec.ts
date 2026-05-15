/**
 * Capability specs — Front-panel DT1-emit affordances (D-XX-02, D-XX-03,
 * D-XX-04).
 *
 * The drawer-embedded front panel (mounted via `VideoCapture.tsx:363-380`)
 * is the canonical surface per `docs/1.0/001-IN-PROGRESS/s550-support/
 * decisions-2026-05-11.md` Decision 1 (the floating VirtualFrontPanel is
 * removed). Each button maps deterministically to one or more DT1 SysEx
 * messages through `createFrontPanelController`
 * (modules/sampler-devices/src/devices/s330/s330-front-panel.ts).
 *
 * Affordances covered:
 *   - D-XX-02: Front-panel navigation buttons (arrows: up/down/left/right)
 *     emit a single category-01 DT1 each in the default 'menu' mode.
 *   - D-XX-03: Front-panel value buttons (inc/dec) emit a category-09
 *     press DT1, a 50ms delay, and a category-09 release DT1 each — two
 *     DT1 records per click.
 *   - D-XX-04: Front-panel function buttons (MODE / MENU / SUB / COM /
 *     EXEC) emit a single category-01 DT1 each.
 *
 * D-XX-09 (drawer mount) and D-XX-10 (in-drawer button rendering) are
 * covered separately by `capabilities/video-drawer.spec.ts`. This spec
 * covers the DT1-emit side only — the bytes that flow when the user
 * actually clicks each button.
 *
 * Fixtures (captured against real S-550 on Volt 4 — fixtures live under
 * `s330/` per Wave 2 convention; see `tones.spec.ts:11-15` for the
 * rationale):
 *   - `front-panel-function-flow.ndjson` — 152 prelude + 5 function-button
 *     DT1 records = 157 total.
 *   - `front-panel-nav-flow.ndjson` — 152 prelude + 4 arrow DT1 records
 *     = 156 total.
 *   - `front-panel-value-flow.ndjson` — 152 prelude + 4 value-button DT1
 *     records (inc press+release, dec press+release) = 156 total.
 *
 * The PatchesPage is the spec-friendly mount surface because (a) Layout
 * is global so the drawer is hosted on every editor page, and (b) the
 * PatchesPage's mount prelude is just `connect() + loadPatchRange(0, 8)`
 * — the smallest fixture footprint among the editor pages, which keeps
 * the per-spec runtime fast.
 *
 * Known divergence — the PatchesPage's `loadInitialData` calls
 * `loadToneBank(0)` after the patch-range load (PatchesPage's standard
 * mount). Because our fixtures only contain bytes for `loadPatchRange`,
 * the tone-bank load fails against the strict-matching simulated
 * adapter with the same byte-6 signature the cross-cutting spec
 * already filters. We import the same filter rather than duplicating
 * the regex.
 */
import { test, expect } from '@playwright/test';
import {
  expectFixtureFullyConsumed,
  readSimulatedAdapterState,
} from './tone-writes-helpers';

// Harness URLs — one per scenario. PatchesPage hosts the drawer (Layout
// is global) and has the lightest mount prelude (152 records); we route
// MIDI to the simulated transport via ?midi=simulated&scenario=... per
// the standard capability-spec convention.
function patchesHarnessUrl(scenario: string): string {
  return `/roland/s330/editor/patches?midi=simulated&scenario=${scenario}`;
}

// The Patches divergence filter (inherited verbatim from
// cross-cutting.spec.ts) — the PatchesPage's mount also triggers a
// `loadToneBank(0)` preload that hits the patch-only fixture's byte-6
// area-selector mismatch. The filter matches only that narrow signature;
// any other error shape still fails the spec.
const KNOWN_TONE_LOAD_DIVERGENCE =
  /SimulatedAdapter[\s\S]*first diff at byte 6:\s*expected 0x00,\s*got 0x03/;
const S_SERIES_TONE_LOAD_ERROR = /\[S(330|550)Client\] Error loading tone \d+/;
const BANK_LOADER_TONE_ERROR = /\[useBankLoader\] Error loading tones/;

function isKnownTonePreloadDiagnostic(text: string): boolean {
  return (
    KNOWN_TONE_LOAD_DIVERGENCE.test(text) ||
    S_SERIES_TONE_LOAD_ERROR.test(text) ||
    BANK_LOADER_TONE_ERROR.test(text)
  );
}

test.describe('Capabilities — Front-panel DT1-emit (D-XX)', () => {
  let pageErrors: string[];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    page.on('pageerror', (err) => {
      if (isKnownTonePreloadDiagnostic(err.message)) return;
      pageErrors.push(err.message);
    });
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (isKnownTonePreloadDiagnostic(text)) return;
      pageErrors.push(text);
    });

    await page.addInitScript(() => {
      window.localStorage.clear();
    });
  });

  test.afterEach(() => {
    expect(pageErrors, 'page should not log harness/adapter errors').toEqual([]);
  });

  test('D-XX-02: clicking the four arrow buttons emits one category-01 DT1 each in menu mode', async ({
    page,
  }) => {
    await page.goto(patchesHarnessUrl('front-panel-nav-flow'));
    await page.waitForLoadState('networkidle');

    // Wait for the mount prelude (connect + loadPatchRange) to finish so
    // the drawer's arrow buttons transition from disabled to enabled. The
    // buttons carry `disabled={!isConnected || isPressing}` (VideoCapture
    // wires through `useFrontPanel`); before connect() resolves a click
    // would no-op and `expectFixtureFullyConsumed` would fail with a
    // clear cursor diagnostic.
    const upArrow = page.getByRole('button', { name: 'Arrow up' });
    await expect(upArrow).toBeEnabled({ timeout: 5_000 });

    // Pre-condition: the mount prelude consumed exactly the 152 prelude
    // records; the 4 outbound DT1 records sit at sequences 152..155. The
    // total fixture size is 156. Reading the cursor before any click
    // confirms the prelude landed cleanly and credits the 4 records about
    // to be verified to the click side, not the mount side.
    const beforeClick = await readSimulatedAdapterState(page);
    expect(beforeClick.total).toBe(156);
    expect(beforeClick.cursor).toBe(152);

    // Click each arrow in the recorded order. The capture used 'menu'
    // mode (the default — useFrontPanel.ts:93 — so this spec does NOT
    // touch the drawer's "Arrow category" 01/09 toggle). Each click
    // emits one DT1 message (ARROW_CODES_CAT01 in s330-front-panel.ts:
    // 97-102).
    await upArrow.click();
    await page.getByRole('button', { name: 'Arrow down' }).click();
    await page.getByRole('button', { name: 'Arrow left' }).click();
    await page.getByRole('button', { name: 'Arrow right' }).click();

    await expectFixtureFullyConsumed(page);
  });

  test('D-XX-03: clicking the inc/dec buttons emits a category-09 press + release DT1 each', async ({
    page,
  }) => {
    await page.goto(patchesHarnessUrl('front-panel-value-flow'));
    await page.waitForLoadState('networkidle');

    const incButton = page.getByRole('button', { name: 'Increment' });
    await expect(incButton).toBeEnabled({ timeout: 5_000 });

    // Pre-condition: 152 prelude + 4 value-button DT1 records (inc press,
    // inc release, dec press, dec release) = 156 total.
    const beforeClick = await readSimulatedAdapterState(page);
    expect(beforeClick.total).toBe(156);
    expect(beforeClick.cursor).toBe(152);

    // Each value-button click emits TWO DT1 records: a category-09 press,
    // a 50ms delay (NAVIGATION_DELAY_MS), and a category-09 release. The
    // useFrontPanel hook's `pressButton` awaits the controller's
    // `pressNavigation`, so the second click cannot race ahead of the
    // first's release. We click Inc then Dec in the captured order.
    await incButton.click();
    await page.getByRole('button', { name: 'Decrement' }).click();

    await expectFixtureFullyConsumed(page);
  });

  test('D-XX-04: clicking the five function buttons emits one category-01 DT1 each', async ({
    page,
  }) => {
    await page.goto(patchesHarnessUrl('front-panel-function-flow'));
    await page.waitForLoadState('networkidle');

    const modeButton = page.getByRole('button', { name: 'MODE', exact: true });
    await expect(modeButton).toBeEnabled({ timeout: 5_000 });

    // Pre-condition: 152 prelude + 5 function-button DT1 records = 157
    // total.
    const beforeClick = await readSimulatedAdapterState(page);
    expect(beforeClick.total).toBe(157);
    expect(beforeClick.cursor).toBe(152);

    // Click each function button in the recorded order — MODE, MENU, SUB,
    // COM, EXEC. Each emits one category-01 DT1 message (FUNCTION_CODES
    // in s330-front-panel.ts:131-135). The drawer's VirtualFrontPanel
    // (Phase 7 Task 2, commit 81ea648b) renders the buttons with these
    // exact aria-label values.
    await modeButton.click();
    await page.getByRole('button', { name: 'MENU', exact: true }).click();
    await page.getByRole('button', { name: 'SUB', exact: true }).click();
    await page.getByRole('button', { name: 'COM', exact: true }).click();
    await page.getByRole('button', { name: 'EXEC', exact: true }).click();

    await expectFixtureFullyConsumed(page);
  });
});
