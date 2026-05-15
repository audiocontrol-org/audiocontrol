/**
 * Capability specs — Tone display affordances (D-TONE-WAVE-03,
 * D-TONE-PITCH-01, D-TONE-LFO-05, D-TONE-ENV-01, 06, 07, 12).
 *
 * See ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md for the canonical
 * statements. This spec covers display-only or visible-but-disabled
 * affordances inside the ToneEditor — fields the editor shows without
 * (yet) driving, plus the envelope's visual SVG + fullscreen-expand
 * affordance which is purely a presentation concern.
 *
 * Affordances covered:
 *   - D-TONE-WAVE-03: Sample Rate (display only — no select control).
 *   - D-TONE-PITCH-01: Transpose slider visible-but-disabled.
 *   - D-TONE-LFO-05: LFO Mode (display only — no edit control).
 *   - D-TONE-ENV-01: TVF envelope draggable SVG visualization
 *     (presence + aria-label).
 *   - D-TONE-ENV-06: TVF envelope fullscreen expand button.
 *   - D-TONE-ENV-07: TVA envelope draggable SVG visualization
 *     (presence + aria-label).
 *   - D-TONE-ENV-12: TVA envelope fullscreen expand button.
 *
 * Fixture: `tones-bank-0` — the same fixture wiring/tones.spec.ts
 * uses. TonesPage's mount sequence consumes it cleanly; no divergence
 * filter required.
 */
import { test, expect } from '@playwright/test';

const HARNESS_URL =
  '/roland/s330/editor/tones?midi=simulated&scenario=tones-bank-0';

