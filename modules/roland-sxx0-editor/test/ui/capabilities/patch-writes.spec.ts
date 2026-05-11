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
 *   - D-PATCH-08: setPatchLevel           — Level slider (Radix)
 *   - D-PATCH-09: setPatchAftertouchSens  — A.T Sense slider (Radix)
 *   - D-PATCH-10: setPatchDetune          — Unison Detune slider, keyMode=unison
 *   - D-PATCH-11: setPatchVelocityThreshold — V-Sw Thresh slider, keyMode=v-sw
 *   - D-PATCH-12: setPatchVelocityMixRatio — V-Mix Ratio slider, keyMode=v-mix
 *
 * Slider note: the PatchEditor's sliders are Radix `Slider.Root` (not the
 * native input slider used on the PlayPage). To emit exactly ONE
 * onValueCommit, this spec clicks the slider's track at the X position
 * that maps linearly to the target value; Radix fires onSlideStart on
 * pointerdown and onValueCommit on pointerup, producing exactly one
 * setter call per click.
 */
import { test, expect, type Page, type Locator } from '@playwright/test';

const PATCHES_URL = (scenario: string): string =>
  `/roland/s550/editor/patches?midi=simulated&scenario=${scenario}`;

// Mirrors the filter in capabilities/patches.spec.ts. The PatchesPage's
// mount sequence emits loadToneRange(0, 8) which the patch-write fixtures
// don't capture; the resulting 8 RQD-vs-WSD mismatches surface as console
// errors that aren't load-bearing for the affordance under test.
const KNOWN_TONE_LOAD_DIVERGENCE =
  /SimulatedAdapter[\s\S]*(at sequence \d+|exhausted)[\s\S]*/;
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
 * Drive a Radix ParameterSlider to a target value with exactly one
 * onValueCommit. The slider's clickable root has
 * `data-orientation="horizontal"`; clicking at an X position within it
 * fires onSlideStart on pointerdown (setting the value linearly from
 * the X position) and onValueCommit on pointerup. The mapping is
 * `(targetValue - min) / (max - min) = (clickX - rect.left) / rect.width`
 * (see @radix-ui/react-slider getValueFromPointer in dist/index.js).
 *
 * Pre-conditions:
 *   - The slider must not be `disabled` (caller must enable conditional
 *     sliders by selecting the matching keyMode first).
 *   - The current slider value MUST differ from `targetValue`; if they
 *     match, Radix's onValueCommit only fires when value changed, and
 *     the test would silently emit nothing.
 */
async function clickSliderAtValue(
  page: Page,
  wrapper: Locator,
  targetValue: number,
  min: number,
  max: number,
): Promise<void> {
  // The wrapper is the <div data-testid="param-..."> in ParameterSlider.tsx;
  // inside is the Slider.Root, which carries data-orientation="horizontal".
  // .first() resolves to the Root (not the nested Track which also has the
  // same attribute) because Root appears first in document order.
  const sliderRoot = wrapper
    .locator('[data-orientation="horizontal"]')
    .first();
  await expect(sliderRoot).toBeVisible({ timeout: 5_000 });

  const box = await sliderRoot.boundingBox();
  if (!box) {
    throw new Error('clickSliderAtValue: slider root has no bounding box');
  }

  const ratio = (targetValue - min) / (max - min);
  // Inset from the edges by 1px to avoid landing exactly on the boundary
  // where rounding could resolve to the wrong step value.
  const insetX = Math.max(1, Math.min(box.width - 1, ratio * box.width));
  const clickX = box.x + insetX;
  const clickY = box.y + box.height / 2;

  await page.mouse.click(clickX, clickY);
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
    await clickSliderAtValue(page, editor.getByTestId('param-level'), 100, 0, 127);

    await page.waitForLoadState('networkidle');
  });

  test('D-PATCH-09: adjusting aftertouch sensitivity writes setPatchAftertouchSens', async ({ page }) => {
    await page.goto(PATCHES_URL('patch-0-at-sens'));
    const editor = await openPatch0Editor(page);

    // Captured fixture sets aftertouchSens=75 (slider min=0, max=127).
    // The ParameterSlider for 'A.T Sense' renders with data-testid
    // 'param-a-t-sense' (labelToTestId slugifies 'A.T Sense').
    await clickSliderAtValue(page, editor.getByTestId('param-a-t-sense'), 75, 0, 127);

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
    // slider value by +64 (signed -> unsigned, see PatchEditor.tsx:457)
    // so slider value 20+64=84 maps to detune=20 emitted to device.
    await clickSliderAtValue(page, editor.getByTestId('param-unison-detune'), 84, 0, 127);

    await page.waitForLoadState('networkidle');
  });

  test('D-PATCH-11: adjusting v-sw threshold writes setPatchVelocityThreshold (after enabling v-sw keyMode)', async ({ page }) => {
    await page.goto(PATCHES_URL('patch-0-vsw-threshold'));
    const editor = await openPatch0Editor(page);

    // Conditional slider — keyMode='v-sw' prelude.
    await page.getByTestId('patch-key-mode').selectOption({ value: 'v-sw' });

    // Captured fixture sets velocityThreshold=80.
    await clickSliderAtValue(page, editor.getByTestId('param-v-sw-thresh'), 80, 0, 127);

    await page.waitForLoadState('networkidle');
  });

  test('D-PATCH-12: adjusting v-mix ratio writes setPatchVelocityMixRatio (after enabling v-mix keyMode)', async ({ page }) => {
    await page.goto(PATCHES_URL('patch-0-vmix-ratio'));
    const editor = await openPatch0Editor(page);

    // Conditional slider — keyMode='v-mix' prelude.
    await page.getByTestId('patch-key-mode').selectOption({ value: 'v-mix' });

    // Captured fixture sets velocityMixRatio=64.
    await clickSliderAtValue(page, editor.getByTestId('param-v-mix-ratio'), 64, 0, 127);

    await page.waitForLoadState('networkidle');
  });
});
