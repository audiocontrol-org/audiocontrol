/**
 * Tab active-indicator contract — the highlight must track the SELECTED tab
 * (editor-ux-refinement Phase 0, T0.1).
 *
 * Bug (found 2026-06-02): the radio-driven `AcRadioTabs` (shared by the
 * Tones + Patches editors) drove its active-tab highlight purely off the
 * uncontrolled `<input defaultChecked>` `:checked` paint. After switching
 * to a non-default tab the correct PANEL showed, but the active highlight
 * could stale-paint to the default first tab. The labels carried
 * `role="tab"` with NO `aria-selected`, so there was no controlled signal
 * pinning which tab is active.
 *
 * These assertions are the indicator-tracks-selection contract:
 *   - exactly one `role="tab"` reports `aria-selected="true"`, and it is the
 *     tab the user switched to (NOT the default first tab);
 *   - the selected tab's rendered label color is the accent; the default
 *     tab's is not.
 *
 * They FAIL against `6fe066a6` (no `aria-selected` exists → no tab is
 * "selected" in the ARIA sense) per the validator-paired-changes discipline.
 */
import { test, expect, type Locator } from '@playwright/test';
import { tonesUrl, openTone0Editor, switchToToneTab } from './tone-writes-helpers';

// The inactive tab label color (`--ac-color-text-muted`). The active tab
// transitions to the accent; asserting "left the inactive slate" is robust
// against the exact accent value AND the color-transition mid-flight (a
// hardcoded accent rgb races the `transition: color` and reads a blend).
const INACTIVE = 'rgb(148, 163, 184)';

function labelColor(tab: Locator): Promise<string> {
  return tab.evaluate((el) => getComputedStyle(el).color);
}

test.describe('Tab active-indicator tracks the selected tab (D-TAB-INDICATOR-01)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
  });

  test('D-TAB-INDICATOR-01a: Tones — switching to Filter moves the active indicator off Wave', async ({ page }) => {
    await page.goto(tonesUrl('tone-0-tvf-cutoff'));
    const editor = await openTone0Editor(page);
    await switchToToneTab(page, 'Filter');

    // Exactly one selected tab, and it's Filter (not the default Wave).
    const selected = editor.getByRole('tab', { selected: true });
    await expect(selected).toHaveCount(1);
    await expect(selected).toHaveText('Filter');
    await expect(editor.getByRole('tab', { name: 'Wave' })).toHaveAttribute('aria-selected', 'false');

    // Visual: the selected tab leaves the inactive slate (becomes accent);
    // the default tab settles back to the inactive slate.
    await expect.poll(() => labelColor(editor.getByRole('tab', { name: 'Filter' }))).not.toBe(INACTIVE);
    await expect.poll(() => labelColor(editor.getByRole('tab', { name: 'Wave' }))).toBe(INACTIVE);
  });

  test('D-TAB-INDICATOR-01b: Patches — switching to Mapping moves the active indicator off Common', async ({ page }) => {
    await page.goto('/roland/s330/editor/patches?midi=simulated&scenario=patches-bank-0');

    const list = page.locator('[data-capability="C-PATCH-01"]');
    await expect(list).toBeVisible({ timeout: 5_000 });
    await list.getByRole('button', { name: /^P11/ }).click();

    const editor = page.locator('[data-capability="C-PATCH-04"]');
    await expect(editor).toBeVisible({ timeout: 5_000 });

    await editor.getByRole('tab', { name: 'Mapping' }).click();
    await expect(editor.locator('[data-tab="pt-mapping"]')).toBeVisible();

    const selected = editor.getByRole('tab', { selected: true });
    await expect(selected).toHaveCount(1);
    await expect(selected).toHaveText('Mapping');
    await expect(editor.getByRole('tab', { name: 'Common' })).toHaveAttribute('aria-selected', 'false');

    await expect.poll(() => labelColor(editor.getByRole('tab', { name: 'Mapping' }))).not.toBe(INACTIVE);
    await expect.poll(() => labelColor(editor.getByRole('tab', { name: 'Common' }))).toBe(INACTIVE);
  });
});
