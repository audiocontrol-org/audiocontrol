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

// Same divergence filter as capabilities/patch-writes.spec.ts. The
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
});
