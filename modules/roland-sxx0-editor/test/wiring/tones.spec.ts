/**
 * Capability specs — Tones (C-TONE-01..04).
 *
 * See ROLAND-S550-EDITOR-CAPABILITIES.md for the canonical capability
 * statements. Each test is named with its capability ID so a regression
 * traces back to a specific capability the doc declares.
 *
 * Selectors are accessible-first. The capability suite uses
 *   data-capability="C-TONE-01"
 * on the tone list root and
 *   data-capability="C-TONE-04"
 * on the tone editor root, plus the per-row inner <button> with the
 * accessible name composed of slot label + tone name.
 *
 * NO data-testids that encode layout position (e.g., tone-item-3) are
 * used here. The legacy spec at test/ui/tones.spec.ts continues to use
 * those for now — this file is the parallel capability suite.
 *
 * Capabilities covered:
 *   - C-TONE-01: User can see the list of tones resident in device memory
 *   - C-TONE-02: User can see each tone's name, slot id, and load state
 *   - C-TONE-03: User can identify empty tone slots
 *   - C-TONE-04: User can select a specific tone to view its details
 *
 * Detail affordances covered (Wave 3, #414):
 *   - D-TONE-LIST-05: Click-to-load eyebrow + clickable unloaded slot
 *   - D-TONE-LIST-06: Refresh-all icon-button on the title row (Phase 9
 *     redesign consolidated per-bank reload toolbar into one button)
 *   - D-TONE-LIST-07: Pins the absence of the per-row Export
 *     button. The inline affordance was removed 2026-05-19 because
 *     tone export lives on the tone editor's title row, not on every
 *     list row.
 *
 * Fixture: `tones-bank-0` — captured for `connect() + loadToneRange(0, 8)`.
 * The TonesPage's mount sequence matches the fixture exactly (no patch
 * preload, no spurious fetches), so no error filtering is needed.
 */
import { test, expect } from '@playwright/test';

const HARNESS_URL =
  '/roland/s330/editor/tones?midi=simulated&scenario=tones-bank-0';

test.describe('Capabilities — Tones (C-TONE)', () => {
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
  });

  test.afterEach(() => {
    expect(pageErrors, 'page should not log harness/adapter errors').toEqual([]);
  });

  test('C-TONE-01: renders one entry per tone slot', async ({ page }) => {
    // S-330 has 32 tone slots (T11..T48). The list root carries
    // data-capability="C-TONE-01". The per-slot accessible buttons
    // start with the slot label.
    const list = page.locator('[data-capability="C-TONE-01"]');
    await expect(list).toBeVisible({ timeout: 5_000 });

    const slotButtons = list.getByRole('button', { name: /^T[1-4][1-8]\b/ });
    await expect(slotButtons).toHaveCount(32);
  });

  test('C-TONE-02: each tone entry exposes slot id, name, and load state', async ({ page }) => {
    const list = page.locator('[data-capability="C-TONE-01"]');
    await expect(list).toBeVisible({ timeout: 5_000 });

    // First slot is loaded by the fixture; the accessible name carries
    // both 'T11' (slot id) and the decoded tone name.
    const firstSlot = list.getByRole('button', { name: /^T11\b/ });
    await expect(firstSlot).toBeVisible({ timeout: 5_000 });

    const firstText = await firstSlot.evaluate((el) => el.textContent ?? '');
    expect(firstText).toMatch(/^\s*T11/);
    expect(firstText.trim().length).toBeGreaterThan('T11'.length);

    // Last slot — T48 — is NOT loaded under tones-bank-0 (only bank 0,
    // i.e., T11..T18, was captured). It surfaces the not-loaded state.
    const lastSlot = list.getByRole('button', { name: /^T48\b/ });
    await expect(lastSlot).toBeVisible();
    const lastText = await lastSlot.evaluate((el) => el.textContent ?? '');
    expect(lastText).toMatch(/not loaded|click to load/i);
  });

  test('C-TONE-03: empty slots are distinguishable from loaded ones', async ({ page }) => {
    const list = page.locator('[data-capability="C-TONE-01"]');
    await expect(list).toBeVisible({ timeout: 5_000 });

    const loadedText = await list
      .getByRole('button', { name: /^T11\b/ })
      .evaluate((el) => el.textContent ?? '');
    const unloadedText = await list
      .getByRole('button', { name: /^T48\b/ })
      .evaluate((el) => el.textContent ?? '');

    expect(loadedText.trim()).not.toEqual(unloadedText.trim());
    expect(unloadedText).toMatch(/not loaded|empty|click to load/i);
    expect(loadedText).not.toMatch(/click to load/i);
  });

  test('C-TONE-04: selecting a tone opens its editor surface', async ({ page }) => {
    const list = page.locator('[data-capability="C-TONE-01"]');
    await expect(list).toBeVisible({ timeout: 5_000 });

    // Activate slot T11 — loaded by the fixture.
    await list.getByRole('button', { name: /^T11\b/ }).click();

    // ToneEditor's outer container carries data-capability="C-TONE-04".
    await expect(
      page.locator('[data-capability="C-TONE-04"]'),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('D-TONE-LIST-05: unloaded slots surface a click-to-load affordance', async ({ page }) => {
    const list = page.locator('[data-capability="C-TONE-01"]');
    await expect(list).toBeVisible({ timeout: 5_000 });

    // The tones-bank-0 fixture loads bank 0 (T11..T18). Bank 1+ stays
    // not-loaded; T48 is the last slot in S-330's address space and the
    // C-TONE-02 spec already asserts it surfaces the not-loaded state.
    // The click-to-load contract is the eyebrow + clickable role-button.
    const unloadedSlot = list.getByRole('button', { name: /^T48\b/ });
    await expect(unloadedSlot).toBeVisible();

    const text = await unloadedSlot.evaluate((el) => el.textContent ?? '');
    expect(text).toMatch(/click to load/i);

    // tabIndex / aria-disabled wiring: not actively loading → reachable.
    const ariaDisabled = await unloadedSlot.getAttribute('aria-disabled');
    expect(ariaDisabled === null || ariaDisabled === 'false').toBe(true);
  });

  test('D-TONE-LIST-06: refresh-all icon-button is reachable on the title row', async ({ page }) => {
    // Phase 9 Task 4 consolidated the per-bank reload toolbar into a
    // single icon button on the page-title row. The button's aria-label
    // is 'Refresh all tones from device' (TonesPage.tsx:343). The
    // inventory's older description ("Per-bank force-reload buttons")
    // drifted from reality with the redesign; the consolidated button
    // still realizes the C-TONE-05 capability.
    const refreshButton = page.getByRole('button', {
      name: 'Refresh all tones from device',
    });
    await expect(refreshButton).toBeVisible({ timeout: 5_000 });
    await expect(refreshButton).toBeEnabled();

    // title attr + aria-label agree (TonesPage.tsx:343-344).
    await expect(refreshButton).toHaveAttribute(
      'title',
      'Refresh all tones from device',
    );
  });

  test('D-TONE-LIST-07: per-row export-tone-button is permanently absent', async ({ page }) => {
    // The per-row Export affordance was removed 2026-05-19 — it was a
    // vestige from before the library page existed. Tone export now
    // lives only on the tone editor's title row (ToneEditorHead).
    // This test pins the absence: a regression that reintroduces an
    // inline per-row Export button trips this assertion.
    const list = page.locator('[data-capability="C-TONE-01"]');
    await expect(list).toBeVisible({ timeout: 5_000 });

    const anyExportButton = list.locator(
      'button[data-testid="export-tone-button"]',
    );
    await expect(anyExportButton).toHaveCount(0);
  });
});
