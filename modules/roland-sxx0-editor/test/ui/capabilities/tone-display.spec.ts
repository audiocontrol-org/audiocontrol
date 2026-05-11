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
 * Fixture: `tones-bank-0` — the same fixture capabilities/tones.spec.ts
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

    // TonePitchPanel.tsx:30-38 mounts a ParameterSlider with
    // `disabled` set. ParameterSlider renders a Radix Slider.Root +
    // a label. The "Transpose" label is what the user sees;
    // assert the slider role itself is present + has the disabled
    // attribute (data-disabled='' on Radix's root when disabled=true).
    await expect(
      page.getByText('Transpose', { exact: true }),
    ).toBeVisible({ timeout: 5_000 });

    // ParameterSlider exposes a single slider role per field. The
    // Transpose slider is the first slider inside the Pitch panel.
    const pitchPanel = page.locator('[data-tab="tt-pitch"]');
    const transposeSlider = pitchPanel.getByRole('slider').first();
    await expect(transposeSlider).toBeVisible();

    // Radix Slider sets `aria-disabled="true"` (or data-disabled='')
    // when disabled. The contract: the user cannot interact.
    const ariaDisabled = await transposeSlider.getAttribute('aria-disabled');
    const dataDisabled = await transposeSlider.getAttribute('data-disabled');
    expect(ariaDisabled === 'true' || dataDisabled !== null).toBe(true);
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

  test('D-TONE-ENV-01: TVF envelope SVG visualization renders inside the Filter tab', async ({ page }) => {
    // EnvelopeEditor mounts a div with aria-label "${label} envelope"
    // (EnvelopeEditor.tsx:478) wrapping the SVG. The Filter tab
    // exposes the TVF envelope; the label is 'TVF' or similar
    // depending on the panel's prop value. ToneFilterPanel mounts
    // the envelope component for tvf.
    await page.getByRole('tab', { name: 'Filter' }).click();

    const filterPanel = page.locator('[data-tab="tt-filter"]');
    // Find the envelope wrapper by partial aria-label match —
    // 'TVF' / 'Filter' / 'TVF Envelope' depending on caller.
    // We assert at least one element with aria-label containing
    // 'envelope' (case-insensitive) exists inside the panel.
    const tvfEnv = filterPanel
      .locator('[aria-label$="envelope" i]')
      .first();
    await expect(tvfEnv).toBeVisible({ timeout: 5_000 });

    // The SVG itself is a child of the envelope wrapper.
    await expect(tvfEnv.locator('svg').first()).toBeVisible();
  });

  test('D-TONE-ENV-06: TVF envelope fullscreen expand button is reachable', async ({ page }) => {
    // EnvelopeEditor.tsx:94-99 renders an absolute-positioned button
    // with title="Expand envelope editor" inside the envelope card.
    await page.getByRole('tab', { name: 'Filter' }).click();

    const filterPanel = page.locator('[data-tab="tt-filter"]');
    const expandButton = filterPanel
      .getByRole('button', { name: 'Expand envelope editor' })
      .first();
    await expect(expandButton).toBeVisible({ timeout: 5_000 });
    await expect(expandButton).toBeEnabled();
  });

  test('D-TONE-ENV-07: TVA envelope SVG visualization renders inside the Amp tab', async ({ page }) => {
    // Same component (EnvelopeEditor) reused for the TVA envelope
    // inside the Amp panel.
    await page.getByRole('tab', { name: 'Amp' }).click();

    const ampPanel = page.locator('[data-tab="tt-amp"]');
    const tvaEnv = ampPanel
      .locator('[aria-label$="envelope" i]')
      .first();
    await expect(tvaEnv).toBeVisible({ timeout: 5_000 });
    await expect(tvaEnv.locator('svg').first()).toBeVisible();
  });

  test('D-TONE-ENV-12: TVA envelope fullscreen expand button is reachable', async ({ page }) => {
    await page.getByRole('tab', { name: 'Amp' }).click();

    const ampPanel = page.locator('[data-tab="tt-amp"]');
    const expandButton = ampPanel
      .getByRole('button', { name: 'Expand envelope editor' })
      .first();
    await expect(expandButton).toBeVisible({ timeout: 5_000 });
    await expect(expandButton).toBeEnabled();
  });
});
