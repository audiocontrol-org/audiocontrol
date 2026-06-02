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
import { expandTweak } from './tone-writes-helpers';

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
    // Pitch + LFO are now merged into the "Pitch & LFO" tab. The
    // Transpose row still renders via ParamSliderRow inside that tab
    // and remains disabled until the device-side transpose contract is
    // wired (the `disabled` prop on the row passes through to the
    // editable AcNumberInput).
    await page.getByRole('tab', { name: 'Pitch & LFO' }).click();

    await expect(
      page.getByText('Transpose', { exact: true }),
    ).toBeVisible({ timeout: 5_000 });

    const panel = page.locator('[data-tab="tt-pitch-lfo"]');
    const transposeWrapper = panel.getByTestId('param-transpose');
    await expect(transposeWrapper).toBeVisible();
    const transposeInput = transposeWrapper
      .locator('input[type="number"]')
      .first();
    await expect(transposeInput).toBeDisabled();
  });

  test('D-TONE-LFO-05: LFO Mode is an interactive Normal/One-Shot toggle', async ({ page }) => {
    // LFO Mode is now an AcToggle with two options (normal / one-shot).
    // The previous display-only label/value was tagged "remediate to a
    // real control or remove"; this spec asserts the remediation. The
    // tab is now combined "Pitch & LFO".
    await page.getByRole('tab', { name: 'Pitch & LFO' }).click();

    const panel = page.locator('[data-tab="tt-pitch-lfo"]');
    // Both option labels are reachable inside the panel.
    await expect(panel.getByTestId('tone-lfo-mode-normal')).toBeVisible({
      timeout: 5_000,
    });
    await expect(panel.getByTestId('tone-lfo-mode-one-shot')).toBeVisible();

    // Exactly one option is marked active at any time.
    const normalActive = await panel
      .getByTestId('tone-lfo-mode-normal')
      .getAttribute('data-active');
    const oneShotActive = await panel
      .getByTestId('tone-lfo-mode-one-shot')
      .getAttribute('data-active');
    const total = (normalActive === 'true' ? 1 : 0) + (oneShotActive === 'true' ? 1 : 0);
    expect(total).toBe(1);
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

  test('D-TONE-ENV-06: TVF envelope per-segment editor is reachable under the Tweak (Filter tab)', async ({ page }) => {
    // v2 filter-tab compaction (T8.11): the per-segment numeric editor (the
    // inline rate/level edit grid) is collapsed under the envelope's
    // "per-segment values" Tweak so the graphic stays compact and the
    // filter curve sits above-the-fold. AcEnvelope's own display table is
    // suppressed (showTable=false). The editor remains reachable by
    // expanding the Tweak.
    await page.getByRole('tab', { name: 'Filter' }).click();

    const filterPanel = page.locator('[data-tab="tt-filter"]');
    await expect(filterPanel.locator('[data-edit-row="rate"]')).toHaveCount(0);
    await expandTweak(filterPanel, 'per-segment');
    await expect(filterPanel.locator('[data-edit-row="rate"]').first()).toBeVisible();
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

  test('D-TONE-ENV-12: TVA envelope per-segment editor is reachable under the Tweak (Amp tab)', async ({ page }) => {
    // Same v2 compaction applies to the TVA envelope (shared
    // ToneEnvelopeEditor): the per-segment editor is Tweak-collapsed.
    await page.getByRole('tab', { name: 'Amp' }).click();

    const ampPanel = page.locator('[data-tab="tt-amp"]');
    await expect(ampPanel.locator('[data-edit-row="rate"]')).toHaveCount(0);
    await expandTweak(ampPanel, 'per-segment');
    await expect(ampPanel.locator('[data-edit-row="rate"]').first()).toBeVisible();
  });
});
