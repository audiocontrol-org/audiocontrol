/**
 * Tone parameter write-capability specs (D-TONE-{WAVE,PITCH,TVF,TVA,LFO,ENV}).
 *
 * Each test mounts a fixture that captures the TonesPage mount sequence
 * (connect + loadToneRange(0, 8)) plus ONE `sendToneData(0, mutatedTone)`
 * call. The spec drives the UI to emit the same byte sequence. The
 * SimulatedAdapter strict-matches the outbound bytes; absence of
 * pageerror after the interaction = the UI emitted exactly the captured
 * bytes.
 *
 * Whole-structure-write model: unlike PatchEditor (per-field setters),
 * the ToneEditor mutates the local SamplerTone in the Zustand store and
 * re-sends the WHOLE tone on each `onCommit` via
 * `sendToneData(toneIndex, tone)`. Each captured outbound encodes the
 * full tone with ONE field changed. Driving the corresponding UI
 * affordance must produce the exact same encoded tone — which it will,
 * because the mounted fixture's inbound bytes decode to the same
 * starting state, and changing the same field to the same target value
 * yields the same encoded output.
 *
 * URL routing: tests use the `/roland/s550/editor/tones` route. The
 * fixtures were captured with createS550Client, so the editor must use
 * the S-550 client (via the URL device segment) for the encoded bytes
 * to match. Fixture path lives under `s330/` (not `s550/`) because the
 * editor's useMidiStore legacy alias is hardcoded to
 * `getMidiStore('s330')` — same pattern as Wave 2a/2b. See
 * patch-writes.spec.ts header for the long-form explanation.
 *
 * No tone-load divergence filter is needed (unlike patch-writes):
 * TonesPage.loadInitialData calls only `loadToneBank(0)` (→
 * `loadToneRange(0, 8)`); no patch preload, no function-parameters
 * fetch. The fixture matches the page's mount sequence exactly.
 *
 * Tab routing: the ToneEditor uses a CSS-only radio-driven tab shell
 * (Wave · Pitch · Filter · Amp · LFO). All panels exist in the DOM at
 * all times; only the active panel is `display: block`. Tests use
 * `switchToToneTab` to flip tabs before driving non-Wave controls, and
 * `tonePanel(editor, '<tab>').getByTestId('...')` to disambiguate test
 * IDs that collide across tabs (LFO Depth, Key Rate, Vel Rate exist
 * in both TVF and TVA panels).
 *
 * Plumbing — see `tone-writes-helpers.ts` for the helpers
 * (`openTone0Editor`, `switchToToneTab`, `tonePanel`, `clickSliderAtValue`,
 * `fillLabeledNumber`, `fillEnvelopeFirstCell`, `selectLabeled`).
 *
 * Affordances covered (39 total):
 *   Wave (7): D-TONE-WAVE-01, 02, 04..08
 *     (WAVE-03 sample-rate is display-only; 09/10/11 missing UI per #408)
 *   Pitch (4): D-TONE-PITCH-02..05
 *     (PITCH-01 transpose slider disabled per inventory)
 *   TVF (10): D-TONE-TVF-01..10
 *   TVA (5): D-TONE-TVA-01..05
 *     (Prior TVA-06 top-level tvaLfoDepth was an alias of tva.lfoDepth at
 *      the same encoded offset; collapsed in #408 Phase A — TVA-02 now
 *      covers the only TVA LFO depth affordance.)
 *   LFO (5): D-TONE-LFO-01..04, 06
 *     (LFO-05 mode display-only per inventory)
 *   Env (8): D-TONE-ENV-02..05, 08..11
 *     (ENV-01/07 SVG drag and ENV-06/12 fullscreen are not write
 *      affordances)
 */
import { test, expect } from '@playwright/test';
import {
  tonesUrl,
  openTone0Editor,
  switchToToneTab,
  tonePanel,
  fillSliderInput,
  fillLabeledNumber,
  fillEnvelopeFirstCell,
  selectEnvelopePip,
  expectFixtureFullyConsumed,
  type ToneTabName,
} from './tone-writes-helpers';

