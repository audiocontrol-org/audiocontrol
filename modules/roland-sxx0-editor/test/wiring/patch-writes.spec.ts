/**
 * Patch parameter write-capability specs (D-PATCH-01..05, 07..12).
 *
 * Each test mounts a fixture that captures the PatchesPage mount sequence
 * (connect + loadPatchRange(0, 8)) plus ONE setter call (and, for the three
 * conditional sliders, a setPatchKeyMode prelude that enables the slider).
 * The spec drives the UI to emit the same setter at the same value. The
 * SimulatedAdapter strict-matches the outbound bytes; absence of
 * pageerror after the interaction = the UI emitted exactly the captured
 * bytes.
 *
 * URL routing note: these tests use the `/roland/s550/editor/...` route
 * (not `/roland/s330/...` like play-writes) because several of the
 * patch-edit setters diverge between S-330 and S-550 implementations.
 * For example, setPatchName on S-330 splits the 12-byte name into two
 * 8+4-byte writes at address offsets 0 and +16, while S-550 uses a
 * single 12-byte write — see modules/sampler-devices/dist/s330.js:2717
 * vs dist/s550.js:2037. The fixtures were recorded with createS550Client,
 * so the UI must use createS550Client (URL=s550) to emit matching bytes.
 *
 * Fixture path note: filed under s330/ because the editor's useMidiStore
 * legacy alias is hardcoded to getMidiStore('s330'), so the simulated
 * transport fetches /test-fixtures/s330/... regardless of URL device
 * segment. The captured bytes are S-550 device behavior. The DeviceConfig
 * context (which controls which client factory the editor uses) is
 * separately URL-routed and gives us the S-550 client.
 *
 * Tone-load divergence: PatchesPage mounts loadToneBank(0) after
 * loadPatchRange(0, 8) (see PatchesPage.tsx:130-133), but the
 * patch-write fixtures only capture connect + loadPatchRange + setter.
 * The 8 tone RQDs all mismatch the next recorded outbound (the setter's
 * WSD). SimulatedAdapter does NOT advance its cursor on mismatch
 * (see modules/sampler-devices/src/simulation/simulated-adapter.ts:64-90),
 * so when the user-driven setter eventually fires it matches at the
 * still-pristine cursor. The 8 tone-load failures surface as console
 * errors that this spec filters via `isKnownTonePreloadDiagnostic` —
 * the same filter `capabilities/patches.spec.ts` uses (issue #405).
 *
 * D-PATCH-06 (Oct.Shift) is display-only pending issue #10 and is not
 * tested here.
 *
 * Affordances covered:
 *   - D-PATCH-01: setPatchName            — inline text edit on patch title
 *   - D-PATCH-02: setPatchKeyMode         — Key Mode select
 *   - D-PATCH-03: setPatchKeyAssign       — Key Assign select
 *   - D-PATCH-04: setPatchBenderRange     — Pitch Bender Range select
 *   - D-PATCH-05: setPatchAftertouchAssign — A.T Assign select
 *   - D-PATCH-07: setPatchOutput          — Output Assign select
 *   - D-PATCH-08: setPatchLevel           — Level slider (v3 AcSlider)
 *   - D-PATCH-09: setPatchAftertouchSens  — A.T Sense slider (v3 AcSlider)
 *   - D-PATCH-10: setPatchDetune          — Unison Detune slider, keyMode=unison
 *   - D-PATCH-11: setPatchVelocityThreshold — V-Sw Thresh slider, keyMode=v-sw
 *   - D-PATCH-12: setPatchVelocityMixRatio — V-Mix Ratio slider, keyMode=v-mix
 *
 * Slider note: after the Phase 9 Task 4 PatchesPage amend, the slider
 * rows are AcSlider (display-only range bar) + AcNumberInput(editable)
 * (the focusable affordance) — see ParamSliderRow.tsx. The legacy
 * `param-<label>` data-testid wrapper is preserved, but the inner
 * affordance changed from a Radix Slider.Root (click-on-track) to an
 * `<input type="number">` (page.fill). Each onChange streams the value
 * straight to the device (no separate commit edge); page.fill clears
 * and types atomically, so the spec's fillSliderInput helper emits
 * exactly ONE outbound write at the final value.
 */
import { test, expect, type Page, type Locator } from '@playwright/test';

const PATCHES_URL = (scenario: string): string =>
  `/roland/s550/editor/patches?midi=simulated&scenario=${scenario}`;

// Mirrors the filter in capabilities/patches.spec.ts. The PatchesPage's
// mount sequence emits loadToneBank(0) which the patch-write fixtures
// don't capture; the resulting 8 RQD-vs-WSD mismatches surface as console
// errors that aren't load-bearing for the affordance under test.
//
// The signature is highly specific: the SimulatedAdapter's
// SimulatedAdapterUnexpectedSendError reports "first diff at byte 4:
// expected 0x40, got 0x41". Byte 4 in the Roland S-series exclusive frame
// (F0 41 dev 1E [cmd] ...) is the Command ID — 0x40 is WSD (the captured
// next outbound is a setter writing to patch memory) and 0x41 is RQD (the
// UI is emitting an unrecorded tone RQD from PatchesPage's loadToneBank(0)
// preload). Matching only this exact byte-4 WSD-vs-RQD mismatch keeps the
// filter narrow: any other adapter mismatch — including a real setter
// emitting wrong bytes (which would diff at byte 5+ on the address /
// payload) — will NOT match and will fail the test.
const KNOWN_TONE_LOAD_DIVERGENCE =
  /SimulatedAdapter[\s\S]*first diff at byte 4:\s*expected 0x40,\s*got 0x41/;
