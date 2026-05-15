/**
 * Capability specs — Cross-cutting (D-XX-11, D-XX-12, D-XX-13).
 *
 * See ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md for the canonical
 * statements. These are affordances that sit above any single editor
 * page — they're either on the persistent layout (Panic button) or
 * they're a design contract that applies across every parameter-edit
 * pane (the live-edit guard).
 *
 * Affordances covered:
 *   - D-XX-11: MIDI Panic button emits CC 120 + CC 123 across all 16
 *     channels (32 outbound channel messages).
 *   - D-XX-12: Long-running operations surface a progress affordance.
 *     PARTIAL coverage — the inventory marks this `partial` because
 *     (a) the design system requires bytes-transferred / elapsed / ETA,
 *     none of which are wired anywhere, and (b) the `<div role="status">`
 *     percent-bar region in `PatchesPage.tsx:266` does not render during
 *     a real load (the render guard `isLoading && loadingProgress !==
 *     null` is suppressed by `editorStoreBase.setError(null)` resetting
 *     `isLoading: false`; see inventory note for the trace). This spec
 *     pins what IS observable mid-load: the per-row `(loading...)`
 *     placeholder in PatchList rows and the page-title `N of 16 loaded`
 *     counter that advances as patches arrive. We DO NOT assert against
 *     the percent bar or the bytes/elapsed/ETA fields — they would
 *     false-pass against the current state.
 *   - D-XX-13: Live-edit guard — parameter-edit panes carry no Save /
 *     Cancel / Undo buttons. Per `feedback_live_editing_no_save`,
 *     S-330/S-550 parameter edits stream live to the device; the
 *     absence of save/cancel/undo is the design contract. This spec
 *     pins the contract so a redesign that re-introduces those
 *     buttons fails the suite loudly.
 *
 * VFP affordances (D-XX-02..05) are EXPLICITLY NOT covered in this
 * file — they remain blocked on the operator decision about mounting
 * the floating VirtualFrontPanel (see "VFP unmounted" note in the
 * inventory). The drawer-embedded panel is covered by
 * wiring/video-drawer.spec.ts.
 *
 * Fixtures:
 *   - `panic-flow` — connect() + loadPatchRange(0, 8) + 32 CC outbound
 *     records; captured against real S-550 via
 *     `modules/sampler-devices/test/fixtures/s330/panic-flow.ndjson`.
 *   - `patches-bank-0` — reused for the progress + live-edit-guard
 *     mounts; no fresh capture needed.
 */
import { test, expect } from '@playwright/test';
import {
  expectFixtureFullyConsumed,
  readSimulatedAdapterState,
} from './tone-writes-helpers';

// The Patches page is the spec-friendly mount surface for all three
// tests: it hosts the persistent Layout (which holds the Panic button),
// it exercises the load-progress affordance during loadPatchRange, and
// its detail pane is one of the parameter-edit surfaces the live-edit
// guard pins.
const PANIC_HARNESS_URL =
  '/roland/s330/editor/patches?midi=simulated&scenario=panic-flow';

// The progress test slows inbound dispatch so the loadPatchRange round
// trips spread out enough for the progress affordance to be observable
// mid-flight before the load completes and the region disappears. The
// fixture has ~80 outbound RQDs (8 patches × ~10 round-trips); at 200ms
// per inbound delay the load takes ~16s — Playwright's polling sees the
// region for nearly the entire window. 50ms produced a ~4s total load
// which was occasionally clearing before the polling cadence caught it
// (the patches-bank-0 fixture is small; only the latency keeps the load
// long enough to observe).
const PROGRESS_HARNESS_URL =
  '/roland/s330/editor/patches?midi=simulated&scenario=patches-bank-0&simLatency=200';

// The Patches divergence filter inherited from wiring/patches.spec.ts
// — the PatchesPage's mount also triggers a loadToneBank(0) preload that
// hits the patch-only fixture's byte-6 area-selector mismatch. The filter
// matches that narrow signature and only that signature; a real regression
// produces a different error shape and still fails the spec.
//
// Three log shapes can fire during the divergence — the underlying
// SimulatedAdapter throw, the client-layer rethrow message, and the
// useBankLoader catch-block log. All three are narrow signatures tied
// to the known tone-area divergence; any other error shape still fails
// the spec.
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