test.describe('Tone parameter write affordances', () => {
  let pageErrors: string[];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      pageErrors.push(msg.text());
    });
    await page.addInitScript(() => {
      window.localStorage.clear();
    });
  });

  test.afterEach(() => {
    expect(
      pageErrors,
      'no SimulatedAdapter mismatch or harness errors after driving the setter',
    ).toEqual([]);
  });

  // ---------------------------------------------------------------------
  // Wave section (D-TONE-WAVE-01, 02, 04..08) — default tab; no switch.
  // ---------------------------------------------------------------------

  test('D-TONE-WAVE-01: editing tone name writes sendToneData', async ({ page }) => {
    await page.goto(tonesUrl('tone-0-wave-name'));
    await openTone0Editor(page);

    // The tone-name input lives in the editor head; commits on blur.
    const nameInput = page.getByTestId('tone-name-input');
    await expect(nameInput).toBeVisible({ timeout: 2_000 });
    await nameInput.fill('TST_NAME');
    await nameInput.blur();

    await expectFixtureFullyConsumed(page);
  });

  test('D-TONE-WAVE-02: editing original key writes sendToneData', async ({ page }) => {
    await page.goto(tonesUrl('tone-0-wave-original-key'));
    const editor = await openTone0Editor(page);

    // The Original Key number input commits on change. fill() sets the
    // value via JS which fires exactly one React change event for a
    // controlled input. The blur after is defensive. Target is 60 (C4)
    // to match the scenario's mutation (`originalKey: 60`).
    const input = tonePanel(editor, 'tt-wave').getByTestId('tone-original-key');
    await input.fill('60');
    await input.blur();

    await expectFixtureFullyConsumed(page);
  });

  test('D-TONE-WAVE-04: editing loop mode writes sendToneData', async ({ page }) => {
    await page.goto(tonesUrl('tone-0-wave-loop-mode'));
    const editor = await openTone0Editor(page);

    await tonePanel(editor, 'tt-wave')
      .getByTestId('tone-loop-mode')
      .selectOption({ value: 'alternating' });

    await expectFixtureFullyConsumed(page);
  });

  test('D-TONE-WAVE-05: editing output assign writes sendToneData', async ({ page }) => {
    await page.goto(tonesUrl('tone-0-wave-output-assign'));
    const editor = await openTone0Editor(page);

    await tonePanel(editor, 'tt-wave')
      .getByTestId('tone-output')
      .selectOption({ value: '5' });

    await expectFixtureFullyConsumed(page);
  });

  test('D-TONE-WAVE-06: editing wave start point writes sendToneData', async ({ page }) => {
    await page.goto(tonesUrl('tone-0-wave-start-point'));
    const editor = await openTone0Editor(page);

    await fillLabeledNumber(tonePanel(editor, 'tt-wave'), /^Start$/, '1024');

    await expectFixtureFullyConsumed(page);
  });

  test('D-TONE-WAVE-07: editing wave loop point writes sendToneData', async ({ page }) => {
    await page.goto(tonesUrl('tone-0-wave-loop-point'));
    const editor = await openTone0Editor(page);

    await fillLabeledNumber(tonePanel(editor, 'tt-wave'), /^Loop Point$/, '2048');

    await expectFixtureFullyConsumed(page);
  });

  test('D-TONE-WAVE-08: editing wave end point writes sendToneData', async ({ page }) => {
    await page.goto(tonesUrl('tone-0-wave-end-point'));
    const editor = await openTone0Editor(page);

    await fillLabeledNumber(tonePanel(editor, 'tt-wave'), /^End$/, '4096');

    await expectFixtureFullyConsumed(page);
  });

  // ---------------------------------------------------------------------
  // Slider-driven tests — table-driven across the TVF/TVA/LFO panels.
  //
  // Each row covers ONE slider affordance: the captured fixture sets
  // the parameter to `value`; the spec switches to `tab`, scopes by the
  // matching panel, finds the ParameterSlider via its labelToTestId
  // (`testId`), and emits one onValueCommit click at the matching X
  // position. Sliders use [0, 127] for everything except Fine Tune,
  // which is offset: device value `v` ↔ slider position `v + 64` in
  // [0, 127], so the captured fineTune=20 maps to slider position 84.
  // ---------------------------------------------------------------------

  interface SliderTest {
    id: string;
    title: string;
    scenario: string;
    tab: ToneTabName;
    tabId: 'tt-wave' | 'tt-pitch' | 'tt-filter' | 'tt-amp' | 'tt-lfo';
    testId: string;
    value: number;
  }

  const SLIDER_TESTS: SliderTest[] = [
    // Pitch (fine tune is the only slider in Pitch; transpose is disabled)
    { id: 'D-TONE-PITCH-02', title: 'adjusting fine tune writes sendToneData',
      scenario: 'tone-0-pitch-fine-tune', tab: 'Pitch', tabId: 'tt-pitch',
      testId: 'param-fine-tune', value: 20 + 64 },

    // TVF (Filter tab)
    { id: 'D-TONE-TVF-02', title: 'adjusting cutoff writes sendToneData',
      scenario: 'tone-0-tvf-cutoff', tab: 'Filter', tabId: 'tt-filter',
      testId: 'param-cutoff', value: 80 },
    { id: 'D-TONE-TVF-03', title: 'adjusting resonance writes sendToneData',
      scenario: 'tone-0-tvf-resonance', tab: 'Filter', tabId: 'tt-filter',
      testId: 'param-resonance', value: 64 },
    { id: 'D-TONE-TVF-04', title: 'adjusting key follow writes sendToneData',
      scenario: 'tone-0-tvf-key-follow', tab: 'Filter', tabId: 'tt-filter',
      testId: 'param-key-follow', value: 75 },
    // param-lfo-depth, param-key-rate, param-vel-rate collide across
    // TVF and TVA panels — scoping by `tabId` resolves to the correct one.
    { id: 'D-TONE-TVF-05', title: 'adjusting filter LFO depth writes sendToneData',
      scenario: 'tone-0-tvf-lfo-depth', tab: 'Filter', tabId: 'tt-filter',
      testId: 'param-lfo-depth', value: 50 },
    { id: 'D-TONE-TVF-06', title: 'adjusting EG depth writes sendToneData',
      scenario: 'tone-0-tvf-eg-depth', tab: 'Filter', tabId: 'tt-filter',
      testId: 'param-eg-depth', value: 90 },
    { id: 'D-TONE-TVF-07', title: 'adjusting key rate follow writes sendToneData',
      scenario: 'tone-0-tvf-key-rate-follow', tab: 'Filter', tabId: 'tt-filter',
      testId: 'param-key-rate', value: 40 },
    { id: 'D-TONE-TVF-08', title: 'adjusting vel rate follow writes sendToneData',
      scenario: 'tone-0-tvf-vel-rate-follow', tab: 'Filter', tabId: 'tt-filter',
      testId: 'param-vel-rate', value: 60 },

    // TVA (Amp tab)
    { id: 'D-TONE-TVA-01', title: 'adjusting amp level writes sendToneData',
      scenario: 'tone-0-tva-level', tab: 'Amp', tabId: 'tt-amp',
      testId: 'param-level', value: 100 },
    { id: 'D-TONE-TVA-02', title: 'adjusting amp LFO depth writes sendToneData',
      scenario: 'tone-0-tva-lfo-depth', tab: 'Amp', tabId: 'tt-amp',
      testId: 'param-lfo-depth', value: 45 },
    { id: 'D-TONE-TVA-03', title: 'adjusting amp key rate writes sendToneData',
      scenario: 'tone-0-tva-key-rate', tab: 'Amp', tabId: 'tt-amp',
      testId: 'param-key-rate', value: 35 },
    { id: 'D-TONE-TVA-04', title: 'adjusting amp vel rate writes sendToneData',
      scenario: 'tone-0-tva-vel-rate', tab: 'Amp', tabId: 'tt-amp',
      testId: 'param-vel-rate', value: 55 },

    // LFO
    { id: 'D-TONE-LFO-01', title: 'adjusting LFO rate writes sendToneData',
      scenario: 'tone-0-lfo-rate', tab: 'LFO', tabId: 'tt-lfo',
      testId: 'param-rate', value: 70 },
    { id: 'D-TONE-LFO-02', title: 'adjusting LFO delay writes sendToneData',
      scenario: 'tone-0-lfo-delay', tab: 'LFO', tabId: 'tt-lfo',
      testId: 'param-delay', value: 25 },
    { id: 'D-TONE-LFO-03', title: 'adjusting LFO offset writes sendToneData',
      scenario: 'tone-0-lfo-offset', tab: 'LFO', tabId: 'tt-lfo',
      testId: 'param-offset', value: 90 },
  ];

  for (const t of SLIDER_TESTS) {
    test(`${t.id}: ${t.title}`, async ({ page }) => {
      await page.goto(tonesUrl(t.scenario));
      const editor = await openTone0Editor(page);
      await switchToToneTab(page, t.tab);

      await fillSliderInput(
        tonePanel(editor, t.tabId).getByTestId(t.testId),
        t.value,
      );

      await expectFixtureFullyConsumed(page);
    });
  }

  // ---------------------------------------------------------------------
  // Checkbox-driven tests — table-driven. Each one toggles a boolean
  // tone field; the captured fixture mutates `!current`, so a single
  // click flips the field in the same direction.
  //
  // The Pitch / LFO checkboxes that lack data-testids are addressed by
  // their HTML `id` attribute.
  // ---------------------------------------------------------------------

  interface CheckboxTest {
    id: string;
    title: string;
    scenario: string;
    tab: ToneTabName | null;
    tabId: 'tt-wave' | 'tt-pitch' | 'tt-filter' | 'tt-amp' | 'tt-lfo';
    locator: { testId?: string; cssId?: string };
  }

  const CHECKBOX_TESTS: CheckboxTest[] = [
    { id: 'D-TONE-PITCH-03', title: 'toggling pitch follow writes sendToneData',
      scenario: 'tone-0-pitch-follow', tab: 'Pitch', tabId: 'tt-pitch',
      locator: { testId: 'tone-pitch-follow' } },
    { id: 'D-TONE-PITCH-04', title: 'toggling pitch bender writes sendToneData',
      scenario: 'tone-0-pitch-bender-enabled', tab: 'Pitch', tabId: 'tt-pitch',
      locator: { cssId: 'benderEnabled' } },
    { id: 'D-TONE-PITCH-05', title: 'toggling aftertouch writes sendToneData',
      scenario: 'tone-0-pitch-aftertouch-enabled', tab: 'Pitch', tabId: 'tt-pitch',
      locator: { cssId: 'aftertouchEnabled' } },
    { id: 'D-TONE-TVF-01', title: 'toggling filter enable writes sendToneData',
      scenario: 'tone-0-tvf-enabled', tab: 'Filter', tabId: 'tt-filter',
      locator: { testId: 'tone-tvf-enabled' } },
    { id: 'D-TONE-LFO-04', title: 'toggling LFO key sync writes sendToneData',
      scenario: 'tone-0-lfo-sync', tab: 'LFO', tabId: 'tt-lfo',
      locator: { testId: 'tone-lfo-sync' } },
    { id: 'D-TONE-LFO-06', title: 'toggling peak hold (polarity) writes sendToneData',
      scenario: 'tone-0-lfo-polarity', tab: 'LFO', tabId: 'tt-lfo',
      locator: { cssId: 'lfoPolarity' } },
  ];

  for (const t of CHECKBOX_TESTS) {
    test(`${t.id}: ${t.title}`, async ({ page }) => {
      await page.goto(tonesUrl(t.scenario));
      const editor = await openTone0Editor(page);
      if (t.tab) await switchToToneTab(page, t.tab);

      const scope = tonePanel(editor, t.tabId);
      const target = t.locator.testId
        ? scope.getByTestId(t.locator.testId)
        : scope.locator(`#${t.locator.cssId}`);
      await target.click();

      await expectFixtureFullyConsumed(page);
    });
  }

  // ---------------------------------------------------------------------
  // Select-driven tests (EG polarity, level curve, env sustain/end).
  // ---------------------------------------------------------------------

  test('D-TONE-TVF-09: adjusting EG polarity writes sendToneData', async ({ page }) => {
    await page.goto(tonesUrl('tone-0-tvf-eg-polarity'));
    const editor = await openTone0Editor(page);
    await switchToToneTab(page, 'Filter');

    await tonePanel(editor, 'tt-filter')
      .getByTestId('tone-tvf-polarity')
      .selectOption({ value: 'reverse' });

    await expectFixtureFullyConsumed(page);
  });

  test('D-TONE-TVF-10: adjusting filter level curve writes sendToneData', async ({ page }) => {
    await page.goto(tonesUrl('tone-0-tvf-level-curve'));
    const editor = await openTone0Editor(page);
    await switchToToneTab(page, 'Filter');

    await tonePanel(editor, 'tt-filter')
      .getByTestId('tone-tvf-curve')
      .selectOption({ value: '3' });

    await expectFixtureFullyConsumed(page);
  });

  test('D-TONE-TVA-05: adjusting amp level curve writes sendToneData', async ({ page }) => {
    await page.goto(tonesUrl('tone-0-tva-level-curve'));
    const editor = await openTone0Editor(page);
    await switchToToneTab(page, 'Amp');

    await tonePanel(editor, 'tt-amp')
      .getByTestId('tone-tva-curve')
      .selectOption({ value: '4' });

    await expectFixtureFullyConsumed(page);
  });

  // ---------------------------------------------------------------------
  // Envelope section (D-TONE-ENV-02..05, 08..11).
  //
  // TVF envelope lives in the Filter tab (alongside the TVF params per
  // project memory `feedback_tabbed_detail_pane`); TVA envelope lives
  // in the Amp tab. Rate/Level inputs commit on `onBlur`; Sustain/End
  // selects commit on `onChange`. Each envelope has 8 rate inputs and
  // 8 level inputs in a <table> — the fixtures target index 0 (proving
  // the input row works is sufficient for the affordance).
  // ---------------------------------------------------------------------

  interface EnvTest {
    id: string;
    title: string;
    scenario: string;
    tab: ToneTabName;
    tabId: 'tt-filter' | 'tt-amp';
    action: { kind: 'rate' | 'level'; value: string }
      | { kind: 'sustain' | 'end'; value: string };
  }

  const ENV_TESTS: EnvTest[] = [
    { id: 'D-TONE-ENV-02', title: 'editing TVF env rate writes sendToneData',
      scenario: 'tone-0-tvf-env-rate-0', tab: 'Filter', tabId: 'tt-filter',
      action: { kind: 'rate', value: '50' } },
    { id: 'D-TONE-ENV-03', title: 'editing TVF env level writes sendToneData',
      scenario: 'tone-0-tvf-env-level-0', tab: 'Filter', tabId: 'tt-filter',
      action: { kind: 'level', value: '90' } },
    { id: 'D-TONE-ENV-04', title: 'editing TVF env sustain point writes sendToneData',
      scenario: 'tone-0-tvf-env-sustain-point', tab: 'Filter', tabId: 'tt-filter',
      action: { kind: 'sustain', value: '3' } },
    { id: 'D-TONE-ENV-05', title: 'editing TVF env end point writes sendToneData',
      scenario: 'tone-0-tvf-env-end-point', tab: 'Filter', tabId: 'tt-filter',
      action: { kind: 'end', value: '5' } },
    { id: 'D-TONE-ENV-08', title: 'editing TVA env rate writes sendToneData',
      scenario: 'tone-0-tva-env-rate-0', tab: 'Amp', tabId: 'tt-amp',
      action: { kind: 'rate', value: '50' } },
    { id: 'D-TONE-ENV-09', title: 'editing TVA env level writes sendToneData',
      scenario: 'tone-0-tva-env-level-0', tab: 'Amp', tabId: 'tt-amp',
      action: { kind: 'level', value: '90' } },
    { id: 'D-TONE-ENV-10', title: 'editing TVA env sustain point writes sendToneData',
      scenario: 'tone-0-tva-env-sustain-point', tab: 'Amp', tabId: 'tt-amp',
      action: { kind: 'sustain', value: '3' } },
    { id: 'D-TONE-ENV-11', title: 'editing TVA env end point writes sendToneData',
      scenario: 'tone-0-tva-env-end-point', tab: 'Amp', tabId: 'tt-amp',
      action: { kind: 'end', value: '5' } },
  ];

  for (const t of ENV_TESTS) {
    test(`${t.id}: ${t.title}`, async ({ page }) => {
      await page.goto(tonesUrl(t.scenario));
      const editor = await openTone0Editor(page);
      await switchToToneTab(page, t.tab);

      const scope = tonePanel(editor, t.tabId);
      switch (t.action.kind) {
        case 'rate':
          await fillEnvelopeFirstCell(scope, 'Rate', t.action.value);
          break;
        case 'level':
          await fillEnvelopeFirstCell(scope, 'Level', t.action.value);
          break;
        case 'sustain':
          // The fixture captures `sustainPoint` in store-coordinates
          // (0-based). The v3 pip radiogroup is 1-based by display.
          // ToneEnvelopeEditor.handleSustainChange subtracts 1 before
          // writing, so passing pipIndex = stored + 1 reproduces the
          // captured byte sequence.
          await selectEnvelopePip(scope, 'sustain', Number(t.action.value) + 1);
          break;
        case 'end':
          // `endPoint` is already 1-based in the store, and the v3 pip
          // radiogroup is 1-based by display, so the captured value
          // maps directly to pipIndex.
          await selectEnvelopePip(scope, 'end', Number(t.action.value));
          break;
      }

      await expectFixtureFullyConsumed(page);
    });
  }
});
