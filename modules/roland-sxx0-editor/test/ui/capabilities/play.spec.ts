/**
 * Capability specs — Play (multi-mode) (C-PLAY-01..03).
 *
 * See ROLAND-S550-EDITOR-CAPABILITIES.md for the canonical capability
 * statements. Each test is named with its capability ID so a regression
 * traces back to a specific capability the doc declares.
 *
 * Selectors are accessible-first. PlayPage parts are tagged
 *   data-capability="C-PLAY-01"
 * on each part-row container plus the parts grid root, with
 *   aria-label="Part {A..H}"
 * on each row. The MIDI channel and patch selects carry
 *   aria-label="Part {id} MIDI channel" / "Part {id} patch"
 * and data-capability tags ("C-PLAY-02" / "C-PLAY-03") so an a11y-tree
 * accessible query covers them without leaning on the layout-encoding
 * data-testid="part-N-channel" the legacy spec uses.
 *
 * NO data-testids that encode layout position are used in this spec.
 *
 * Capabilities covered:
 *   - C-PLAY-01: User can see all multi-mode parts (8 of A..H)
 *   - C-PLAY-02: User can see each part's MIDI channel
 *   - C-PLAY-03: User can see each part's assigned patch
 *
 * Fixture: `play-init` — captured for `loadPatchBank(0) +
 * requestFunctionParameters()`. Matches the page's mount sequence.
 */
import { test, expect } from '@playwright/test';

const HARNESS_URL =
  '/roland/s330/editor/play?midi=simulated&scenario=play-init';

const PART_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

test.describe('Capabilities — Play (C-PLAY)', () => {
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

  test('C-PLAY-01: all 8 multi-mode parts are listed', async ({ page }) => {
    // Each part row carries data-capability="C-PLAY-01" + aria-label
    // 'Part {A..H}'. Counting all such rows asserts the full multi-mode
    // address space (8 parts) is rendered. The grid container also
    // carries the same data-capability, so we filter by aria-label
    // beginning with 'Part '.
    const rows = page.locator('[data-capability="C-PLAY-01"][aria-label^="Part "]');
    await expect(rows.first()).toBeVisible({ timeout: 5_000 });
    await expect(rows).toHaveCount(8);

    // Each label A..H must be present exactly once.
    for (const label of PART_LABELS) {
      const row = page.locator(
        `[data-capability="C-PLAY-01"][aria-label="Part ${label}"]`,
      );
      await expect(row).toHaveCount(1);
    }
  });

  test('C-PLAY-02: each part shows its MIDI channel', async ({ page }) => {
    // Each part has an accessible MIDI-channel combobox: aria-label =
    // "Part {id} MIDI channel". The select is populated with values 0-15
    // (channels 1-16). The capability is satisfied if every part
    // (A..H) exposes its channel select and a value is readable.
    for (const label of PART_LABELS) {
      const channel = page.getByRole('combobox', {
        name: `Part ${label} MIDI channel`,
        exact: true,
      });
      await expect(channel).toBeVisible({ timeout: 5_000 });

      // Read the current value as a number — every part must surface a
      // valid 0-15 integer (the device's wire format). Not asserting a
      // specific channel because the captured fixture's multi-mode
      // state is not part of the contract.
      const value = await channel.inputValue();
      const parsed = Number.parseInt(value, 10);
      expect(Number.isInteger(parsed)).toBe(true);
      expect(parsed).toBeGreaterThanOrEqual(0);
      expect(parsed).toBeLessThanOrEqual(15);
    }
  });

  test('C-PLAY-03: each part shows its assigned patch', async ({ page }) => {
    // Each part has an accessible Patch combobox: aria-label =
    // "Part {id} patch". The select carries either '-1' (no patch
    // assigned, rendered as '---') or a non-negative patch index.
    for (const label of PART_LABELS) {
      const patch = page.getByRole('combobox', {
        name: `Part ${label} patch`,
        exact: true,
      });
      await expect(patch).toBeVisible({ timeout: 5_000 });
      await expect(patch).toBeEnabled();

      // The select value must be a parseable int; -1 means 'unassigned'
      // (mapped to the '---' option), 0..N is a patch index. Either
      // satisfies "shows assigned patch (or 'none')".
      const value = await patch.inputValue();
      const parsed = Number.parseInt(value, 10);
      expect(Number.isNaN(parsed)).toBe(false);
      expect(parsed).toBeGreaterThanOrEqual(-1);
    }
  });
});