const S_SERIES_TONE_LOAD_ERROR = /\[S(330|550)Client\] Error loading tone \d+/;

function isKnownTonePreloadDiagnostic(text: string): boolean {
  return KNOWN_TONE_LOAD_DIVERGENCE.test(text) || S_SERIES_TONE_LOAD_ERROR.test(text);
}

/**
 * Wait for the PatchesPage's mount sequence to drain against the
 * SimulatedAdapter and for the PatchEditor to render after we click
 * the first patch slot. Two signals must both hold:
 *   - The patch list root is visible (proves loadPatchRange(0, 8)
 *     completed and populated the UI).
 *   - Clicking the P11 slot opens the editor (PatchEditor's root has
 *     data-capability="C-PATCH-04").
 *
 * Returns the editor locator so the caller can drill in to the
 * affordance under test.
 */
async function openPatch0Editor(page: Page): Promise<Locator> {
  const list = page.locator('[data-capability="C-PATCH-01"]');
  await expect(list).toBeVisible({ timeout: 5_000 });

  // I11 is patch index 0 in the S-550 memory layout (see
  // modules/roland-sxx0-editor/src/configs/memory-layout.ts:151-158 —
  // S-550 slots are I11..I28 + II11..II28, two blocks of 16). Activating
  // the first slot mounts PatchEditor (data-capability="C-PATCH-04").
  await list.getByRole('button', { name: /^I11\b/ }).click();

  const editor = page.locator('[data-capability="C-PATCH-04"]');
  await expect(editor).toBeVisible({ timeout: 5_000 });
  return editor;
}

/**
 * Drive a v3 AcSlider row to a target value with exactly one outbound
 * write. The wrapper is the `<div data-testid="param-...">` that
 * encloses the row (see PatchEditor's ParamSliderRow); inside is the
 * `<AcNumberInput editable>` `<input type="number">` (the focusable
 * affordance — `AcSlider`'s bar is display-only per DESIGN-SYSTEM.md).
 *
 * `page.fill` clears the existing value and types the new one in one
 * atomic step — Playwright dispatches a single `input` event with the
 * final value (verified in `Locator.fill` source: fires `input` after
 * setting `.value`, no per-keystroke events). The onChange handler on
 * `AcNumberInput` parses the value and the row's onChange streams it
 * to the device.
 *
 * Pre-conditions:
 *   - The input must not be `disabled` (caller must enable conditional
 *     sliders by selecting the matching keyMode first).
 *   - The current value should differ from `targetValue`; React's
 *     controlled-input no-op skips an onChange dispatch if the new
 *     value matches the prop. The patch-write fixtures all set values
 *     that differ from the loaded patch's defaults, so this is
 *     satisfied in practice.
 */
async function fillSliderInput(
  wrapper: Locator,
  targetValue: number,
): Promise<void> {
  const input = wrapper.locator('input[type="number"]').first();
  await expect(input).toBeVisible({ timeout: 5_000 });
  await input.fill(String(targetValue));
  // Blur to ensure React's controlled-input change cycle completes and
  // any downstream effect handlers settle before the spec's
  // page.waitForLoadState('networkidle') runs.
  await input.blur();
}

