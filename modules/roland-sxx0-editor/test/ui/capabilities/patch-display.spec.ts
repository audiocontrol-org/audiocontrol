/**
 * Capability specs — Patch display affordances (D-PATCH-06).
 *
 * See ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md for the canonical
 * statements. This spec covers display-only affordances of the
 * PatchEditor — fields the editor shows but doesn't drive (yet).
 *
 * Affordances covered:
 *   - D-PATCH-06: Octave Shift — display-only pending issue #10.
 *     PatchEditor.tsx:389-403 renders the field as a non-editable
 *     <div> with the formatted value. The test pins the contract:
 *     the field renders, it's NOT a <select> or <input>, and the
 *     visible value follows the +N / -N / 0 format.
 *
 * Fixture: `patches-bank-0` — same fixture the patches spec uses.
 * Tone-load divergence is filtered for the same reason patches.spec.ts
 * filters it (issue #405).
 */
import { test, expect } from '@playwright/test';

const HARNESS_URL =
  '/roland/s330/editor/patches?midi=simulated&scenario=patches-bank-0';

const KNOWN_TONE_LOAD_DIVERGENCE =
  /SimulatedAdapter[\s\S]*first diff at byte 6:\s*expected 0x00,\s*got 0x03/;
const S330_TONE_LOAD_ERROR = /\[S330Client\] Error loading tone \d+/;

function isKnownTonePreloadDiagnostic(text: string): boolean {
  return KNOWN_TONE_LOAD_DIVERGENCE.test(text) || S330_TONE_LOAD_ERROR.test(text);
}

test.describe('Capabilities — Patch display (D-PATCH)', () => {
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
    await page.goto(HARNESS_URL);
    await page.waitForLoadState('networkidle');

    const list = page.locator('[data-capability="C-PATCH-01"]');
    await expect(list).toBeVisible({ timeout: 5_000 });
    await list.getByRole('button', { name: /^P11\b/ }).click();
    await expect(
      page.locator('[data-capability="C-PATCH-04"]'),
    ).toBeVisible({ timeout: 5_000 });
  });

  test.afterEach(() => {
    expect(
      pageErrors,
      'unexpected pageerror beyond the known PatchesPage tone-preload divergence (issue #405)',
    ).toEqual([]);
  });

  test('D-PATCH-06: Octave Shift renders read-only (editing blocked, issue #10)', async ({ page }) => {
    // PatchEditor.tsx:389-403 renders the field as a non-editable
    // <div> inside an opacity-50 container, with the formatted value
    // ("+N" / "-N" / "0"). The affordance under test:
    //   1. The "Oct.Shift" label is visible.
    //   2. The value cell is a <div>, not a <select> or <input> —
    //      so the user cannot click to change it.
    //   3. The visible value matches the expected formatted shape.
    await expect(
      page.getByText('Oct.Shift', { exact: true }),
    ).toBeVisible({ timeout: 5_000 });

    // Scope to the label's parent so the value cell lives next to it.
    const octaveBlock = page
      .getByText('Oct.Shift', { exact: true })
      .locator('xpath=ancestor::div[contains(@class, "opacity-50")][1]');
    await expect(octaveBlock).toBeVisible();

    // The value is rendered inside a <div>, NOT a <select> or <input>.
    // Asserting both negatives pins the read-only contract.
    await expect(octaveBlock.locator('select')).toHaveCount(0);
    await expect(octaveBlock.locator('input')).toHaveCount(0);

    // The visible value matches the +N / -N / 0 format. The captured
    // patch under patches-bank-0 has its octaveShift field set — we
    // assert the format rather than a specific value so a fixture
    // re-capture doesn't break the test.
    const text = await octaveBlock.textContent();
    expect(text).toMatch(/Oct\.Shift\s*[+-]?\d+/);
  });
});
