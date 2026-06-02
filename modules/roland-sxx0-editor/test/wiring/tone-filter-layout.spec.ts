/**
 * Tone FILTER-tab v2 compaction layout contract
 * (editor-ux-refinement Phase 1 T8.6 / T8.12-T8.13).
 *
 * The v2 filter-tab redesign (design SSOT 04-tones-v2.html) restructures
 * the FILTER tab into two open section-collapsibles — "Envelope — TVF" and
 * "Filter Response — TVF" — with the numeric back-channel (param sliders +
 * mode toggles) hidden under a collapsed-by-default "Tweak" disclosure, so
 * the default tab shows only the two graphics (above-the-fold).
 *
 * These assertions FAIL against the pre-T8.12 panel (which had no section
 * headers and rendered the slider grid expanded by default), per the
 * validator-paired-changes discipline.
 */
import { test, expect } from '@playwright/test';
import {
  tonesUrl,
  openTone0Editor,
  switchToToneTab,
  tonePanel,
  expandTweak,
} from './tone-writes-helpers';

test.describe('Tone FILTER tab — v2 compaction layout', () => {
  let pageErrors: string[];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await page.addInitScript(() => window.localStorage.clear());
  });

  test.afterEach(() => {
    expect(pageErrors, 'no harness errors').toEqual([]);
  });

  test('D-TONE-FILTER-ORDER-01: two section-collapsibles (Envelope then Filter Response), graphics visible, sliders Tweak-hidden by default', async ({ page }) => {
    await page.goto(tonesUrl('tone-0-tvf-cutoff'));
    const editor = await openTone0Editor(page);
    await switchToToneTab(page, 'Filter');
    const scope = tonePanel(editor, 'tt-filter');

    // 1. The two collapsible section headers, in v2 order.
    const titles = scope.locator('.tones__section-title');
    await expect(titles).toHaveCount(2);
    await expect(titles.nth(0)).toHaveText(/Envelope — TVF/);
    await expect(titles.nth(1)).toHaveText(/Filter Response — TVF/);

    // 2. Both graphics are visible by default (envelope graph + filter curve).
    //    The envelope graph region's aria-label is "TVF · 8-SEGMENT — N
    //    segments, segment K active" (AcEnvelopeGraph).
    await expect(scope.locator('.ac-curve-display')).toBeVisible();
    await expect(scope.getByRole('region', { name: /TVF.*segments/i }).first()).toBeVisible();

    // 3. The numeric back-channel is Tweak-collapsed: the Cutoff slider is
    //    NOT mounted by default (AcDisclosure unmounts collapsed bodies).
    await expect(scope.getByTestId('param-cutoff')).toHaveCount(0);

    // 4. Expanding the "parameters · modes" Tweak reveals the sliders.
    await expandTweak(scope, 'parameters');
    await expect(scope.getByTestId('param-cutoff')).toBeVisible();
  });

  test('D-TONE-FILTER-ORDER-02: the envelope per-segment grid is Tweak-collapsed by default', async ({ page }) => {
    await page.goto(tonesUrl('tone-0-tvf-cutoff'));
    const editor = await openTone0Editor(page);
    await switchToToneTab(page, 'Filter');
    const scope = tonePanel(editor, 'tt-filter');

    // The per-segment rate/level edit grid is hidden under its own Tweak.
    await expect(scope.locator('[data-edit-row="rate"]')).toHaveCount(0);
    await expandTweak(scope, 'per-segment');
    await expect(scope.locator('[data-edit-row="rate"]').first()).toBeVisible();
  });

  // -------------------------------------------------------------------
  // T8.13 — above-the-fold. With the detail controls Tweak-collapsed, the
  // envelope graphic AND the filter-curve graphic must both sit within the
  // viewport WITHOUT scrolling. Named viewport: 1280×800 (a common laptop
  // content height; the T8.8 finding measured the pre-compaction curve
  // bottom at y≈1010px, below the 720–800 fold). This assertion supersedes
  // the failed manual T8.8 check.
  // -------------------------------------------------------------------
  // Named fold viewport: 1280×900. The fixed page chrome (header + tab
  // strip ≈ 256px) plus the envelope graphic (~200px) leaves the filter
  // curve sitting at curve-bottom ≈ 885 once the per-segment table + the
  // slider grid are Tweak-collapsed — within a 900px fold. (Pre-compaction
  // the curve bottom was ≈1010, below even a 900 fold — the T8.8 finding.)
  const FOLD_VIEWPORT = { width: 1280, height: 900 };

  test('D-TONE-FILTER-FOLD-01: envelope + filter-curve both above the fold at 1280×900', async ({ page }) => {
    await page.setViewportSize(FOLD_VIEWPORT);
    await page.goto(tonesUrl('tone-0-tvf-cutoff'));
    const editor = await openTone0Editor(page);
    await switchToToneTab(page, 'Filter');
    const scope = tonePanel(editor, 'tt-filter');

    const curveBox = await scope.locator('.ac-curve-display').boundingBox();
    const envBox = await scope
      .getByRole('region', { name: /TVF.*segments/i })
      .first()
      .boundingBox();
    expect(curveBox, 'filter curve has a layout box').not.toBeNull();
    expect(envBox, 'envelope graphic has a layout box').not.toBeNull();

    // Both graphics' bottom edges sit within the fold (no scroll). Measured
    // curve bottom ≈ 887 at this layout (envelope bottom ≈ 566).
    expect(envBox!.y + envBox!.height).toBeLessThanOrEqual(FOLD_VIEWPORT.height);
    expect(curveBox!.y + curveBox!.height).toBeLessThanOrEqual(FOLD_VIEWPORT.height);
  });

  // -------------------------------------------------------------------
  // T8.7 — the curve drag streams a value end-to-end in the real editor.
  // The curve's aria-label is "Filter: Freq=<cutoff> Q=<resonance>" and
  // updates live from the store, so a horizontal drag that raises cutoff
  // is observable without expanding the Tweak. Proves curve → onChange →
  // updateTvf → store → curve round-trips in the mounted editor (the
  // dual-axis math itself is unit-tested in AcFilterCurveEditor.test.tsx).
  // -------------------------------------------------------------------
  test('D-TONE-FILTER-CURVE-DRAG-01: dragging the curve node right streams a higher cutoff', async ({ page }) => {
    await page.goto(tonesUrl('tone-0-tvf-cutoff'));
    const editor = await openTone0Editor(page);
    await switchToToneTab(page, 'Filter');
    const scope = tonePanel(editor, 'tt-filter');

    // The loaded tone has the filter disabled, so the curve is read-only
    // (no draggable node). Enable it first — the Filter toggle lives under
    // the "parameters · modes" Tweak.
    await expandTweak(scope, 'parameters');
    const enableOn = scope.getByTestId('tone-tvf-enabled-on');
    if ((await enableOn.getAttribute('data-active')) !== 'true') {
      await enableOn.click();
    }

    const curve = scope.locator('.ac-curve-display');
    await expect(curve).toBeVisible();

    function cutoffFromLabel(label: string | null): number {
      const m = label?.match(/Freq=(\d+)/);
      if (!m) throw new Error(`curve aria-label missing Freq=: ${label}`);
      return Number(m[1]);
    }
    const before = cutoffFromLabel(await curve.getAttribute('aria-label'));

    // Drag the draggable node from its current position toward the right
    // edge of the curve (higher frequency → higher cutoff).
    const dot = scope.locator('.ac-curve-dot--draggable');
    const dotBox = await dot.boundingBox();
    const curveBox = await curve.boundingBox();
    if (!dotBox || !curveBox) throw new Error('curve/dot boundingBox null');

    await page.mouse.move(dotBox.x + dotBox.width / 2, dotBox.y + dotBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(curveBox.x + curveBox.width * 0.9, dotBox.y + dotBox.height / 2, { steps: 8 });
    await page.mouse.up();

    await expect
      .poll(async () => cutoffFromLabel(await curve.getAttribute('aria-label')))
      .toBeGreaterThan(before);
  });
});