test.describe('Patch parameter write affordances (D-PATCH-01..05, 07..12)', () => {
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
    expect(
      pageErrors,
      'no SimulatedAdapter mismatch (beyond the known tone-preload divergence, issue #405) or harness errors after driving the setter',
    ).toEqual([]);
  });

  test('D-PATCH-01: editing patch name writes setPatchName', async ({ page }) => {
    await page.goto(PATCHES_URL('patch-0-name'));
    const editor = await openPatch0Editor(page);

    // The patch name on the detail header is a clickable <span> that
    // swaps into an <input data-testid="patch-name-input"> when clicked.
    // Click the displayed name to enter edit mode, then fill + Enter to
    // commit (handleNameChange calls setPatchName(0, 'TESTNAME')).
    await editor.locator('.patches__detail-name').click();
    const nameInput = page.getByTestId('patch-name-input');
    await expect(nameInput).toBeVisible({ timeout: 2_000 });
    await nameInput.fill('TESTNAME');
    await nameInput.press('Enter');

    await page.waitForLoadState('networkidle');
  });

  test('D-PATCH-02: adjusting key mode writes setPatchKeyMode', async ({ page }) => {
    await page.goto(PATCHES_URL('patch-0-key-mode'));
    await openPatch0Editor(page);

    // Captured fixture sets keyMode='x-fade' (option value 'x-fade').
    // selectOption fires change, which invokes handleKeyModeChange ->
    // setPatchKeyMode(0, 'x-fade').
    await page.getByTestId('patch-key-mode').selectOption({ value: 'x-fade' });

    await page.waitForLoadState('networkidle');
  });

  test('D-PATCH-03: adjusting key assign writes setPatchKeyAssign', async ({ page }) => {
    await page.goto(PATCHES_URL('patch-0-key-assign'));
    await openPatch0Editor(page);

    // Captured fixture sets keyAssign='fix' (vs typical default 'rotary').
    await page.getByTestId('patch-key-assign').selectOption({ value: 'fix' });

    await page.waitForLoadState('networkidle');
  });

  test('D-PATCH-04: adjusting bender range writes setPatchBenderRange', async ({ page }) => {
    await page.goto(PATCHES_URL('patch-0-bender-range'));
    await openPatch0Editor(page);

    // Captured fixture sets benderRange=8 (8 semitones).
    await page.getByTestId('patch-bender-range').selectOption({ value: '8' });

    await page.waitForLoadState('networkidle');
  });

  test('D-PATCH-05: adjusting aftertouch assign writes setPatchAftertouchAssign', async ({ page }) => {
    await page.goto(PATCHES_URL('patch-0-at-assign'));
    await openPatch0Editor(page);

    // Captured fixture sets aftertouchAssign='filter'.
    await page.getByTestId('patch-at-assign').selectOption({ value: 'filter' });

    await page.waitForLoadState('networkidle');
  });

  test('D-PATCH-07: adjusting output assign writes setPatchOutput', async ({ page }) => {
    await page.goto(PATCHES_URL('patch-0-output'));
    await openPatch0Editor(page);

    // Captured fixture sets output=4 (Out 5; the select's values are 0..7
    // for Out 1..8 plus 8 for TONE). selectOption drives
    // handleOutputChange(4) -> setPatchOutput(0, 4).
    await page.getByTestId('patch-output').selectOption({ value: '4' });

    await page.waitForLoadState('networkidle');
  });

  test('D-PATCH-08: adjusting level writes setPatchLevel', async ({ page }) => {
    await page.goto(PATCHES_URL('patch-0-level'));
    const editor = await openPatch0Editor(page);

    // Captured fixture sets level=100 (slider min=0, max=127).
    await fillSliderInput(editor.getByTestId('param-level'), 100);

    await page.waitForLoadState('networkidle');
  });

  test('D-PATCH-09: adjusting aftertouch sensitivity writes setPatchAftertouchSens', async ({ page }) => {
    await page.goto(PATCHES_URL('patch-0-at-sens'));
    const editor = await openPatch0Editor(page);

    // Captured fixture sets aftertouchSens=75 (slider min=0, max=127).
    // The ParamSliderRow for 'A.T Sense' renders with data-testid
    // 'param-a-t-sense' (labelToTestId slugifies 'A.T Sense').
    await fillSliderInput(editor.getByTestId('param-a-t-sense'), 75);

    await page.waitForLoadState('networkidle');
  });

  test('D-PATCH-10: adjusting unison detune writes setPatchDetune (after enabling unison keyMode)', async ({ page }) => {
    await page.goto(PATCHES_URL('patch-0-detune'));
    const editor = await openPatch0Editor(page);

    // Conditional slider — must enable by switching keyMode to 'unison'
    // first. This emits setPatchKeyMode(0, 'unison'), which the fixture
    // captured as the prelude.
    await page.getByTestId('patch-key-mode').selectOption({ value: 'unison' });

    // Captured fixture sets detune=20. The PatchEditor offsets the
    // slider value by +64 (signed -> unsigned) so the editable readout
    // displays 84 to emit detune=20 to the device.
    await fillSliderInput(editor.getByTestId('param-unison-detune'), 84);

    await page.waitForLoadState('networkidle');
  });

  test('D-PATCH-11: adjusting v-sw threshold writes setPatchVelocityThreshold (after enabling v-sw keyMode)', async ({ page }) => {
    await page.goto(PATCHES_URL('patch-0-vsw-threshold'));
    const editor = await openPatch0Editor(page);

    // Conditional slider — keyMode='v-sw' prelude.
    await page.getByTestId('patch-key-mode').selectOption({ value: 'v-sw' });

    // Captured fixture sets velocityThreshold=80.
    await fillSliderInput(editor.getByTestId('param-v-sw-thresh'), 80);

    await page.waitForLoadState('networkidle');
  });

  test('D-PATCH-12: adjusting v-mix ratio writes setPatchVelocityMixRatio (after enabling v-mix keyMode)', async ({ page }) => {
    await page.goto(PATCHES_URL('patch-0-vmix-ratio'));
    const editor = await openPatch0Editor(page);

    // Conditional slider — keyMode='v-mix' prelude.
    await page.getByTestId('patch-key-mode').selectOption({ value: 'v-mix' });

    // Captured fixture sets velocityMixRatio=64.
    await fillSliderInput(editor.getByTestId('param-v-mix-ratio'), 64);

    await page.waitForLoadState('networkidle');
  });
});
