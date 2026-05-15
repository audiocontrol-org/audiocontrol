/**
 * Capability specs — Patches (C-PATCH-01..04).
 *
 * See ROLAND-S550-EDITOR-CAPABILITIES.md for the canonical capability
 * statements. Each test is named with its capability ID so a regression
 * traces back to a specific capability the doc declares.
 *
 * Selectors are accessible-first. The capability suite uses
 *   data-capability="C-PATCH-01"
 * on the patch list root and
 *   data-capability="C-PATCH-04"
 * on the patch editor root, plus the per-row role="button" with the
 * accessible name composed of slot label + patch name.
 *
 * NO data-testids that encode layout position (e.g., patch-item-3) are
 * used here. The legacy spec at test/ui/patches.spec.ts continues to use
 * those for now — this file is the parallel capability suite.
 *
 * Capabilities covered:
 *   - C-PATCH-01: User can see the list of patches resident in device memory
 *   - C-PATCH-02: User can see each patch's name, slot identifier, and load state
 *   - C-PATCH-03: User can identify empty patch slots
 *   - C-PATCH-04: User can select a specific patch to view its details
 *
 * Detail affordances covered (Wave 3, #414):
 *   - D-PATCH-LIST-05: Click-to-load eyebrow + clickable unloaded slot
 *   - D-PATCH-LIST-06: Refresh-all icon-button on the title row (Phase 9
 *     redesign collapsed per-bank reload toolbar into one button)
 *   - D-PATCH-LIST-07: Same refresh-all icon-button covers the prior
 *     "Load All" affordance after the same redesign
 *   - D-PATCH-LIST-08: Per-row Export button on loaded non-empty slots
 *
 * Fixture: `patches-bank-0` — captured for `connect() + loadPatchRange(0, 8)`.
 * The PatchesPage's mount sequence then tries `loadToneBank(0)` which is NOT
 * recorded in this fixture (intentionally narrowed). The SimulatedAdapter
 * surfaces that mismatch as the same divergence shape the legacy spec
 * filters; we filter it here for the same reason and only here. Tracked as
 * github.com/audiocontrol-org/audiocontrol/issues/405.
 */
import { test, expect } from '@playwright/test';

const HARNESS_URL =
  '/roland/s330/editor/patches?midi=simulated&scenario=patches-bank-0';

// Same divergence filter as wiring/patch-writes.spec.ts. The
// SimulatedAdapter's SimulatedAdapterUnexpectedSendError reports
// "first diff at byte 6: expected 0x00, got 0x03" — byte 6 in the
// S-series RQD/WSD frame is the area-selector (0x00 = patch area,
// 0x03 = tone area). The PatchesPage's loadToneBank(0) preload emits
// tone RQDs that don't appear in this patch-only fixture, producing
// exactly this byte-6 area-selector mismatch. A real regression in the
// patches path will not match this narrow signature and will fail the
// test.
const KNOWN_TONE_LOAD_DIVERGENCE =
  /SimulatedAdapter[\s\S]*first diff at byte 6:\s*expected 0x00,\s*got 0x03/;
const S330_TONE_LOAD_ERROR = /\[S330Client\] Error loading tone \d+/;

function isKnownTonePreloadDiagnostic(text: string): boolean {
  return KNOWN_TONE_LOAD_DIVERGENCE.test(text) || S330_TONE_LOAD_ERROR.test(text);
}