test.describe('Capabilities — Cross-cutting (D-XX)', () => {
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

  test('D-XX-11: clicking MIDI Panic emits CC 120 + CC 123 across all 16 channels', async ({
    page,
  }) => {
    await page.goto(PANIC_HARNESS_URL);
    await page.waitForLoadState('networkidle');

    // Wait for the mount prelude (connect + loadPatchRange) to finish so
    // the Panic button transitions from disabled to enabled. The
    // PanicButton's `disabled={!isConnected}` predicate flips after
    // `connect()` resolves; before that, a click would no-op and the
    // fixture would stop short of the panic outbound records, failing
    // expectFixtureFullyConsumed with a clear diagnostic.
    const panicButton = page.getByRole('button', { name: /All Notes Off/i });
    await expect(panicButton).toBeEnabled({ timeout: 5_000 });

    // Pre-condition: the mount prelude has consumed everything but the
    // 32 panic outbound records. The fixture has 152 prelude records
    // (sequences 0..151 — alternating outbound RQDs and inbound DT1
    // responses across connect + loadPatchRange(0, 8)) and 32 panic
    // outbounds (sequences 152..183) for 184 total. Reading the cursor
    // before the click confirms the prelude landed cleanly and that
    // the 32 records we're about to verify aren't being credited to a
    // mount-phase emission.
    const beforeClick = await readSimulatedAdapterState(page);
    expect(beforeClick.total).toBe(184);
    expect(beforeClick.cursor).toBe(152);

    await panicButton.click();

    // The Panic button's onClick wires through to useMidiStore.sendPanic
    // (modules/editor-core/src/stores/createMidiStore.ts:273), which
    // emits — per channel 0..15, in this order — CC 120 then CC 123:
    // a total of 32 outbound channel messages. The captured fixture
    // mirrors that order exactly (see record-fixtures-roland-page-
    // scenarios.ts panic-flow scenario). A byte-for-byte mismatch on
    // any of the 32 records throws SimulatedAdapterUnexpectedSendError
    // from the adapter and surfaces in pageErrors.
    await expectFixtureFullyConsumed(page);
  });

  test('D-XX-12: long operation surfaces progress affordance (partial — see comment for what is asserted vs. what the design system requires)', async ({
    page,
  }) => {
    // Default test timeout (playwright.test-harness.config.ts: 15s) is
    // tight relative to the 200ms × ~80 round-trip simulated load
    // (~16s) plus polling + post-load disappear assertion. Bumping to
    // 30s gives the spec a comfortable budget without making it lazy.
    test.setTimeout(30_000);

    // What this test actually asserts (read carefully — the design-
    // system progress contract has THREE gaps in the shipped UI; this
    // spec is honest about pinning only the affordances that exist):
    //
    //   1) Inline `(loading...)` placeholder text in PatchList rows
    //      whose patches haven't arrived yet. This IS a visible mid-
    //      flight progress affordance — the user sees the rows
    //      filling in as patches load. PatchList.tsx:124.
    //   2) The incrementing "N of <total> loaded" counter on the
    //      page-title row (PatchesPage.tsx:240). The counter is the
    //      cross-page metric Phase 9 consolidated when the per-bank
    //      reload toolbar collapsed.
    //
    // What this test DOES NOT assert (and why):
    //
    //   - The `<div className="patches__progress" role="status">`
    //     percent bar (PatchesPage.tsx:266) — investigation showed it
    //     never renders during a real load because `useBankLoader`'s
    //     `setError(null)` call in its catch-block precondition runs
    //     after `setLoading(true)` and resets `isLoading` to false
    //     (editorStoreBase.setError clears loading state as part of
    //     its contract). Asserting on this region would currently
    //     false-fail. Fixing that bug is upstream of Wave 6's scope
    //     (it would touch every editor's load flow); this spec flags
    //     the gap honestly and the inventory's `partial` status on
    //     D-XX-12 covers it.
    //   - The design-system-required bytes-transferred / elapsed
    //     time / ETA fields (per `.claude/rules/ui-development.md`
    //     "Progress Indicators" section). None of these exist in
    //     the current PatchesPage progress affordance. The inventory's
    //     `partial` status flags this gap.
    //
    // The hard contract the spec pins: SOMETHING in the page surfaces
    // mid-load progress to the user. A regression that removed BOTH
    // the per-row placeholder AND the counter would fail this spec.
    await page.goto(PROGRESS_HARNESS_URL);

    // Phase 1 — assert the per-row "(loading...)" placeholder text
    // is visible mid-flight. PatchList renders this for each row whose
    // bank is currently loading (PatchList.tsx:117 `isBankLoading`
    // prop). With simLatency=200 the load spreads over ~16s, so the
    // placeholder is visible for a long, observable window.
    const loadingRows = page.getByText(/\(loading\.\.\.\)/);
    await expect(loadingRows.first()).toBeVisible({ timeout: 5_000 });

    // Phase 2 — assert the counter advances from `0 of 16` (initial
    // mount state) to a non-zero value mid-flight. The counter is
    // simple text in PatchesPage.tsx:240, not wrapped in a
    // role-tagged region, so we locate by text-match. The pattern
    // matches `<N> of 16 loaded` where N is 1..7 (we don't insist
    // on a specific number — the simulated load advances at its own
    // rate; any non-zero count proves the counter is updating).
    await expect(page.getByText(/[1-9]\d* of 16 loaded/)).toBeVisible({
      timeout: 10_000,
    });

    // Phase 3 — assert the load eventually clears the per-row
    // placeholder. After the patches load completes the "(loading...)"
    // strings disappear (the rows show patch names or `(empty)`).
    // This pins the affordance contract: progress is TRANSIENT — it
    // appears, advances, and clears. A regression that left the rows
    // stuck on "(loading...)" would fail here.
    await expect(loadingRows.first()).toBeHidden({ timeout: 20_000 });
  });

  test('D-XX-13: no save/cancel/undo affordances in parameter-edit panes', async ({
    page,
  }) => {
    // The live-edit guard pins a cross-page design contract. Per project
    // memory `feedback_live_editing_no_save`, S-330/S-550 parameter
    // edits stream live to the device; the absence of save/cancel/undo
    // buttons is the canonical UX. This spec mounts the Patches page,
    // selects a patch to surface the PatchEditor (the largest parameter-
    // edit surface), and asserts no save/cancel/undo buttons exist.
    //
    // We assert on the EDITOR scope, not the whole page, so the spec
    // doesn't false-fail on save/cancel buttons that legitimately
    // belong elsewhere (e.g. a Save Set dialog the operator opens
    // explicitly). The PatchEditor wraps in `data-capability="C-PATCH-04"`
    // — using the capability anchor as scope keeps the assertion
    // semantically tied to "the parameter-edit pane" rather than to a
    // DOM-traversal accident.
    await page.goto('/roland/s330/editor/patches?midi=simulated&scenario=patches-bank-0');
    await page.waitForLoadState('networkidle');

    // Select a patch to mount the PatchEditor. The first row in the
    // patch list is `role="button"`; clicking it switches the detail
    // pane into edit mode.
    const firstPatch = page
      .locator('[data-capability="C-PATCH-01"]')
      .getByRole('button')
      .first();
    await firstPatch.click();

    const patchEditor = page.locator('[data-capability="C-PATCH-04"]');
    await expect(patchEditor).toBeVisible({ timeout: 5_000 });

    // The contract: no Save / Cancel / Undo buttons inside the editor.
    // We assert COUNT zero (not "not visible") so a hidden-but-present
    // button also fails the spec — the contract is structural, not
    // visual.
    const saveCancelUndo = patchEditor.getByRole('button', {
      name: /\b(save|cancel|undo)\b/i,
    });
    await expect(saveCancelUndo).toHaveCount(0);
  });
});