test.describe('Capabilities — Tone display (D-TONE)', () => {
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

    // Mount the ToneEditor by clicking T11 (slot 0).
    const firstSlot = page.getByTestId('tone-item-0');
    await expect(firstSlot).toBeVisible({ timeout: 5_000 });
    await firstSlot.click();
    await expect(
      page.locator('[data-capability="C-TONE-04"]'),
    ).toBeVisible({ timeout: 5_000 });
  });

  test.afterEach(() => {
    expect(pageErrors, 'page should not log harness/adapter errors').toEqual([]);
  });

  test('D-TONE-WAVE-03: Sample Rate renders as a read-only label/value pair', async ({ page }) => {
    // ToneWavePanel.tsx:71-76 renders the field as
    //   <label>Sample Rate</label>
    //   <div>{tone.sampleRate}</div>
    // No <select> or <input> for editing — the value is read-only.
    // The captured tone in T0 carries '15kHz' or '30kHz'; we assert
    // one of those two strings appears next to the label.
    await expect(
      page.getByText('Sample Rate', { exact: true }),
    ).toBeVisible({ timeout: 5_000 });

    const sampleRateBlock = page
      .getByText('Sample Rate', { exact: true })
      .locator('xpath=ancestor::div[1]');
    // No select inside the block — the field is read-only.
    await expect(sampleRateBlock.locator('select')).toHaveCount(0);

    // The value text matches one of the two valid sample rates.
    const text = await sampleRateBlock.textContent();
    expect(text).toMatch(/Sample Rate\s*(?:15|30)kHz/);
  });

  test('D-TONE-PITCH-01: Transpose slider is visible but disabled', async ({ page }) => {
    // The Pitch tab is not active by default — switch to it. The
    // ToneEditorTabs use CSS-only radio tabs (TonesEditor.tsx); the
    // helper in tone-writes-helpers.ts clicks the label by role 'tab'.
    await page.getByRole('tab', { name: 'Pitch' }).click();

    // Phase 9 Task 4 TonesPage amend: TonePitchPanel.tsx now renders
    // the Transpose row via ParamSliderRow (AcSlider + AcNumberInput
    // editable). The "Transpose" label is visible; the focusable
    // affordance is the AcNumberInput's `<input type="number">`. The
    // disabled-on-keyboard contract is enforced by the input's
    // `disabled` attribute (HTML, not Radix). Assert the input under
    // the param-transpose wrapper is disabled.
    await expect(
      page.getByText('Transpose', { exact: true }),
    ).toBeVisible({ timeout: 5_000 });

    const pitchPanel = page.locator('[data-tab="tt-pitch"]');
    const transposeWrapper = pitchPanel.getByTestId('param-transpose');
    await expect(transposeWrapper).toBeVisible();
    const transposeInput = transposeWrapper
      .locator('input[type="number"]')
      .first();
    await expect(transposeInput).toBeDisabled();
  });

  test('D-TONE-LFO-05: LFO Mode renders as a read-only label/value pair', async ({ page }) => {
    // Switch to the LFO tab — ToneLfoPanel.tsx:53-58 renders the
    // field as a <label> + <div>{tone.lfo.mode}</div>. No edit control.
    await page.getByRole('tab', { name: 'LFO' }).click();

    const lfoPanel = page.locator('[data-tab="tt-lfo"]');
    await expect(lfoPanel.getByText('Mode', { exact: true })).toBeVisible({
      timeout: 5_000,
    });

    const modeBlock = lfoPanel
      .getByText('Mode', { exact: true })
      .locator('xpath=ancestor::div[1]');
    // No select / input inside the block — read-only.
    await expect(modeBlock.locator('select')).toHaveCount(0);
    await expect(modeBlock.locator('input')).toHaveCount(0);

    // The mode is one of the SamplerTone['lfo']['mode'] values.
    // The captured tone surfaces the device's actual value; the
    // assertion is that some non-empty string follows 'Mode'.
    const text = await modeBlock.textContent();
    expect(text).toMatch(/Mode\s*\S+/i);
  });

  test('D-TONE-ENV-01: TVF envelope graphic renders inside the Filter tab', async ({ page }) => {
    // Phase 9 Task 4 TonesPage amend: ToneEnvelopeEditor composes the
    // v3 `AcEnvelope` (editor-core), whose graph region carries
    // role="region" + aria-label like "TVF · 8-SEGMENT — N segments,
    // segment K active". The SVG-based VFD-glow path lives inside
    // that region.
    await page.getByRole('tab', { name: 'Filter' }).click();

    const filterPanel = page.locator('[data-tab="tt-filter"]');
    const tvfEnv = filterPanel
      .getByRole('region', { name: /TVF.*segments/i })
      .first();
    await expect(tvfEnv).toBeVisible({ timeout: 5_000 });
    // The VFD-glow SVG path is rendered inside the envelope graph.
    await expect(tvfEnv.locator('svg').first()).toBeVisible();
  });

  test('D-TONE-ENV-06: TVF envelope segment table is reachable inside the Filter tab', async ({ page }) => {
    // The legacy `Expand envelope editor` button belonged to the old
    // EnvelopeEditor. The v3 AcEnvelope replaces it with an inline
    // segment-selection table (the segment buttons live inside the
    // envelope's table portion, role="table") plus the inline edit
    // grid for per-segment rate/level. The display affordance asserted
    // here is the segment table presence.
    await page.getByRole('tab', { name: 'Filter' }).click();

    const filterPanel = page.locator('[data-tab="tt-filter"]');
    const segmentTable = filterPanel
      .getByRole('table', { name: /Envelope segments/i })
      .first();
    await expect(segmentTable).toBeVisible({ timeout: 5_000 });
  });

  test('D-TONE-ENV-07: TVA envelope graphic renders inside the Amp tab', async ({ page }) => {
    // Same AcEnvelope composition reused for the TVA envelope inside
    // the Amp panel; label prefix is "TVA".
    await page.getByRole('tab', { name: 'Amp' }).click();

    const ampPanel = page.locator('[data-tab="tt-amp"]');
    const tvaEnv = ampPanel
      .getByRole('region', { name: /TVA.*segments/i })
      .first();
    await expect(tvaEnv).toBeVisible({ timeout: 5_000 });
    await expect(tvaEnv.locator('svg').first()).toBeVisible();
  });

  test('D-TONE-ENV-12: TVA envelope segment table is reachable inside the Amp tab', async ({ page }) => {
    await page.getByRole('tab', { name: 'Amp' }).click();

    const ampPanel = page.locator('[data-tab="tt-amp"]');
    const segmentTable = ampPanel
      .getByRole('table', { name: /Envelope segments/i })
      .first();
    await expect(segmentTable).toBeVisible({ timeout: 5_000 });
  });
});