test.describe('Capabilities — Patches (C-PATCH)', () => {
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
  });

  test.afterEach(() => {
    expect(
      pageErrors,
      'unexpected pageerror beyond the known PatchesPage tone-preload divergence (issue #405)',
    ).toEqual([]);
  });

  test('C-PATCH-01: renders one entry per patch slot', async ({ page }) => {
    // S-330 has 16 patch slots (totalPatches in configs/s330.ts). The list
    // root carries data-capability="C-PATCH-01". Within it, each slot is
    // a div with role="button" whose accessible name composes the slot
    // label + name (or load state). Counting the buttons inside the
    // capability-tagged region asserts the full address space is rendered.
    const list = page.locator('[data-capability="C-PATCH-01"]');
    await expect(list).toBeVisible({ timeout: 5_000 });

    const slots = list.getByRole('button');
    // The Export per-row buttons inside each slot are also role="button",
    // so we filter by the slot-label-prefixed accessible name. P11..P28
    // covers the S-330 16-slot address space.
    const slotButtons = list.getByRole('button', { name: /^P[12][1-8]\b/ });
    await expect(slotButtons).toHaveCount(16);

    // Belt-and-braces: the list has at least 16 role=button descendants.
    // (Each row's optional Export button only renders for loaded+nonempty
    // slots, so the lower bound is slotButtons + zero exports.)
    expect(await slots.count()).toBeGreaterThanOrEqual(16);
  });

  test('C-PATCH-02: each patch entry exposes slot id, name, and load state', async ({ page }) => {
    const list = page.locator('[data-capability="C-PATCH-01"]');
    await expect(list).toBeVisible({ timeout: 5_000 });

    // First slot — the patches-bank-0 fixture loads it from the device.
    // The slot identifier 'P11' is part of the accessible name; the patch
    // name follows it. The accessible name is derived from text content
    // since the list-item is role="button".
    const firstSlot = list.getByRole('button', { name: /^P11\b/ });
    await expect(firstSlot).toBeVisible({ timeout: 5_000 });

    // The accessible name must contain BOTH the slot id AND something
    // beyond the slot id. For a loaded slot the trailing text is the
    // decoded name; for an empty slot it's '(empty)'. Either is the
    // load-state surface required by the capability.
    const nameAttr = await firstSlot.evaluate((el) => el.textContent ?? '');
    expect(nameAttr).toMatch(/^\s*P11/);
    expect(nameAttr.trim().length).toBeGreaterThan('P11'.length);

    // Last slot in S-330 address space — P28. Bank 1 is NOT loaded under
    // patches-bank-0, so this slot is in the not-loaded state. Its
    // accessible name surfaces the not-loaded state.
    const lastSlot = list.getByRole('button', { name: /^P28\b/ });
    await expect(lastSlot).toBeVisible();
    const lastText = await lastSlot.evaluate((el) => el.textContent ?? '');
    expect(lastText).toMatch(/not loaded|click to load/i);
  });

  test('C-PATCH-03: empty slots are distinguishable from loaded ones', async ({ page }) => {
    const list = page.locator('[data-capability="C-PATCH-01"]');
    await expect(list).toBeVisible({ timeout: 5_000 });

    // Bank-0 patch P11 is loaded and named (per the fixture-decoded
    // device data); bank-1 patch P28 is not loaded. The two slots'
    // visible text MUST differ in shape: a loaded slot carries the
    // decoded name; an unloaded slot carries '(not loaded)' or
    // '(empty)' or the click-to-load hint.
    const loadedText = await list
      .getByRole('button', { name: /^P11\b/ })
      .evaluate((el) => el.textContent ?? '');
    const unloadedText = await list
      .getByRole('button', { name: /^P28\b/ })
      .evaluate((el) => el.textContent ?? '');

    expect(loadedText.trim()).not.toEqual(unloadedText.trim());
    expect(unloadedText).toMatch(/not loaded|empty|click to load/i);
    expect(loadedText).not.toMatch(/click to load/i);
  });

  test('C-PATCH-04: selecting a patch opens its editor surface', async ({ page }) => {
    const list = page.locator('[data-capability="C-PATCH-01"]');
    await expect(list).toBeVisible({ timeout: 5_000 });

    // Initially no patch is selected — the placeholder copy is visible.
    await expect(page.getByText('Select a patch to edit')).toBeVisible();

    // Activate slot P11 (loaded by the fixture).
    await list.getByRole('button', { name: /^P11\b/ }).click();

    // The placeholder disappears and the patch editor surface mounts.
    // PatchEditor's outer container carries data-capability="C-PATCH-04".
    await expect(page.getByText('Select a patch to edit')).toHaveCount(0);
    await expect(
      page.locator('[data-capability="C-PATCH-04"]'),
    ).toBeVisible();
  });

  test('D-PATCH-LIST-05: unloaded slots surface a click-to-load affordance', async ({ page }) => {
    const list = page.locator('[data-capability="C-PATCH-01"]');
    await expect(list).toBeVisible({ timeout: 5_000 });

    // The patches-bank-0 fixture loads bank 0 (P11..P18). Bank 1 (P21..P28)
    // is not loaded, so each row in bank 1 surfaces the click-to-load
    // eyebrow + remains a focusable role="button" with the slot label as
    // its accessible-name prefix. Slot P28 is the last slot in S-330's
    // 16-slot address space — same slot the C-PATCH-02 spec asserts is
    // in the not-loaded state.
    const unloadedSlot = list.getByRole('button', { name: /^P28\b/ });
    await expect(unloadedSlot).toBeVisible();

    // The row's text content surfaces the click-to-load hint. The hint
    // is rendered as a sibling <span class="patches__list-eyebrow"> next
    // to the placeholder name '(not loaded)'.
    const text = await unloadedSlot.evaluate((el) => el.textContent ?? '');
    expect(text).toMatch(/click to load bank/i);

    // The slot is keyboard-reachable — tabIndex is 0 when the bank
    // isn't actively loading. Asserting reachability via aria-disabled
    // being absent (or false) is the same contract under both
    // `aria-disabled="false"` and unset.
    const ariaDisabled = await unloadedSlot.getAttribute('aria-disabled');
    expect(ariaDisabled === null || ariaDisabled === 'false').toBe(true);
  });

  test('D-PATCH-LIST-06: refresh-all icon-button is reachable on the title row', async ({ page }) => {
    // Phase 9 Task 4 consolidated the per-bank reload toolbar into a
    // single icon button on the page-title row. The button's
    // aria-label is the operational copy 'Refresh all patches from
    // device' (PatchesPage.tsx:251). The inventory's older description
    // ("Per-bank force-reload buttons (dynamic count)") drifted from
    // reality with the redesign; the consolidated affordance still
    // realizes the C-PATCH-05 capability.
    const refreshButton = page.getByRole('button', {
      name: 'Refresh all patches from device',
    });
    await expect(refreshButton).toBeVisible({ timeout: 5_000 });

    // The button is operable while not in mid-load. The fixture's
    // initial mount completes before this test runs (the beforeEach
    // waitForLoadState('networkidle') gates on that), so enabled.
    await expect(refreshButton).toBeEnabled();
  });

  test('D-PATCH-LIST-07: refresh-all icon-button covers the prior "Load All" affordance', async ({ page }) => {
    // After Phase 9 Task 4 the dedicated "Load All" button no longer
    // exists separately — the same title-row icon button refreshes the
    // full address space (PatchesPage.tsx refreshAll, line 139). The
    // affordance the user needs ("load every bank from device in one
    // action") is still present and reachable. This test pins the
    // consolidation so a future redesign that drops the icon button
    // without restoring an equivalent fails loudly.
    const refreshButton = page.getByRole('button', {
      name: 'Refresh all patches from device',
    });
    await expect(refreshButton).toBeVisible({ timeout: 5_000 });

    // Assert the button title attribute matches the aria-label so the
    // tooltip + screen-reader name agree. PatchesPage.tsx:252 sets
    // both to the same string.
    await expect(refreshButton).toHaveAttribute(
      'title',
      'Refresh all patches from device',
    );
  });

  test('D-PATCH-LIST-08: loaded non-empty patches surface a per-row Export button', async ({ page }) => {
    const list = page.locator('[data-capability="C-PATCH-01"]');
    await expect(list).toBeVisible({ timeout: 5_000 });

    // Bank 0 is loaded; slot P11 is the first loaded slot. The Export
    // button is gated on (isLoaded && !isEmpty && onExportPatch) per
    // PatchList.tsx:166. The patches-bank-0 fixture surfaces a
    // non-empty patch in P11 (its accessible name carries decoded text
    // beyond 'P11', asserted in C-PATCH-02), so the Export button
    // renders.
    const firstSlot = list.getByRole('button', { name: /^P11\b/ });
    await expect(firstSlot).toBeVisible();

    // The per-row Export button is a real <button> nested in the
    // role="button" row div (see PatchList.tsx:166 + the explanation
    // comment at L18). Its data-testid is "export-patch-button".
    const exportButton = firstSlot.locator(
      'button[data-testid="export-patch-button"]',
    );
    await expect(exportButton).toBeVisible();
    await expect(exportButton).toHaveText('Export');

    // Unloaded slots MUST NOT carry the Export button — the gate
    // requires `isLoaded`. P28 is unloaded under this fixture.
    const unloadedSlot = list.getByRole('button', { name: /^P28\b/ });
    const exportOnUnloaded = unloadedSlot.locator(
      'button[data-testid="export-patch-button"]',
    );
    await expect(exportOnUnloaded).toHaveCount(0);
  });
});
